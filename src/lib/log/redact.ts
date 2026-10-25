const SECRET_KEY =
  /password|passwd|secret|token|otp|authorization|cookie|session|initdata|apikey|api_key|credit|cvv|html|body|text|content|caption|preview|set-cookie/i;

const BEARER = /bearer\s+\S+/gi;
const TOKEN_QUERY = /([?&](?:token|code|password|reset)=)[^&\s]+/gi;

export function redactText(value: string, max: number): string {
  return value.replace(BEARER, "bearer [redacted]").replace(TOKEN_QUERY, "$1[redacted]").slice(0, max);
}

export function safeRoute(route: string | null | undefined): string | null {
  if (!route) return null;
  const path = route.split("?")[0]?.trim() ?? "";
  if (!path) return null;
  return path.slice(0, 300);
}

export function normalizeSubject(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || trimmed.length > 320) return null;
  if (/password|token|bearer|secret/.test(trimmed)) return null;
  return trimmed;
}

export function maskPhone(phone: string | null | undefined): string | null {
  const digits = phone?.replace(/\D/g, "") ?? "";
  if (digits.length < 6 || digits.length > 15) return null;
  return `${digits.slice(0, 3)}${"*".repeat(digits.length - 5)}${digits.slice(-2)}`;
}

export function safeTarget(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 80) return null;
  if (/password|token|bearer|secret|\s/.test(trimmed)) return null;
  return trimmed;
}

export function redactContext(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[depth]";
  if (value == null) return null;
  if (typeof value === "string") return redactText(value, 500);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redactContext(item, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      if (SECRET_KEY.test(key) || key === "code") {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = redactContext(item, depth + 1);
    }
    return out;
  }
  return redactText(String(value), 200);
}

export function isUnsafeClientMessage(message: string): boolean {
  return /password|token=|bearer\s|otp|initdata|cookie/i.test(message);
}
