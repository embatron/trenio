import { closeDb } from "../src/db/index";
import { installAppLogs } from "../src/lib/log/purge";

async function main() {
  await installAppLogs();
  console.info("app_logs is ready. Rows expire after 30 days.");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
