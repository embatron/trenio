import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, gte, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { getSessionUserFromToken } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { getDb } from "@/db";
import { trainerCardImpressions, trainerProfiles } from "@/db/schema";
import { minskToday } from "@/lib/catalog/trainer-periods";
import { visitorId } from "@/lib/catalog/trainer-visitor";
import { logCaught } from "@/lib/log/logger";

const slugSchema = z.string().trim().regex(/^[a-z0-9._-]{1,30}$/);

let tableReady = false;
let tableFailedAt = 0;

export async function ensureTrainerImpressionTable() {
  if (tableReady) return true;
  if (tableFailedAt && Date.now() - tableFailedAt < 60_000) return false;
  try {
    const db = getDb();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS trainer_card_impressions (
      profile_id uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
      visitor_id varchar(36) NOT NULL,
      day date NOT NULL,
      PRIMARY KEY (profile_id, visitor_id, day)
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS trainer_card_impressions_profile_day_idx ON trainer_card_impressions (profile_id, day)`);
    tableReady = true;
    return true;
  } catch (error) {
    tableFailedAt = Date.now();
    logCaught("catalog", "catalog.impression", error, { target: "trainer_card_impressions" });
    return false;
  }
}

export async function impressionDailyCounts(profileId: string, since: string) {
  if (!(await ensureTrainerImpressionTable())) return [];
  try {
    const rows = await getDb()
      .select({ day: trainerCardImpressions.day, total: count() })
      .from(trainerCardImpressions)
      .where(and(eq(trainerCardImpressions.profileId, profileId), gte(trainerCardImpressions.day, since)))
      .groupBy(trainerCardImpressions.day);
    return rows.map((row) => ({ day: row.day, total: Number(row.total) }));
  } catch (error) {
    logCaught("catalog", "catalog.impression", error, { target: profileId });
    return [];
  }
}

/** One catalog impression per browser per Minsk day. The profile owner is not counted. */
export const recordTrainerCardImpressionsFn = createServerFn({ method: "POST" })
  .validator(z.object({ slugs: z.array(slugSchema).max(80) }))
  .handler(async ({ data }) => {
    const slugs = [...new Set(data.slugs)];
    if (slugs.length === 0) return { ok: true as const };
    if (!(await ensureTrainerImpressionTable())) return { ok: true as const };

    try {
      const db = getDb();
      const profiles = await db
        .select({
          id: trainerProfiles.id,
          ownerUserId: trainerProfiles.ownerUserId,
          status: trainerProfiles.status,
        })
        .from(trainerProfiles)
        .where(inArray(trainerProfiles.slug, slugs));
      const session = await getSessionUserFromToken(readSessionToken());
      const visible = profiles.filter((profile) => profile.status === "published" && !(session && profile.ownerUserId && session.id === profile.ownerUserId));
      if (visible.length === 0) return { ok: true as const };

      const visitor = visitorId();
      const day = minskToday();
      await db
        .insert(trainerCardImpressions)
        .values(visible.map((profile) => ({ profileId: profile.id, visitorId: visitor, day })))
        .onConflictDoNothing();
      return { ok: true as const };
    } catch (error) {
      logCaught("catalog", "catalog.impression", error);
      return { ok: true as const };
    }
  });
