import { avg, count, desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { optionalAuthMiddleware, requireAuthMiddleware } from "@/auth/middleware";
import type { SessionUser } from "@/auth/service";
import { getDb } from "@/db";
import { trainerReviews, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { isStaff } from "@/lib/auth/roles";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
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

export type PublicTrainerReview = {
  id: string;
  author: string;
  date: string;
  rating: number;
  text: string;
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
  const rows = await getDb()
    .select({
      slug: trainerReviews.trainerSlug,
      reviews: count(),
      average: avg(trainerReviews.rating),
    })
    .from(trainerReviews)
    .where(eq(trainerReviews.status, "published"))
    .groupBy(trainerReviews.trainerSlug);

  const summaries: Record<string, TrainerRatingSnapshot> = {};
  for (const row of rows) {
    if (!getPublishedTrainer(row.slug)) continue;
    const reviews = Number(row.reviews);
    const average = Number(row.average);
    if (!Number.isFinite(reviews) || reviews <= 0 || !Number.isFinite(average)) continue;
    summaries[row.slug] = { rating: average.toFixed(1), reviews };
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
      };
    }

    const rows = await getDb()
      .select()
      .from(trainerReviews)
      .where(eq(trainerReviews.trainerSlug, data.slug))
      .orderBy(desc(trainerReviews.createdAt));

    const published = rows.filter((row) => row.status === "published");
    const own = context.user ? rows.find((row) => row.userId === context.user?.id) : undefined;
    const reviews: PublicTrainerReview[] = published.map((row) => ({
      id: row.id,
      author: row.authorName,
      date: dateFormat.format(row.createdAt),
      rating: row.rating,
      text: row.body,
      isMine: context.user?.id === row.userId,
    }));

    return {
      reviews,
      summary: summarize(published),
      ownStatus: (own?.status ?? null) as ReviewStatus | null,
      ownComment: own?.status === "rejected" ? own.moderationNote : null,
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
      console.error("[mail] review notice failed", error instanceof Error ? error.message : "unknown");
    }

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
        console.error("[mail] review decision failed", error instanceof Error ? error.message : "unknown");
      }
    }

    return { ok: true as const };
  });
