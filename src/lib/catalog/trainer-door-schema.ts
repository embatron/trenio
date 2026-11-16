import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { isLinkPreviewVisit } from "@/lib/catalog/door-visit";

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

async function addTimestamp(db: ReturnType<typeof getDb>, column: "door_entered_at" | "outreach_sent_at") {
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
  await addTimestamp(db, "outreach_sent_at");
  const found = await db.execute(sql`SELECT to_regclass('public.app_logs') AS rel`);
  const rel = found[0]?.rel;
  if (!rel) return;
  await backfillHumanVisits(db);
}

type VisitRow = {
  target: string;
  at: Date | string;
  user_agent: string | null;
  ip: string | null;
};

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
