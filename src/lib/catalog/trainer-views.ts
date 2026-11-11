import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getSessionUserFromToken } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfileViews, trainerProfiles } from "@/db/schema";
import { publishCabinet } from "@/lib/messages/live-hub";
import {
  minskToday,
  type TrainerFavoriteStats,
  type TrainerViewPeriod,
  type TrainerViewStats,
} from "@/lib/catalog/trainer-periods";
import { loadOwnTrainerPulse, loadTrainerMenuCounts } from "@/lib/catalog/trainer-views.server";
import { visitorId } from "@/lib/catalog/trainer-visitor";

export type { TrainerFavoriteStats, TrainerViewPeriod, TrainerViewStats };

export type TrainerContactStats = {
  phone: TrainerViewStats;
  instagram: TrainerViewStats;
  telegram: TrainerViewStats;
  message: TrainerViewStats;
};

export type TrainerCabinetPulse = {
  visits: TrainerViewStats;
  favorites: TrainerFavoriteStats;
  impressions: TrainerViewStats;
  contacts: TrainerContactStats;
  likes: TrainerFavoriteStats;
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
    publishCabinet([profile.ownerUserId]);
    return { ok: true as const };
  });

export const getOwnTrainerViewStatsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<TrainerCabinetPulse> => loadOwnTrainerPulse(context.user.id));

/** Sidebar counts for the header menu: reviews on the card, and likes from other accounts. */
export const getTrainerMenuCountsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => loadTrainerMenuCounts(context.user.id));
