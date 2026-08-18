import { and, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";

import { getDb } from "@/db";
import {
  emailChangeTokens,
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  userRoles,
  users,
  type User,
  type UserRole,
} from "@/db/schema";
import { issueOtp, verifyOtp } from "@/auth/otp";
import { consumeRateLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/auth/rate-limit";
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
  validatePasswordStrength,
  verifyPassword,
} from "@/auth/password";
import { AuthError } from "@/lib/auth/errors";
import { isHoneypotFilled } from "@/lib/auth/honeypot";
import {
  OTP_RESEND_SECONDS,
  normalizeBelarusMobile,
  validateBelarusMobile,
} from "@/lib/auth/phone";
import {
  signupRoleToIntent,
  type PublicSignupRole,
} from "@/lib/auth/roles";

export const GENERIC_REGISTRATION_SENT =
  "Мы отправили письмо со ссылкой. Проверьте почту и задайте пароль.";
export const GENERIC_RESET_SENT =
  "Если аккаунт с этим e-mail существует, мы отправили ссылку для сброса пароля.";
export const GENERIC_OTP_SENT = "Если номер привязан к аккаунту, мы отправили SMS с кодом.";
export const GENERIC_OTP_ERROR = "Неверный или устаревший код.";
export const GENERIC_CREDENTIALS = "Неверный e-mail или пароль.";
export const GENERIC_EMAIL_CHANGE_SENT =
  "Мы отправили письмо на новый адрес. Откройте ссылку, чтобы подтвердить смену e-mail.";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  roles: UserRole[];
  status: User["status"];
  lastSignupIntent: User["lastSignupIntent"];
};

export type AuthRequestMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
  honeypot?: string | null;
};

function toSessionUser(user: User, roles: UserRole[]): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    phoneVerified: user.phoneVerifiedAt != null,
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

function clientKeyOf(meta?: AuthRequestMeta): string {
  const ip = meta?.ipAddress?.trim() ?? "";
  return ip || "unknown";
}

function allowDevSecrets(): boolean {
  return process.env.NODE_ENV !== "production";
}

function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:8080";
}

async function logDevEmail(
  kind: "set-password" | "password-reset" | "email-change" | "email-taken",
  email: string,
  url: string,
) {
  if (process.env.AUTH_DEV_LOG_EMAILS === "true" || allowDevSecrets()) {
    console.info(`[auth:${kind}] ${email} → ${url}`);
  }
}

async function assertUserCanAuthenticate(user: User) {
  if (user.status === "suspended") {
    throw new AuthError("Аккаунт заблокирован. Обратитесь в поддержку.", "ACCOUNT_SUSPENDED");
  }
  if (user.status === "deleted" || user.status === "pending_verification" || !user.passwordHash) {
    throw new AuthError(GENERIC_CREDENTIALS, "INVALID_CREDENTIALS");
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

async function findUserByVerifiedPhone(phone: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(eq(users.phone, phone), isNotNull(users.phoneVerifiedAt)))
    .limit(1);
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

  if (user.status === "suspended" || user.status === "deleted" || user.status === "pending_verification") {
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
  honeypot?: string | null;
}) {
  if (isHoneypotFilled(input.honeypot)) {
    throw new AuthError(GENERIC_CREDENTIALS, "INVALID_CREDENTIALS");
  }

  const ipLimit = await consumeRateLimit(
    `login:ip:${clientKeyOf(input)}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
  if (!ipLimit.ok) {
    throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  }

  const user = await findUserByEmail(input.email);
  const hashToCheck = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(input.password, hashToCheck);

  if (!user || !passwordMatches) {
    throw new AuthError(GENERIC_CREDENTIALS, "INVALID_CREDENTIALS");
  }

  await assertUserCanAuthenticate(user);
  await revokeAllUserSessions(user.id);
  return createSession(user.id, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    remember: input.remember,
  });
}

async function invalidateUnusedEmailVerification(userId: string) {
  const db = getDb();
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt)));
}

async function invalidateUnusedPasswordResets(userId: string) {
  const db = getDb();
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));
}

async function invalidateUnusedEmailChanges(userId: string) {
  const db = getDb();
  await db
    .update(emailChangeTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(emailChangeTokens.userId, userId), isNull(emailChangeTokens.usedAt)));
}

export async function issueSetPasswordToken(userId: string) {
  const db = getDb();
  await invalidateUnusedEmailVerification(userId);
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addDays(new Date(), 1);

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const url = `${getAppUrl()}/auth/set-password?token=${encodeURIComponent(rawToken)}`;
  return { token: rawToken, url, expiresAt };
}

export async function registerUser(input: {
  email: string;
  firstName: string;
  lastName?: string | null;
  signupRole: PublicSignupRole;
  ipAddress?: string | null;
  honeypot?: string | null;
}): Promise<{ message: string; devUrl?: string }> {
  if (isHoneypotFilled(input.honeypot)) {
    return { message: GENERIC_REGISTRATION_SENT };
  }

  const ipLimit = await consumeRateLimit(
    `register:ip:${clientKeyOf(input)}`,
    RATE_LIMITS.registerIp.windowMs,
    RATE_LIMITS.registerIp.max,
  );
  if (!ipLimit.ok) {
    throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  }

  const db = getDb();
  const email = normalizeEmail(input.email);
  const firstName = input.firstName.trim();
  const lastName = input.lastName?.trim() || null;
  const intent = signupRoleToIntent(input.signupRole);
  const existing = await findUserByEmail(email);

  if (existing && existing.status !== "pending_verification") {
    if (existing.status === "active") {
      await logDevEmail("email-taken", existing.email, `${getAppUrl()}/auth/login`);
    }
    return { message: GENERIC_REGISTRATION_SENT };
  }

  let userId: string;
  if (existing) {
    await db
      .update(users)
      .set({
        firstName,
        lastName,
        lastSignupIntent: intent,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    await db.delete(userRoles).where(eq(userRoles.userId, existing.id));
    await db.insert(userRoles).values({ userId: existing.id, role: input.signupRole });
    userId = existing.id;
  } else {
    const [user] = await db
      .insert(users)
      .values({
        email,
        passwordHash: null,
        firstName,
        lastName,
        status: "pending_verification",
        lastSignupIntent: intent,
      })
      .returning();
    await db.insert(userRoles).values({
      userId: user.id,
      role: input.signupRole,
    });
    userId = user.id;
  }

  const setup = await issueSetPasswordToken(userId);
  await logDevEmail("set-password", email, setup.url);

  return {
    message: GENERIC_REGISTRATION_SENT,
    devUrl: allowDevSecrets() ? setup.url : undefined,
  };
}

export async function completeSetPassword(rawToken: string, newPassword: string) {
  const db = getDb();
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new AuthError(passwordError, "WEAK_PASSWORD");
  }

  const tokenHash = hashToken(rawToken.trim());
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

  const user = await findUserById(tokenRow.userId);
  if (!user || user.status === "deleted" || user.status === "suspended") {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, tokenRow.id));
  await invalidateUnusedEmailVerification(user.id);

  await db
    .update(users)
    .set({
      passwordHash,
      emailVerifiedAt: now,
      status: "active",
      updatedAt: now,
    })
    .where(eq(users.id, user.id));

  await revokeAllUserSessions(user.id);
  return createSession(user.id, { remember: true });
}

/** Legacy `/auth/verify-email` links: if the account already has a password, just confirm email. */
export async function verifyEmailToken(rawToken: string) {
  const db = getDb();
  const tokenHash = hashToken(rawToken.trim());
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

  const user = await findUserById(tokenRow.userId);
  if (!user?.passwordHash) {
    throw new AuthError("Задайте пароль по ссылке из письма.", "INVALID_TOKEN");
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

export async function requestPasswordReset(email: string, meta?: AuthRequestMeta) {
  if (isHoneypotFilled(meta?.honeypot)) {
    return { ok: true as const };
  }

  const ipLimit = await consumeRateLimit(
    `forgot:ip:${clientKeyOf(meta)}`,
    RATE_LIMITS.forgotIp.windowMs,
    RATE_LIMITS.forgotIp.max,
  );
  if (!ipLimit.ok) {
    throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  }

  const user = await findUserByEmail(email);
  if (user?.passwordHash && user.status !== "deleted") {
    const reset = await issuePasswordReset(user.id);
    await logDevEmail("password-reset", user.email, reset.url);
    return { ok: true as const, devUrl: allowDevSecrets() ? reset.url : undefined };
  }
  return { ok: true as const };
}

export async function issuePasswordReset(userId: string) {
  const db = getDb();
  await invalidateUnusedPasswordResets(userId);
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

export async function resetPassword(rawToken: string, newPassword: string, meta?: AuthRequestMeta) {
  const db = getDb();
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new AuthError(passwordError, "WEAK_PASSWORD");
  }

  const tokenHash = hashToken(rawToken.trim());
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
  await invalidateUnusedPasswordResets(tokenRow.userId);

  await db
    .update(users)
    .set({ passwordHash, updatedAt: now, status: "active", emailVerifiedAt: now })
    .where(eq(users.id, tokenRow.userId));

  await revokeAllUserSessions(tokenRow.userId);
  return createSession(tokenRow.userId, {
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    remember: true,
  });
}

export async function requestEmailChange(userId: string, newEmailRaw: string, meta?: AuthRequestMeta) {
  const ipLimit = await consumeRateLimit(
    `email-change:ip:${clientKeyOf(meta)}`,
    RATE_LIMITS.emailChangeIp.windowMs,
    RATE_LIMITS.emailChangeIp.max,
  );
  if (!ipLimit.ok) {
    throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  }

  const newEmail = normalizeEmail(newEmailRaw);
  const user = await findUserById(userId);
  if (!user) {
    throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
  }
  if (newEmail === user.email) {
    return { message: "E-mail не изменился." };
  }

  const taken = await findUserByEmail(newEmail);
  if (taken && taken.id !== userId) {
    return { message: GENERIC_EMAIL_CHANGE_SENT };
  }

  const db = getDb();
  await invalidateUnusedEmailChanges(userId);
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addDays(new Date(), 1);

  await db.insert(emailChangeTokens).values({
    userId,
    newEmail,
    tokenHash,
    expiresAt,
  });

  const url = `${getAppUrl()}/auth/confirm-email?token=${encodeURIComponent(rawToken)}`;
  await logDevEmail("email-change", newEmail, url);

  return {
    message: GENERIC_EMAIL_CHANGE_SENT,
    devUrl: allowDevSecrets() ? url : undefined,
  };
}

export async function confirmEmailChange(rawToken: string) {
  const db = getDb();
  const tokenHash = hashToken(rawToken.trim());
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(emailChangeTokens)
    .where(
      and(eq(emailChangeTokens.tokenHash, tokenHash), gt(emailChangeTokens.expiresAt, now), isNull(emailChangeTokens.usedAt)),
    )
    .limit(1);

  if (!tokenRow) {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  }

  const taken = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.email, tokenRow.newEmail), ne(users.id, tokenRow.userId)))
    .limit(1);
  if (taken.length > 0) {
    await db.update(emailChangeTokens).set({ usedAt: now }).where(eq(emailChangeTokens.id, tokenRow.id));
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  }

  await db.update(emailChangeTokens).set({ usedAt: now }).where(eq(emailChangeTokens.id, tokenRow.id));
  await invalidateUnusedEmailChanges(tokenRow.userId);

  await db
    .update(users)
    .set({
      email: tokenRow.newEmail,
      emailVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(users.id, tokenRow.userId));

  return tokenRow.userId;
}

export async function requestSmsLogin(phoneRaw: string, meta?: AuthRequestMeta) {
  if (isHoneypotFilled(meta?.honeypot)) {
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  const phoneError = validateBelarusMobile(phoneRaw);
  if (phoneError) {
    throw new AuthError(phoneError, "VALIDATION");
  }
  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) {
    throw new AuthError("Укажите мобильный номер РБ.", "VALIDATION");
  }

  const ipLimit = await consumeRateLimit(
    `otp:ip:${clientKeyOf(meta)}`,
    RATE_LIMITS.otpIp.windowMs,
    RATE_LIMITS.otpIp.max,
  );
  const phoneLimit = await consumeRateLimit(
    `otp:phone:${phone}`,
    RATE_LIMITS.otpPhone.windowMs,
    RATE_LIMITS.otpPhone.max,
  );
  if (!ipLimit.ok || !phoneLimit.ok) {
    const retryAfterSec = Math.max(
      ipLimit.ok ? 0 : ipLimit.retryAfterSec,
      phoneLimit.ok ? 0 : phoneLimit.retryAfterSec,
    );
    throw new AuthError(`Код можно отправить снова через ${retryAfterSec} с.`, "RATE_LIMITED");
  }

  const user = await findUserByVerifiedPhone(phone);
  if (!user || user.status !== "active") {
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  const issued = await issueOtp({
    phone,
    purpose: "login",
    userId: user.id,
    send: true,
  });

  if (!issued.ok) {
    if (issued.code === "rate_limited") {
      throw new AuthError(issued.error, "RATE_LIMITED");
    }
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  return {
    message: GENERIC_OTP_SENT,
    retryAfterSec: issued.retryAfterSec,
    devCode: issued.devCode,
  };
}

export async function confirmSmsLogin(input: {
  phone: string;
  code: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  remember?: boolean;
  honeypot?: string | null;
}) {
  if (isHoneypotFilled(input.honeypot)) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_TOKEN");
  }

  const phone = normalizeBelarusMobile(input.phone);
  if (!phone) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_TOKEN");
  }

  const ipLimit = await consumeRateLimit(
    `login:ip:${clientKeyOf(input)}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
  if (!ipLimit.ok) {
    throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  }

  const verified = await verifyOtp({ phone, purpose: "login", code: input.code });
  const user = verified.ok ? await findUserByVerifiedPhone(phone) : null;
  if (!verified.ok || !user || user.status !== "active") {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_TOKEN");
  }

  await assertUserCanAuthenticate(user);
  await revokeAllUserSessions(user.id);
  return createSession(user.id, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    remember: input.remember,
  });
}

export async function requestPhoneVerify(userId: string, phoneRaw: string, meta?: AuthRequestMeta) {
  if (isHoneypotFilled(meta?.honeypot)) {
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  const phoneError = validateBelarusMobile(phoneRaw);
  if (phoneError) {
    throw new AuthError(phoneError, "VALIDATION");
  }
  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) {
    throw new AuthError("Укажите мобильный номер РБ.", "VALIDATION");
  }

  const ipLimit = await consumeRateLimit(
    `otp:ip:${clientKeyOf(meta)}`,
    RATE_LIMITS.otpIp.windowMs,
    RATE_LIMITS.otpIp.max,
  );
  const phoneLimit = await consumeRateLimit(
    `otp:phone:${phone}`,
    RATE_LIMITS.otpPhone.windowMs,
    RATE_LIMITS.otpPhone.max,
  );
  if (!ipLimit.ok || !phoneLimit.ok) {
    const retryAfterSec = Math.max(
      ipLimit.ok ? 0 : ipLimit.retryAfterSec,
      phoneLimit.ok ? 0 : phoneLimit.retryAfterSec,
    );
    throw new AuthError(`Код можно отправить снова через ${retryAfterSec} с.`, "RATE_LIMITED");
  }

  const issued = await issueOtp({
    phone,
    purpose: "verify_phone",
    userId,
    send: true,
  });

  if (!issued.ok) {
    if (issued.code === "rate_limited") {
      throw new AuthError(issued.error, "RATE_LIMITED");
    }
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  return {
    message: GENERIC_OTP_SENT,
    retryAfterSec: issued.retryAfterSec,
    devCode: issued.devCode,
  };
}

export async function confirmPhoneVerify(userId: string, phoneRaw: string, code: string, honeypot?: string | null) {
  if (isHoneypotFilled(honeypot)) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_TOKEN");
  }

  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_TOKEN");
  }

  const verified = await verifyOtp({ phone, purpose: "verify_phone", code });
  if (!verified.ok || (verified.userId && verified.userId !== userId)) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_TOKEN");
  }

  const owner = await findUserByVerifiedPhone(phone);
  if (owner && owner.id !== userId) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_TOKEN");
  }

  const db = getDb();
  const now = new Date();
  await db
    .update(users)
    .set({ phone, phoneVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, userId));
}

export async function updateAccountName(userId: string, firstName: string, lastName?: string | null) {
  const trimmed = firstName.trim();
  if (!trimmed) {
    throw new AuthError("Укажите имя.", "VALIDATION");
  }
  const db = getDb();
  await db
    .update(users)
    .set({
      firstName: trimmed,
      lastName: lastName?.trim() || null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId));
}

export async function getSessionUserFromToken(rawToken: string | null): Promise<SessionUser | null> {
  if (!rawToken) return null;
  return findValidSession(rawToken);
}

export async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const roles = await getUserRoles(userId);
  return toSessionUser(user, roles);
}
