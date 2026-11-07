import { count, desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { conversations, trainerReviews, userFavorites, users } from "@/db/schema";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";
import type { ReviewStatus } from "@/lib/catalog/trainer-reviews";

export type UserCabinetReview = {
  id: string;
  trainerSlug: string;
  trainerName: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  moderationNote: string | null;
  createdAt: string;
};

export type UserCabinet = {
  phone: string | null;
  phoneVerified: boolean;
  emailVerified: boolean;
  createdAt: string;
  favoriteCount: number;
  conversationCount: number;
  reviews: UserCabinetReview[];
};

function trainerName(slug: string) {
  return PUBLISHED_TRAINERS.find((trainer) => trainer.slug === slug)?.name ?? slug;
}

export const getUserCabinetFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<UserCabinet> => {
    const db = getDb();
    const userId = context.user.id;
    const [reviewRows, accountRows, favoriteRows, conversationRows] = await Promise.all([
      db
        .select({
          id: trainerReviews.id,
          trainerSlug: trainerReviews.trainerSlug,
          rating: trainerReviews.rating,
          body: trainerReviews.body,
          status: trainerReviews.status,
          moderationNote: trainerReviews.moderationNote,
          createdAt: trainerReviews.createdAt,
        })
        .from(trainerReviews)
        .where(eq(trainerReviews.userId, userId))
        .orderBy(desc(trainerReviews.createdAt)),
      db
        .select({
          phone: users.phone,
          phoneVerifiedAt: users.phoneVerifiedAt,
          emailVerifiedAt: users.emailVerifiedAt,
          createdAt: users.createdAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1),
      db.select({ n: count() }).from(userFavorites).where(eq(userFavorites.userId, userId)),
      db.select({ n: count() }).from(conversations).where(eq(conversations.userId, userId)),
    ]);

    const account = accountRows[0];
    return {
      phone: account?.phone ?? null,
      phoneVerified: account?.phoneVerifiedAt != null,
      emailVerified: account?.emailVerifiedAt != null,
      createdAt: (account?.createdAt ?? new Date()).toISOString(),
      favoriteCount: Number(favoriteRows[0]?.n ?? 0),
      conversationCount: Number(conversationRows[0]?.n ?? 0),
      reviews: reviewRows.map((row) => ({
        id: row.id,
        trainerSlug: row.trainerSlug,
        trainerName: trainerName(row.trainerSlug),
        rating: row.rating,
        body: row.body,
        status: row.status,
        moderationNote: row.moderationNote,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  });
