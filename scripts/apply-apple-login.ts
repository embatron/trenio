import postgres from "postgres";

const STATEMENTS = [
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_sub varchar(255)",
  "ALTER TABLE users ADD COLUMN IF NOT EXISTS apple_email varchar(320)",
  "CREATE UNIQUE INDEX IF NOT EXISTS users_apple_sub_unique ON users (apple_sub)",
  "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS platform text NOT NULL DEFAULT 'web'",
  "ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS token_type text NOT NULL DEFAULT 'vapid'",
  "CREATE INDEX IF NOT EXISTS push_subscriptions_user_platform_idx ON push_subscriptions (user_id, platform)",
  `CREATE TABLE IF NOT EXISTS user_devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform text NOT NULL,
    push_token text NOT NULL,
    token_type text NOT NULL,
    device_name text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, push_token)
  )`,
  "CREATE INDEX IF NOT EXISTS user_devices_user_idx ON user_devices (user_id)",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    for (const statement of STATEMENTS) await sql.unsafe(statement);
    console.info("apple login and device push tables are ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
