import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import {
  authOtpChallenges,
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  trainerProfiles,
  trainerReviews,
} from "@/db/schema";

export type AdminUserLogin = {
  id: string;
  createdAt: string;
  expiresAt: string;
  ip: string;
  userAgent: string;
  active: boolean;
};

export type AdminUserLog = {
  at: string;
  title: string;
  detail: string;
};

const OTP_LABEL = {
  login: "Код для входа",
  verify_phone: "Код подтверждения телефона",
  register: "Код регистрации",
  reset_password: "Код сброса пароля",
} as const;

const REVIEW_STATUS_LABEL = { pending: "На модерации", published: "Опубликован", rejected: "Отклонён" } as const;

const SIGNUP_INTENT_LABEL: Record<string, string> = {
  client_signup: "Регистрация клиента",
  trainer_create: "Регистрация тренера",
  branch_create: "Регистрация клуба",
  brand_create: "Регистрация бренда",
  trainer_claim: "Забор карточки тренера",
};

const TRAINER_SOURCE_LABEL = { self: "Сам тренер", branch_created: "Филиал", admin_created: "Администратор", import: "Импорт" } as const;

const CLAIM_LABEL = { unclaimed: "Не забран", claimed: "Привязан", disputed: "Спор" } as const;

export async function loadAdminUserActivity(userId: string, options?: { reviewLimit?: number; loginLimit?: number }) {
  const reviewLimit = options?.reviewLimit ?? 40;
  const loginLimit = options?.loginLimit ?? 40;
  const db = getDb();
  const now = Date.now();

  const [loginRows, resetRows, emailRows, otpRows, reviewRows, trainerRows] = await Promise.all([
    db
      .select({
        id: sessions.id,
        createdAt: sessions.createdAt,
        expiresAt: sessions.expiresAt,
        ipAddress: sessions.ipAddress,
        userAgent: sessions.userAgent,
      })
      .from(sessions)
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.createdAt))
      .limit(loginLimit),
    db
      .select({ createdAt: passwordResetTokens.createdAt, usedAt: passwordResetTokens.usedAt })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, userId))
      .orderBy(desc(passwordResetTokens.createdAt))
      .limit(20),
    db
      .select({
        createdAt: emailVerificationTokens.createdAt,
        usedAt: emailVerificationTokens.usedAt,
        pendingEmail: emailVerificationTokens.pendingEmail,
      })
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.userId, userId))
      .orderBy(desc(emailVerificationTokens.createdAt))
      .limit(20),
    db
      .select({
        purpose: authOtpChallenges.purpose,
        createdAt: authOtpChallenges.createdAt,
        consumedAt: authOtpChallenges.consumedAt,
        attemptCount: authOtpChallenges.attemptCount,
      })
      .from(authOtpChallenges)
      .where(eq(authOtpChallenges.userId, userId))
      .orderBy(desc(authOtpChallenges.createdAt))
      .limit(20),
    db
      .select({
        authorName: trainerReviews.authorName,
        rating: trainerReviews.rating,
        status: trainerReviews.status,
        createdAt: trainerReviews.createdAt,
        trainerSlug: trainerReviews.trainerSlug,
      })
      .from(trainerReviews)
      .where(eq(trainerReviews.userId, userId))
      .orderBy(desc(trainerReviews.createdAt))
      .limit(reviewLimit),
    db
      .select({
        slug: trainerProfiles.slug,
        fullName: trainerProfiles.fullName,
        createdAt: trainerProfiles.createdAt,
        updatedAt: trainerProfiles.updatedAt,
        claimedAt: trainerProfiles.claimedAt,
        claimStatus: trainerProfiles.claimStatus,
        createdSource: trainerProfiles.createdSource,
        offerAcceptedAt: trainerProfiles.offerAcceptedAt,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, userId)),
  ]);

  const logins: AdminUserLogin[] = loginRows.map((login) => ({
    id: login.id,
    createdAt: login.createdAt.toISOString(),
    expiresAt: login.expiresAt.toISOString(),
    ip: login.ipAddress || "—",
    userAgent: login.userAgent || "—",
    active: login.expiresAt.getTime() > now,
  }));

  return { logins, reviewRows, trainerRows, resetRows, emailRows, otpRows };
}

export function buildAdminUserLogs(input: {
  createdAt: Date;
  updatedAt: Date;
  emailVerifiedAt: Date | null;
  phoneVerifiedAt: Date | null;
  lastSignupIntent: string | null;
  lastLoginAt: Date | null;
  reviewRows: Array<{
    authorName: string;
    rating: number;
    status: string;
    createdAt: Date;
    trainerSlug: string;
  }>;
  trainerRows: Array<{
    slug: string;
    fullName: string;
    createdAt: Date;
    updatedAt: Date;
    claimedAt: Date | null;
    claimStatus: keyof typeof CLAIM_LABEL;
    createdSource: keyof typeof TRAINER_SOURCE_LABEL;
    offerAcceptedAt: Date | null;
  }>;
  resetRows: Array<{ createdAt: Date; usedAt: Date | null }>;
  emailRows: Array<{ createdAt: Date; usedAt: Date | null; pendingEmail: string | null }>;
  otpRows: Array<{
    purpose: keyof typeof OTP_LABEL;
    createdAt: Date;
    consumedAt: Date | null;
    attemptCount: number;
  }>;
  limit?: number;
}): AdminUserLog[] {
  const logs: AdminUserLog[] = [
    {
      at: input.createdAt.toISOString(),
      title: "Аккаунт создан",
      detail: input.lastSignupIntent ? SIGNUP_INTENT_LABEL[input.lastSignupIntent] ?? input.lastSignupIntent : "",
    },
  ];
  if (input.emailVerifiedAt) {
    logs.push({ at: input.emailVerifiedAt.toISOString(), title: "Почта подтверждена", detail: "" });
  }
  if (input.phoneVerifiedAt) {
    logs.push({ at: input.phoneVerifiedAt.toISOString(), title: "Телефон подтверждён", detail: "" });
  }
  if (input.updatedAt.getTime() - input.createdAt.getTime() > 1000) {
    logs.push({ at: input.updatedAt.toISOString(), title: "Профиль изменён", detail: "" });
  }
  if (input.lastLoginAt) {
    logs.push({ at: input.lastLoginAt.toISOString(), title: "Последний вход", detail: "" });
  }
  for (const trainer of input.trainerRows) {
    logs.push({
      at: trainer.createdAt.toISOString(),
      title: "Карточка тренера",
      detail: `${trainer.fullName || trainer.slug} · ${TRAINER_SOURCE_LABEL[trainer.createdSource]}`,
    });
    if (trainer.updatedAt.getTime() - trainer.createdAt.getTime() > 1000) {
      logs.push({
        at: trainer.updatedAt.toISOString(),
        title: "Карточка тренера изменена",
        detail: trainer.fullName || trainer.slug,
      });
    }
    if (trainer.claimedAt) {
      logs.push({
        at: trainer.claimedAt.toISOString(),
        title: "Карточка тренера привязана",
        detail: `${trainer.fullName || trainer.slug} · ${CLAIM_LABEL[trainer.claimStatus]}`,
      });
    }
    if (trainer.offerAcceptedAt) {
      logs.push({
        at: trainer.offerAcceptedAt.toISOString(),
        title: "Оферта принята",
        detail: trainer.fullName || trainer.slug,
      });
    }
  }
  for (const review of input.reviewRows) {
    logs.push({
      at: review.createdAt.toISOString(),
      title: `Отзыв · ${REVIEW_STATUS_LABEL[review.status as keyof typeof REVIEW_STATUS_LABEL] ?? review.status}`,
      detail: `${review.authorName}, ${review.rating} из 5 · ${review.trainerSlug}`,
    });
  }
  for (const token of input.resetRows) {
    logs.push({
      at: token.createdAt.toISOString(),
      title: "Сброс пароля",
      detail: token.usedAt ? "Ссылка использована" : "Ссылка отправлена",
    });
  }
  for (const token of input.emailRows) {
    logs.push({
      at: token.createdAt.toISOString(),
      title: "Подтверждение почты",
      detail: token.pendingEmail ? token.pendingEmail : token.usedAt ? "Письмо подтверждено" : "Письмо отправлено",
    });
  }
  for (const otp of input.otpRows) {
    logs.push({
      at: otp.createdAt.toISOString(),
      title: OTP_LABEL[otp.purpose],
      detail: otp.consumedAt ? "Код использован" : `Код не использован, попыток: ${otp.attemptCount}`,
    });
  }
  logs.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return logs.slice(0, input.limit ?? 80);
}
