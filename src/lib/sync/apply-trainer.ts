import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { draftFileToImported, type DraftFile } from "@/db/import-draft-map";
import { trainerProfiles } from "@/db/schema";
import { upsertImportedTrainer } from "@/db/trainer-profiles";
import { writeLog } from "@/lib/log/logger";

import { cleanHandle, looksLikeMedia, trainerFileName } from "./policy";

const FILE_CAP = 2_500_000;
const TOTAL_CAP = 24_000_000;

type IncomingFile = { name?: unknown; data?: unknown };

function mediaRoots() {
  const roots = [path.resolve("public/trainers/instagram")];
  if (existsSync(path.resolve("dist/client"))) {
    roots.push(path.resolve("dist/client/trainers/instagram"));
  }
  return roots;
}

export async function applySyncedTrainer(body: { draft?: DraftFile; files?: IncomingFile[] }) {
  const draft = body.draft;
  const handle = cleanHandle(draft?.handle || "");
  if (!draft || !handle || !draft.sourceUrl || !draft.firstName) {
    return { ok: false as const, reason: "draft" as const };
  }
  const files = Array.isArray(body.files) ? body.files : [];
  if (files.length > 40) return { ok: false as const, reason: "files" as const };

  let total = 0;
  const written: Array<{ name: string; bytes: Buffer }> = [];
  for (const file of files) {
    const name = typeof file.name === "string" ? file.name : "";
    const data = typeof file.data === "string" ? file.data : "";
    if (!trainerFileName(handle, name)) return { ok: false as const, reason: "name" as const };
    const bytes = Buffer.from(data, "base64");
    if (!bytes.length || bytes.length > FILE_CAP || !looksLikeMedia(name, bytes)) {
      return { ok: false as const, reason: "file" as const };
    }
    total += bytes.length;
    if (total > TOTAL_CAP) return { ok: false as const, reason: "size" as const };
    written.push({ name, bytes });
  }

  for (const root of mediaRoots()) {
    mkdirSync(root, { recursive: true });
    for (const file of written) {
      const target = path.resolve(root, file.name);
      if (!target.startsWith(root + path.sep)) return { ok: false as const, reason: "name" as const };
      writeFileSync(target, file.bytes);
    }
  }

  const mapped = draftFileToImported({ ...draft, handle });
  const [existing] = await getDb()
    .select({ status: trainerProfiles.status })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.instagramHandle, handle))
    .limit(1);
  mapped.status = existing && existing.status !== "draft" ? existing.status : "draft";
  const saved = await upsertImportedTrainer(mapped);
  void writeLog({
    level: "info",
    domain: "admin",
    action: "admin.sync_trainer",
    outcome: "success",
    message: "Черновик тренера синхронизирован.",
    target: handle,
    context: { files: written.length, created: saved.created },
  });
  return { ok: true as const, handle, created: saved.created };
}
