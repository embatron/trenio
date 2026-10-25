import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index";
import { trainerWelcomes } from "../src/db/schema";

const field = process.argv.includes("--phone") ? "phone" : process.argv.includes("--telegram") ? "telegram" : "instagram";
const handle = process.argv.filter((arg) => arg !== "--telegram" && arg !== "--phone").at(-1)?.trim() ?? "";

async function main() {
  const column = trainerWelcomes[field];
  const pattern =
    field === "phone"
      ? /^\+375 (?:25|29|33|44) \d{3}-\d{2}-\d{2}$/
      : field === "telegram"
        ? /^[A-Za-z][A-Za-z0-9_]{4,31}$/
        : /^[A-Za-z0-9._]{1,30}$/;
  if (!pattern.test(handle)) {
    throw new Error(`${field} value required`);
  }
  const deleted = await getDb().delete(trainerWelcomes).where(eq(column, handle)).returning({ id: trainerWelcomes.id });
  console.info(JSON.stringify({ deleted: deleted.length }));
  await closeDb();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
