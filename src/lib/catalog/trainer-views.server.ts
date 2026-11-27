import { and, count, eq, gte, ne, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { accountLikes, trainerProfileViews, trainerProfiles, trainerReviews, userFavorites } from "@/db/schema";
import { contactClickDailyCounts, type ContactClickKind } from "@/lib/catalog/trainer-contact-clicks";
import { impressionDailyCounts } from "@/lib/catalog/trainer-impression-store";
import {
  addDays,
  emptyFavoriteStats,
  emptyViewStats,
  favoriteStats,
  minskToday,
  periodSpans,
  statsFromDaily,
} from "@/lib/catalog/trainer-periods";
import type { PulseChartPoint } from "@/lib/catalog/pulse-chart";
import type { TrainerCabinetPulse, TrainerContactStats, VisitSourceCount } from "@/lib/catalog/trainer-views";
import { knownVisitSource, type VisitSource } from "@/lib/catalog/visit-source";
import { logCaught } from "@/lib/log/logger";

const emptyContacts: TrainerContactStats = {
  phone: emptyViewStats,
  instagram: emptyViewStats,
  telegram: emptyViewStats,
  message: emptyViewStats,
};

const emptySources: TrainerCabinetPulse["visitSources"] = { day: [], week: [], month: [] };

let sourceColumnReady = false;
let repeatReady = false;

/** The source column and the repeat-visit key are added in place. A second process waits, then finds the same shape. */
export async function ensureTrainerViewSource() {
  if (sourceColumnReady && repeatReady) return;
  const db = getDb();
  await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(81420127)`);
    await tx.execute(sql`ALTER TABLE trainer_profile_views ADD COLUMN IF NOT EXISTS source varchar(16)`);
    await tx.execute(sql`
      ALTER TABLE trainer_profile_views
        ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
        ADD COLUMN IF NOT EXISTS seen_at timestamptz
    `);
    await tx.execute(sql`UPDATE trainer_profile_views SET id = gen_random_uuid() WHERE id IS NULL`);
    await tx.execute(sql`
      UPDATE trainer_profile_views
      SET seen_at = CASE
        WHEN day = (timezone('Europe/Minsk', now()))::date THEN now()
        ELSE (day::timestamp AT TIME ZONE 'Europe/Minsk') + interval '12 hours'
      END
      WHERE seen_at IS NULL
    `);
    await tx.execute(sql`ALTER TABLE trainer_profile_views ALTER COLUMN id SET NOT NULL`);
    await tx.execute(sql`ALTER TABLE trainer_profile_views ALTER COLUMN seen_at SET DEFAULT now()`);
    await tx.execute(sql`ALTER TABLE trainer_profile_views ALTER COLUMN seen_at SET NOT NULL`);
    await tx.execute(sql`
      DO $$
      DECLARE
        old_name text;
      BEGIN
        SELECT conname INTO old_name
        FROM pg_constraint
        WHERE conrelid = 'trainer_profile_views'::regclass
          AND contype = 'p'
          AND pg_get_constraintdef(oid) NOT LIKE '%(id)%';
        IF old_name IS NOT NULL THEN
          EXECUTE format('ALTER TABLE trainer_profile_views DROP CONSTRAINT %I', old_name);
        END IF;
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = 'trainer_profile_views'::regclass
            AND contype = 'p'
        ) THEN
          ALTER TABLE trainer_profile_views ADD PRIMARY KEY (id);
        END IF;
      END $$
    `);
    await tx.execute(sql`
      CREATE INDEX IF NOT EXISTS trainer_profile_views_visitor_seen_idx
      ON trainer_profile_views (profile_id, visitor_id, seen_at DESC)
    `);
  });
  sourceColumnReady = true;
  repeatReady = true;
}

const emptyPulse: TrainerCabinetPulse = {
  visits: emptyViewStats,
  favorites: emptyFavoriteStats,
  impressions: emptyViewStats,
  contacts: emptyContacts,
  likes: emptyFavoriteStats,
  visitSources: emptySources,
  series: [] as PulseChartPoint[],
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

function sourcesFor(
  rows: Array<{ day: string; source: string | null; total: number }>,
  today: string,
): TrainerCabinetPulse["visitSources"] {
  const spans = periodSpans(today);
  const modes = ["day", "week", "month"] as const;
  const result: TrainerCabinetPulse["visitSources"] = { day: [], week: [], month: [] };
  for (const mode of modes) {
    const span = spans[mode].current;
    const totals = new Map<VisitSource, number>();
    for (const row of rows) {
      if (row.day < span.start || row.day > span.end) continue;
      const source = knownVisitSource(row.source);
      if (!source) continue;
      totals.set(source, (totals.get(source) ?? 0) + row.total);
    }
    result[mode] = [...totals.entries()]
      .map(([source, count]): VisitSourceCount => ({ source, count }))
      .filter((row) => row.count > 0)
      .sort((a, b) => b.count - a.count);
  }
  return result;
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

export function blankTrainerPulse(): TrainerCabinetPulse {
  return emptyPulse;
}

async function readPulse<T>(
  action: "catalog.view" | "catalog.like",
  actorUserId: string,
  slug: string,
  run: () => Promise<T>,
  empty: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logCaught("catalog", action, error, { actorUserId, target: slug });
    return empty;
  }
}

export async function loadOwnTrainerPulse(userId: string): Promise<TrainerCabinetPulse> {
  const db = getDb();
  const [profile] = await db
    .select({ id: trainerProfiles.id, slug: trainerProfiles.slug, ownerUserId: trainerProfiles.ownerUserId })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!profile) return emptyPulse;
  return loadProfilePulse(profile, userId);
}

/** Visits, shows, saves, likes, and contact clicks for one card. The caller decides who may read it. */
export async function loadProfilePulse(
  profile: { id: string; slug: string; ownerUserId: string | null },
  actorUserId: string,
): Promise<TrainerCabinetPulse> {
  const db = getDb();
  const today = minskToday();
  const earliest = periodSpans(today).month.previous.start;
  await ensureTrainerViewSource().catch((error: unknown) => {
    logCaught("catalog", "catalog.view", error, { actorUserId, target: profile.slug });
  });
  const [viewRows, sourceRows, saveRows, impressionRows, contactRows, likeRows] = await Promise.all([
    readPulse("catalog.view", actorUserId, profile.slug, () => db
      .select({ day: trainerProfileViews.day, total: count() })
      .from(trainerProfileViews)
      .where(and(eq(trainerProfileViews.profileId, profile.id), gte(trainerProfileViews.day, earliest)))
      .groupBy(trainerProfileViews.day), []),
    readPulse("catalog.view", actorUserId, profile.slug, () => db
      .select({ day: trainerProfileViews.day, source: trainerProfileViews.source, total: count() })
      .from(trainerProfileViews)
      .where(and(eq(trainerProfileViews.profileId, profile.id), gte(trainerProfileViews.day, earliest)))
      .groupBy(trainerProfileViews.day, trainerProfileViews.source), []),
    readPulse("catalog.view", actorUserId, profile.slug, () => db
      .select({ createdAt: userFavorites.createdAt })
      .from(userFavorites)
      .where(and(
        eq(userFavorites.targetType, "trainer"),
        eq(userFavorites.targetSlug, profile.slug),
        ...(profile.ownerUserId ? [ne(userFavorites.userId, profile.ownerUserId)] : []),
      )), []),
    impressionDailyCounts(profile.id, earliest),
    contactClickDailyCounts(profile.id, earliest),
    readPulse("catalog.like", actorUserId, profile.slug, () => db
      .select({ createdAt: accountLikes.createdAt })
      .from(accountLikes)
      .where(and(
        eq(accountLikes.profileId, profile.id),
        ...(profile.ownerUserId ? [ne(accountLikes.actorUserId, profile.ownerUserId)] : []),
      )), []),
  ]);

  return {
    visits: statsFromDaily(viewRows.map((row) => ({ day: row.day, total: Number(row.total) })), today),
    visitSources: sourcesFor(sourceRows.map((row) => ({ day: row.day, source: row.source, total: Number(row.total) })), today),
    favorites: favoriteStats(saveRows.map((row) => row.createdAt.getTime()), today),
    impressions: statsFromDaily(impressionRows, today),
    contacts: contactsFromDaily(contactRows, today),
    likes: favoriteStats(likeRows.map((row) => row.createdAt.getTime()), today),
    series: chartSeries(
      earliest,
      today,
      viewRows.map((row) => ({ day: row.day, total: Number(row.total) })),
      impressionRows,
      contactRows.map((row) => ({ day: row.day, kind: row.kind, total: Number(row.total) })),
    ),
  };
}

function addCount(map: Map<string, number>, day: string, total: number) {
  map.set(day, (map.get(day) ?? 0) + total);
}

function chartSeries(
  start: string,
  today: string,
  views: Array<{ day: string; total: number }>,
  impressions: Array<{ day: string; total: number }>,
  contacts: Array<{ day: string; kind: string; total: number }>,
): PulseChartPoint[] {
  const opens = new Map<string, number>();
  const shows = new Map<string, number>();
  const contact = new Map<string, number>();
  const messages = new Map<string, number>();
  for (const row of views) addCount(opens, row.day, Number(row.total));
  for (const row of impressions) addCount(shows, row.day, Number(row.total));
  for (const row of contacts) {
    addCount(row.kind === "message" ? messages : contact, row.day, Number(row.total));
  }
  const points: PulseChartPoint[] = [];
  for (let day = start; day <= today; day = addDays(day, 1)) {
    points.push({
      day,
      shows: shows.get(day) ?? 0,
      opens: opens.get(day) ?? 0,
      contacts: contact.get(day) ?? 0,
      messages: messages.get(day) ?? 0,
    });
  }
  return points;
}
