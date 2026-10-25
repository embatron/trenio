import { randomInt } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import { and, desc, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";

import { belarusPhoneEquals } from "@/lib/auth/phone-match";

import { getDb } from "@/db";
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  trainerProfiles,
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
  validatePasswordStrength,
  verifyPassword,
} from "@/auth/password";
import { issueOtp, verifyOtp } from "@/auth/otp";
import { consumeRateLimit } from "@/auth/rate-limit";
import { isSmsByEnabled } from "@/auth/sms";
import { AuthError } from "@/lib/auth/errors";
import { resolveAccountLogin } from "@/lib/auth/login-name";
import { writeImageSet } from "@/lib/images/store";
import {
  normalizeBelarusMobile,
  OTP_CODE_LENGTH,
  storedBelarusPhone,
  validateBelarusMobile,
} from "@/lib/auth/phone";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { sendMail } from "@/lib/mail/send.server";
import {
  signupRoleToIntent,
  type PublicSignupRole,
} from "@/lib/auth/roles";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  avatarPath: string;
  emailVerified: boolean;
  roles: UserRole[];
  status: User["status"];
  lastSignupIntent: User["lastSignupIntent"];
};

/** Face and public nick for the header. The nick is the Instagram handle. */
export async function trainerHeaderFace(userId: string): Promise<{ avatarPath: string; nick: string } | null> {
  const [row] = await getDb()
    .select({
      handle: trainerProfiles.instagramHandle,
      slug: trainerProfiles.slug,
      avatarPath: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!row) return null;
  const photo = (row.photos[0] || row.avatarPath || "").split("?")[0];
  const handle = row.handle.startsWith("self") ? "" : row.handle;
  return { avatarPath: photo, nick: handle || row.slug };
}

function toSessionUser(user: User, roles: UserRole[]): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarPath: user.avatarPath ?? "",
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

export async function assertUserCanAuthenticate(user: User) {
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

/** Email matches `users.email`. A nick matches the trainer card address. */
export async function findUserByLogin(value: string): Promise<User | null> {
  const login = resolveAccountLogin(value);
  const direct = await findUserByEmail(login);
  if (direct) return direct;
  const nick = login.endsWith("@nick.trenio.by") ? login.slice(0, -"@nick.trenio.by".length) : "";
  if (!nick) return null;
  const [profile] = await getDb()
    .select({ ownerUserId: trainerProfiles.ownerUserId })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.slug, nick))
    .limit(1);
  if (!profile?.ownerUserId) return null;
  return findUserById(profile.ownerUserId);
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
  const expiresAt = addDays(new Date(), 21);

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

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentToken: string | null,
) {
  const user = await findUserById(userId);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");

  const limit = consumeRateLimit(`password-change:${userId}`, 15 * 60_000, 8);
  if (!limit.ok) {
    throw new AuthError("Слишком много попыток. Подождите и попробуйте снова.", "RATE_LIMITED");
  }

  const matches = await verifyPassword(currentPassword, user.passwordHash);
  if (!matches) throw new AuthError("Неверный текущий пароль.", "INVALID_CREDENTIALS");

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");
  if (currentPassword === newPassword) {
    throw new AuthError("Новый пароль должен отличаться от текущего.", "VALIDATION");
  }

  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (currentToken) {
    await getDb()
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashToken(currentToken))));
  } else {
    await revokeAllUserSessions(userId);
  }

  return { ok: true as const, message: "Пароль изменён." };
}

export async function setAccountAvatar(userId: string, dataUrl: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new AuthError("Выберите изображение JPEG, PNG или WebP.", "VALIDATION");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 32 || buffer.length > 1_500_000) {
    throw new AuthError("Фото должно быть меньше 1,5 МБ.", "VALIDATION");
  }
  const relative = `/avatars/${userId}.jpg`;
  await writeImageSet(buffer, path.join(process.cwd(), "public", relative));
  await Promise.all(["png", "webp"].map((ext) => unlink(path.join(process.cwd(), "public", "avatars", `${userId}.${ext}`)).catch(() => undefined)));
  await getDb().update(users).set({ avatarPath: relative, updatedAt: new Date() }).where(eq(users.id, userId));
  return { ok: true as const, avatarPath: `${relative}?v=${Date.now()}`, message: "Фото обновлено." };
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
  const user = await findUserByLogin(input.email);
  const hashToCheck = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(input.password, hashToCheck);

  if (!user || !passwordMatches) {
    throw new AuthError("Неверный логин или пароль.", "INVALID_CREDENTIALS");
  }

  await assertUserCanAuthenticate(user);
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
  lastName: string;
  phone?: string | null;
  signupRole: PublicSignupRole;
}) {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const rawPhone = input.phone?.trim() ?? "";
  const phone = rawPhone ? storedBelarusPhone(rawPhone) : null;
  if (rawPhone && !phone) {
    throw new AuthError(validateBelarusMobile(rawPhone) ?? "Укажите мобильный номер РБ.", "VALIDATION");
  }

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    throw new AuthError(passwordError, "WEAK_PASSWORD");
  }

  if (await findUserByEmail(email)) {
    throw new AuthError("Аккаунт с таким e-mail уже существует.", "EMAIL_TAKEN");
  }

  if (phone) {
    const digits = normalizeBelarusMobile(phone);
    const [existingPhone] = digits
      ? await db.select().from(users).where(belarusPhoneEquals(users.phone, digits)).limit(1)
      : [];
    if (existingPhone) {
      throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");
    }
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName) throw new AuthError("Укажите имя.", "VALIDATION");
  if (!lastName) throw new AuthError("Укажите фамилию.", "VALIDATION");

  const passwordHash = await hashPassword(input.password);
  const intent = signupRoleToIntent(input.signupRole);

  const [user] = await db
    .insert(users)
    .values({
      email,
      phone,
      passwordHash,
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

  if (!tokenRow || tokenRow.pendingEmail) {
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

function emailCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  const min = 10 ** (OTP_CODE_LENGTH - 1);
  return String(randomInt(min, max));
}

export async function requestAccountEmailCode(userId: string, emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  const user = await findUserById(userId);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
  if (email === user.email && user.emailVerifiedAt) {
    return { ok: true as const, already: true, message: "Почта уже подтверждена." };
  }

  const taken = await findUserByEmail(email);
  if (taken && taken.id !== userId) {
    throw new AuthError("Этот e-mail уже занят.", "EMAIL_TAKEN");
  }

  const limit = consumeRateLimit(`email-confirm:${userId}`, 60_000, 1);
  if (!limit.ok) {
    throw new AuthError(`Код можно отправить снова через ${limit.retryAfterSec} с.`, "RATE_LIMITED");
  }

  const db = getDb();
  const now = new Date();
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt), isNotNull(emailVerificationTokens.pendingEmail)));

  const code = emailCode();
  await db.insert(emailVerificationTokens).values({
    userId,
    pendingEmail: email,
    tokenHash: hashToken(`${userId}:${code}`),
    expiresAt: addMinutes(now, 10),
  });

  await sendMail({
    to: [email],
    subject: "Код подтверждения trenio.by",
    text: `Код подтверждения почты: ${code}\nОн действует 10 минут. Никому не сообщайте.`,
  });

  const delivered = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
  return {
    ok: true as const,
    already: false,
    message: "Код отправлен на почту.",
    devCode: !delivered && process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function confirmAccountEmailCode(userId: string, emailRaw: string, codeRaw: string) {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  const limit = consumeRateLimit(`email-confirm-try:${userId}`, 15 * 60_000, 5);
  if (!limit.ok) {
    throw new AuthError("Слишком много попыток. Подождите и попробуйте снова.", "RATE_LIMITED");
  }

  const db = getDb();
  const now = new Date();
  const tokenRows = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        eq(emailVerificationTokens.pendingEmail, email),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    )
    .orderBy(desc(emailVerificationTokens.createdAt))
    .limit(8);
  const tokenRow = tokenRows.find((row) => row.tokenHash === hashToken(`${userId}:${code}`));

  if (!tokenRow) {
    throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");
  }

  const taken = await findUserByEmail(email);
  if (taken && taken.id !== userId) {
    throw new AuthError("Этот e-mail уже занят.", "EMAIL_TAKEN");
  }

  await db.update(emailVerificationTokens).set({ usedAt: now }).where(eq(emailVerificationTokens.id, tokenRow.id));
  await db
    .update(users)
    .set({ email, emailVerifiedAt: now, status: "active", updatedAt: now })
    .where(eq(users.id, userId));

  return { ok: true as const, message: "Почта подтверждена." };
}

export async function requestAccountPhoneCode(userId: string, phoneRaw: string) {
  const phoneError = validateBelarusMobile(phoneRaw);
  if (phoneError) throw new AuthError(phoneError, "VALIDATION");
  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) throw new AuthError("Укажите мобильный номер РБ.", "VALIDATION");

  const stored = storedBelarusPhone(phone);
  if (!stored) throw new AuthError("Укажите мобильный номер РБ.", "VALIDATION");
  const db = getDb();
  const user = await findUserById(userId);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
  if (normalizeBelarusMobile(user.phone ?? "") === phone && user.phoneVerifiedAt) {
    return { ok: true as const, already: true, message: "Телефон уже подтверждён." };
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(belarusPhoneEquals(users.phone, phone), ne(users.id, userId)))
    .limit(1);
  if (owner) throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");

  const ipLimit = consumeRateLimit(`otp:user:${userId}`, 60_000, 1);
  if (!ipLimit.ok) {
    throw new AuthError(`Код можно отправить снова через ${ipLimit.retryAfterSec} с.`, "RATE_LIMITED");
  }

  const issued = await issueOtp({ phone, purpose: "verify_phone", userId, send: true });
  if (!issued.ok) {
    throw new AuthError(issued.error, issued.code === "rate_limited" ? "RATE_LIMITED" : "VALIDATION");
  }

  return {
    ok: true as const,
    already: false,
    message: "Код отправлен по SMS.",
    retryAfterSec: issued.retryAfterSec,
    devCode: isSmsByEnabled() ? undefined : issued.devCode,
  };
}

export async function confirmAccountPhoneCode(userId: string, phoneRaw: string, codeRaw: string) {
  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");

  const verified = await verifyOtp({ phone, purpose: "verify_phone", code: codeRaw });
  if (!verified.ok || (verified.userId && verified.userId !== userId)) {
    throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");
  }

  const stored = storedBelarusPhone(phone);
  if (!stored) throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");
  const db = getDb();
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(belarusPhoneEquals(users.phone, phone), ne(users.id, userId)))
    .limit(1);
  if (owner) throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");

  const now = new Date();
  await db
    .update(users)
    .set({ phone: stored, phoneVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, userId));
  await db
    .update(trainerProfiles)
    .set({ phone: stored, updatedAt: now })
    .where(eq(trainerProfiles.ownerUserId, userId));

  return { ok: true as const, message: "Телефон подтверждён." };
}

export async function requestTrainerContactEmailCode(userId: string, emailRaw: string) {
  const email = normalizeEmail(emailRaw);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError("Введите корректный e-mail.", "VALIDATION");
  }

  const db = getDb();
  const [profile] = await db
    .select({ id: trainerProfiles.id, email: trainerProfiles.email, emailVerifiedAt: trainerProfiles.emailVerifiedAt })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!profile) throw new AuthError("Сначала сохраните профиль.", "VALIDATION");
  if (normalizeEmail(profile.email) === email && profile.emailVerifiedAt) {
    return { ok: true as const, already: true, message: "Почта уже подтверждена." };
  }

  const limit = consumeRateLimit(`contact-email:${userId}`, 60_000, 1);
  if (!limit.ok) {
    throw new AuthError(`Код можно отправить снова через ${limit.retryAfterSec} с.`, "RATE_LIMITED");
  }

  const now = new Date();
  const code = emailCode();
  await db.insert(emailVerificationTokens).values({
    userId,
    pendingEmail: email,
    tokenHash: hashToken(`contact:${userId}:${code}`),
    expiresAt: addMinutes(now, 10),
  });

  await sendMail({
    to: [email],
    subject: "Код подтверждения trenio.by",
    text: `Код подтверждения почты для связи: ${code}\nОн действует 10 минут. Никому не сообщайте.`,
  });

  const delivered = Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
  return {
    ok: true as const,
    already: false,
    message: "Код отправлен на почту.",
    devCode: !delivered && process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function confirmTrainerContactEmailCode(userId: string, emailRaw: string, codeRaw: string) {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  const limit = consumeRateLimit(`contact-email-try:${userId}`, 15 * 60_000, 5);
  if (!limit.ok) {
    throw new AuthError("Слишком много попыток. Подождите и попробуйте снова.", "RATE_LIMITED");
  }

  const db = getDb();
  const now = new Date();
  const tokenRows = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        eq(emailVerificationTokens.pendingEmail, email),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, now),
      ),
    )
    .orderBy(desc(emailVerificationTokens.createdAt))
    .limit(8);
  const tokenRow = tokenRows.find((row) => row.tokenHash === hashToken(`contact:${userId}:${code}`));
  if (!tokenRow) throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");

  const [profile] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!profile) throw new AuthError("Сначала сохраните профиль.", "VALIDATION");

  await db.update(emailVerificationTokens).set({ usedAt: now }).where(eq(emailVerificationTokens.id, tokenRow.id));
  await db
    .update(trainerProfiles)
    .set({ email, emailVerifiedAt: now, updatedAt: now })
    .where(eq(trainerProfiles.id, profile.id));

  return { ok: true as const, message: "Почта подтверждена." };
}

export async function updateAccountName(userId: string, firstName: string, lastName: string) {
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  if (!trimmedFirst) {
    throw new AuthError("Укажите имя.", "VALIDATION");
  }
  if (!trimmedLast) {
    throw new AuthError("Укажите фамилию.", "VALIDATION");
  }
  const now = new Date();
  const db = getDb();
  const given = trimmedFirst.slice(0, 100);
  const family = trimmedLast.slice(0, 100);
  await db
    .update(users)
    .set({ firstName: given, lastName: family, updatedAt: now })
    .where(eq(users.id, userId));
  await db
    .update(trainerProfiles)
    .set({ firstName: given, lastName: family, fullName: joinTrainerName(given, family), updatedAt: now })
    .where(eq(trainerProfiles.ownerUserId, userId));
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
    const { writeLog } = await import("@/lib/log/logger");
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.dev",
      outcome: "skipped",
      message: kind === "verification" ? "Ссылка подтверждения в консоли разработки." : "Ссылка сброса в консоли разработки.",
      subject: email,
    });
  }
}

export async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const roles = await getUserRoles(userId);
  return toSessionUser(user, roles);
}
