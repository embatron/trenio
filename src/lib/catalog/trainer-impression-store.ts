import { and, count, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerCardImpressions } from "@/db/schema";
import { logCaught } from "@/lib/log/logger";

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
