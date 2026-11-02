import { createPublicKey, createVerify, randomBytes } from "node:crypto";

import { readGoogleIdentity, type GoogleIdentity } from "@/lib/auth/google-identity";

type Jwk = { kid: string; kty: string; n: string; e: string; alg?: string };

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CERTS_URL = "https://www.googleapis.com/oauth2/v3/certs";

let certs: { expiresAt: number; keys: Jwk[] } | null = null;

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
}

export function googleRedirectUri(): string {
  const base = (process.env.APP_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  return `${base}/auth/google/callback`;
}

export function googleAuthUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID?.trim() ?? "");
  url.searchParams.set("redirect_uri", googleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

export function newGoogleState(): string {
  return randomBytes(16).toString("base64url");
}

function decodePart(part: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

async function googleCerts(): Promise<Jwk[]> {
  const now = Date.now();
  if (certs && certs.expiresAt > now) return certs.keys;
  const response = await fetch(CERTS_URL);
  if (!response.ok) throw new Error("google certs");
  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = (body.keys ?? []).filter((key) => key.kty === "RSA" && key.kid && key.n && key.e);
  certs = { expiresAt: now + 60 * 60_000, keys };
  return keys;
}

function signatureMatches(token: string, jwk: Jwk): boolean {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return false;
  const key = createPublicKey({ key: jwk, format: "jwk" });
  const verify = createVerify("RSA-SHA256");
  verify.update(`${header}.${payload}`);
  verify.end();
  return verify.verify(key, Buffer.from(signature, "base64url"));
}

/** Exchanges the callback code and checks the Google signature, audience, and verified mail. */
export async function googleIdentityFromCode(code: string): Promise<GoogleIdentity | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret || !code) return null;
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: googleRedirectUri(),
    grant_type: "authorization_code",
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { id_token?: unknown };
  const token = typeof payload.id_token === "string" ? payload.id_token : "";
  const [headerPart, payloadPart] = token.split(".");
  const header = headerPart ? decodePart(headerPart) : null;
  const claims = payloadPart ? decodePart(payloadPart) : null;
  if (!header || !claims || header.alg !== "RS256" || typeof header.kid !== "string") return null;
  const keys = await googleCerts();
  const key = keys.find((item) => item.kid === header.kid);
  if (!key || !signatureMatches(token, key)) return null;
  return readGoogleIdentity(claims, clientId);
}
