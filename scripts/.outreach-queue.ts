import { closeDb, getDb } from "../src/db/index.ts";
import { trainerProfiles } from "../src/db/schema/trainer-profiles.ts";
import { and, asc, eq, isNull } from "drizzle-orm";
import { isLocalOnlyTrainer } from "../src/lib/sync/policy.ts";

async function main() {
  const rows = await getDb()
    .select({
      handle: trainerProfiles.instagramHandle,
      firstName: trainerProfiles.firstName,
      createdAt: trainerProfiles.createdAt,
    })
    .from(trainerProfiles)
    .where(and(eq(trainerProfiles.status, "draft"), isNull(trainerProfiles.outreachSentAt)))
    .orderBy(asc(trainerProfiles.createdAt), asc(trainerProfiles.id));

  const list = rows
    .filter((row) => row.handle.trim() && !isLocalOnlyTrainer(row.handle))
    .map((row) => ({ handle: row.handle, firstName: row.firstName.trim() }));

  console.log(JSON.stringify(list));
  await closeDb();
}

main();
