import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { authOtpChallenges, type AuthOtpPurpose } from "@/db/schema";
import {
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
} from "@/lib/auth/phone";

import { isSmsByEnabled, otpSmsText, sendQuickSms } from "./sms";

export const GENERIC_OTP_SENT = "Если номер привязан к аккаунту, мы отправили код.";
export const GENERIC_OTP_ERROR = "Неверный или устаревший код.";

export type OtpIssueResult =
  | { ok: true; retryAfterSec: number; devCode?: string }
  | {
      ok: false;
      error: string;
      retryAfterSec?: number;
      code: "rate_limited" | "sms_unavailable" | "send_failed";
    };

function otpPepper(): string {
  const secret = process.env.SESSION_SECRET ?? "";
  if (secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be at least 32 characters");
  }
  return "dev-only-trenio-otp-pepper-32chars!!";
}

/** HMAC for OTP, email codes, and step-up codes. The pepper is the session secret. */
export function authMac(material: string): string {
  return createHmac("sha256", otpPepper()).update(material).digest("hex");
}

export function authMacEqual(expectedHex: string, actualHex: string): boolean {
  try {
    const left = Buffer.from(expectedHex, "hex");
    const right = Buffer.from(actualHex, "hex");
    return left.length === right.length && left.length > 0 && timingSafeEqual(left, right);
  } catch {
    return false;
  }
}

function hashOtpCode(phone: string, purpose: AuthOtpPurpose, code: string): string {
  return authMac(`${purpose}:${phone}:${code}`);
}

function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  const min = 10 ** (OTP_CODE_LENGTH - 1);
  return String(randomInt(min, max));
}

function allowDevOtpReveal(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function secondsUntilOtpResend(phone: string, purpose: AuthOtpPurpose): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ createdAt: authOtpChallenges.createdAt })
    .from(authOtpChallenges)
    .where(
      and(
        eq(authOtpChallenges.phone, phone),
        eq(authOtpChallenges.purpose, purpose),
        isNull(authOtpChallenges.consumedAt),
      ),
    )
    .orderBy(desc(authOtpChallenges.createdAt))
    .limit(1);
  if (!row) return 0;
  const elapsed = Date.now() - row.createdAt.getTime();
  const waitMs = OTP_RESEND_SECONDS * 1000 - elapsed;
  return waitMs > 0 ? Math.ceil(waitMs / 1000) : 0;
}

export async function issueOtp(input: {
  phone: string;
  purpose: AuthOtpPurpose;
  userId?: string | null;
  send: boolean;
}): Promise<OtpIssueResult> {
  const retry = await secondsUntilOtpResend(input.phone, input.purpose);
  if (retry > 0) {
    return {
      ok: false,
      error: `Код можно отправить снова через ${retry} с.`,
      retryAfterSec: retry,
      code: "rate_limited",
    };
  }

  const production = process.env.NODE_ENV === "production";
  if (input.send && production && !isSmsByEnabled()) {
    return {
      ok: false,
      error: "Вход по SMS временно недоступен. Войдите по e-mail.",
      code: "sms_unavailable",
    };
  }

  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
  const db = getDb();

  await db
    .update(authOtpChallenges)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(authOtpChallenges.phone, input.phone),
        eq(authOtpChallenges.purpose, input.purpose),
        isNull(authOtpChallenges.consumedAt),
      ),
    );

  const [created] = await db
    .insert(authOtpChallenges)
    .values({
      phone: input.phone,
      purpose: input.purpose,
      userId: input.userId ?? null,
      codeHash: hashOtpCode(input.phone, input.purpose, code),
      expiresAt,
    })
    .returning({ id: authOtpChallenges.id });

  if (input.send && isSmsByEnabled()) {
    const sent = await sendQuickSms(input.phone, otpSmsText(code));
    if (!sent) {
      await db
        .update(authOtpChallenges)
        .set({ consumedAt: new Date() })
        .where(eq(authOtpChallenges.id, created.id));
      return {
        ok: false,
        error: "Не удалось отправить SMS. Попробуйте позже.",
        code: "send_failed",
      };
    }
  } else if (input.send && production) {
    await db
      .update(authOtpChallenges)
      .set({ consumedAt: new Date() })
      .where(eq(authOtpChallenges.id, created.id));
    return {
      ok: false,
      error: "Вход по SMS временно недоступен. Войдите по e-mail.",
      code: "sms_unavailable",
    };
  } else if (input.send) {
    console.info(`[auth:sms] ${input.purpose} +${input.phone} → ${code}`);
    const { writeLog, maskPhone } = await import("@/lib/log/logger");
    void writeLog({
      level: "info",
      domain: "sms",
      action: "sms.dev",
      outcome: "skipped",
      message: "Код SMS оставлен в консоли разработки.",
      subject: maskPhone(input.phone),
      context: { purpose: input.purpose },
    });
  }

  return {
    ok: true,
    retryAfterSec: OTP_RESEND_SECONDS,
    devCode: allowDevOtpReveal() ? code : undefined,
  };
}

export async function verifyOtp(input: {
  phone: string;
  purpose: AuthOtpPurpose;
  code: string;
}): Promise<{ ok: true; userId: string | null } | { ok: false }> {
  const code = input.code.replace(/\D/g, "");
  if (code.length !== OTP_CODE_LENGTH) return { ok: false };

  const db = getDb();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(authOtpChallenges)
      .where(
        and(
          eq(authOtpChallenges.phone, input.phone),
          eq(authOtpChallenges.purpose, input.purpose),
          isNull(authOtpChallenges.consumedAt),
        ),
      )
      .orderBy(desc(authOtpChallenges.createdAt))
      .limit(1)
      .for("update");

    if (!row) return { ok: false as const };
    if (row.expiresAt.getTime() < Date.now()) return { ok: false as const };
    if (row.attemptCount >= OTP_MAX_ATTEMPTS) return { ok: false as const };

    await tx
      .update(authOtpChallenges)
      .set({ attemptCount: sql`${authOtpChallenges.attemptCount} + 1` })
      .where(eq(authOtpChallenges.id, row.id));

    const expected = hashOtpCode(input.phone, input.purpose, code);
    if (!authMacEqual(expected, row.codeHash)) return { ok: false as const };

    const [consumed] = await tx
      .update(authOtpChallenges)
      .set({ consumedAt: new Date() })
      .where(and(eq(authOtpChallenges.id, row.id), isNull(authOtpChallenges.consumedAt)))
      .returning({ id: authOtpChallenges.id });
    if (!consumed) return { ok: false as const };
    return { ok: true as const, userId: row.userId };
  });
}

/** Keeps the unknown-number path from returning faster than a short fixed floor. */
export async function matchAuthDelay(startedAt: number, floorMs = 600) {
  const left = floorMs - (Date.now() - startedAt);
  if (left > 0) await new Promise((resolve) => setTimeout(resolve, left));
}
