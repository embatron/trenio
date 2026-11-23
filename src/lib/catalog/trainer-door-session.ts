import { eq } from "drizzle-orm";

import { sessionCookieHeader, setSessionCookie, setTotpTicketCookie, totpTicketCookieHeader } from "@/auth/session";
import { beginLogin } from "@/auth/service";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";

/** Cookie header for a document navigation. The caller sets it on the response. */
export async function issueDoorSession(
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
): Promise<{ redirectTo: string; setCookie: string }> {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
  const opened = await beginLogin(user, {
    remember: true,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
  });
  if ("totpTicket" in opened) {
    return { redirectTo: "/auth/totp", setCookie: totpTicketCookieHeader(opened.totpTicket) };
  }
  return { redirectTo: "/me", setCookie: sessionCookieHeader(opened.token) };
}

/** Signs the owner in on the current server request. */
export async function openDoorSession(userId: string) {
  const [user] = await getDb().select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
  const opened = await beginLogin(user, { remember: true });
  if ("totpTicket" in opened) {
    setTotpTicketCookie(opened.totpTicket);
    return "/auth/totp";
  }
  setSessionCookie(opened.token, true);
  return "/me";
}
