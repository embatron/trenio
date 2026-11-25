import postgres from "postgres";

const STATEMENTS = [
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT false",
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS publish_requested_at timestamptz",
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS unclear_hold boolean NOT NULL DEFAULT false",
  `UPDATE trainer_profiles AS card
   SET verified = true
   FROM users AS account
   WHERE card.owner_user_id = account.id
     AND card.verified = false
     AND (account.email_verified_at IS NOT NULL OR account.phone_verified_at IS NOT NULL)`,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    for (const statement of STATEMENTS) await sql.unsafe(statement);
    console.info("trainer verified is ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
