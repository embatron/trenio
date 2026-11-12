import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db";
import { trainerProfiles } from "../src/db/schema/trainer-profiles";
import { trainerIntroPhrase, trainerSportRoles } from "../src/lib/catalog/sport-taxonomy";

type Sport = { slug?: string; label?: string; parentSlug?: string };

function sportsOf(sports: Sport[] | null, primary: Sport | null) {
  const listed = (sports ?? []).flatMap((sport) => {
    const slug = sport?.slug?.trim() ?? "";
    const label = sport?.label?.trim() ?? "";
    return slug && label ? [{ slug, label }] : [];
  });
  if (listed.length > 0) return listed.slice(0, 4);
  const slug = primary?.slug?.trim() ?? "";
  const label = primary?.label?.trim() ?? "";
  return slug && label ? [{ slug, label }] : [];
}

function phraseFor(sports: Array<{ slug: string; label: string }>) {
  if (sports.length === 0) return "";
  const phrase = trainerIntroPhrase(trainerSportRoles(sports)).trim();
  return phrase === "Тренер" ? "" : phrase.slice(0, 200);
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
  const db = getDb();
  const rows = await db
    .select({
      id: trainerProfiles.id,
      sports: trainerProfiles.sports,
      primarySport: trainerProfiles.primarySport,
      headline: trainerProfiles.headline,
    })
    .from(trainerProfiles);
  let changed = 0;
  for (const row of rows) {
    const next = phraseFor(sportsOf(row.sports, row.primarySport));
    if (next === row.headline.trim()) continue;
    await db.update(trainerProfiles).set({ headline: next }).where(eq(trainerProfiles.id, row.id));
    changed += 1;
  }
  console.log(`headlines updated ${changed} of ${rows.length}`);
  await closeDb();
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
