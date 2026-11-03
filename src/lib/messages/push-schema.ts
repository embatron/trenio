import { sql } from "drizzle-orm";

import { getDb } from "@/db";

let ready: Promise<void> | null = null;

/** Push subscriptions for message notices. Safe to call on every request. */
export function ensurePushSchema(): Promise<void> {
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
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL,
      p256dh text NOT NULL,
      auth text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `));
  await db.execute(sql.raw(
    "CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique ON push_subscriptions (endpoint)",
  ));
  await db.execute(sql.raw(
    "CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions (user_id)",
  ));
  await db.execute(sql.raw(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS push_messages boolean NOT NULL DEFAULT true",
  ));
}
