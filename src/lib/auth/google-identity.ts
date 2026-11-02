export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
};

const SUB = /^[A-Za-z0-9_-]{1,255}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** First name from Google. A missing name stays the same placeholder as email signup. */
export function googleGivenName(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  const clean = raw.replace(/\s+/g, " ").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 100);
  return clean.length > 0 ? clean : "Пользователь";
}

/** Verified Google identity. Unverified mail and a wrong audience are refused. */
export function readGoogleIdentity(
  claims: Record<string, unknown>,
  clientId: string,
  now = Date.now(),
): GoogleIdentity | null {
  if (claims.iss !== "https://accounts.google.com" && claims.iss !== "accounts.google.com") return null;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(clientId)) return null;
  const exp = typeof claims.exp === "number" ? claims.exp : Number(claims.exp);
  if (!Number.isFinite(exp) || exp * 1000 <= now) return null;
  if (claims.email_verified !== true && claims.email_verified !== "true") return null;
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 320) return null;
  const sub = typeof claims.sub === "string" ? claims.sub.trim() : "";
  if (!SUB.test(sub)) return null;
  const given = typeof claims.given_name === "string" && claims.given_name.trim()
    ? claims.given_name
    : typeof claims.name === "string"
      ? claims.name.split(" ")[0]
      : "";
  return { sub, email, name: googleGivenName(given) };
}
