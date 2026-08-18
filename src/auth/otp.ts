import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { authOtpChallenges } from "@/db/schema";
import {
  OTP_CODE_LENGTH,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
} from "@/lib/auth/phone";
import { isSmsByEnabled } from "@/lib/sms/sms-by-config.server";
import { otpSmsText, sendQuickSms } from "@/lib/sms/sms-by.server";

export type OtpPurpose = "login" | "verify_phone";

export type OtpIssueResult =
  | { ok: true; retryAfterSec: number; devCode?: string }
  | { ok: false; error: string; retryAfterSec?: number; code: "rate_limited" | "sms_unavailable" | "send_failed" };

function otpPepper(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  return "dev-only-trenio-otp-pepper-32chars!!!!";
}

export function hashOtpCode(phone: string, purpose: OtpPurpose, code: string): string {
  return createHmac("sha256", otpPepper()).update(`${purpose}:${phone}:${code}`).digest("hex");
}

function generateOtpCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  const min = 10 ** (OTP_CODE_LENGTH - 1);
  return String(randomInt(min, max));
}

function allowDevOtpReveal(): boolean {
  return process.env.NODE_ENV !== "production";
}

export async function secondsUntilOtpResend(phone: string, purpose: OtpPurpose): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ createdAt: authOtpChallenges.createdAt })
    .from(authOtpChallenges)
    .where(
      and(eq(authOtpChallenges.phone, phone), eq(authOtpChallenges.purpose, purpose), isNull(authOtpChallenges.consumedAt)),
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
  purpose: OtpPurpose;
  userId?: string | null;
  send: boolean;
}): Promise<OtpIssueResult> {
  const retry = await secondsUntilOtpResend(input.phone, input.purpose);
  if (retry > 0) {
    return { ok: false, error: `Код можно отправить снова через ${retry} с.`, retryAfterSec: retry, code: "rate_limited" };
  }

  const production = process.env.NODE_ENV === "production";
  if (input.send && production && !isSmsByEnabled()) {
    return {
      ok: false,
      error: "Вход по SMS временно недоступен. Войдите по e-mail.",
      code: "sms_unavailable",
    };
  }

  const db = getDb();
  const now = new Date();
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

  await db
    .update(authOtpChallenges)
    .set({ consumedAt: now })
    .where(
      and(eq(authOtpChallenges.phone, input.phone), eq(authOtpChallenges.purpose, input.purpose), isNull(authOtpChallenges.consumedAt)),
    );

  const [inserted] = await db
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
    if (!sent.ok) {
      await db.update(authOtpChallenges).set({ consumedAt: now }).where(eq(authOtpChallenges.id, inserted.id));
      return { ok: false, error: "Не удалось отправить SMS. Попробуйте позже.", code: "send_failed" };
    }
  } else if (input.send && production) {
    await db.update(authOtpChallenges).set({ consumedAt: now }).where(eq(authOtpChallenges.id, inserted.id));
    return {
      ok: false,
      error: "Вход по SMS временно недоступен. Войдите по e-mail.",
      code: "sms_unavailable",
    };
  } else if (input.send) {
    console.info("[sms] OTP issued in dev (not sent)", {
      phone: `${input.phone.slice(0, 6)}***`,
      purpose: input.purpose,
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
  purpose: OtpPurpose;
  code: string;
}): Promise<{ ok: true; userId: string | null; id: string } | { ok: false }> {
  const code = input.code.replace(/\D/g, "");
  if (code.length !== OTP_CODE_LENGTH) return { ok: false };

  const db = getDb();
  const [row] = await db
    .select()
    .from(authOtpChallenges)
    .where(
      and(eq(authOtpChallenges.phone, input.phone), eq(authOtpChallenges.purpose, input.purpose), isNull(authOtpChallenges.consumedAt)),
    )
    .orderBy(desc(authOtpChallenges.createdAt))
    .limit(1);

  if (!row) return { ok: false };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false };
  if (row.attemptCount >= OTP_MAX_ATTEMPTS) return { ok: false };

  await db
    .update(authOtpChallenges)
    .set({ attemptCount: row.attemptCount + 1 })
    .where(eq(authOtpChallenges.id, row.id));

  const expected = hashOtpCode(input.phone, input.purpose, code);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(row.codeHash, "hex");
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return { ok: false };
  }

  await db.update(authOtpChallenges).set({ consumedAt: new Date() }).where(eq(authOtpChallenges.id, row.id));
  return { ok: true, userId: row.userId, id: row.id };
}
