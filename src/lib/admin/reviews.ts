import { desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, trainerReviews, users } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import type { ReviewStatus } from "@/lib/catalog/trainer-reviews";

export type AdminReview = {
  id: string;
  trainerSlug: string;
  trainerName: string;
  authorName: string;
  authorEmail: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  moderationNote: string | null;
  createdAt: string;
};

export const getAdminReviewsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<AdminReview[]> => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [reviewRows, profileRows] = await Promise.all([
      db
        .select({
          id: trainerReviews.id,
          userId: trainerReviews.userId,
          trainerSlug: trainerReviews.trainerSlug,
          authorName: trainerReviews.authorName,
          authorEmail: users.email,
          rating: trainerReviews.rating,
          body: trainerReviews.body,
          status: trainerReviews.status,
          moderationNote: trainerReviews.moderationNote,
          createdAt: trainerReviews.createdAt,
        })
        .from(trainerReviews)
        .leftJoin(users, eq(users.id, trainerReviews.userId))
        .orderBy(desc(trainerReviews.createdAt)),
      db.select({ slug: trainerProfiles.slug, fullName: trainerProfiles.fullName }).from(trainerProfiles),
    ]);

    const names = new Map(profileRows.map((row) => [row.slug, row.fullName]));
    const hidden = await hiddenStaffIds(context.user.roles);
    const rank = { pending: 0, rejected: 1, published: 2 };

    return reviewRows
      .filter((row) => !hidden.has(row.userId))
      .map((row) => ({
        id: row.id,
        trainerSlug: row.trainerSlug,
        trainerName: names.get(row.trainerSlug) || getPublishedTrainer(row.trainerSlug)?.name || row.trainerSlug,
        authorName: row.authorName,
        authorEmail: row.authorEmail ?? "",
        rating: row.rating,
        body: row.body,
        status: row.status,
        moderationNote: row.moderationNote,
        createdAt: row.createdAt.toISOString(),
      }))
      .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt));
  });
