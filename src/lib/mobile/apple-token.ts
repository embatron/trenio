import { createRemoteJWKSet, jwtVerify } from "jose";

import { appleClaimsOk } from "@/lib/mobile/apple-claims";

const keys = createRemoteJWKSet(new URL("https://appleid.apple.com/auth/keys"));

export type AppleIdentity = {
  sub: string;
  email: string | null;
};

/** Verifies a Sign in with Apple identity token. A bad token is null. */
export async function verifyAppleIdentity(identityToken: string, audience: string): Promise<AppleIdentity | null> {
  if (!audience || identityToken.length < 20 || identityToken.length > 8192) return null;
  try {
    const { payload } = await jwtVerify(identityToken, keys, {
      issuer: "https://appleid.apple.com",
      audience,
    });
    if (!appleClaimsOk(payload, Math.floor(Date.now() / 1000), audience)) return null;
    const email = typeof payload.email === "string" ? payload.email : null;
    return { sub: String(payload.sub), email };
  } catch {
    return null;
  }
}
