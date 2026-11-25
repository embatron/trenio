import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { stampTrainerRevision } from "@/lib/catalog/trainer-revision";
import { trainerProfiles, userRoles } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { copyCardFaceToAccount } from "@/lib/catalog/account-face";

/** Bind an unowned card to the account that confirmed this mailbox. */
export async function attachDoorProfile(profileId: string, userId: string, email: string) {
  const now = new Date();
  const updated = await getDb().transaction(async (tx) => {
    await stampTrainerRevision(tx, "door", userId);
    return tx.update(trainerProfiles)
      .set({
        ownerUserId: userId,
        claimStatus: "claimed",
        claimedAt: now,
        email,
        emailVerifiedAt: now,
        updatedAt: now,
      })
      .where(and(eq(trainerProfiles.id, profileId), isNull(trainerProfiles.ownerUserId)))
      .returning({
        id: trainerProfiles.id,
        avatarPath: trainerProfiles.avatarPath,
        photos: trainerProfiles.photos,
      });
  });
  if (updated.length === 0) throw new AuthError("Ссылка уже не действует.", "VALIDATION");
  await getDb().insert(userRoles).values({ userId, role: "trainer" }).onConflictDoNothing();
  const card = updated[0];
  await copyCardFaceToAccount(userId, card.avatarPath, card.photos);
}
