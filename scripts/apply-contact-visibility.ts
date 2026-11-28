import postgres from "postgres";

const STATEMENTS = [
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS hide_phone boolean NOT NULL DEFAULT false",
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS hide_instagram boolean NOT NULL DEFAULT false",
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS hide_telegram boolean NOT NULL DEFAULT false",
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS hide_email boolean NOT NULL DEFAULT false",
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS threads varchar(300) NOT NULL DEFAULT ''",
  "ALTER TABLE trainer_profiles ADD COLUMN IF NOT EXISTS hide_threads boolean NOT NULL DEFAULT false",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    for (const statement of STATEMENTS) await sql.unsafe(statement);
    console.info("contact visibility columns are ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
