import postgres from "postgres";

const STATEMENT = "ALTER TYPE trainer_profile_status ADD VALUE IF NOT EXISTS 'declined'";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(STATEMENT);
    console.info("trainer status declined is ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
