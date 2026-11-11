import { count, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import { loadAdminShell, type AdminShellCounts } from "@/lib/admin/shell.server";
import { isAuthError } from "@/lib/auth/errors";
import { hasAnyRole, isStaff } from "@/lib/auth/roles";
import {
  loadAccountLikeHistory,
  loadAccountLikeMarks,
  type AccountLikeHistoryItem,
  type AccountLikeMark,
} from "@/lib/catalog/account-like-load.server";
import { favoriteKeysFor } from "@/lib/catalog/favorite-keys.server";
import { emptyTrainerInterest, loadTrainerInterest, type TrainerInterest } from "@/lib/catalog/trainer-interest";
import type { TrainerCabinetPulse } from "@/lib/catalog/trainer-views";
import { loadOwnTrainerPulse, loadTrainerMenuCounts } from "@/lib/catalog/trainer-views.server";
import { logCaught } from "@/lib/log/logger";

export type CabinetLiveSnapshot = {
  favorites: string[];
  marks: AccountLikeMark[];
  accountReviews: number;
  trainerReviews: number;
  trainerLikes: number;
  pulse: TrainerCabinetPulse | null;
  history: { received: AccountLikeHistoryItem[]; given: AccountLikeHistoryItem[] } | null;
  interest: TrainerInterest | null;
  staff: AdminShellCounts | null;
};

const INTEREST_CACHE_MS = 15_000;
let interestAt = 0;
let interestData: Record<string, TrainerInterest> | null = null;
let interestFlight: Promise<Record<string, TrainerInterest>> | null = null;

async function interestFor(slug: string, fresh: boolean) {
  const now = Date.now();
  if (!fresh && interestData && now - interestAt < INTEREST_CACHE_MS) {
    return interestData[slug] ?? { ...emptyTrainerInterest };
  }
  if (!interestFlight) {
    interestFlight = loadTrainerInterest().finally(() => {
      interestFlight = null;
    });
  }
  try {
    const data = await interestFlight;
    interestData = data;
    interestAt = Date.now();
    return data[slug] ?? { ...emptyTrainerInterest };
  } catch (error) {
    interestData = null;
    throw error;
  }
}

/** One read of the numbers a cabinet shows. A failure is logged and rethrown so the page keeps the last good copy. */
export const getCabinetLiveFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ detail: z.boolean(), fresh: z.boolean() }))
  .handler(async ({ data, context }): Promise<CabinetLiveSnapshot> => {
    const userId = context.user.id;
    try {
      const trainer = hasAnyRole(context.user.roles, ["trainer", "club"]);
      const staffUser = isStaff(context.user.roles);
      const detail = data.detail && trainer;
      const db = getDb();
      const [favorites, marks, accountRows, profiles, menuCounts, staff] = await Promise.all([
        favoriteKeysFor(userId),
        loadAccountLikeMarks(userId),
        db.select({ total: count() }).from(trainerReviews).where(eq(trainerReviews.userId, userId)),
        trainer
          ? db
              .select({ slug: trainerProfiles.slug })
              .from(trainerProfiles)
              .where(eq(trainerProfiles.ownerUserId, userId))
              .limit(1)
          : Promise.resolve([]),
        trainer ? loadTrainerMenuCounts(userId) : Promise.resolve({ reviews: 0, likes: 0 }),
        staffUser ? loadAdminShell(context.user.roles) : Promise.resolve(null),
      ]);
      const card = profiles[0];
      let trainerReviewCount = menuCounts.reviews;
      let trainerLikeCount = menuCounts.likes;
      let pulse: TrainerCabinetPulse | null = null;
      let history: CabinetLiveSnapshot["history"] = null;
      let interest: TrainerInterest | null = null;
      if (detail) {
        const [reviewRows, nextPulse, nextHistory] = await Promise.all([
          card
            ? db.select({ total: count() }).from(trainerReviews).where(eq(trainerReviews.trainerSlug, card.slug))
            : Promise.resolve([]),
          loadOwnTrainerPulse(userId),
          loadAccountLikeHistory(userId),
        ]);
        trainerReviewCount = Number(reviewRows[0]?.total ?? menuCounts.reviews);
        trainerLikeCount = nextPulse.likes.total;
        pulse = nextPulse;
        history = nextHistory;
        if (card) {
          try {
            interest = await interestFor(card.slug, data.fresh);
          } catch (error) {
            logCaught("catalog", "catalog.live", error, { actorUserId: userId, target: card.slug });
          }
        }
      }
      return {
        favorites,
        marks,
        accountReviews: Number(accountRows[0]?.total ?? 0),
        trainerReviews: trainerReviewCount,
        trainerLikes: trainerLikeCount,
        pulse,
        history,
        interest,
        staff,
      };
    } catch (error) {
      if (isAuthError(error)) throw error;
      logCaught("catalog", "catalog.live", error, { actorUserId: userId });
      throw error;
    }
  });
