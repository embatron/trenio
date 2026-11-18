import { getCookie, setCookie } from "@tanstack/react-start/server";

const VISITOR_COOKIE = "trenio_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 400;

function validVisitorId(value: string | undefined) {
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/** The existing browser id, without creating one. */
export function readVisitorId() {
  return validVisitorId(getCookie(VISITOR_COOKIE));
}

/** Stable browser id for profile visits and catalog impressions. */
export function visitorId() {
  const current = readVisitorId();
  if (current) return current;
  const next = crypto.randomUUID();
  setCookie(VISITOR_COOKIE, next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
  });
  return next;
}
