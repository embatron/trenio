import { closeDb } from "../src/db/index";

async function main() {
  console.info("journal rows are kept");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
