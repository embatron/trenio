export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  lastName: string;
  avatarUrl: string | null;
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
  const named = googlePersonName(claims);
  return { sub, email, name: named.name, lastName: named.lastName, avatarUrl: googlePicture(claims.picture) };
}

/** Userinfo fills a name the ID token left blank. A different subject is ignored. */
export function mergeGoogleProfile(
  claims: Record<string, unknown>,
  profile: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!profile || profile.sub !== claims.sub) return claims;
  const next = { ...claims };
  for (const key of ["given_name", "family_name", "name", "picture"] as const) {
    const current = typeof next[key] === "string" ? next[key].trim() : "";
    const incoming = typeof profile[key] === "string" ? profile[key].trim() : "";
    if (!current && incoming) next[key] = incoming;
  }
  return next;
}

function cleanName(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\s+/g, " ").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 100);
}

/** Given name and surname. A single full name is split when Google sends no surname field. */
function googlePersonName(claims: Record<string, unknown>): { name: string; lastName: string } {
  const given = cleanName(claims.given_name);
  let family = cleanName(claims.family_name);
  const full = cleanName(claims.name);
  if (!family && full) {
    if (given && full.startsWith(`${given} `)) family = full.slice(given.length).trim();
    else if (!given) {
      const [first, ...rest] = full.split(" ");
      return { name: googleGivenName(first), lastName: googleFamilyName(rest.join(" ")) };
    }
  }
  return { name: googleGivenName(given || full.split(" ")[0] || ""), lastName: googleFamilyName(family) };
}

function googleFamilyName(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 100);
}

/** Google sends a 96px face. Ask for the same crop at 200px. */
function googlePicture(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("https://")) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const host = url.hostname;
  if (host !== "googleusercontent.com" && !host.endsWith(".googleusercontent.com")) return null;
  return url.href.replace(/=s\d+(-[a-z])?(?=$|[?#])/, "=s200-c");
}
