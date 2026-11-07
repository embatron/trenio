import { and, count, desc, eq, gte, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerContactClicks } from "@/db/schema";
import { logCaught } from "@/lib/log/logger";

export const CONTACT_CLICK_KINDS = ["phone", "instagram", "telegram"] as const;
export type ContactClickKind = (typeof CONTACT_CLICK_KINDS)[number];

/** Two taps in this window are one click. */
export const CONTACT_CLICK_REPEAT_MS = 3000;

export function contactClickIsRepeat(previousAt: number | null, now: number, windowMs = CONTACT_CLICK_REPEAT_MS) {
  return previousAt != null && now - previousAt >= 0 && now - previousAt < windowMs;
}

let tableReady = false;
let tableFailedAt = 0;

export async function ensureTrainerContactClickTable() {
  if (tableReady) return true;
  if (tableFailedAt && Date.now() - tableFailedAt < 60_000) return false;
  try {
    const db = getDb();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS trainer_contact_clicks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      profile_id uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
      kind varchar(16) NOT NULL,
      visitor_id varchar(36) NOT NULL,
      day date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS trainer_contact_clicks_profile_kind_day_idx ON trainer_contact_clicks (profile_id, kind, day)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS trainer_contact_clicks_lookup_idx ON trainer_contact_clicks (profile_id, visitor_id, kind, created_at)`);
    tableReady = true;
    return true;
  } catch (error) {
    tableFailedAt = Date.now();
    logCaught("catalog", "catalog.contact", error, { target: "trainer_contact_clicks" });
    return false;
  }
}

export async function latestContactClickAt(profileId: string, visitor: string, kind: ContactClickKind) {
  const [row] = await getDb()
    .select({ createdAt: trainerContactClicks.createdAt })
    .from(trainerContactClicks)
    .where(and(
      eq(trainerContactClicks.profileId, profileId),
      eq(trainerContactClicks.visitorId, visitor),
      eq(trainerContactClicks.kind, kind),
    ))
    .orderBy(desc(trainerContactClicks.createdAt))
    .limit(1);
  return row?.createdAt.getTime() ?? null;
}

export async function insertContactClick(input: {
  profileId: string;
  visitorId: string;
  kind: ContactClickKind;
  day: string;
}) {
  await getDb().insert(trainerContactClicks).values(input);
}

export async function contactClickDailyCounts(profileId: string, since: string) {
  if (!(await ensureTrainerContactClickTable())) return [];
  try {
    const rows = await getDb()
      .select({
        day: trainerContactClicks.day,
        kind: trainerContactClicks.kind,
        total: count(),
      })
      .from(trainerContactClicks)
      .where(and(eq(trainerContactClicks.profileId, profileId), gte(trainerContactClicks.day, since)))
      .groupBy(trainerContactClicks.day, trainerContactClicks.kind);
    return rows.flatMap((row) => {
      if (!CONTACT_CLICK_KINDS.includes(row.kind as ContactClickKind)) return [];
      return [{ day: row.day, kind: row.kind as ContactClickKind, total: Number(row.total) }];
    });
  } catch (error) {
    logCaught("catalog", "catalog.contact", error, { target: profileId });
    return [];
  }
}
