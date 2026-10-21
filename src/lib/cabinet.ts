import { desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerReviews, users } from "@/db/schema";
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
  reviews: UserCabinetReview[];
};

function trainerName(slug: string) {
  return PUBLISHED_TRAINERS.find((trainer) => trainer.slug === slug)?.name ?? slug;
}

export const getUserCabinetFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<UserCabinet> => {
    const db = getDb();
    const [reviewRows, accountRows] = await Promise.all([
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
        .where(eq(trainerReviews.userId, context.user.id))
        .orderBy(desc(trainerReviews.createdAt)),
      db
        .select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
        .from(users)
        .where(eq(users.id, context.user.id))
        .limit(1),
    ]);

    return {
      phone: accountRows[0]?.phone ?? null,
      phoneVerified: accountRows[0]?.phoneVerifiedAt != null,
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
