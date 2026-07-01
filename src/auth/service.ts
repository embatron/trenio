import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  userRoles,
  users,
  type User,
  type UserRole,
} from "@/db/schema";
import {
  addDays,
  addMinutes,
  generateSecureToken,
  hashToken,
} from "@/auth/tokens";
import {
  getDummyPasswordHash,
  hashPassword,
  normalizeEmail,
  normalizePhone,
  validatePasswordStrength,
  verifyPassword,
} from "@/auth/password";
import { AuthError } from "@/lib/auth/errors";
import {
  signupRoleToIntent,
  type PublicSignupRole,
} from "@/lib/auth/roles";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  emailVerified: boolean;
  roles: UserRole[];
  status: User["status"];
  lastSignupIntent: User["lastSignupIntent"];
};

function toSessionUser(user: User, roles: UserRole[]): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    emailVerified: user.emailVerifiedAt != null,
    roles,
    status: user.status,
    lastSignupIntent: user.lastSignupIntent,
  };
}

async function getUserRoles(userId: string): Promise<UserRole[]> {
  const db = getDb();
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((row) => row.role);
}

async function assertUserCanAuthenticate(user: User) {
  if (user.status === "suspended") {
    throw new AuthError("Аккаунт заблокирован. Обратитесь в поддержку.", "ACCOUNT_SUSPENDED");
  }
  if (user.status === "deleted") {
    throw new AuthError("Неверный e-mail или пароль.", "INVALID_CREDENTIALS");
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const normalized = normalizeEmail(email);
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return user ?? null;
}

export async function findUserById(userId: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null; remember?: boolean },
) {
  const db = getDb();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const remember = meta?.remember ?? true;
  const expiresAt = remember ? addDays(new Date(), 30) : addDays(new Date(), 14);

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  return { token: rawToken, expiresAt };
}

export async function revokeSessionByToken(rawToken: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(rawToken)));
}

export async function revokeAllUserSessions(userId: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function findValidSession(rawToken: string): Promise<SessionUser | null> {
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  if (user.status === "suspended" || user.status === "deleted") {
    await revokeAllUserSessions(user.id);
    return null;
  }

  const roles = await getUserRoles(user.id);
  return toSessionUser(user, roles);
}

export async function loginUser(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  remember?: boolean;
}) {
  const user = await findUserByEmail(input.email);
  const hashToCheck = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(input.password, hashToCheck);

  if (!user || !passwordMatches) {
    throw new AuthError("Неверный e-mail или пароль.", "INVALID_CREDENTIALS");
  }

  await assertUserCanAuthenticate(user);
  await revokeAllUserSessions(user.id);
  return createSession(user.id, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    remember: input.remember,
  });
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  signupRole: PublicSignupRole;
}) {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    throw new AuthError(passwordError, "WEAK_PASSWORD");
  }

  if (await findUserByEmail(email)) {
    throw new AuthError("Аккаунт с таким e-mail уже существует.", "EMAIL_TAKEN");
  }

  if (phone) {
    const [existingPhone] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
    if (existingPhone) {
      throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");
    }
  }

  const passwordHash = await hashPassword(input.password);
  const intent = signupRoleToIntent(input.signupRole);

  const [user] = await db
    .insert(users)
    .values({
      email,
      phone,
      passwordHash,
      firstName: input.firstName.trim(),
      lastName: input.lastName?.trim() || null,
      status: "pending_verification",
      lastSignupIntent: intent,
    })
    .returning();

  await db.insert(userRoles).values({
    userId: user.id,
    role: input.signupRole,
  });

  const verification = await issueEmailVerification(user.id);
  await logDevEmail("verification", email, verification.url);

  return user;
}

export async function issueEmailVerification(userId: string) {
  const db = getDb();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addDays(new Date(), 1);

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const url = `${getAppUrl()}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  return { token: rawToken, url, expiresAt };
}

export async function verifyEmailToken(rawToken: string) {
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, now),
        isNull(emailVerificationTokens.usedAt),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  }

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, tokenRow.id));

  await db
    .update(users)
    .set({
      emailVerifiedAt: now,
      status: "active",
      updatedAt: now,
    })
    .where(eq(users.id, tokenRow.userId));

  return tokenRow.userId;
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email);
  if (user) {
    const reset = await issuePasswordReset(user.id);
    await logDevEmail("password-reset", user.email, reset.url);
  }
  return { ok: true as const };
}

export async function issuePasswordReset(userId: string) {
  const db = getDb();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addMinutes(new Date(), 30);

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const url = `${getAppUrl()}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  return { token: rawToken, url, expiresAt };
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const db = getDb();
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new AuthError(passwordError, "WEAK_PASSWORD");
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    throw new AuthError("Ссылка недействительна или устарела.", "EXPIRED_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now })
    .where(eq(users.id, tokenRow.userId));

  await revokeAllUserSessions(tokenRow.userId);

  return { ok: true as const };
}

export async function getSessionUserFromToken(rawToken: string | null): Promise<SessionUser | null> {
  if (!rawToken) return null;
  return findValidSession(rawToken);
}

function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:8080";
}

async function logDevEmail(kind: "verification" | "password-reset", email: string, url: string) {
  if (process.env.AUTH_DEV_LOG_EMAILS === "true") {
    console.info(`[auth:${kind}] ${email} → ${url}`);
  }
}

export async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const roles = await getUserRoles(userId);
  return toSessionUser(user, roles);
}
