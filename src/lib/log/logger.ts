import { clientIpFromHeaders } from "@/auth/request-meta";
import { getDb } from "@/db";
import { appLogs } from "@/db/schema";
import { isAuthError } from "@/lib/auth/errors";
import {
  currentLogThreshold,
  isLogDomain,
  passesLevel,
  type LogDomain,
  type LogLevel,
  type LogOutcome,
} from "@/lib/log/policy";
import { maskPhone, normalizeSubject, redactContext, redactText, safeRoute, safeTarget } from "@/lib/log/redact";

const LOGGED = Symbol.for("trenio.logged");

export type LogEvent = {
  level: LogLevel;
  domain: LogDomain;
  action: string;
  message: string;
  outcome?: LogOutcome | null;
  actorUserId?: string | null;
  subject?: string | null;
  target?: string | null;
  route?: string | null;
  method?: string | null;
  statusCode?: number | null;
  durationMs?: number | null;
  error?: unknown;
  errorCode?: string | null;
  requestId?: string | null;
  context?: Record<string, unknown> | null;
};

type Ambient = {
  requestId: string;
  route: string | null;
  method: string | null;
  ip: string | null;
  userAgent: string | null;
};

let lastPurgeAt = 0;
let persistFailureLogged = false;

type RequestSnapshot = {
  url: string;
  method: string;
  ipHeader: string | null;
  userAgent: string | null;
};

let readRequest: (() => RequestSnapshot | null) | null = null;

/** Registered from the server entry. The client bundle must not import the server request API. */
export function setLogRequestReader(reader: () => RequestSnapshot | null) {
  readRequest = reader;
}

export function markLogged(error: unknown): void {
  if (!error || typeof error !== "object") return;
  try {
    Object.defineProperty(error, LOGGED, { value: true });
  } catch {
    /* frozen */
  }
}

export function wasLogged(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return Boolean((error as { [LOGGED]?: boolean })[LOGGED]);
}

async function ambient(): Promise<Ambient> {
  const requestId = crypto.randomUUID();
  const empty = { requestId, route: null, method: null, ip: null, userAgent: null };
  try {
    const request = readRequest?.() ?? null;
    if (!request) return empty;
    const url = new URL(request.url);
    const ip = clientIpFromHeaders(request.ipHeader);
    return {
      requestId,
      route: safeRoute(url.pathname),
      method: request.method.slice(0, 8),
      ip: ip === "unknown" ? null : ip,
      userAgent: request.userAgent?.slice(0, 300) ?? null,
    };
  } catch {
    return empty;
  }
}

function describeError(error: unknown): { errorName: string | null; errorCode: string | null; stack: string | null } {
  if (isAuthError(error)) {
    return { errorName: "AuthError", errorCode: error.code, stack: null };
  }
  if (error instanceof Error) {
    const code =
      "code" in error && typeof error.code === "string" && error.code.length <= 64 && !/password|token|secret/i.test(error.code)
        ? error.code
        : null;
    return {
      errorName: error.name.slice(0, 120),
      errorCode: code,
      stack: error.stack ? redactText(error.stack, 4000) : null,
    };
  }
  return { errorName: null, errorCode: null, stack: null };
}

function mirror(event: LogEvent, error: unknown): void {
  const line = `[${event.level}][${event.domain}] ${event.action} ${redactText(event.message, 300)}`;
  if (event.level === "error" || event.level === "fatal") console.error(line, error instanceof Error ? error : "");
  else if (event.level === "warn") console.warn(line);
  else if (process.env.NODE_ENV !== "production") console.info(line);
}

export function logCaught(
  domain: LogDomain,
  action: string,
  error: unknown,
  extra?: Partial<Omit<LogEvent, "level" | "domain" | "action" | "error">>,
): void {
  const auth = isAuthError(error);
  const denied = auth && (error.code === "FORBIDDEN" || error.code === "RATE_LIMITED" || error.code === "UNAUTHORIZED" || error.code === "ACCOUNT_SUSPENDED");
  void writeLog({
    level: auth ? "warn" : "error",
    domain,
    action,
    outcome: denied ? "denied" : "failure",
    message: auth ? error.message : error instanceof Error ? error.message : "Сбой.",
    error,
    ...extra,
  });
}

export async function writeLog(event: LogEvent): Promise<void> {
  const domain = isLogDomain(event.domain) ? event.domain : "system";
  const level = event.level;
  if (!passesLevel(level, currentLogThreshold())) return;

  if (event.error) markLogged(event.error);
  mirror(event, event.error);

  const described = describeError(event.error);
  const around = await ambient();
  const context = event.context ? (redactContext(event.context) as Record<string, unknown>) : null;
  const subject = event.subject?.includes("*") ? event.subject.slice(0, 320) : normalizeSubject(event.subject);

  try {
    await getDb()
      .insert(appLogs)
      .values({
        expiresAt: null,
        level,
        domain,
        action: event.action.slice(0, 80),
        outcome: event.outcome ?? null,
        message: redactText(event.message, 500),
        actorUserId: event.actorUserId ?? null,
        subject,
        target: safeTarget(event.target),
        requestId: (event.requestId ?? around.requestId).slice(0, 64),
        route: safeRoute(event.route) ?? around.route,
        httpMethod: event.method?.slice(0, 8) ?? around.method,
        statusCode: event.statusCode ?? null,
        durationMs: event.durationMs ?? null,
        ip: around.ip,
        userAgent: around.userAgent,
        errorName: described.errorName,
        errorCode: event.errorCode ?? described.errorCode,
        stack: described.stack,
        context,
      });
    persistFailureLogged = false;
    void import("@/lib/log/trainer-journal").then(({ keepTrainerJournal }) =>
      keepTrainerJournal({
        level,
        domain,
        action: event.action,
        outcome: event.outcome ?? null,
        message: redactText(event.message, 500),
        actorUserId: event.actorUserId ?? null,
        subject,
        target: safeTarget(event.target),
        context,
      }),
    );
    void maybePurge();
  } catch (error) {
    if (!persistFailureLogged) {
      persistFailureLogged = true;
      console.error("[log] persist failed", error instanceof Error ? error.message : "unknown");
    }
  }
}

async function maybePurge(): Promise<void> {
  const now = Date.now();
  if (now - lastPurgeAt < 60 * 60 * 1000) return;
  lastPurgeAt = now;
  try {
    const { purgeExpiredAccounts } = await import("@/lib/account/delete-account");
    await purgeExpiredAccounts();
  } catch (error) {
    console.error("[log] account purge failed", error instanceof Error ? error.message : "unknown");
  }
}

export { maskPhone };
