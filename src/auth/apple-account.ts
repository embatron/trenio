import { randomBytes } from "node:crypto";

import { and, eq, isNull, ne, or } from "drizzle-orm";

import { hashPassword, normalizeEmail } from "@/auth/password";
import { rememberOAuthNames } from "@/auth/oauth-profile";
import { beginLogin, revokeAllUserSessions } from "@/auth/service";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users, type User } from "@/db/schema";
import { decideAppleLink } from "@/lib/auth/auth-decisions";
import { storedGivenName } from "@/lib/auth/login-name";
import { isPendingSignupEmail, isReservedAccountEmail, pendingSignupEmail } from "@/lib/auth/pending-email";
import { destinationAfterAuth } from "@/lib/auth/return-path";
import type { UserRole } from "@/lib/auth/types";
import type { AppleIdentity } from "@/lib/mobile/apple-token";

export type AppleLoginResult =
  | { kind: "session"; token: string; redirectTo: string; created: boolean; email: string; userId: string }
  | { kind: "totp"; ticket: string; email: string; userId: string }
  | { kind: "refuse"; reason: "deleted" | "blocked" | "taken" | "invalid" };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

async function rolesOf(userId: string): Promise<UserRole[]> {
  const rows = await getDb().select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((row) => row.role);
}

function refuseReason(user: User | null): "deleted" | "blocked" | "taken" {
  if (user?.status === "deleted") return "deleted";
  if (user?.status === "suspended") return "blocked";
  return "taken";
}

/** Apple proves the mailbox when it sends one. A hidden address becomes the pending mailbox. */
export async function openAppleAccount(
  identity: AppleIdentity,
  names: { firstName: string; lastName: string },
  returnPath: string | null,
  meta: { ipAddress?: string | null; userAgent?: string | null },
  browse: boolean,
): Promise<AppleLoginResult> {
  const presented = identity.email ? normalizeEmail(identity.email) : null;
  if (presented && isReservedAccountEmail(presented)) return { kind: "refuse", reason: "invalid" };
  const db = getDb();
  const [bySub] = await db.select().from(users).where(eq(users.appleSub, identity.sub)).limit(1);
  const [byEmail] = bySub || !presented
    ? []
    : await db.select().from(users).where(eq(users.email, presented)).limit(1);
  let user = bySub ?? byEmail ?? null;
  let created = false;

  const decision = decideAppleLink({
    exists: Boolean(user),
    blocked: user?.status === "suspended" || user?.status === "deleted",
    emailVerified: Boolean(user?.emailVerifiedAt),
    appleSub: user?.appleSub ?? null,
    incomingSub: identity.sub,
  });
  if (decision === "refuse") return { kind: "refuse", reason: refuseReason(user) };

  if (decision === "create") {
    const id = crypto.randomUUID();
    const email = presented ?? pendingSignupEmail(id);
    const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
    try {
      const [row] = await db
        .insert(users)
        .values({
          id,
          email,
          passwordHash,
          emailVerifiedAt: presented ? new Date() : null,
          firstName: storedGivenName(names.firstName, email),
          lastName: names.lastName || null,
          status: "active",
          lastSignupIntent: "client_signup",
          appleSub: identity.sub,
          appleEmail: presented,
        })
        .returning();
      user = row;
      await db.insert(userRoles).values({ userId: user.id, role: "user" });
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const [againSub] = await db.select().from(users).where(eq(users.appleSub, identity.sub)).limit(1);
      const [againEmail] = againSub || !presented
        ? []
        : await db.select().from(users).where(eq(users.email, presented)).limit(1);
      user = againSub ?? againEmail ?? null;
      if (!user) return { kind: "refuse", reason: "taken" };
      const again = decideAppleLink({
        exists: true,
        blocked: user.status === "suspended" || user.status === "deleted",
        emailVerified: Boolean(user.emailVerifiedAt),
        appleSub: user.appleSub ?? null,
        incomingSub: identity.sub,
      });
      if (again === "refuse" || again === "create") return { kind: "refuse", reason: refuseReason(user) };
      if (again === "takeover") await takeoverUnverified(user, identity.sub, presented);
      else if (!user.appleSub) await attachSub(user.id, identity.sub, presented);
    }
  } else if (decision === "takeover" && user) {
    await takeoverUnverified(user, identity.sub, presented);
  } else if (user && !user.appleSub) {
    await attachSub(user.id, identity.sub, presented);
  }

  if (!user) return { kind: "refuse", reason: "invalid" };
  const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0] ?? user;
  if (presented && !isPendingSignupEmail(fresh.email)) await stampAppleMailbox(fresh.id, presented);
  await rememberOAuthNames(fresh.id, names);
  const opened = await beginLogin(fresh, meta);
  const email = fresh.email;
  if ("totpTicket" in opened) return { kind: "totp", ticket: opened.totpTicket, email, userId: fresh.id };
  const roles = await rolesOf(fresh.id);
  return {
    kind: "session",
    token: opened.token,
    redirectTo: destinationAfterAuth(roles, returnPath, browse),
    created,
    email,
    userId: fresh.id,
  };
}

async function attachSub(userId: string, sub: string, email: string | null) {
  await getDb()
    .update(users)
    .set({ appleSub: sub, appleEmail: email, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

async function takeoverUnverified(user: User, sub: string, email: string | null) {
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  await revokeAllUserSessions(user.id);
  await getDb()
    .update(users)
    .set({
      passwordHash,
      passwordSetAt: null,
      appleSub: sub,
      appleEmail: email,
      emailVerifiedAt: new Date(),
      status: "active",
      needsPassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}

async function stampAppleMailbox(userId: string, email: string) {
  const db = getDb();
  const now = new Date();
  const [user] = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt, email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.email !== email) return;
  if (!user.emailVerifiedAt) {
    await db.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, userId));
  }
  await db
    .update(trainerProfiles)
    .set({ email, emailVerifiedAt: now, updatedAt: now })
    .where(and(
      eq(trainerProfiles.ownerUserId, userId),
      or(isNull(trainerProfiles.emailVerifiedAt), ne(trainerProfiles.email, email)),
    ));
}
