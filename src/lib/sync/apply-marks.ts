import { eq, or } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import { ensureTrainerDoorSchema } from "@/lib/catalog/trainer-door-schema";
import { writeLog } from "@/lib/log/logger";

import type { MarkPush } from "./remote";
import { cleanHandle, nextStamp, nextToken } from "./policy";

export type AppliedMarks = {
  applied: number;
  missing: string[];
  tokens: Record<string, string>;
};

export async function listSyncMarks() {
  await ensureTrainerDoorSchema();
  const rows = await getDb()
    .select({
      handle: trainerProfiles.instagramHandle,
      slug: trainerProfiles.slug,
      status: trainerProfiles.status,
      outreachSentAt: trainerProfiles.outreachSentAt,
      inviteSentAt: trainerProfiles.inviteSentAt,
      doorEnteredAt: trainerProfiles.doorEnteredAt,
      previewToken: trainerProfiles.previewToken,
    })
    .from(trainerProfiles);
  return rows
    .filter((row) => row.handle.trim())
    .map((row) => ({
      handle: row.handle,
      slug: row.slug,
      status: row.status,
      outreachSentAt: row.outreachSentAt?.toISOString() ?? null,
      inviteSentAt: row.inviteSentAt?.toISOString() ?? null,
      doorEnteredAt: row.doorEnteredAt?.toISOString() ?? null,
      hasLink: Boolean(row.previewToken),
    }));
}

export async function applySyncMarks(marks: MarkPush[]): Promise<AppliedMarks> {
  await ensureTrainerDoorSchema();
  const db = getDb();
  const missing: string[] = [];
  const tokens: Record<string, string> = {};
  let applied = 0;

  for (const mark of marks.slice(0, 200)) {
    const handle = cleanHandle(mark.handle || "");
    if (!handle) continue;
    const [row] = await db
      .select({
        id: trainerProfiles.id,
        handle: trainerProfiles.instagramHandle,
        outreachSentAt: trainerProfiles.outreachSentAt,
        inviteSentAt: trainerProfiles.inviteSentAt,
        doorEnteredAt: trainerProfiles.doorEnteredAt,
        previewToken: trainerProfiles.previewToken,
      })
      .from(trainerProfiles)
      .where(or(eq(trainerProfiles.instagramHandle, handle), eq(trainerProfiles.slug, handle)))
      .limit(1);
    if (!row) {
      missing.push(handle);
      continue;
    }
    const patch: {
      outreachSentAt?: Date;
      inviteSentAt?: Date;
      doorEnteredAt?: Date;
      previewToken?: string;
      updatedAt?: Date;
    } = {};
    const outreach = nextStamp(row.outreachSentAt, mark.outreachSentAt);
    const invite = nextStamp(row.inviteSentAt, mark.inviteSentAt);
    const door = nextStamp(row.doorEnteredAt, mark.doorEnteredAt);
    const token = nextToken(row.previewToken, mark.previewToken);
    if (outreach) patch.outreachSentAt = outreach;
    if (invite) patch.inviteSentAt = invite;
    if (door) patch.doorEnteredAt = door;
    if (token) {
      const [clash] = await db
        .select({ id: trainerProfiles.id })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.previewToken, token))
        .limit(1);
      if (!clash) patch.previewToken = token;
    }
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = new Date();
      await db.update(trainerProfiles).set(patch).where(eq(trainerProfiles.id, row.id));
    }
    applied += 1;
    if (mark.previewToken) {
      const kept = patch.previewToken || row.previewToken || "";
      tokens[handle] = kept;
      if (row.handle) tokens[row.handle] = kept;
    }
  }

  void writeLog({
    level: "info",
    domain: "admin",
    action: "admin.sync_marks",
    outcome: missing.length ? "failure" : "success",
    message: "Отметки сообщений синхронизированы.",
    context: { applied, missing: missing.length },
  });
  return { applied, missing, tokens };
}
