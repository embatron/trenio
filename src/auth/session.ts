import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "trenio_session";
const SESSION_DAYS = 21;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * SESSION_DAYS;

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function cookieBaseOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: isProduction(),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export function readSessionToken(): string | null {
  return getCookie(SESSION_COOKIE) ?? null;
}

export function setSessionCookie(token: string, _remember = true) {
  setCookie(SESSION_COOKIE, token, cookieBaseOptions(SESSION_MAX_AGE_SECONDS));
}

/** Same cookie as `setSessionCookie`, for a redirect response the router returns itself. */
export function sessionCookieHeader(token: string): string {
  const secure = isProduction() ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export { SESSION_DAYS, SESSION_MAX_AGE_SECONDS };
