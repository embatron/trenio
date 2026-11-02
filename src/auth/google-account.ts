import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { hashPassword, normalizeEmail } from "@/auth/password";
import { createSession } from "@/auth/service";
import { getDb } from "@/db";
import { userRoles, users } from "@/db/schema";
import type { GoogleIdentity } from "@/lib/auth/google-identity";
import { isReservedAccountEmail } from "@/lib/auth/pending-email";
import { getPostLoginPath, type UserRole } from "@/lib/auth/roles";
import { safeReturnPath } from "@/lib/auth/return-path";

export type GoogleLoginResult =
  | { kind: "session"; token: string; redirectTo: string; created: boolean; email: string; userId: string }
  | { kind: "refuse"; reason: "deleted" | "blocked" | "taken" | "invalid" };

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

async function rolesOf(userId: string): Promise<UserRole[]> {
  const rows = await getDb().select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map((row) => row.role);
}

/** Opens the account that already owns this verified Google mail, or creates that account. */
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

  if (user?.status === "suspended") return { kind: "refuse", reason: "blocked" };
  if (user?.status === "deleted") return { kind: "refuse", reason: "deleted" };
  if (user && user.googleSub && user.googleSub !== identity.sub) return { kind: "refuse", reason: "taken" };

  if (!user) {
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
      if (!user || user.status === "deleted" || user.status === "suspended") return { kind: "refuse", reason: "taken" };
    }
  }

  if (!user) return { kind: "refuse", reason: "invalid" };
  if (!user.googleSub || !user.emailVerifiedAt) {
    await db
      .update(users)
      .set({
        googleSub: user.googleSub ?? identity.sub,
        emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }

  const session = await createSession(user.id, meta);
  const roles = await rolesOf(user.id);
  return {
    kind: "session",
    token: session.token,
    redirectTo: safeReturnPath(returnPath) ?? getPostLoginPath(roles),
    created,
    email,
    userId: user.id,
  };
}
