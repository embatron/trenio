import { randomInt } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { authStepUpCodes, authStepUpGrants, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { normalizeBelarusMobile, OTP_CODE_LENGTH } from "@/lib/auth/phone";
import { renderLetter } from "@/lib/mail/letter";
import { sendMail } from "@/lib/mail/send.server";
import { addMinutes, generateSecureToken, hashToken } from "@/auth/tokens";
import { verifyPassword } from "@/auth/password";

import { authMac, authMacEqual } from "./otp";
import { isSmsByEnabled, otpSmsText, sendQuickSms } from "./sms";

const STEP_MINUTES = 10;
const STEP_ATTEMPTS = 5;

function codeDigits(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  const min = 10 ** (OTP_CODE_LENGTH - 1);
  return String(randomInt(min, max));
}

export async function requestStepUpCode(userId: string): Promise<{ message: string; devCode?: string }> {
  const [user] = await getDb()
    .select({
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      phone: users.phone,
      phoneVerifiedAt: users.phoneVerifiedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarPath: users.avatarPath,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
  const emailOk = Boolean(user.emailVerifiedAt) && !isPendingSignupEmail(user.email);
  const phone = user.phoneVerifiedAt ? normalizeBelarusMobile(user.phone ?? "") : null;
  if (!emailOk && !phone) {
    throw new AuthError("Нет подтверждённой почты или телефона, чтобы проверить, что это вы.", "VALIDATION");
  }
  const code = codeDigits();
  const now = new Date();
  const db = getDb();
  await db
    .update(authStepUpCodes)
    .set({ consumedAt: now })
    .where(and(eq(authStepUpCodes.userId, userId), isNull(authStepUpCodes.consumedAt)));
  await db.insert(authStepUpCodes).values({
    userId,
    channel: emailOk ? "email" : "phone",
    codeHash: authMac(`step:${userId}:${code}`),
    expiresAt: addMinutes(now, STEP_MINUTES),
  });
  if (emailOk) {
    const letter = renderLetter({
      service: true,
      title: "Код подтверждения",
      person: {
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Ваш аккаунт",
        avatarUrl: user.avatarPath,
      },
      code,
      lines: ["Он нужен, чтобы сменить почту, телефон или Telegram. Код действует 10 минут."],
    });
    await sendMail({
      to: [user.email],
      subject: "Подтверждение trenio.by",
      text: letter.text,
      html: letter.html,
    });
    return {
      message: "Код отправлен на текущую почту.",
      devCode: process.env.NODE_ENV !== "production" ? code : undefined,
    };
  }
  if (isSmsByEnabled() && phone) {
    const sent = await sendQuickSms(phone, otpSmsText(code));
    if (!sent) throw new AuthError("Не удалось отправить SMS. Попробуйте позже.", "VALIDATION");
  } else if (process.env.NODE_ENV === "production") {
    throw new AuthError("Не удалось отправить SMS. Попробуйте позже.", "VALIDATION");
  }
  return {
    message: "Код отправлен на текущий телефон.",
    devCode: process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

async function codeMatches(userId: string, codeRaw: string): Promise<boolean> {
  const code = codeRaw.replace(/\D/g, "");
  if (code.length !== OTP_CODE_LENGTH) return false;
  const db = getDb();
  const now = new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(authStepUpCodes)
      .where(and(eq(authStepUpCodes.userId, userId), isNull(authStepUpCodes.consumedAt)))
      .limit(1)
      .for("update");
    if (!row || row.expiresAt.getTime() <= now.getTime() || row.attemptCount >= STEP_ATTEMPTS) return false;
    await tx
      .update(authStepUpCodes)
      .set({ attemptCount: row.attemptCount + 1 })
      .where(eq(authStepUpCodes.id, row.id));
    if (!authMacEqual(authMac(`step:${userId}:${code}`), row.codeHash)) return false;
    await tx.update(authStepUpCodes).set({ consumedAt: now }).where(eq(authStepUpCodes.id, row.id));
    return true;
  });
}

export async function issueStepUpGrant(userId: string, proof: { password?: string; code?: string }): Promise<string> {
  const [user] = await getDb()
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
  const passwordOk = proof.password ? await verifyPassword(proof.password, user.passwordHash) : false;
  const codeOk = !passwordOk && proof.code ? await codeMatches(userId, proof.code) : false;
  if (!passwordOk && !codeOk) {
    throw new AuthError("Неверный пароль.", "INVALID_CREDENTIALS");
  }
  const raw = generateSecureToken();
  await getDb().insert(authStepUpGrants).values({
    tokenHash: hashToken(raw),
    userId,
    expiresAt: addMinutes(new Date(), STEP_MINUTES),
  });
  return raw;
}

export async function consumeStepUpGrant(userId: string, raw: string) {
  const now = new Date();
  const [row] = await getDb()
    .update(authStepUpGrants)
    .set({ usedAt: now })
    .where(
      and(
        eq(authStepUpGrants.tokenHash, hashToken(raw)),
        eq(authStepUpGrants.userId, userId),
        isNull(authStepUpGrants.usedAt),
      ),
    )
    .returning({ expiresAt: authStepUpGrants.expiresAt });
  if (!row || row.expiresAt.getTime() <= now.getTime()) {
    throw new AuthError("Сначала подтвердите, что это вы.", "VALIDATION");
  }
}
