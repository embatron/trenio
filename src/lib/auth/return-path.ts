/** The session is gone. The person has to sign in again. */
export const AUTHORIZATION_REQUIRED = "Требуется авторизация.";

/** Login URL that returns to a same-site path after a successful sign-in. */
export function loginHref(returnPath?: string | null): string {
  const next = safeReturnPath(returnPath);
  if (!next || next.startsWith("/auth/")) return "/auth/login";
  return `/auth/login?redirect=${encodeURIComponent(next)}`;
}

/** Leave the current page for the login form. No-op on the server and on auth pages. */
export function redirectToLogin(): boolean {
  if (typeof window === "undefined") return false;
  const here = `${window.location.pathname}${window.location.search}`;
  if (here.startsWith("/auth/")) return false;
  window.location.assign(loginHref(here));
  return true;
}

/** Same-site path safe to use after login. Rejects protocol-relative and external URLs. */
export function safeReturnPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value.length < 2 || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://") || value.includes("\0")) return null;
  return value;
}
