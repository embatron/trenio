import { closeDb, getDb } from "../src/db/index";
import { trainerWelcomes } from "../src/db/schema";
import { normalizeBelarusMobile } from "../src/lib/auth/phone";
import { belarusPhoneEquals } from "../src/lib/auth/phone-match";

const digits = normalizeBelarusMobile(process.argv[2] ?? "");

async function main() {
  if (!digits) throw new Error("Belarus mobile required");
  const rows = await getDb()
    .select({ phone: trainerWelcomes.phone })
    .from(trainerWelcomes)
    .where(belarusPhoneEquals(trainerWelcomes.phone, digits));
  console.info(JSON.stringify({ phones: rows.map((row) => row.phone) }));
  await closeDb();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
