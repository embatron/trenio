import { randomBytes } from "node:crypto";

import { readYandexIdentity, type YandexIdentity } from "@/lib/auth/yandex-identity";

const TOKEN_URL = "https://oauth.yandex.ru/token";
const AUTH_URL = "https://oauth.yandex.ru/authorize";
const INFO_URL = "https://login.yandex.ru/info?format=json";
const SCOPE = "login:email login:avatar login:default_phone";

export function yandexConfigured(): boolean {
  return Boolean(process.env.YANDEX_CLIENT_ID?.trim() && process.env.YANDEX_CLIENT_SECRET?.trim());
}

export function yandexRedirectUri(): string {
  const base = (process.env.APP_URL ?? "http://127.0.0.1:8080").replace(/\/$/, "");
  return `${base}/auth/yandex/callback`;
}

export function yandexAuthUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.YANDEX_CLIENT_ID?.trim() ?? "");
  url.searchParams.set("redirect_uri", yandexRedirectUri());
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("force_confirm", "yes");
  return url.toString();
}

export function newYandexState(): string {
  return randomBytes(16).toString("base64url");
}

/** Exchanges the callback code and reads the Yandex ID profile for this client. */
export async function yandexIdentityFromCode(code: string): Promise<YandexIdentity | null> {
  const clientId = process.env.YANDEX_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.YANDEX_CLIENT_SECRET?.trim() ?? "";
  if (!clientId || !clientSecret || !code) return null;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(8_000),
  });
  if (!tokenResponse.ok) return null;
  const tokenPayload = (await tokenResponse.json()) as { access_token?: unknown };
  const accessToken = typeof tokenPayload.access_token === "string" ? tokenPayload.access_token : "";
  if (!accessToken || accessToken.length > 4096) return null;
  const infoResponse = await fetch(INFO_URL, {
    headers: { authorization: `OAuth ${accessToken}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!infoResponse.ok) return null;
  const info = (await infoResponse.json()) as unknown;
  if (!info || typeof info !== "object") return null;
  return readYandexIdentity(info as Record<string, unknown>, clientId);
}
