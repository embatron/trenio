import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index.ts";
import { trainerProfiles } from "../src/db/schema/index.ts";

const CAPTIONS = [
  "Диплом тренера",
  "Сертификат инструктора",
  "Удостоверение о повышении квалификации",
  "Диплом спортивной школы",
  "Сертификат первой помощи",
  "Свидетельство судьи",
  "Диплом о профессиональной переподготовке",
  "Сертификат курса",
  "Грамота федерации",
  "Удостоверение специалиста",
];

const SKIP = /-(s128|c320|c640|w960)\.[a-z0-9]+$/i;

async function imagesIn(dir: string, root: string): Promise<string[]> {
  const found: string[] = [];
  let entries: Array<{ name: string; isDirectory: () => boolean; isFile: () => boolean }>;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "admin") continue;
      found.push(...await imagesIn(absolute, root));
      continue;
    }
    if (!entry.isFile() || !/\.(jpe?g|png|webp)$/i.test(entry.name) || SKIP.test(entry.name)) continue;
    const info = await stat(absolute);
    if (info.size < 12_000) continue;
    found.push(`/${path.relative(root, absolute).split(path.sep).join("/")}`);
  }
  return found;
}

function pick<T>(items: T[], count: number, salt: number) {
  const copy = items.slice();
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = (salt + index * 17) % (index + 1);
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy.slice(0, count);
}

const root = path.join(process.cwd(), "public");
const pool = await imagesIn(root, root);
if (pool.length < 5) throw new Error(`Not enough site images: ${pool.length}`);

const db = getDb();
const rows = await db
  .select({ id: trainerProfiles.id, slug: trainerProfiles.slug })
  .from(trainerProfiles)
  .where(eq(trainerProfiles.status, "published"));

let updated = 0;
for (const [index, row] of rows.entries()) {
  const count = 1 + (index % 5);
  const files = pick(pool, count, index * 13 + row.slug.length);
  const captions = pick(CAPTIONS, count, index * 7 + 3);
  const certificates = files.map((file, fileIndex) => ({ path: file, caption: captions[fileIndex] }));
  await db.update(trainerProfiles).set({ certificates, updatedAt: new Date() }).where(eq(trainerProfiles.id, row.id));
  updated += 1;
}

console.log(JSON.stringify({ published: rows.length, updated, pool: pool.length, sample: rows[0]?.slug ?? null }));
await closeDb();
