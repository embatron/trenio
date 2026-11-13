export type AppleClaimInput = {
  iss?: unknown;
  aud?: unknown;
  exp?: unknown;
  sub?: unknown;
};

/** The checks around Apple's signature. `aud` is the bundle id, not the team id. */
export function appleClaimsOk(payload: AppleClaimInput, nowSec: number, audience: string): boolean {
  if (payload.iss !== "https://appleid.apple.com") return false;
  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.includes(audience)) return false;
  if (typeof payload.exp !== "number" || payload.exp <= nowSec) return false;
  return typeof payload.sub === "string" && payload.sub.length >= 8 && payload.sub.length <= 255;
}
