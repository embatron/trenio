import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit } from "@/auth/rate-limit";
import { AuthError } from "@/lib/auth/errors";
import { cabinetEntryAdmit } from "@/lib/catalog/cabinet-entry-admit";
import { lookEntry, noteEntry } from "@/lib/catalog/cabinet-entry-work";
import { issueDoorSession } from "@/lib/catalog/trainer-door-session";
import { writeLog } from "@/lib/log/logger";

async function limitDenied(request: Request) {
  try {
    const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
    const limit = await consumeRateLimit(`cabinet-entry:${ip}`, 15 * 60_000, 20);
    if (!limit.ok) throw new AuthError("Слишком много попыток. Попробуйте позже.", "RATE_LIMITED");
  } catch (error) {
    if (error instanceof AuthError) throw error;
  }
}

export type SettledCabinetEntry =
  | { kind: "redirect"; href: string; setCookie: string }
  | { kind: "preview" }
  | { kind: "dead" };

/** Signs the owner in for a real document navigation. A preview fetch gets neither a session nor a spent link. */
export async function settleCabinetEntry(code: string, token: string, request: Request): Promise<SettledCabinetEntry> {
  if (request.method === "HEAD") return { kind: "preview" };
  const look = await lookEntry(code, token);
  if (look.state !== "live" || !look.userId || !look.slug) {
    await limitDenied(request);
    noteEntry(look.state, look.slug, look.email);
    return { kind: "dead" };
  }
  const admit = cabinetEntryAdmit({
    userAgent: request.headers.get("user-agent") ?? "",
    ip: clientIpFromHeaders(request.headers.get("x-real-ip")),
    purpose: [request.headers.get("purpose"), request.headers.get("sec-purpose"), request.headers.get("x-purpose")].filter(Boolean).join(" "),
    fetchDest: request.headers.get("sec-fetch-dest") ?? "",
    fetchMode: request.headers.get("sec-fetch-mode") ?? "",
  });
  if (admit === "preview") {
    noteEntry("live", look.slug, look.email);
    return { kind: "preview" };
  }
  const issued = await issueDoorSession(look.userId, {
    ipAddress: clientIpFromHeaders(request.headers.get("x-real-ip")),
    userAgent: request.headers.get("user-agent"),
  });
  void writeLog({
    level: "info",
    domain: "account",
    action: "account.entry",
    outcome: "success",
    message: "Одноразовая ссылка открыла кабинет.",
    subject: look.email,
    actorUserId: look.userId,
    target: look.slug,
  });
  return { kind: "redirect", href: issued.redirectTo, setCookie: issued.setCookie };
}
