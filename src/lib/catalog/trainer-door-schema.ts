import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let ready: Promise<void> | null = null;

/** Column for the first open of `/hi/{code}`. Safe to call on every request. */
export function ensureTrainerDoorSchema(): Promise<void> {
  if (!ready) {
    ready = apply().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function apply() {
  const db = getDb();
  await db.execute(sql.raw(
    "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS door_entered_at timestamptz",
  ));
  const found = await db.execute(sql`SELECT to_regclass('public.app_logs') AS rel`);
  const rel = found[0]?.rel;
  if (!rel) return;
  await db.execute(sql.raw(`
    UPDATE trainer_profiles AS profile
    SET door_entered_at = entered.at
    FROM (
      SELECT target, MIN(created_at) AS at
      FROM app_logs
      WHERE action IN ('catalog.trainer_preview', 'catalog.trainer_edit')
        AND outcome = 'success'
        AND target <> ''
      GROUP BY target
    ) AS entered
    WHERE profile.slug = entered.target
      AND profile.door_entered_at IS NULL
  `));
}
