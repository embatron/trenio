import "dotenv/config";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { closeDb } from "./index";
import { draftFileToImported, type DraftFile } from "./import-draft-map";
import { upsertImportedTrainer } from "./trainer-profiles";

const DRAFT_DIR = join(process.cwd(), "data/instagram-trainers");

async function sync() {
  const only = (process.argv[2] || "").replace(/\.json$/, "");
  const files = readdirSync(DRAFT_DIR).filter((name) => name.endsWith(".json") && name !== "index.json");
  for (const file of files) {
    if (only && file !== `${only}.json`) continue;
    const draft = JSON.parse(readFileSync(join(DRAFT_DIR, file), "utf8")) as DraftFile;
    const saved = await upsertImportedTrainer(draftFileToImported(draft));
    console.info(`${saved.created ? "created" : "updated"} ${draft.handle}`);
  }
  if (only && !files.includes(`${only}.json`)) throw new Error(`No draft named ${only}.`);
}

sync()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
