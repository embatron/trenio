import { and, count, eq, gte } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfileViews, trainerProfiles, userFavorites } from "@/db/schema";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import { minskMonthStart } from "@/lib/catalog/trainer-popularity";

export type TrainerInterest = {
  views: number;
  saves: number;
};

/** Monthly profile opens and favorite saves for published catalog trainers. */
export async function loadTrainerInterest(): Promise<Record<string, TrainerInterest>> {
  const db = getDb();
  const monthStart = minskMonthStart();
  const [viewRows, saveRows] = await Promise.all([
    db
      .select({ slug: trainerProfiles.slug, total: count() })
      .from(trainerProfileViews)
      .innerJoin(trainerProfiles, eq(trainerProfiles.id, trainerProfileViews.profileId))
      .where(and(gte(trainerProfileViews.day, monthStart), eq(trainerProfiles.status, "published")))
      .groupBy(trainerProfiles.slug),
    db
      .select({ slug: userFavorites.targetSlug, total: count() })
      .from(userFavorites)
      .where(eq(userFavorites.targetType, "trainer"))
      .groupBy(userFavorites.targetSlug),
  ]);

  const interest: Record<string, TrainerInterest> = {};
  const touch = (slug: string) => {
    if (!getPublishedTrainer(slug)) return null;
    interest[slug] ??= { views: 0, saves: 0 };
    return interest[slug];
  };
  for (const row of viewRows) {
    const item = touch(row.slug);
    if (item) item.views = Number(row.total);
  }
  for (const row of saveRows) {
    const item = touch(row.slug);
    if (item) item.saves = Number(row.total);
  }
  return interest;
}
