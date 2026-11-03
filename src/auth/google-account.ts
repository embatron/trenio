import { randomBytes } from "node:crypto";

import { and, eq, isNull, ne, or } from "drizzle-orm";

import { hashPassword, normalizeEmail } from "@/auth/password";
import { beginLogin, revokeAllUserSessions } from "@/auth/service";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users, type User } from "@/db/schema";
import { decideGoogleLink } from "@/lib/auth/auth-decisions";
import type { GoogleIdentity } from "@/lib/auth/google-identity";
import { isReservedAccountEmail } from "@/lib/auth/pending-email";
import { getPostLoginPath } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { safeReturnPath } from "@/lib/auth/return-path";

export type GoogleLoginResult =
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

/** Google proves the mailbox. An unverified password row is replaced; a verified row is entered only when its Google id matches or is empty. */
export async function openGoogleAccount(
  identity: GoogleIdentity,
  returnPath: string | null,
  meta: { ipAddress?: string | null; userAgent?: string | null },
): Promise<GoogleLoginResult> {
  const email = normalizeEmail(identity.email);
  if (isReservedAccountEmail(email)) return { kind: "refuse", reason: "invalid" };
  const db = getDb();
  const [bySub] = await db.select().from(users).where(eq(users.googleSub, identity.sub)).limit(1);
  const [byEmail] = bySub ? [] : await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user = bySub ?? byEmail ?? null;
  let created = false;

  const decision = decideGoogleLink({
    exists: Boolean(user),
    blocked: user?.status === "suspended" || user?.status === "deleted",
    emailVerified: Boolean(user?.emailVerifiedAt),
    googleSub: user?.googleSub ?? null,
    incomingSub: identity.sub,
  });
  if (decision === "refuse") return { kind: "refuse", reason: refuseReason(user) };

  if (decision === "create") {
    const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
    try {
      const [row] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          emailVerifiedAt: new Date(),
          firstName: identity.name,
          status: "active",
          lastSignupIntent: "client_signup",
          googleSub: identity.sub,
        })
        .returning();
      user = row;
      await db.insert(userRoles).values({ userId: user.id, role: "user" });
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const [againEmail] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      const [againSub] = againEmail ? [] : await db.select().from(users).where(eq(users.googleSub, identity.sub)).limit(1);
      user = againEmail ?? againSub ?? null;
      if (!user) return { kind: "refuse", reason: "taken" };
      const again = decideGoogleLink({
        exists: true,
        blocked: user.status === "suspended" || user.status === "deleted",
        emailVerified: Boolean(user.emailVerifiedAt),
        googleSub: user.googleSub ?? null,
        incomingSub: identity.sub,
      });
      if (again === "refuse" || again === "create") return { kind: "refuse", reason: refuseReason(user) };
      if (again === "takeover") {
        await takeoverUnverified(user, identity.sub);
      } else if (!user.googleSub) {
        await db.update(users).set({ googleSub: identity.sub, updatedAt: new Date() }).where(eq(users.id, user.id));
      }
    }
  } else if (decision === "takeover" && user) {
    await takeoverUnverified(user, identity.sub);
  } else if (user && !user.googleSub) {
    await db.update(users).set({ googleSub: identity.sub, updatedAt: new Date() }).where(eq(users.id, user.id));
  }

  if (!user) return { kind: "refuse", reason: "invalid" };
  const fresh = (await db.select().from(users).where(eq(users.id, user.id)).limit(1))[0] ?? user;
  await stampGoogleMailbox(fresh.id, email);
  const opened = await beginLogin(fresh, meta);
  if ("totpTicket" in opened) return { kind: "totp", ticket: opened.totpTicket, email, userId: fresh.id };
  const roles = await rolesOf(fresh.id);
  return {
    kind: "session",
    token: opened.token,
    redirectTo: safeReturnPath(returnPath) ?? getPostLoginPath(roles),
    created,
    email,
    userId: fresh.id,
  };
}

/** Google already proved the mailbox. Fill a missing verification and copy it onto the trainer card. */
async function stampGoogleMailbox(userId: string, email: string) {
  const db = getDb();
  const now = new Date();
  const [user] = await db
    .select({ emailVerifiedAt: users.emailVerifiedAt, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status === "deleted" || user.status === "suspended") return;
  let verifiedAt = user.emailVerifiedAt;
  if (!verifiedAt || user.status === "pending_verification") {
    verifiedAt = verifiedAt ?? now;
    await db
      .update(users)
      .set({ emailVerifiedAt: verifiedAt, status: "active", updatedAt: now })
      .where(eq(users.id, userId));
  }
  await db.update(users).set({ needsPassword: false, updatedAt: now }).where(eq(users.id, userId));
  await db
    .update(trainerProfiles)
    .set({ email, emailVerifiedAt: verifiedAt, updatedAt: now })
    .where(and(
      eq(trainerProfiles.ownerUserId, userId),
      or(isNull(trainerProfiles.emailVerifiedAt), ne(trainerProfiles.email, email)),
    ));
}

async function takeoverUnverified(user: User, sub: string) {
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  await revokeAllUserSessions(user.id);
  await getDb()
    .update(users)
    .set({
      passwordHash,
      googleSub: sub,
      emailVerifiedAt: new Date(),
      status: "active",
      needsPassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
}
