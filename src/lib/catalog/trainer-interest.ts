import { and, count, eq, gte, isNull, lt, ne, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { accountLikes, trainerContactClicks, trainerProfileViews, trainerProfiles, trainerReviews, userFavorites } from "@/db/schema";
import { logCaught } from "@/lib/log/logger";
import { ensureTrainerPublishedAt } from "@/lib/catalog/trainer-published";
import { POPULARITY_LIMITS, imputeWindow, minskAgeDays, minskWindowStart } from "@/lib/catalog/trainer-popularity";

export type TrainerInterest = {
  views: number;
  engaged: number;
  opens: number;
  engagedRaw: number;
  saves: number;
  likes: number;
  likesShown: number;
  likePace: number;
  likePaceRaw: number;
  coldStart: boolean;
};

export const emptyTrainerInterest: TrainerInterest = {
  views: 0,
  engaged: 0,
  opens: 0,
  engagedRaw: 0,
  saves: 0,
  likes: 0,
  likesShown: 0,
  likePace: 0,
  likePaceRaw: 0,
  coldStart: false,
};

type CountRow = { slug: string; total: number | string };

/** 90-day response, 20-day fresh likes, favorite saves, and like weight, keyed by trainer slug. */
export async function loadTrainerInterest(): Promise<Record<string, TrainerInterest>> {
  const db = getDb();
  const responseStart = minskWindowStart(POPULARITY_LIMITS.responseWindowDays);
  const responseInstant = new Date(`${responseStart}T00:00:00+03:00`);
  const likePaceStart = minskWindowStart(POPULARITY_LIMITS.likePaceDays);
  const likePaceInstant = new Date(`${likePaceStart}T00:00:00+03:00`);
  const halfInstant = new Date(Date.now() - POPULARITY_LIMITS.likeHalfDays * 86_400_000);
  const notOwnLike = or(isNull(trainerProfiles.ownerUserId), ne(accountLikes.actorUserId, trainerProfiles.ownerUserId));
  await ensureTrainerPublishedAt();

  const [viewRows, saveRows, likeRows, oldLikeRows, paceRows, contactRows, reviewRows, publishedRows] = await Promise.all([
    db
      .select({ slug: trainerProfiles.slug, total: count() })
      .from(trainerProfileViews)
      .innerJoin(trainerProfiles, eq(trainerProfiles.id, trainerProfileViews.profileId))
      .where(and(gte(trainerProfileViews.day, responseStart), eq(trainerProfiles.status, "published")))
      .groupBy(trainerProfiles.slug),
    db
      .select({ slug: userFavorites.targetSlug, total: count() })
      .from(userFavorites)
      .where(eq(userFavorites.targetType, "trainer"))
      .groupBy(userFavorites.targetSlug),
    likeCounts().catch((error: unknown) => {
      logCaught("catalog", "catalog.like", error);
      return [] as CountRow[];
    }),
    likeCounts(undefined, halfInstant).catch((error: unknown) => {
      logCaught("catalog", "catalog.like", error);
      return [] as CountRow[];
    }),
    likeCounts(likePaceInstant).catch((error: unknown) => {
      logCaught("catalog", "catalog.like", error);
      return [] as CountRow[];
    }),
    contactVisitors(responseStart).catch((error: unknown) => {
      logCaught("catalog", "catalog.contact", error);
      return [] as CountRow[];
    }),
    db
      .select({ slug: trainerReviews.trainerSlug, total: count() })
      .from(trainerReviews)
      .where(and(eq(trainerReviews.status, "published"), gte(trainerReviews.createdAt, responseInstant)))
      .groupBy(trainerReviews.trainerSlug)
      .catch((error: unknown) => {
        logCaught("catalog", "catalog.rating", error);
        return [] as CountRow[];
      }),
    publishedAges().catch((error: unknown) => {
      logCaught("catalog", "catalog.rating", error);
      return [] as Array<{ slug: string; publishedAt: Date | string | null }>;
    }),
  ]);

  const interest: Record<string, TrainerInterest> = {};
  const touch = (slug: string) => {
    interest[slug] ??= { ...emptyTrainerInterest };
    return interest[slug];
  };
  const ages = new Map<string, number | null>();
  for (const row of publishedRows) {
    touch(row.slug);
    const at = row.publishedAt ? new Date(row.publishedAt) : null;
    ages.set(row.slug, at && !Number.isNaN(at.getTime()) ? minskAgeDays(at) : null);
  }
  for (const row of viewRows) touch(row.slug).opens = Number(row.total);
  for (const row of saveRows) touch(row.slug).saves = Number(row.total);
  const oldLikes = new Map(oldLikeRows.map((row) => [row.slug, Number(row.total)]));
  for (const row of likeRows) {
    const slot = touch(row.slug);
    const shown = Number(row.total);
    const old = oldLikes.get(row.slug) ?? 0;
    slot.likesShown = shown;
    slot.likes = Math.max(0, shown - old * 0.5);
  }
  for (const row of paceRows) touch(row.slug).likePaceRaw = Number(row.total);
  for (const row of contactRows) touch(row.slug).engagedRaw += Number(row.total);
  for (const row of reviewRows) touch(row.slug).engagedRaw += Number(row.total);

  let mature = 0;
  let openSum = 0;
  let engagedSum = 0;
  let paceSum = 0;
  for (const [slug, age] of ages) {
    if (age == null || age < POPULARITY_LIMITS.coldStartDays) continue;
    const slot = interest[slug];
    if (!slot) continue;
    mature += 1;
    openSum += slot.opens;
    engagedSum += slot.engagedRaw;
    paceSum += slot.likePaceRaw;
  }
  const mean = mature > 0
    ? { opens: openSum / mature, engaged: engagedSum / mature, pace: paceSum / mature }
    : null;

  for (const [slug, slot] of Object.entries(interest)) {
    const age = ages.get(slug) ?? null;
    const young = mean != null && age != null && age < POPULARITY_LIMITS.coldStartDays;
    slot.views = young ? imputeWindow(slot.opens, mean.opens, age) : slot.opens;
    slot.engaged = young ? imputeWindow(slot.engagedRaw, mean.engaged, age) : slot.engagedRaw;
    slot.likePace = young
      ? imputeWindow(slot.likePaceRaw, mean.pace, age, POPULARITY_LIMITS.likePaceDays)
      : slot.likePaceRaw;
    slot.coldStart = young;
  }
  return interest;

  function likeCounts(since?: Date, before?: Date) {
    return db
      .select({ slug: trainerProfiles.slug, total: count() })
      .from(accountLikes)
      .innerJoin(trainerProfiles, eq(trainerProfiles.id, accountLikes.profileId))
      .where(and(
        eq(trainerProfiles.status, "published"),
        notOwnLike,
        ...(since ? [gte(accountLikes.createdAt, since)] : []),
        ...(before ? [lt(accountLikes.createdAt, before)] : []),
      ))
      .groupBy(trainerProfiles.slug);
  }
}

async function contactVisitors(windowStart: string): Promise<CountRow[]> {
  const rows = await getDb()
    .select({
      slug: trainerProfiles.slug,
      total: sql<number>`count(distinct ${trainerContactClicks.visitorId})`,
    })
    .from(trainerContactClicks)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, trainerContactClicks.profileId))
    .where(and(gte(trainerContactClicks.day, windowStart), eq(trainerProfiles.status, "published")))
    .groupBy(trainerProfiles.slug);
  return rows;
}

async function publishedAges() {
  if (!(await ensureTrainerPublishedAt())) return [];
  const rows = await getDb().execute(sql`
    SELECT slug, published_at
    FROM trainer_profiles
    WHERE status = 'published'
  `);
  return rows.map((row) => ({
    slug: String(row.slug ?? ""),
    publishedAt: (row.published_at as Date | string | null) ?? null,
  })).filter((row) => row.slug.length > 0);
}
