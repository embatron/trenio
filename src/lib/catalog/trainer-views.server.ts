import { and, count, eq, gte, ne } from "drizzle-orm";

import { getDb } from "@/db";
import { accountLikes, trainerProfileViews, trainerProfiles, trainerReviews, userFavorites } from "@/db/schema";
import { contactClickDailyCounts, type ContactClickKind } from "@/lib/catalog/trainer-contact-clicks";
import { impressionDailyCounts } from "@/lib/catalog/trainer-impression-store";
import {
  emptyFavoriteStats,
  emptyViewStats,
  favoriteStats,
  minskToday,
  periodSpans,
  statsFromDaily,
} from "@/lib/catalog/trainer-periods";
import type { TrainerCabinetPulse, TrainerContactStats } from "@/lib/catalog/trainer-views";
import { logCaught } from "@/lib/log/logger";

const emptyContacts: TrainerContactStats = {
  phone: emptyViewStats,
  instagram: emptyViewStats,
  telegram: emptyViewStats,
  message: emptyViewStats,
};

const emptyPulse: TrainerCabinetPulse = {
  visits: emptyViewStats,
  favorites: emptyFavoriteStats,
  impressions: emptyViewStats,
  contacts: emptyContacts,
  likes: emptyFavoriteStats,
};

function contactsFromDaily(
  rows: Array<{ day: string; kind: ContactClickKind; total: number }>,
  today: string,
): TrainerContactStats {
  const pick = (kind: ContactClickKind) =>
    statsFromDaily(
      rows.filter((row) => row.kind === kind).map(({ day, total }) => ({ day, total })),
      today,
    );
  return {
    phone: pick("phone"),
    instagram: pick("instagram"),
    telegram: pick("telegram"),
    message: pick("message"),
  };
}

/** Reviews on the trainer's card, and likes left by other accounts. */
export async function loadTrainerMenuCounts(userId: string): Promise<{ reviews: number; likes: number }> {
  const db = getDb();
  const [profile] = await db
    .select({ id: trainerProfiles.id, slug: trainerProfiles.slug })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!profile) return { reviews: 0, likes: 0 };
  const [reviewRow] = await db
    .select({ total: count() })
    .from(trainerReviews)
    .where(eq(trainerReviews.trainerSlug, profile.slug));
  let likes = 0;
  try {
    const [likeRow] = await db
      .select({ total: count() })
      .from(accountLikes)
      .where(and(eq(accountLikes.profileId, profile.id), ne(accountLikes.actorUserId, userId)));
    likes = Number(likeRow?.total ?? 0);
  } catch (error) {
    logCaught("catalog", "catalog.like", error, { actorUserId: userId, target: profile.slug });
  }
  return { reviews: Number(reviewRow?.total ?? 0), likes };
}

export async function loadOwnTrainerPulse(userId: string): Promise<TrainerCabinetPulse> {
  const db = getDb();
  const [profile] = await db
    .select({ id: trainerProfiles.id, slug: trainerProfiles.slug, ownerUserId: trainerProfiles.ownerUserId })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!profile) return emptyPulse;

  const today = minskToday();
  const earliest = periodSpans(today).month.previous.start;
  const [viewRows, saveRows, impressionRows, contactRows, likeRows] = await Promise.all([
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
    contactClickDailyCounts(profile.id, earliest),
    db
      .select({ createdAt: accountLikes.createdAt })
      .from(accountLikes)
      .where(and(
        eq(accountLikes.profileId, profile.id),
        ...(profile.ownerUserId ? [ne(accountLikes.actorUserId, profile.ownerUserId)] : []),
      ))
      .catch((error: unknown) => {
        logCaught("catalog", "catalog.like", error, { actorUserId: userId, target: profile.slug });
        return [] as Array<{ createdAt: Date }>;
      }),
  ]);

  return {
    visits: statsFromDaily(viewRows.map((row) => ({ day: row.day, total: Number(row.total) })), today),
    favorites: favoriteStats(saveRows.map((row) => row.createdAt.getTime()), today),
    impressions: statsFromDaily(impressionRows, today),
    contacts: contactsFromDaily(contactRows, today),
    likes: favoriteStats(likeRows.map((row) => row.createdAt.getTime()), today),
  };
}
