import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles } from "@/db/schema";
import { writeLog } from "@/lib/log/logger";

/** Turn verification on for every card this account owns. A card already marked stays as it is. */
export async function grantTrainerVerification(ownerUserId: string) {
  const id = ownerUserId.trim();
  if (!id) return;
  const updated = await getDb()
    .update(trainerProfiles)
    .set({ verified: true })
    .where(and(eq(trainerProfiles.ownerUserId, id), eq(trainerProfiles.verified, false)))
    .returning({ slug: trainerProfiles.slug });
  for (const row of updated) {
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.verify",
      outcome: "success",
      message: "Верификация включена: почта или телефон подтверждены.",
      actorUserId: id,
      target: row.slug,
    });
  }
}

/** Same mark for one card, after the short link confirms the mailbox or the mobile. */
export async function grantTrainerVerificationForProfile(profileId: string) {
  const updated = await getDb()
    .update(trainerProfiles)
    .set({ verified: true })
    .where(and(eq(trainerProfiles.id, profileId), eq(trainerProfiles.verified, false)))
    .returning({ slug: trainerProfiles.slug, ownerUserId: trainerProfiles.ownerUserId });
  for (const row of updated) {
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.verify",
      outcome: "success",
      message: "Верификация включена: почта или телефон подтверждены.",
      actorUserId: row.ownerUserId,
      target: row.slug,
    });
  }
}
