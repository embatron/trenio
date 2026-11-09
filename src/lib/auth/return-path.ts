import { getPostLoginPath, hasAnyRole } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";

/** The session is gone. The person has to sign in again. */
export const AUTHORIZATION_REQUIRED = "Требуется авторизация.";

/** A client, without a trainer, club, or staff role. */
export function isPlainClient(roles: readonly UserRole[]): boolean {
  return !hasAnyRole(roles as UserRole[], ["trainer", "club", "admin", "superadmin"]);
}

/**
 * Where to open after a successful sign-in.
 * A plain client returns to the page they left. With nowhere to return, that is the catalog.
 * A trainer, club, or staff member keeps the cabinet. `browse` is the header link:
 * it remembers the public page for a client and does not pull a trainer out of the cabinet.
 */
export function destinationAfterAuth(
  roles: readonly UserRole[],
  returnPath: unknown,
  browse = false,
): string {
  const back = safeReturnPath(returnPath);
  const page = back && !back.startsWith("/auth/") ? back : null;
  if (!isPlainClient(roles)) {
    if (browse) return getPostLoginPath(roles as UserRole[]);
    return page ?? getPostLoginPath(roles as UserRole[]);
  }
  return page ?? "/";
}

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
  if (value === "/") return "/";
  if (value.length < 2 || value.length > 200) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\") || value.includes("://") || value.includes("\0")) return null;
  return value;
}
