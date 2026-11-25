import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { stampTrainerRevision } from "@/lib/catalog/trainer-revision";
import { trainerProfiles } from "@/db/schema";
import { writeLog } from "@/lib/log/logger";
import { staffProof, verificationMessage, type TrainerProof } from "@/lib/catalog/trainer-verify-log";

/** Turn verification on for every card this account owns. A card already marked stays as it is. */
export async function grantTrainerVerification(
  ownerUserId: string,
  via: TrainerProof,
  proof?: { actorUserId?: string | null; subject?: string | null },
) {
  const id = ownerUserId.trim();
  if (!id) return;
  const staff = staffProof(via);
  const updated = await getDb().transaction(async (tx) => {
    await stampTrainerRevision(tx, staff ? "admin" : "door", proof?.actorUserId ?? id);
    return tx.update(trainerProfiles)
      .set({ verified: true, unclearHold: false })
      .where(and(eq(trainerProfiles.ownerUserId, id), eq(trainerProfiles.verified, false)))
      .returning({ slug: trainerProfiles.slug });
  });
  for (const row of updated) {
    void writeLog({
      level: "info",
      domain: staff ? "admin" : "account",
      action: staff ? "admin.trainer_verify" : "account.verify",
      outcome: "success",
      message: verificationMessage(via),
      actorUserId: proof?.actorUserId ?? id,
      subject: proof?.subject ?? null,
      target: row.slug,
      context: { via, staff },
    });
  }
}

/** Same mark for one card, after the short link confirms the mailbox or the mobile. */
export async function grantTrainerVerificationForProfile(
  profileId: string,
  via: TrainerProof,
  proof?: { actorUserId?: string | null; subject?: string | null },
) {
  const staff = staffProof(via);
  const updated = await getDb().transaction(async (tx) => {
    await stampTrainerRevision(tx, staff ? "admin" : "door", proof?.actorUserId ?? null);
    return tx.update(trainerProfiles)
      .set({ verified: true, unclearHold: false })
      .where(and(eq(trainerProfiles.id, profileId), eq(trainerProfiles.verified, false)))
      .returning({ slug: trainerProfiles.slug, ownerUserId: trainerProfiles.ownerUserId });
  });
  for (const row of updated) {
    const staff = staffProof(via);
    void writeLog({
      level: "info",
      domain: staff ? "admin" : "account",
      action: staff ? "admin.trainer_verify" : "account.verify",
      outcome: "success",
      message: verificationMessage(via),
      actorUserId: proof?.actorUserId ?? row.ownerUserId,
      subject: proof?.subject ?? null,
      target: row.slug,
      context: { via, staff },
    });
  }
}
