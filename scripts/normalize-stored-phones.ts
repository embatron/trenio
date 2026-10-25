import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index";
import { trainerProfiles, trainerWelcomes, users } from "../src/db/schema";
import { storedBelarusPhone } from "../src/lib/auth/phone";

type Row = { id: string; phone: string | null };

async function rewrite(label: string, rows: Row[], save: (id: string, phone: string) => Promise<void>) {
  let updated = 0;
  let kept = 0;
  let skipped = 0;
  for (const row of rows) {
    const raw = row.phone?.trim() ?? "";
    if (!raw) continue;
    const stored = storedBelarusPhone(raw);
    if (!stored) {
      skipped += 1;
      continue;
    }
    if (stored === raw) {
      kept += 1;
      continue;
    }
    await save(row.id, stored);
    updated += 1;
  }
  console.info(JSON.stringify({ label, updated, kept, skipped }));
}

async function main() {
  const db = getDb();
  await rewrite("users", await db.select({ id: users.id, phone: users.phone }).from(users), async (id, phone) => {
    await db.update(users).set({ phone, updatedAt: new Date() }).where(eq(users.id, id));
  });
  await rewrite(
    "trainer_profiles",
    await db.select({ id: trainerProfiles.id, phone: trainerProfiles.phone }).from(trainerProfiles),
    async (id, phone) => {
      await db.update(trainerProfiles).set({ phone, updatedAt: new Date() }).where(eq(trainerProfiles.id, id));
    },
  );
  await rewrite(
    "trainer_welcomes",
    await db.select({ id: trainerWelcomes.id, phone: trainerWelcomes.phone }).from(trainerWelcomes),
    async (id, phone) => {
      await db.update(trainerWelcomes).set({ phone }).where(eq(trainerWelcomes.id, id));
    },
  );
  await closeDb();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
