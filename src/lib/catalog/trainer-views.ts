import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getSessionUserFromToken } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { getDb } from "@/db";
import { trainerProfileViews, trainerProfiles } from "@/db/schema";
import { publishCabinet } from "@/lib/messages/live-hub";
import { hasAnyRole } from "@/lib/auth/roles";
import { contactClickIgnored } from "@/lib/catalog/trainer-contact-clicks";
import { minskToday, type TrainerFavoriteStats, type TrainerViewPeriod, type TrainerViewStats } from "@/lib/catalog/trainer-periods";
import { loadOwnTrainerPulse, loadTrainerMenuCounts, ensureTrainerViewSource, blankTrainerPulse } from "@/lib/catalog/trainer-views.server";
import { visitorId } from "@/lib/catalog/trainer-visitor";
import { visitCountsAsNew } from "@/lib/catalog/visit-repeat";
import type { PulseChartPoint } from "@/lib/catalog/pulse-chart";
import { visitSource, type VisitSource } from "@/lib/catalog/visit-source";
import { logCaught } from "@/lib/log/logger";

export type { TrainerFavoriteStats, TrainerViewPeriod, TrainerViewStats };

export type TrainerContactStats = {
  phone: TrainerViewStats;
  instagram: TrainerViewStats;
  telegram: TrainerViewStats;
  message: TrainerViewStats;
};

export type VisitSourceCount = {
  source: VisitSource;
  count: number;
};

export type TrainerCabinetPulse = {
  visits: TrainerViewStats;
  favorites: TrainerFavoriteStats;
  impressions: TrainerViewStats;
  contacts: TrainerContactStats;
  likes: TrainerFavoriteStats;
  visitSources: Record<"day" | "week" | "month", VisitSourceCount[]>;
  /** One point per Minsk day, from the previous month through today. */
  series: PulseChartPoint[];
};

/** A published-page open. The owner and staff are not stored. A return after half an hour is another visit. */
export const recordTrainerProfileViewFn = createServerFn({ method: "POST" })
  .validator(z.object({
    slug: z.string().trim().min(1).max(40),
    referrer: z.string().max(500).optional(),
    src: z.string().max(16).optional(),
  }))
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
    if (contactClickIgnored(session, profile.ownerUserId)) return { ok: true as const };

    try {
      await ensureTrainerViewSource();
      const visitor = visitorId();
      let stored = false;
      await db.transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${profile.id}), hashtext(${visitor}))`);
        const [last] = await tx
          .select({ seenAt: trainerProfileViews.seenAt })
          .from(trainerProfileViews)
          .where(and(eq(trainerProfileViews.profileId, profile.id), eq(trainerProfileViews.visitorId, visitor)))
          .orderBy(desc(trainerProfileViews.seenAt))
          .limit(1);
        if (!visitCountsAsNew(last?.seenAt?.getTime() ?? null, Date.now())) return;
        await tx.insert(trainerProfileViews).values({
          profileId: profile.id,
          visitorId: visitor,
          day: minskToday(),
          seenAt: new Date(),
          source: visitSource({ referrer: data.referrer, src: data.src }),
        });
        stored = true;
      });
      if (stored) publishCabinet([profile.ownerUserId]);
    } catch (error) {
      logCaught("catalog", "catalog.view", error, { target: data.slug });
    }
    return { ok: true as const };
  });

export const getOwnTrainerViewStatsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<TrainerCabinetPulse> => {
    if (!hasAnyRole(context.user.roles, ["trainer", "club"])) return blankTrainerPulse();
    try {
      return await loadOwnTrainerPulse(context.user.id);
    } catch (error) {
      logCaught("catalog", "catalog.view", error, { actorUserId: context.user.id });
      return blankTrainerPulse();
    }
  });

/** Sidebar counts for the header menu: reviews on the card, and likes from other accounts. */
export const getTrainerMenuCountsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => loadTrainerMenuCounts(context.user.id));
