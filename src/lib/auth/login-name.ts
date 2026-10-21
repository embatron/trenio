import { AuthError } from "@/lib/auth/errors";

const NICK_DOMAIN = "nick.trenio.by";

/** Email stays an email. A nick becomes a stable internal address so the same login works later. */
export function resolveAccountLogin(value: string): string {
  const raw = value.trim().toLowerCase();
  if (raw.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || raw.length > 320) {
      throw new AuthError("Введите почту или ник латиницей.", "VALIDATION");
    }
    return raw;
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(raw)) {
    throw new AuthError("Ник: латиница, цифры, точка или дефис, от 3 символов.", "VALIDATION");
  }
  return `${raw}@${NICK_DOMAIN}`;
}

export function displayAccountLogin(email: string): string {
  const suffix = `@${NICK_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}
