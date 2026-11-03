import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, gte, ne } from "drizzle-orm";
import { z } from "zod";

import { getSessionUserFromToken } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfileViews, trainerProfiles, userFavorites } from "@/db/schema";
import { impressionDailyCounts } from "@/lib/catalog/trainer-impression-store";
import {
  emptyFavoriteStats,
  emptyViewStats,
  favoriteStats,
  minskToday,
  periodSpans,
  statsFromDaily,
  type TrainerFavoriteStats,
  type TrainerViewPeriod,
  type TrainerViewStats,
} from "@/lib/catalog/trainer-periods";
import { visitorId } from "@/lib/catalog/trainer-visitor";

export type { TrainerFavoriteStats, TrainerViewPeriod, TrainerViewStats };

export type TrainerCabinetPulse = {
  visits: TrainerViewStats;
  favorites: TrainerFavoriteStats;
  impressions: TrainerViewStats;
};

const emptyPulse: TrainerCabinetPulse = {
  visits: emptyViewStats,
  favorites: emptyFavoriteStats,
  impressions: emptyViewStats,
};

/** One visit per browser per Minsk day. The profile owner is not counted. */
export const recordTrainerProfileViewFn = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const [profile] = await db
      .select({
        id: trainerProfiles.id,
        ownerUserId: trainerProfiles.ownerUserId,
        status: trainerProfiles.status,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    if (!profile || profile.status !== "published") return { ok: true as const };

    const session = await getSessionUserFromToken(readSessionToken());
    if (session && profile.ownerUserId && session.id === profile.ownerUserId) return { ok: true as const };

    await db
      .insert(trainerProfileViews)
      .values({ profileId: profile.id, visitorId: visitorId(), day: minskToday() })
      .onConflictDoNothing();
    return { ok: true as const };
  });

export const getOwnTrainerViewStatsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<TrainerCabinetPulse> => {
    const db = getDb();
    const [profile] = await db
      .select({ id: trainerProfiles.id, slug: trainerProfiles.slug, ownerUserId: trainerProfiles.ownerUserId })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, context.user.id))
      .limit(1);
    if (!profile) return emptyPulse;

    const today = minskToday();
    const earliest = periodSpans(today).month.previous.start;
    const [viewRows, saveRows, impressionRows] = await Promise.all([
      db
        .select({ day: trainerProfileViews.day, total: count() })
        .from(trainerProfileViews)
        .where(and(eq(trainerProfileViews.profileId, profile.id), gte(trainerProfileViews.day, earliest)))
        .groupBy(trainerProfileViews.day),
      db
        .select({ createdAt: userFavorites.createdAt })
        .from(userFavorites)
        .where(and(
          eq(userFavorites.targetType, "trainer"),
          eq(userFavorites.targetSlug, profile.slug),
          ...(profile.ownerUserId ? [ne(userFavorites.userId, profile.ownerUserId)] : []),
        )),
      impressionDailyCounts(profile.id, earliest),
    ]);

    return {
      visits: statsFromDaily(viewRows.map((row) => ({ day: row.day, total: Number(row.total) })), today),
      favorites: favoriteStats(saveRows.map((row) => row.createdAt.getTime()), today),
      impressions: statsFromDaily(impressionRows, today),
    };
  });
