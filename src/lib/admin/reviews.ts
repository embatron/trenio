import { desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, trainerReviews, users, type TrainerSportRecord } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import type { ReviewStatus } from "@/lib/catalog/trainer-reviews";

export type AdminReview = {
  id: string;
  trainerSlug: string;
  trainerName: string;
  trainerSportSlugs: string[];
  authorId: string;
  authorName: string;
  authorAvatar: string;
  authorEmail: string;
  rating: number;
  body: string;
  status: ReviewStatus;
  moderationNote: string | null;
  createdAt: string;
};

function sportSlugs(sports: TrainerSportRecord[] | null | undefined, fallback: string[]) {
  const slugs = (sports ?? []).map((item) => item.slug).filter(Boolean);
  return slugs.length > 0 ? slugs : fallback;
}

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
          authorAvatar: users.avatarPath,
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
      db
        .select({
          slug: trainerProfiles.slug,
          fullName: trainerProfiles.fullName,
          sports: trainerProfiles.sports,
        })
        .from(trainerProfiles),
    ]);

    const profiles = new Map(profileRows.map((row) => [row.slug, row]));
    const hidden = await hiddenStaffIds(context.user.roles);
    const rank = { pending: 0, rejected: 1, published: 2 };

    return reviewRows
      .filter((row) => !hidden.has(row.userId))
      .map((row) => {
        const profile = profiles.get(row.trainerSlug);
        const published = getPublishedTrainer(row.trainerSlug);
        return {
          id: row.id,
          trainerSlug: row.trainerSlug,
          trainerName: profile?.fullName || published?.name || row.trainerSlug,
          trainerSportSlugs: sportSlugs(profile?.sports, published?.sports.map((item) => item.slug) ?? []),
          authorId: row.userId,
          authorName: row.authorName,
          authorAvatar: row.authorAvatar ?? "",
          authorEmail: row.authorEmail ?? "",
          rating: row.rating,
          body: row.body,
          status: row.status,
          moderationNote: row.moderationNote,
          createdAt: row.createdAt.toISOString(),
        };
      })
      .sort((a, b) => rank[a.status] - rank[b.status] || b.createdAt.localeCompare(a.createdAt));
  });
