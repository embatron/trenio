import { and, eq, isNotNull } from "drizzle-orm";

import { belarusPhoneEquals } from "@/lib/auth/phone-match";

import { getDb } from "@/db";
import { users, type User } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { validatePasswordStrength } from "@/lib/auth/password-policy";
import {
  normalizeBelarusMobile,
  OTP_RESEND_SECONDS,
  validateBelarusMobile,
} from "@/lib/auth/phone";
import { hashPassword } from "@/auth/password";
import { GENERIC_OTP_ERROR, GENERIC_OTP_SENT, issueOtp, verifyOtp } from "@/auth/otp";
import { consumeRateLimit, RATE_LIMITED_MESSAGE, RATE_LIMITS } from "@/auth/rate-limit";
import { isSmsByEnabled } from "@/auth/sms";
import {
  assertUserCanAuthenticate,
  createSession,
  findUserById,
} from "@/auth/service";
import {
  isTelegramLoginConfigured,
  parseTelegramWidgetUser,
  verifyTelegramWidgetUser,
} from "@/auth/telegram";
import { verifyTelegramWebAppInitData } from "@/auth/telegram-webapp";

const TELEGRAM_NOT_LINKED =
  "Этот Telegram ещё не привязан к аккаунту trenio.by. Войдите по e-mail и подключите его в профиле.";

const SMS_UNAVAILABLE = "Вход по SMS временно недоступен. Войдите по e-mail.";
const SMS_RESET_UNAVAILABLE = "Сброс по SMS временно недоступен.";

export type IssuedOtp = {
  message: string;
  retryAfterSec: number;
  devCode?: string;
};

export type LoginMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
  clientKey: string;
  honeypot?: string;
  remember?: boolean;
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

async function findUserByVerifiedPhone(phone375: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db
    .select()
    .from(users)
    .where(and(belarusPhoneEquals(users.phone, phone375), isNotNull(users.phoneVerifiedAt)))
    .limit(1);
  return user ?? null;
}

async function findUserByTelegramId(telegramUserId: number): Promise<User | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.telegramUserId, telegramUserId)).limit(1);
  return user ?? null;
}

async function openSession(user: User, meta: LoginMeta) {
  await assertUserCanAuthenticate(user);
  return createSession(user.id, {
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    remember: meta.remember ?? true,
  });
}

function assertSmsAvailable() {
  if (process.env.NODE_ENV === "production" && !isSmsByEnabled()) {
    throw new AuthError(SMS_UNAVAILABLE, "VALIDATION");
  }
}

export async function requestSmsLogin(phoneRaw: string, meta: LoginMeta): Promise<IssuedOtp> {
  if (honeypotTripped(meta)) {
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
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

  const user = await findUserByVerifiedPhone(phone);
  if (!user || user.status === "deleted") {
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  const issued = await issueOtp({ phone, purpose: "login", userId: user.id, send: true });
  if (!issued.ok) {
    if (issued.code === "rate_limited") throw new AuthError(issued.error, "RATE_LIMITED");
    throw new AuthError(
      issued.code === "sms_unavailable" ? SMS_UNAVAILABLE : "Не удалось отправить SMS. Попробуйте позже.",
      "VALIDATION",
    );
  }

  return {
    message: GENERIC_OTP_SENT,
    retryAfterSec: issued.retryAfterSec,
    devCode: issued.devCode,
  };
}

export async function confirmSmsLogin(phoneRaw: string, code: string, meta: LoginMeta) {
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

  const verified = await verifyOtp({ phone, purpose: "login", code });
  const user = verified.ok ? await findUserByVerifiedPhone(phone) : null;
  if (!verified.ok || !user || user.status === "deleted" || (verified.userId && verified.userId !== user.id)) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
  }

  return openSession(user, meta);
}

export async function requestPasswordResetByPhone(phoneRaw: string, meta: LoginMeta): Promise<IssuedOtp> {
  if (honeypotTripped(meta)) {
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  const phoneError = validateBelarusMobile(phoneRaw);
  const phone = normalizeBelarusMobile(phoneRaw);
  if (phoneError || !phone) {
    throw new AuthError(phoneError ?? "Некорректный номер", "VALIDATION");
  }

  if (process.env.NODE_ENV === "production" && !isSmsByEnabled()) {
    throw new AuthError(SMS_RESET_UNAVAILABLE, "VALIDATION");
  }

  const ipLimit = consumeRateLimit(
    `forgot:ip:${meta.clientKey}`,
    RATE_LIMITS.forgotIp.windowMs,
    RATE_LIMITS.forgotIp.max,
  );
  const phoneLimit = consumeRateLimit(
    `otp:reset:${phone}`,
    RATE_LIMITS.otpPhone.windowMs,
    RATE_LIMITS.otpPhone.max,
  );
  if (!ipLimit.ok || !phoneLimit.ok) {
    const retryAfterSec = firstRetryAfter(phoneLimit, ipLimit);
    throw new AuthError(`Код можно отправить снова через ${retryAfterSec} с.`, "RATE_LIMITED");
  }

  const user = await findUserByVerifiedPhone(phone);
  if (!user || user.status === "deleted") {
    return { message: GENERIC_OTP_SENT, retryAfterSec: OTP_RESEND_SECONDS };
  }

  const issued = await issueOtp({ phone, purpose: "reset_password", userId: user.id, send: true });
  if (!issued.ok) {
    throw new AuthError(
      issued.code === "sms_unavailable"
        ? SMS_RESET_UNAVAILABLE
        : issued.code === "rate_limited"
          ? issued.error
          : "Не удалось отправить SMS. Попробуйте позже.",
      issued.code === "rate_limited" ? "RATE_LIMITED" : "VALIDATION",
    );
  }

  return {
    message: GENERIC_OTP_SENT,
    retryAfterSec: issued.retryAfterSec,
    devCode: issued.devCode,
  };
}

export async function confirmPasswordResetByPhone(
  input: { phone: string; code: string; password: string },
  meta: LoginMeta,
) {
  if (honeypotTripped(meta)) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
  }

  const phone = normalizeBelarusMobile(input.phone);
  if (!phone) throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");

  const ipLimit = consumeRateLimit(
    `login:ip:${meta.clientKey}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
  if (!ipLimit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");

  const verified = await verifyOtp({ phone, purpose: "reset_password", code: input.code });
  const user = verified.ok ? await findUserByVerifiedPhone(phone) : null;
  if (!verified.ok || !user || user.status === "deleted" || (verified.userId && verified.userId !== user.id)) {
    throw new AuthError(GENERIC_OTP_ERROR, "INVALID_CREDENTIALS");
  }

  const passwordHash = await hashPassword(input.password);
  const db = getDb();
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  const fresh = (await findUserById(user.id)) ?? user;
  return openSession(fresh, meta);
}

async function completeTelegramLogin(
  telegramUserId: number,
  username: string | undefined,
  meta: LoginMeta,
) {
  const user = await findUserByTelegramId(telegramUserId);
  if (!user || user.status === "deleted" || (!user.emailVerifiedAt && !user.phoneVerifiedAt)) {
    throw new AuthError(TELEGRAM_NOT_LINKED, "INVALID_CREDENTIALS");
  }

  if (username && username !== user.telegramUsername) {
    const db = getDb();
    await db
      .update(users)
      .set({ telegramUsername: username.slice(0, 64), updatedAt: new Date() })
      .where(eq(users.id, user.id));
  }

  const fresh = (await findUserById(user.id)) ?? user;
  return openSession(fresh, meta);
}

function guardTelegram(meta: LoginMeta) {
  if (honeypotTripped(meta)) {
    throw new AuthError("Неверный e-mail или пароль.", "INVALID_CREDENTIALS");
  }
  if (!isTelegramLoginConfigured()) {
    throw new AuthError("Вход через Telegram сейчас недоступен.", "VALIDATION");
  }
  const ipLimit = consumeRateLimit(
    `login:ip:${meta.clientKey}`,
    RATE_LIMITS.loginIp.windowMs,
    RATE_LIMITS.loginIp.max,
  );
  if (!ipLimit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
}

export async function loginWithTelegramWidget(raw: unknown, meta: LoginMeta) {
  guardTelegram(meta);
  const widget = parseTelegramWidgetUser(raw);
  if (!widget || !verifyTelegramWidgetUser(widget)) {
    throw new AuthError("Не удалось подтвердить Telegram. Попробуйте ещё раз.", "INVALID_CREDENTIALS");
  }
  return completeTelegramLogin(widget.id, widget.username, meta);
}

export async function loginWithTelegramWebApp(initData: string, meta: LoginMeta) {
  guardTelegram(meta);
  const user = verifyTelegramWebAppInitData(initData);
  if (!user) {
    throw new AuthError("Не удалось подтвердить Telegram. Попробуйте ещё раз.", "INVALID_CREDENTIALS");
  }
  return completeTelegramLogin(user.id, user.username, meta);
}

export function consumePasswordLoginLimit(email: string, clientKey: string) {
  const ipLimit = consumeRateLimit(`login:ip:${clientKey}`, RATE_LIMITS.loginIp.windowMs, RATE_LIMITS.loginIp.max);
  const idLimit = consumeRateLimit(
    `login:id:${email.trim().toLowerCase()}`,
    RATE_LIMITS.loginId.windowMs,
    RATE_LIMITS.loginId.max,
  );
  if (!ipLimit.ok || !idLimit.ok) {
    throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
  }
}

export function consumeForgotEmailLimit(clientKey: string) {
  const ipLimit = consumeRateLimit(`forgot:ip:${clientKey}`, RATE_LIMITS.forgotIp.windowMs, RATE_LIMITS.forgotIp.max);
  if (!ipLimit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
}
