import "dotenv/config";

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { and, eq, isNull } from "drizzle-orm";

import { closeDb, getDb } from "../src/db";
import type { DraftFile } from "../src/db/import-draft-map";
import { trainerProfiles } from "../src/db/schema";
import { trainerFileName } from "../src/lib/sync/policy";
import { pushMarks, pushTrainer } from "../src/lib/sync/remote";

const command = process.argv[2] || "";
const handleArg = (process.argv[3] || "").replace(/^@/, "").replace(/\.json$/, "");

function trainerFiles(handle: string) {
  const dir = path.resolve("public/trainers/instagram");
  return readdirSync(dir)
    .filter((name) => trainerFileName(handle, name))
    .map((name) => ({
      name,
      data: readFileSync(path.join(dir, name)).toString("base64"),
    }));
}

async function pushAllMarks() {
  const rows = await getDb()
    .select({
      handle: trainerProfiles.instagramHandle,
      outreachSentAt: trainerProfiles.outreachSentAt,
      inviteSentAt: trainerProfiles.inviteSentAt,
      doorEnteredAt: trainerProfiles.doorEnteredAt,
      previewToken: trainerProfiles.previewToken,
    })
    .from(trainerProfiles);
  const marks = rows
    .filter((row) => row.handle.trim())
    .map((row) => ({
      handle: row.handle,
      outreachSentAt: row.outreachSentAt?.toISOString() ?? null,
      inviteSentAt: row.inviteSentAt?.toISOString() ?? null,
      doorEnteredAt: row.doorEnteredAt?.toISOString() ?? null,
      previewToken: row.previewToken,
    }));
  const pushed = await pushMarks(marks);
  if (pushed.status === "ok") {
    for (const [handle, token] of Object.entries(pushed.tokens)) {
      if (!token) continue;
      await getDb()
        .update(trainerProfiles)
        .set({ previewToken: token })
        .where(and(eq(trainerProfiles.instagramHandle, handle), isNull(trainerProfiles.previewToken)));
    }
  }
  console.log(JSON.stringify({ ok: pushed.status === "ok", status: pushed.status, missing: pushed.missing.length }));
  if (pushed.status === "undeployed") process.exitCode = 2;
  else if (pushed.status !== "ok") process.exitCode = 1;
}

async function pushOneTrainer() {
  if (!handleArg) throw new Error("Pass the Instagram handle.");
  const file = path.resolve("data/instagram-trainers", `${handleArg}.json`);
  const draft = JSON.parse(readFileSync(file, "utf8")) as DraftFile;
  const files = trainerFiles(draft.handle || handleArg);
  const status = await pushTrainer({ draft, files });
  console.log(JSON.stringify({ ok: status === "ok", status, files: files.length }));
  if (status === "undeployed") process.exitCode = 2;
  else if (status !== "ok") process.exitCode = 1;
}

async function main() {
  if (command === "marks") {
    await pushAllMarks();
    return;
  }
  if (command === "trainer") {
    await pushOneTrainer();
    return;
  }
  throw new Error("Use marks or trainer <handle>.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
