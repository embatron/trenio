import { and, avg, count, desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalAuthMiddleware, requireAuthMiddleware } from "@/auth/middleware";
import type { SessionUser } from "@/auth/service";
import { getDb } from "@/db";
import { trainerProfiles, trainerReviews, users, type TrainerReviewMessage } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { writeLog } from "@/lib/log/logger";
import { isStaff } from "@/lib/auth/roles";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import { loadTrainerInterest } from "@/lib/catalog/trainer-interest";
import { notifyAuthorAboutReview, notifyStaffAboutReview } from "@/lib/catalog/review-mail.server";
import { reviewPlainText, sanitizeReviewHtml } from "@/lib/catalog/review-html";
import type { TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";

export const REVIEW_STATUSES = ["pending", "published", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

const slugSchema = z.string().trim().min(1).max(80);
const reviewTextSchema = z
  .string()
  .trim()
  .max(8000)
  .transform(sanitizeReviewHtml)
  .refine((html) => {
    const length = reviewPlainText(html).length;
    return length >= 10 && length <= 1000;
  }, "Напишите от 10 до 1000 символов");

export type PublicReviewMessage = {
  role: "trainer" | "author";
  author: string;
  avatarPath: string;
  body: string;
  date: string;
};

export type PublicTrainerReview = {
  id: string;
  author: string;
  avatarPath: string;
  date: string;
  rating: number;
  text: string;
  messages: PublicReviewMessage[];
  isMine: boolean;
};

export type TrainerReviewSummary = {
  value: string;
  ratingCount: number;
  reviewCount: number;
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function storedThread(row: {
  messages: TrainerReviewMessage[] | null;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
}): TrainerReviewMessage[] {
  const raw = Array.isArray(row.messages) ? row.messages : [];
  const parsed = raw.flatMap((item) => {
    if (!item || (item.role !== "trainer" && item.role !== "author") || !item.body?.trim()) return [];
    return [{ role: item.role, body: item.body.trim(), at: item.at || row.createdAt.toISOString() }];
  });
  if (parsed.length) return parsed;
  if (row.reply?.trim()) {
    return [{ role: "trainer", body: row.reply.trim(), at: (row.repliedAt ?? row.createdAt).toISOString() }];
  }
  return [];
}

function publicMessages(
  row: {
    authorName: string;
    messages: TrainerReviewMessage[] | null;
    reply: string | null;
    repliedAt: Date | null;
    createdAt: Date;
  },
  faces: { author: string; trainer: string },
): PublicReviewMessage[] {
  return storedThread(row).map((message) => ({
    role: message.role,
    author: message.role === "trainer" ? "Тренер" : row.authorName,
    avatarPath: message.role === "trainer" ? faces.trainer : faces.author,
    body: message.body,
    date: dateFormat.format(new Date(message.at)),
  }));
}

function profileFace(row: { photos: string[] | null; avatarPath: string } | undefined) {
  return (row?.photos?.[0] || row?.avatarPath || "").split("?")[0];
}

function authorName(user: SessionUser) {
  const last = user.lastName?.trim();
  const name = last ? `${user.firstName} ${last.slice(0, 1)}.` : user.firstName;
  return name.slice(0, 120);
}

function summarize(rows: Array<{ rating: number }>): TrainerReviewSummary {
  if (rows.length === 0) {
    return { value: "0", ratingCount: 0, reviewCount: 0 };
  }
  const total = rows.reduce((sum, row) => sum + row.rating, 0);
  return {
    value: (total / rows.length).toFixed(1),
    ratingCount: rows.length,
    reviewCount: rows.length,
  };
}

export const listTrainerRatingSummariesFn = createServerFn({ method: "GET" }).handler(async () => {
  const [rows, interest] = await Promise.all([
    getDb()
      .select({
        slug: trainerReviews.trainerSlug,
        reviews: count(),
        average: avg(trainerReviews.rating),
      })
      .from(trainerReviews)
      .where(eq(trainerReviews.status, "published"))
      .groupBy(trainerReviews.trainerSlug),
    loadTrainerInterest(),
  ]);

  const summaries: Record<string, TrainerRatingSnapshot> = {};
  const blank = (slug: string): TrainerRatingSnapshot => {
    const signal = interest[slug] ?? { views: 0, saves: 0 };
    return { rating: "0", reviews: 0, views: signal.views, saves: signal.saves };
  };
  for (const slug of Object.keys(interest)) summaries[slug] = blank(slug);
  for (const row of rows) {
    if (!getPublishedTrainer(row.slug)) continue;
    const reviews = Number(row.reviews);
    const average = Number(row.average);
    if (!Number.isFinite(reviews) || reviews <= 0 || !Number.isFinite(average)) continue;
    summaries[row.slug] = { ...blank(row.slug), rating: average.toFixed(1), reviews };
  }
  return summaries;
});

export const listTrainerReviewsFn = createServerFn({ method: "GET" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({ slug: slugSchema }))
  .handler(async ({ data, context }) => {
    if (!getPublishedTrainer(data.slug)) {
      return {
        reviews: [] as PublicTrainerReview[],
        summary: summarize([]),
        isOwner: false,
      };
    }

    const db = getDb();
    const [rows, profile] = await Promise.all([
      db
        .select({ review: trainerReviews, avatarPath: users.avatarPath })
        .from(trainerReviews)
        .leftJoin(users, eq(users.id, trainerReviews.userId))
        .where(eq(trainerReviews.trainerSlug, data.slug))
        .orderBy(desc(trainerReviews.createdAt)),
      db
        .select({
          ownerUserId: trainerProfiles.ownerUserId,
          avatarPath: trainerProfiles.avatarPath,
          photos: trainerProfiles.photos,
        })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.slug, data.slug))
        .limit(1)
        .then((found) => found[0]),
    ]);

    const trainerAvatar = profileFace(profile);
    const published = rows.filter((row) => row.review.status === "published");
    const own = context.user ? rows.find((row) => row.review.userId === context.user?.id) : undefined;
    const reviews: PublicTrainerReview[] = published.map((row) => {
      const avatarPath = row.avatarPath ?? "";
      return {
        id: row.review.id,
        author: row.review.authorName,
        avatarPath,
        date: dateFormat.format(row.review.createdAt),
        rating: row.review.rating,
        text: row.review.body,
        messages: publicMessages(row.review, { author: avatarPath, trainer: trainerAvatar }),
        isMine: context.user?.id === row.review.userId,
      };
    });

    const isOwner = Boolean(context.user && profile?.ownerUserId === context.user.id);

    return {
      reviews,
      summary: summarize(published.map((row) => row.review)),
      ownStatus: (own?.review.status ?? null) as ReviewStatus | null,
      ownComment: own?.review.status === "rejected" ? own.review.moderationNote : null,
      isOwner,
    };
  });

export const createTrainerReviewFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(
    z.object({
      slug: slugSchema,
      rating: z.number().int().min(1).max(5),
      text: reviewTextSchema,
    }),
  )
  .handler(async ({ data, context }) => {
    if (!getPublishedTrainer(data.slug)) {
      throw new AuthError("Тренер не найден.", "VALIDATION");
    }
    const [owned] = await getDb()
      .select({ id: trainerProfiles.id })
      .from(trainerProfiles)
      .where(and(eq(trainerProfiles.slug, data.slug), eq(trainerProfiles.ownerUserId, context.user.id)))
      .limit(1);
    if (owned) {
      throw new AuthError("Нельзя оставить отзыв о своём профиле.", "VALIDATION");
    }

    const inserted = await getDb()
      .insert(trainerReviews)
      .values({
        trainerSlug: data.slug,
        userId: context.user.id,
        authorName: authorName(context.user),
        rating: data.rating,
        body: data.text,
        status: "pending",
      })
      .onConflictDoNothing({ target: [trainerReviews.trainerSlug, trainerReviews.userId] })
      .returning({ id: trainerReviews.id });

    if (inserted.length === 0) {
      throw new AuthError("Вы уже оставили отзыв об этом тренере.", "VALIDATION");
    }

    try {
      await notifyStaffAboutReview({
        authorName: authorName(context.user),
        authorEmail: context.user.email,
        trainerSlug: data.slug,
        rating: data.rating,
        body: data.text,
      });
    } catch (error) {
      void writeLog({
        level: "error",
        domain: "email",
        action: "email.review",
        outcome: "failure",
        message: "Не удалось отправить письмо о новом отзыве.",
        actorUserId: context.user.id,
        target: data.slug,
        error,
      });
    }

    void writeLog({
      level: "info",
      domain: "form",
      action: "form.review",
      outcome: "success",
      message: "Отзыв отправлен на модерацию.",
      actorUserId: context.user.id,
      subject: context.user.email,
      target: data.slug,
      context: { rating: data.rating },
    });
    return { ok: true as const };
  });

const decisionSchema = z
  .object({
    id: z.string().uuid(),
    status: z.enum(["published", "rejected"]),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "rejected" && (value.note?.replace(/<[^>]+>/g, "").trim().length ?? 0) < 5) {
      ctx.addIssue({ code: "custom", message: "Напишите комментарий для клиента, хотя бы 5 символов.", path: ["note"] });
    }
  });

export const setTrainerReviewStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(decisionSchema)
  .handler(async ({ data, context }) => {
    if (!isStaff(context.user.roles)) {
      throw new AuthError("Недостаточно прав.", "FORBIDDEN");
    }
    const note = data.status === "rejected" ? data.note?.replace(/<[^>]+>/g, "").trim() ?? null : null;
    const db = getDb();
    const [existing] = await db
      .select({
        id: trainerReviews.id,
        userId: trainerReviews.userId,
        trainerSlug: trainerReviews.trainerSlug,
      })
      .from(trainerReviews)
      .where(eq(trainerReviews.id, data.id))
      .limit(1);
    if (!existing) {
      throw new AuthError("Отзыв не найден.", "VALIDATION");
    }

    await db
      .update(trainerReviews)
      .set({ status: data.status, moderationNote: note })
      .where(eq(trainerReviews.id, existing.id));

    const [author] = await db.select({ email: users.email }).from(users).where(eq(users.id, existing.userId)).limit(1);
    if (author?.email) {
      try {
        await notifyAuthorAboutReview({
          email: author.email,
          trainerSlug: existing.trainerSlug,
          status: data.status,
          note,
        });
      } catch (error) {
        void writeLog({
          level: "error",
          domain: "email",
          action: "email.review",
          outcome: "failure",
          message: "Не удалось отправить письмо о решении по отзыву.",
          actorUserId: context.user.id,
          target: existing.trainerSlug,
          error,
        });
      }
    }

    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.review",
      outcome: "success",
      message: data.status === "published" ? "Отзыв опубликован." : "Отзыв отклонён.",
      actorUserId: context.user.id,
      target: existing.trainerSlug,
      context: { status: data.status },
    });
    return { ok: true as const };
  });

const REVIEW_STATUS_LABEL = {
  pending: "На модерации",
  published: "Опубликован",
  rejected: "Отклонён",
} as const;

export type OwnTrainerReview = {
  id: string;
  author: string;
  avatarPath: string;
  trainerAvatar: string;
  date: string;
  rating: number;
  text: string;
  status: ReviewStatus;
  statusLabel: string;
  messages: PublicReviewMessage[];
  canReply: boolean;
};

export const listOwnTrainerReviewsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    const db = getDb();
    const [profile] = await db
      .select({
        slug: trainerProfiles.slug,
        avatarPath: trainerProfiles.avatarPath,
        photos: trainerProfiles.photos,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, context.user.id))
      .limit(1);
    if (!profile) return [] as OwnTrainerReview[];

    const trainerAvatar = profileFace(profile);
    const rows = await db
      .select({ review: trainerReviews, avatarPath: users.avatarPath })
      .from(trainerReviews)
      .leftJoin(users, eq(users.id, trainerReviews.userId))
      .where(eq(trainerReviews.trainerSlug, profile.slug))
      .orderBy(desc(trainerReviews.createdAt));

    return rows.map((row) => {
      const avatarPath = row.avatarPath ?? "";
      return {
        id: row.review.id,
        author: row.review.authorName,
        avatarPath,
        trainerAvatar,
        date: dateFormat.format(row.review.createdAt),
        rating: row.review.rating,
        text: row.review.body,
        status: row.review.status,
        statusLabel: REVIEW_STATUS_LABEL[row.review.status],
        messages: publicMessages(row.review, { author: avatarPath, trainer: trainerAvatar }),
        canReply: row.review.status === "published" && storedThread(row.review).at(-1)?.role !== "trainer",
      };
    });
  });

export const replyToTrainerReviewFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({
    id: z.string().uuid(),
    reply: z.string().trim().min(10, "Напишите хотя бы 10 символов").max(1000),
  }))
  .handler(async ({ data, context }) => {
    const db = getDb();
    const [profile] = await db
      .select({ slug: trainerProfiles.slug })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, context.user.id))
      .limit(1);
    const [review] = await db.select().from(trainerReviews).where(eq(trainerReviews.id, data.id)).limit(1);
    if (!review || review.status !== "published") {
      throw new AuthError("Ответить можно на опубликованный отзыв.", "VALIDATION");
    }
    const isOwner = Boolean(profile && review.trainerSlug === profile.slug);
    const isAuthor = review.userId === context.user.id;
    const thread = storedThread(review);
    const lastRole = thread.at(-1)?.role ?? "author";
    let role: TrainerReviewMessage["role"];
    if (isOwner && !isAuthor && lastRole !== "trainer") role = "trainer";
    else if (isAuthor && !isOwner && lastRole === "trainer") role = "author";
    else throw new AuthError("Сейчас ответить нельзя.", "FORBIDDEN");

    const now = new Date();
    const next: TrainerReviewMessage[] = [...thread, { role, body: data.reply, at: now.toISOString() }];
    await db.update(trainerReviews).set({
      messages: next,
      ...(role === "trainer" && !review.reply ? { reply: data.reply, repliedAt: now } : {}),
    }).where(eq(trainerReviews.id, review.id));
    return { ok: true as const, message: "Ответ опубликован." };
  });
