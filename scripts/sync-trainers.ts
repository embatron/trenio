import "dotenv/config";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db";
import { trainerProfiles } from "../src/db/schema";
import { writeLog } from "../src/lib/log/logger";
import { applyTrainerPatch, listTrainerSyncHeads, readTrainerSync } from "../src/lib/sync/apply-card";
import { cleanHandle } from "../src/lib/sync/policy";
import { fetchTrainerCard, fetchTrainerHeads, pushMarks, pushTrainerPatch } from "../src/lib/sync/remote";
import { isTrainerStatus, syncMove, type TrainerSyncHead } from "../src/lib/sync/trainers";

function asHead(value: TrainerSyncHead | undefined): TrainerSyncHead | null {
  if (!value) return null;
  const handle = cleanHandle(value.handle || "");
  if (!handle || !isTrainerStatus(value.status) || typeof value.revision !== "string") return null;
  return {
    handle,
    status: value.status,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : "",
    outreachSentAt: typeof value.outreachSentAt === "string" ? value.outreachSentAt : null,
    inviteSentAt: typeof value.inviteSentAt === "string" ? value.inviteSentAt : null,
    doorEnteredAt: typeof value.doorEnteredAt === "string" ? value.doorEnteredAt : null,
    revision: value.revision,
  };
}

function patchFrom(head: TrainerSyncHead, card: Awaited<ReturnType<typeof readTrainerSync>> | null) {
  return {
    handle: head.handle,
    status: head.status,
    updatedAt: head.updatedAt,
    outreachSentAt: head.outreachSentAt,
    inviteSentAt: head.inviteSentAt,
    doorEnteredAt: null,
    card: card?.card ?? null,
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Run this on the laptop.");
  const localRows = await listTrainerSyncHeads();
  const remote = await fetchTrainerHeads();
  if (remote.status === "undeployed") {
    console.log(JSON.stringify({ ok: false, status: "undeployed" }));
    process.exitCode = 2;
    return;
  }
  if (remote.status !== "ok") throw new Error("The live site did not send the trainer list.");

  const local = new Map(localRows.map((row) => [row.handle, row]));
  const live = new Map(remote.trainers.map((row) => asHead(row)).filter((row): row is TrainerSyncHead => Boolean(row)).map((row) => [row.handle, row]));
  const pause = () => new Promise((resolve) => setTimeout(resolve, 2100));
  const handles = [...new Set([...local.keys(), ...live.keys()])].sort();
  const counts = { pushed: 0, pulled: 0, status: 0, marks: 0, unchanged: 0 };
  const failed: Array<{ handle: string; reason: string }> = [];

  for (const handle of handles) {
    const move = syncMove(local.get(handle) ?? null, live.get(handle) ?? null);
    const busy = move.pushCard || move.pullCard || move.pushStatus || move.pullStatus || move.pushMarks || move.pullMarks;
    if (!busy) {
      counts.unchanged += 1;
      continue;
    }
    try {
      if (move.pullCard || move.pullStatus || move.pullMarks) {
        const pulled = move.pullCard ? await fetchTrainerCard(handle) : null;
        if (move.pullCard) await pause();
        if (pulled && pulled.status !== "ok") throw new Error(pulled.status);
        const source = pulled?.head ?? live.get(handle);
        if (!source) throw new Error("missing");
        const saved = await applyTrainerPatch({
          handle,
          status: source.status,
          updatedAt: source.updatedAt,
          outreachSentAt: source.outreachSentAt,
          inviteSentAt: source.inviteSentAt,
          doorEnteredAt: source.doorEnteredAt,
          card: pulled?.card ?? null,
        }, pulled?.files ?? [], "incoming");
        if (!saved.ok) throw new Error(saved.reason);
        if (saved.card) counts.pulled += 1;
        if (saved.status) counts.status += 1;
        if (saved.marks) counts.marks += 1;
      }
      if (move.pushCard || move.pushStatus || move.pushMarks) {
        const fresh = await readTrainerSync(handle);
        const head = fresh?.head ?? local.get(handle);
        if (!head) throw new Error("missing");
        const status = await pushTrainerPatch(patchFrom(head, move.pushCard ? fresh : null), move.pushCard ? fresh?.files ?? [] : []);
        await pause();
        if (status !== "ok") throw new Error(status);
        if (move.pushCard) counts.pushed += 1;
        if (move.pushStatus) counts.status += 1;
        if (move.pushMarks) counts.marks += 1;
      }
    } catch (error) {
      failed.push({ handle, reason: error instanceof Error ? error.message : "failed" });
    }
  }

  const linkRows = await getDb()
    .select({
      handle: trainerProfiles.instagramHandle,
      outreachSentAt: trainerProfiles.outreachSentAt,
      inviteSentAt: trainerProfiles.inviteSentAt,
      previewToken: trainerProfiles.previewToken,
    })
    .from(trainerProfiles);
  const marks = await pushMarks(linkRows.filter((row) => row.handle.trim()).map((row) => ({
    handle: row.handle,
    outreachSentAt: row.outreachSentAt?.toISOString() ?? null,
    inviteSentAt: row.inviteSentAt?.toISOString() ?? null,
    doorEnteredAt: null,
    previewToken: row.previewToken,
  })));
  if (marks.status === "ok") {
    for (const [handle, token] of Object.entries(marks.tokens)) {
      if (!token) continue;
      const row = linkRows.find((item) => item.handle === handle);
      if (!row || row.previewToken) continue;
      await getDb().update(trainerProfiles).set({ previewToken: token }).where(eq(trainerProfiles.instagramHandle, handle));
    }
  }

  await writeLog({
    level: failed.length ? "warn" : "info",
    domain: "admin",
    action: "admin.sync_trainers",
    outcome: failed.length ? "failure" : "success",
    message: "Карточки тренеров синхронизированы.",
    context: { ...counts, failed: failed.length },
  });
  console.log(JSON.stringify({ ok: failed.length === 0 && marks.status === "ok", ...counts, failed, links: marks.status }));
  if (failed.length || marks.status !== "ok") process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
