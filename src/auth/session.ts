import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";

const SESSION_COOKIE = "trenio_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days
const REMEMBER_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

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

export function setSessionCookie(token: string, remember = true) {
  setCookie(SESSION_COOKIE, token, cookieBaseOptions(remember ? REMEMBER_MAX_AGE_SECONDS : SESSION_MAX_AGE_SECONDS));
}

export function clearSessionCookie() {
  deleteCookie(SESSION_COOKIE, { path: "/" });
}

export { SESSION_MAX_AGE_SECONDS, REMEMBER_MAX_AGE_SECONDS };
