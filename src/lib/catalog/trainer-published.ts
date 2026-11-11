import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { logCaught } from "@/lib/log/logger";

let ready = false;
let failedAt = 0;

/** First catalog appearance. Added on read, not by db:push. */
export async function ensureTrainerPublishedAt() {
  if (ready) return true;
  if (failedAt && Date.now() - failedAt < 60_000) return false;
  try {
    const db = getDb();
    await db.execute(sql`ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS published_at timestamptz`);
    await db.execute(sql`
      UPDATE trainer_profiles
      SET published_at = created_at
      WHERE status = 'published'
        AND published_at IS NULL
        AND updated_at < now() - interval '2 minutes'
    `);
    ready = true;
    return true;
  } catch (error) {
    failedAt = Date.now();
    logCaught("catalog", "catalog.rating", error, { target: "trainer_profiles.published_at" });
    return false;
  }
}

/** Remember the first time this slug is published. A later hide keeps the moment. */
export async function stampTrainerPublished(slug: string) {
  const clean = slug.trim();
  if (!clean) return;
  try {
    if (!(await ensureTrainerPublishedAt())) return;
    await getDb().execute(sql`
      UPDATE trainer_profiles
      SET published_at = now()
      WHERE slug = ${clean}
        AND status = 'published'
        AND published_at IS NULL
    `);
  } catch (error) {
    logCaught("catalog", "catalog.rating", error, { target: clean });
  }
}
