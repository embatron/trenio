import { randomBytes, randomInt, randomUUID } from "node:crypto";

import { and, desc, eq, isNull, sql } from "drizzle-orm";

import { hashPassword, normalizeEmail, validatePasswordStrength } from "@/auth/password";
import { authMac, authMacEqual, issueOtp, verifyOtp, GENERIC_OTP_ERROR } from "@/auth/otp";
import { consumeRateLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/auth/rate-limit";
import { isSmsByEnabled } from "@/auth/sms";
import {
  assertUserCanAuthenticate,
  beginLogin,
  findUserByEmail,
  findUserById,
  issueSignupEmailProof,
  revokeAllUserSessions,
} from "@/auth/service";
import { acceptTelegramWebApp, acceptTelegramWidget } from "@/auth/telegram-accept";
import { isTelegramLoginConfigured } from "@/auth/telegram";
import { addMinutes } from "@/auth/tokens";
import { getDb } from "@/db";
import { emailVerificationTokens, userRoles, users, type User } from "@/db/schema";
import { decideEmailSignup, decideSmsSignup } from "@/lib/auth/auth-decisions";
import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail, isReservedAccountEmail, pendingSignupEmail } from "@/lib/auth/pending-email";
import { OTP_RESEND_SECONDS, storedBelarusPhone, validateBelarusMobile, normalizeBelarusMobile } from "@/lib/auth/phone";
import { belarusPhoneEquals } from "@/lib/auth/phone-match";
import { renderLetter } from "@/lib/mail/letter";
import { sendMail } from "@/lib/mail/send.server";

import { type IssuedOtp, type LoginMeta } from "@/auth/login-channels";

const SIGNUP_SMS_SENT = "Мы отправили код в SMS.";
const SMS_UNAVAILABLE = "Регистрация по SMS временно недоступна. Зарегистрируйтесь по e-mail.";
const TELEGRAM_FAILED = "Не удалось подтвердить Telegram. Попробуйте ещё раз.";
const PLACEHOLDER_NAME = "Пользователь";

export type SignupSession = {
  session: { token: string } | { totpTicket: string };
  created: boolean;
};

function honeypotTripped(meta: LoginMeta): boolean {
  return Boolean(meta.honeypot?.trim());
}

function firstRetryAfter(
  primary: { ok: true } | { ok: false; retryAfterSec: number },
  secondary: { ok: true } | { ok: false; retryAfterSec: number },
): number {
  if (!primary.ok) return primary.retryAfterSec;
  if (!secondary.ok) return secondary.retryAfterSec;
  return OTP_RESEND_SECONDS;
}

function cleanName(value: string | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, 100);
}

function telegramUsername(value: string | undefined): string | null {
  const clean = (value ?? "").replace(/^@/, "").trim().slice(0, 64);
  return clean || null;
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && current && "code" in current && (current as { code?: string }).code === "23505") {
      return true;
    }
    current = typeof current === "object" && current && "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}

async function findUserByPhone(phone375: string): Promise<User | null> {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(belarusPhoneEquals(users.phone, phone375))
    .limit(1);
  return user ?? null;
}

async function findUserByTelegramId(telegramUserId: number): Promise<User | null> {
  const [user] = await getDb()
    .select()
    .from(users)
    .where(eq(users.telegramUserId, telegramUserId))
    .limit(1);
  return user ?? null;
}

async function openSession(user: User, meta: LoginMeta) {
  await assertUserCanAuthenticate(user);
  const fresh = (await findUserById(user.id)) ?? user;
  const opened = await beginLogin(fresh, {
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    remember: meta.remember ?? true,
  });
  if ("totpTicket" in opened) return opened;
  return { token: opened.token };
}

async function insertClient(input: {
  phone?: string | null;
  phoneVerified?: boolean;
  telegramUserId?: number | null;
  telegramUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
}): Promise<User> {
  const id = randomUUID();
  const now = new Date();
  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const db = getDb();
  const [user] = await db
    .insert(users)
    .values({
      id,
      email: pendingSignupEmail(id),
      phone: input.phone ?? null,
      phoneVerifiedAt: input.phoneVerified ? now : null,
      passwordHash,
      firstName: cleanName(input.firstName ?? "") || PLACEHOLDER_NAME,
      lastName: cleanName(input.lastName ?? "") || null,
      status: "active",
      lastSignupIntent: "client_signup",
      telegramUserId: input.telegramUserId ?? null,
      telegramUsername: input.telegramUsername ?? null,
    })
    .returning();
  await db.insert(userRoles).values({ userId: user.id, role: "user" });
  return user;
}

async function markPhoneVerified(user: User, phone375: string): Promise<User> {
  const stored = storedBelarusPhone(phone375);
  if (!stored) return user;
  const now = new Date();
  const [fresh] = await getDb()
    .update(users)
    .set({
      phone: stored,
      phoneVerifiedAt: user.phoneVerifiedAt ?? now,
      status: user.status === "pending_verification" ? "active" : user.status,
      updatedAt: now,
    })
    .where(eq(users.id, user.id))
    .returning();
  return fresh ?? user;
}

function assertSmsAvailable() {
  if (process.env.NODE_ENV === "production" && !isSmsByEnabled()) {
    throw new AuthError(SMS_UNAVAILABLE, "VALIDATION");
  }
}

function guardTelegram(meta: LoginMeta) {
  if (honeypotTripped(meta)) {
    throw new AuthError(TELEGRAM_FAILED, "INVALID_CREDENTIALS");
  }
  if (!isTelegramLoginConfigured()) {
    throw new AuthError("Регистрация через Telegram сейчас недоступна.", "VALIDATION");
  }
  return consumeRateLimit(
    `login:ip:${meta.clientKey}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
}

const SIGNUP_EMAIL_MESSAGE =
  "Если этот адрес можно использовать, мы отправили письмо со ссылкой. Откройте его и подтвердите почту.";

async function sendSignupLetter(email: string, url: string | null, notice: boolean, trainer = false) {
  const letter = renderLetter({
    service: true,
    title: notice ? "Попытка регистрации" : trainer ? "Кабинет тренера" : "Подтвердите почту",
    lead: notice
      ? "Кто-то указал этот адрес при регистрации на trenio.by. Если это были не вы, ничего делать не нужно."
      : trainer
        ? "Остался один шаг, чтобы открыть кабинет тренера."
        : "Остался один шаг, чтобы пользоваться trenio.by.",
    action: url ? { href: url, label: "Подтвердить почту" } : undefined,
    note: notice ? undefined : "Ссылка действует сутки. Если вы не регистрировались, не открывайте её.",
  });
  await sendMail({
    to: [email],
    subject: notice ? "Попытка регистрации на trenio.by" : "Подтвердите почту trenio.by",
    text: letter.text,
    html: letter.html,
  });
}

export async function signupWithEmail(
  input: { email: string; password: string },
  meta: LoginMeta,
  profile: { firstName?: string; lastName?: string; intent?: "client_signup" | "trainer_create" } = {},
): Promise<{ message: string }> {
  if (honeypotTripped(meta)) return { message: SIGNUP_EMAIL_MESSAGE };
  const email = normalizeEmail(input.email);
  if (!email.includes("@") || isReservedAccountEmail(email)) {
    throw new AuthError("Введите корректный e-mail.", "VALIDATION");
  }
  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");
  const ipLimit = await consumeRateLimit(`signup:ip:${meta.clientKey}`, RATE_LIMITS.loginIp.windowMs, RATE_LIMITS.loginIp.max);
  const emailLimit = await consumeRateLimit(`signup:email:${email}`, RATE_LIMITS.loginId.windowMs, RATE_LIMITS.loginId.max);
  if (!ipLimit.ok || !emailLimit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");

  const existing = await findUserByEmail(email);
  const kind = !existing
    ? "none"
    : existing.emailVerifiedAt || existing.status === "suspended" || existing.status === "deleted"
      ? existing.emailVerifiedAt
        ? "verified"
        : "blocked"
      : "unverified";
  const decision = decideEmailSignup(kind);
  const passwordHash = await hashPassword(input.password);
  const db = getDb();

  try {
    if (decision === "create") {
      const trainer = profile.intent === "trainer_create";
      const [created] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          passwordSetAt: new Date(),
          firstName: cleanName(profile.firstName) || PLACEHOLDER_NAME,
          lastName: cleanName(profile.lastName) || null,
          status: "pending_verification",
          lastSignupIntent: trainer ? "trainer_create" : "client_signup",
        })
        .returning();
      await db.insert(userRoles).values({ userId: created.id, role: "user" });
      const proof = await issueSignupEmailProof(created.id);
      await sendSignupLetter(email, proof.url, false, trainer);
    } else if (decision === "refresh" && existing) {
      const trainer = profile.intent === "trainer_create";
      await db.update(users).set({
        passwordHash,
        passwordSetAt: new Date(),
        needsPassword: false,
        ...(trainer ? {
          firstName: cleanName(profile.firstName) || existing.firstName,
          lastName: cleanName(profile.lastName) || existing.lastName,
          lastSignupIntent: "trainer_create" as const,
        } : {}),
        updatedAt: new Date(),
      }).where(eq(users.id, existing.id));
      const proof = await issueSignupEmailProof(existing.id);
      await sendSignupLetter(email, proof.url, false, trainer);
    } else {
      await sendSignupLetter(email, null, true);
    }
  } catch (error) {
    if (isUniqueViolation(error)) {
      await sendSignupLetter(email, null, true).catch(() => undefined);
      return { message: SIGNUP_EMAIL_MESSAGE };
    }
    throw new AuthError("Не удалось отправить письмо. Попробуйте ещё раз.", "VALIDATION");
  }
  return { message: SIGNUP_EMAIL_MESSAGE };
}

export async function requestSmsSignup(phoneRaw: string, meta: LoginMeta): Promise<IssuedOtp> {
  if (honeypotTripped(meta)) {
    return { message: SIGNUP_SMS_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  const phoneError = validateBelarusMobile(phoneRaw);
  const phone = normalizeBelarusMobile(phoneRaw);
  if (phoneError || !phone) {
    throw new AuthError(phoneError ?? "Некорректный номер", "VALIDATION");
  }

  assertSmsAvailable();

  const ipLimit = await consumeRateLimit(`otp:ip:${meta.clientKey}`, RATE_LIMITS.otpIp.windowMs, RATE_LIMITS.otpIp.max);
  const phoneLimit = await consumeRateLimit(`otp:phone:${phone}`, RATE_LIMITS.otpPhone.windowMs, RATE_LIMITS.otpPhone.max);
  if (!ipLimit.ok || !phoneLimit.ok) {
    const retryAfterSec = firstRetryAfter(phoneLimit, ipLimit);
    throw new AuthError(`Код можно отправить снова через ${retryAfterSec} с.`, "RATE_LIMITED");
  }

  const user = await findUserByPhone(phone);
  const issued = await issueOtp({
    phone,
    purpose: "register",
    userId: user && user.status !== "deleted" ? user.id : null,
    send: true,
  });
  if (!issued.ok) {
    if (issued.code === "rate_limited") throw new AuthError(issued.error, "RATE_LIMITED");
    throw new AuthError(
      issued.code === "sms_unavailable" ? SMS_UNAVAILABLE : "Не удалось отправить SMS. Попробуйте позже.",
      "VALIDATION",
    );
  }

  return {
    message: SIGNUP_SMS_SENT,
    retryAfterSec: issued.retryAfterSec,
    devCode: issued.devCode,
  };
}

export async function confirmSmsSignup(phoneRaw: string, code: string, meta: LoginMeta): Promise<SignupSession> {
  if (honeypotTripped(meta)) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
  }

  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

  const ipLimit = await consumeRateLimit(
    `login:ip:${meta.clientKey}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
  if (!ipLimit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");

  const verified = await verifyOtp({ phone, purpose: "register", code });
  if (!verified.ok) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

  const stored = storedBelarusPhone(phone);
  if (!stored) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

  const current = await findUserByPhone(phone);
  const owner = current && current.status !== "deleted" ? current : null;
  const challenge = verified.userId ? await findUserById(verified.userId) : null;
  const decision = decideSmsSignup({
    challengeUserId: verified.userId,
    ownerStillHasPhone: Boolean(challenge && owner && challenge.id === owner.id),
    phoneIsFree: !owner,
  });
  if (decision === "refuse") throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

  let user = decision === "login" ? owner : null;
  let created = false;
  if (decision === "create") {
    try {
      user = await insertClient({ phone: stored, phoneVerified: true });
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
    }
  }
  if (!user) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
  if (!created) {
    try {
      user = await markPhoneVerified(user, phone);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");
    }
  }
  return { session: await openSession(user, meta), created };
}

async function finishTelegramSignup(
  profile: { id: number; first_name?: string; last_name?: string; username?: string },
  meta: LoginMeta,
): Promise<SignupSession> {
  let user = await findUserByTelegramId(profile.id);
  let created = false;
  if (!user || user.status === "deleted") {
    try {
      user = await insertClient({
        telegramUserId: profile.id,
        telegramUsername: telegramUsername(profile.username),
        firstName: profile.first_name,
        lastName: profile.last_name,
      });
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      user = await findUserByTelegramId(profile.id);
      if (!user || user.status === "deleted") throw new AuthError(TELEGRAM_FAILED, "INVALID_CREDENTIALS");
    }
  } else {
    const username = telegramUsername(profile.username);
    if (username && username !== user.telegramUsername) {
      await getDb()
        .update(users)
        .set({ telegramUsername: username, updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
  }

  return { session: await openSession(user, meta), created };
}

export async function signupWithTelegramWidget(raw: unknown, meta: LoginMeta): Promise<SignupSession> {
  const limit = await guardTelegram(meta);
  if (!limit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  const widget = await acceptTelegramWidget(raw);
  if (!widget) throw new AuthError(TELEGRAM_FAILED, "INVALID_CREDENTIALS");
  return finishTelegramSignup(widget, meta);
}

export async function signupWithTelegramWebApp(initData: string, meta: LoginMeta): Promise<SignupSession> {
  const limit = await guardTelegram(meta);
  if (!limit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  const user = await acceptTelegramWebApp(initData);
  if (!user) throw new AuthError(TELEGRAM_FAILED, "INVALID_CREDENTIALS");
  return finishTelegramSignup(user, meta);
}

async function sendMailboxCode(userId: string, email: string) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = new Date();
  const db = getDb();
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(and(eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt)));
  await db.insert(emailVerificationTokens).values({
    userId,
    pendingEmail: email,
    tokenHash: authMac(`email:${userId}:${email}:${code}`),
    expiresAt: addMinutes(now, 10),
  });
  const letter = renderLetter({
    service: true,
    title: "Код подтверждения почты",
    code,
    lines: ["Он действует 10 минут. Никому не сообщайте."],
  });
  await sendMail({
    to: [email],
    subject: "Код подтверждения trenio.by",
    text: letter.text,
    html: letter.html,
  });
  return process.env.NODE_ENV === "production" ? undefined : code;
}

async function takeMailboxCode(userId: string, email: string, code: string) {
  const db = getDb();
  const now = new Date();
  const row = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          eq(emailVerificationTokens.pendingEmail, email),
          isNull(emailVerificationTokens.usedAt),
        ),
      )
      .orderBy(desc(emailVerificationTokens.createdAt))
      .limit(1)
      .for("update");
    if (!locked || locked.expiresAt.getTime() <= now.getTime() || locked.attemptCount >= 5) return null;
    await tx
      .update(emailVerificationTokens)
      .set({ attemptCount: sql`${emailVerificationTokens.attemptCount} + 1` })
      .where(eq(emailVerificationTokens.id, locked.id));
    return locked;
  });
  if (!row) throw new AuthError("Код неверный или устарел.", "INVALID_TOKEN");
  const expected = authMac(`email:${userId}:${email}:${code.trim()}`);
  if (!authMacEqual(expected, row.tokenHash)) throw new AuthError("Код неверный или устарел.", "INVALID_TOKEN");
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(and(eq(emailVerificationTokens.id, row.id), isNull(emailVerificationTokens.usedAt)));
}

export async function saveSignupCredentials(userId: string, emailRaw: string, password: string) {
  const user = await findUserById(userId);
  if (!user || user.status === "deleted" || user.status === "suspended") {
    throw new AuthError("Аккаунт недоступен.", "UNAUTHORIZED");
  }
  if (!isPendingSignupEmail(user.email)) {
    throw new AuthError("Почта уже сохранена. Изменить её можно в настройках.", "VALIDATION");
  }

  const email = normalizeEmail(emailRaw);
  if (isReservedAccountEmail(email)) {
    throw new AuthError("Введите корректный e-mail.", "VALIDATION");
  }
  const passwordError = validatePasswordStrength(password);
  if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");

  const taken = await findUserByEmail(email);
  if (taken && taken.id !== userId) {
    if (taken.emailVerifiedAt && taken.status !== "deleted" && taken.status !== "suspended") {
      return { ok: true as const, linkAvailable: true as const };
    }
    throw new AuthError("Эта почта уже используется.", "EMAIL_TAKEN");
  }

  await getDb()
    .update(users)
    .set({ passwordHash: await hashPassword(password), passwordSetAt: new Date(), needsPassword: false, updatedAt: new Date() })
    .where(eq(users.id, userId));
  const devCode = await sendMailboxCode(userId, email);
  return { ok: true as const, needsCode: true as const, devCode };
}

export async function confirmSignupCredentials(userId: string, emailRaw: string, code: string) {
  const user = await findUserById(userId);
  if (!user || !isPendingSignupEmail(user.email)) {
    throw new AuthError("Почта уже сохранена.", "VALIDATION");
  }
  const email = normalizeEmail(emailRaw);
  await takeMailboxCode(userId, email, code);
  const taken = await findUserByEmail(email);
  if (taken && taken.id !== userId) throw new AuthError("Эта почта уже используется.", "EMAIL_TAKEN");
  const now = new Date();
  await getDb()
    .update(users)
    .set({ email, emailVerifiedAt: now, status: "active", updatedAt: now })
    .where(eq(users.id, userId));
  return { ok: true as const };
}

export async function requestSignupLink(userId: string, emailRaw: string) {
  const shell = await findUserById(userId);
  if (!shell || !isPendingSignupEmail(shell.email)) {
    throw new AuthError("Почта уже сохранена.", "VALIDATION");
  }
  const email = normalizeEmail(emailRaw);
  const target = await findUserByEmail(email);
  if (!target?.emailVerifiedAt || target.status === "deleted" || target.status === "suspended") {
    throw new AuthError("Эта почта уже используется.", "EMAIL_TAKEN");
  }
  const devCode = await sendMailboxCode(userId, email);
  return { ok: true as const, devCode };
}

export async function confirmSignupLink(
  userId: string,
  emailRaw: string,
  code: string,
  meta: LoginMeta,
): Promise<SignupSession> {
  const shell = await findUserById(userId);
  if (!shell || !isPendingSignupEmail(shell.email)) {
    throw new AuthError("Почта уже сохранена.", "VALIDATION");
  }
  const email = normalizeEmail(emailRaw);
  await takeMailboxCode(userId, email, code);
  const target = await findUserByEmail(email);
  if (!target?.emailVerifiedAt || target.status === "deleted" || target.status === "suspended") {
    throw new AuthError("Эта почта уже используется.", "EMAIL_TAKEN");
  }
  const shellPhone = shell.phoneVerifiedAt ? shell.phone : null;
  const shellTelegram = shell.telegramUserId;
  if (shellPhone && target.phoneVerifiedAt && target.phone !== shell.phone) {
    throw new AuthError("На той почте уже указан другой телефон.", "VALIDATION");
  }
  if (shellTelegram && target.telegramUserId && target.telegramUserId !== shellTelegram) {
    throw new AuthError("На той почте уже указан другой Telegram.", "VALIDATION");
  }
  if (shellPhone && !target.phone) {
    /* moved below */
  } else if (shellPhone && target.phone && target.phone !== shell.phone) {
    throw new AuthError("На той почте уже указан другой телефон.", "VALIDATION");
  }
  const now = new Date();
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({
        phone: null,
        phoneVerifiedAt: null,
        telegramUserId: null,
        telegramUsername: null,
        status: "deleted",
        deletedAt: now,
        updatedAt: now,
      })
      .where(eq(users.id, shell.id));
    await tx
      .update(users)
      .set({
        phone: shellPhone && !target.phone ? shell.phone : target.phone,
        phoneVerifiedAt: shellPhone && !target.phone ? shell.phoneVerifiedAt : target.phoneVerifiedAt,
        telegramUserId: shellTelegram && !target.telegramUserId ? shell.telegramUserId : target.telegramUserId,
        telegramUsername:
          shellTelegram && !target.telegramUserId ? shell.telegramUsername : target.telegramUsername,
        updatedAt: now,
      })
      .where(eq(users.id, target.id));
  });
  await revokeAllUserSessions(shell.id);
  const fresh = (await findUserById(target.id)) ?? target;
  return { session: await openSession(fresh, meta), created: false };
}
