export const LOG_RETENTION_DAYS = 30;

export const LOG_LEVELS = ["debug", "info", "warn", "error", "fatal"] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

export const LOG_DOMAINS = [
  "auth",
  "email",
  "sms",
  "account",
  "form",
  "map",
  "geo",
  "api",
  "system",
  "message",
  "ajax",
  "client",
  "admin",
  "catalog",
] as const;
export type LogDomain = (typeof LOG_DOMAINS)[number];

export const LOG_OUTCOMES = ["success", "failure", "denied", "skipped"] as const;
export type LogOutcome = (typeof LOG_OUTCOMES)[number];

const RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  fatal: 50,
};

export function currentLogThreshold(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw && (LOG_LEVELS as readonly string[]).includes(raw)) return raw as LogLevel;
  return "info";
}

export function passesLevel(level: LogLevel, threshold = currentLogThreshold()): boolean {
  return RANK[level] >= RANK[threshold];
}

export function logExpiresAt(from = new Date()): Date {
  const expires = new Date(from.getTime());
  expires.setUTCDate(expires.getUTCDate() + LOG_RETENTION_DAYS);
  return expires;
}

export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

export function isLogDomain(value: string): value is LogDomain {
  return (LOG_DOMAINS as readonly string[]).includes(value);
}
