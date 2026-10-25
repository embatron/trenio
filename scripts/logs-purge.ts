import { closeDb } from "../src/db/index";
import { purgeExpiredLogs } from "../src/lib/log/purge";

async function main() {
  const deleted = await purgeExpiredLogs();
  console.info(`deleted ${deleted} expired log row(s)`);
  await closeDb();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
