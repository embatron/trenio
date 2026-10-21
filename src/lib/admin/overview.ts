import { count, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, trainerReviews, users } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";

export const getAdminOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [accountCount, reviewCount, pendingRows, profileSlugs] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(trainerReviews),
      db.select({ userId: trainerReviews.userId }).from(trainerReviews).where(eq(trainerReviews.status, "pending")),
      db.select({ slug: trainerProfiles.slug }).from(trainerProfiles),
    ]);
    const known = new Set(profileSlugs.map((row) => row.slug));
    const catalogOnly = PUBLISHED_TRAINERS.filter((trainer) => !known.has(trainer.slug)).length;
    const hidden = await hiddenStaffIds(context.user.roles);

    return {
      accountsTotal: Math.max(0, Number(accountCount[0]?.n ?? 0) - hidden.size),
      trainersTotal: profileSlugs.length + catalogOnly,
      reviewsTotal: Number(reviewCount[0]?.n ?? 0),
      reviewsPending: pendingRows.filter((row) => !hidden.has(row.userId)).length,
    };
  });
