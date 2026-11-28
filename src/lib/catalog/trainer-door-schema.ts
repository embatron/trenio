import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { isLinkPreviewVisit } from "@/lib/catalog/door-visit";

let ready: Promise<void> | null = null;

/** Columns for the first and latest open of `/hi/{code}`. Safe to call on every request. */
export function ensureTrainerDoorSchema(): Promise<void> {
  if (!ready) {
    ready = apply().catch((error) => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

async function addTimestamp(db: ReturnType<typeof getDb>, column: "door_entered_at" | "door_seen_at" | "outreach_sent_at") {
  const found = await db.execute(sql`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'trainer_profiles'
      AND column_name = ${column}
  `);
  if (found.length > 0) return;
  await db.execute(sql.raw(`ALTER TABLE trainer_profiles ADD COLUMN ${column} timestamptz`));
}

async function apply() {
  const db = getDb();
  await addTimestamp(db, "door_entered_at");
  await addTimestamp(db, "door_seen_at");
  await addTimestamp(db, "outreach_sent_at");
  await db.execute(sql`ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS threads varchar(300) NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS hide_threads boolean NOT NULL DEFAULT false`);
  const found = await db.execute(sql`SELECT to_regclass('public.app_logs') AS rel`);
  const rel = found[0]?.rel;
  if (!rel) {
    await copyFirstVisit(db);
    return;
  }
  await backfillHumanVisits(db);
  await backfillLatestVisits(db);
}

type VisitRow = {
  target: string;
  at: Date | string;
  user_agent: string | null;
  ip: string | null;
};

/** Cards that already have a first visit keep that moment as the latest one until a journal row says otherwise. */
async function copyFirstVisit(db: ReturnType<typeof getDb>) {
  await db.execute(sql`
    UPDATE trainer_profiles
    SET door_seen_at = door_entered_at
    WHERE door_seen_at IS NULL
      AND door_entered_at IS NOT NULL
  `);
}

/** Fill an empty latest visit from the newest person in the journal. A preview robot does not count. */
async function backfillLatestVisits(db: ReturnType<typeof getDb>) {
  const logs = await db.execute<VisitRow>(sql`
    SELECT l.target, l.created_at AS at, l.user_agent, l.ip
    FROM app_logs l
    INNER JOIN trainer_profiles p ON p.slug = l.target
    WHERE p.door_seen_at IS NULL
      AND l.action = 'catalog.trainer_preview'
      AND l.outcome = 'success'
      AND l.target <> ''
  `);
  const latest = new Map<string, Date>();
  for (const row of logs) {
    const at = row.at instanceof Date ? row.at : new Date(row.at);
    if (Number.isNaN(at.getTime())) continue;
    if (isLinkPreviewVisit(row.user_agent ?? "", row.ip ?? "")) continue;
    const have = latest.get(row.target);
    if (!have || at.getTime() > have.getTime()) latest.set(row.target, at);
  }
  for (const [slug, at] of latest) {
    const iso = at.toISOString();
    await db.execute(sql`
      UPDATE trainer_profiles
      SET door_seen_at = GREATEST(${iso}::timestamptz, COALESCE(door_entered_at, ${iso}::timestamptz))
      WHERE slug = ${slug}
        AND door_seen_at IS NULL
    `);
  }
  await copyFirstVisit(db);
}

/** Fill an empty visit from the earliest person in the journal. A preview robot does not count. */
async function backfillHumanVisits(db: ReturnType<typeof getDb>) {
  const logs = await db.execute<VisitRow>(sql`
    SELECT l.target, l.created_at AS at, l.user_agent, l.ip
    FROM app_logs l
    INNER JOIN trainer_profiles p ON p.slug = l.target
    WHERE p.door_entered_at IS NULL
      AND l.action IN ('catalog.trainer_preview', 'catalog.trainer_edit')
      AND l.outcome = 'success'
      AND l.target <> ''
  `);
  const earliest = new Map<string, Date>();
  for (const row of logs) {
    const at = row.at instanceof Date ? row.at : new Date(row.at);
    if (Number.isNaN(at.getTime())) continue;
    if (isLinkPreviewVisit(row.user_agent ?? "", row.ip ?? "")) continue;
    const have = earliest.get(row.target);
    if (!have || at.getTime() < have.getTime()) earliest.set(row.target, at);
  }
  for (const [slug, at] of earliest) {
    await db.execute(sql`
      UPDATE trainer_profiles
      SET door_entered_at = ${at}
      WHERE slug = ${slug}
        AND door_entered_at IS NULL
    `);
  }
}
