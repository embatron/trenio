import { randomBytes, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { hashPassword, normalizeEmail, validatePasswordStrength } from "@/auth/password";
import { issueOtp, verifyOtp, GENERIC_OTP_ERROR } from "@/auth/otp";
import { consumeRateLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/auth/rate-limit";
import { isSmsByEnabled } from "@/auth/sms";
import {
  assertUserCanAuthenticate,
  createSession,
  findUserByEmail,
  findUserById,
  loginUser,
} from "@/auth/service";
import {
  isTelegramLoginConfigured,
  parseTelegramWidgetUser,
  verifyTelegramWidgetUser,
} from "@/auth/telegram";
import { verifyTelegramWebAppInitData } from "@/auth/telegram-webapp";
import { getDb } from "@/db";
import { userRoles, users, type User } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail, isReservedAccountEmail, pendingSignupEmail } from "@/lib/auth/pending-email";
import { OTP_RESEND_SECONDS, storedBelarusPhone, validateBelarusMobile, normalizeBelarusMobile } from "@/lib/auth/phone";
import { belarusPhoneEquals } from "@/lib/auth/phone-match";

import { consumePasswordLoginLimit, type IssuedOtp, type LoginMeta } from "@/auth/login-channels";

const SIGNUP_SMS_SENT = "Мы отправили код в SMS.";
const SMS_UNAVAILABLE = "Регистрация по SMS временно недоступна. Зарегистрируйтесь по e-mail.";
const TELEGRAM_FAILED = "Не удалось подтвердить Telegram. Попробуйте ещё раз.";
const PLACEHOLDER_NAME = "Пользователь";

export type SignupSession = {
  session: { token: string };
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
  return createSession(fresh.id, {
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    remember: meta.remember ?? true,
  });
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
  const ipLimit = consumeRateLimit(
    `login:ip:${meta.clientKey}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
  if (!ipLimit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
}

export async function signupWithEmail(
  input: { email: string; password: string },
  meta: LoginMeta,
): Promise<SignupSession | { restore: true }> {
  if (honeypotTripped(meta)) {
    throw new AuthError("Не удалось создать аккаунт. Проверьте почту и пароль.", "INVALID_CREDENTIALS");
  }
  const email = normalizeEmail(input.email);
  if (!email.includes("@") || isReservedAccountEmail(email)) {
    throw new AuthError("Введите корректный e-mail.", "VALIDATION");
  }
  consumePasswordLoginLimit(email, meta.clientKey);

  const existing = await findUserByEmail(email);
  if (existing) {
    const session = await loginUser({
      email,
      password: input.password,
      remember: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    if ("restore" in session) return { restore: true };
    return { session, created: false };
  }

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");

  const now = new Date();
  const passwordHash = await hashPassword(input.password);
  const db = getDb();
  let user: User;
  try {
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        emailVerifiedAt: now,
        firstName: PLACEHOLDER_NAME,
        lastName: null,
        status: "active",
        lastSignupIntent: "client_signup",
      })
      .returning();
    user = created;
    await db.insert(userRoles).values({ userId: user.id, role: "user" });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await findUserByEmail(email);
    if (!raced) throw error;
    const session = await loginUser({
      email,
      password: input.password,
      remember: true,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    if ("restore" in session) return { restore: true };
    return { session, created: false };
  }

  return { session: await openSession(user, meta), created: true };
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

  const ipLimit = consumeRateLimit(`otp:ip:${meta.clientKey}`, RATE_LIMITS.otpIp.windowMs, RATE_LIMITS.otpIp.max);
  const phoneLimit = consumeRateLimit(`otp:phone:${phone}`, RATE_LIMITS.otpPhone.windowMs, RATE_LIMITS.otpPhone.max);
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

  const ipLimit = consumeRateLimit(
    `login:ip:${meta.clientKey}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
  if (!ipLimit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");

  const verified = await verifyOtp({ phone, purpose: "register", code });
  if (!verified.ok) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

  const stored = storedBelarusPhone(phone);
  if (!stored) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

  let user = verified.userId ? await findUserById(verified.userId) : await findUserByPhone(phone);
  let created = false;
  if (!user || user.status === "deleted") {
    try {
      user = await insertClient({ phone: stored, phoneVerified: true });
      created = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      user = await findUserByPhone(phone);
      if (!user || user.status === "deleted") throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
    }
  }

  if (!user || user.status === "deleted") {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
  }
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
  guardTelegram(meta);
  const widget = parseTelegramWidgetUser(raw);
  if (!widget || !verifyTelegramWidgetUser(widget)) {
    throw new AuthError(TELEGRAM_FAILED, "INVALID_CREDENTIALS");
  }
  return finishTelegramSignup(widget, meta);
}

export async function signupWithTelegramWebApp(initData: string, meta: LoginMeta): Promise<SignupSession> {
  guardTelegram(meta);
  const user = verifyTelegramWebAppInitData(initData);
  if (!user) throw new AuthError(TELEGRAM_FAILED, "INVALID_CREDENTIALS");
  return finishTelegramSignup(user, meta);
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
    throw new AuthError("Эта почта уже используется.", "EMAIL_TAKEN");
  }

  const now = new Date();
  await getDb()
    .update(users)
    .set({
      email,
      emailVerifiedAt: now,
      passwordHash: await hashPassword(password),
      status: "active",
      updatedAt: now,
    })
    .where(eq(users.id, userId));
}
