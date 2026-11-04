import { and, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";

/** The card face is the first gallery photo, then the stored portrait. */
export function cardFace(avatarPath: string, photos?: readonly string[] | null) {
  const listed = photos?.map((item) => item.split("?")[0].trim()).find(Boolean) ?? "";
  return listed || avatarPath.split("?")[0].trim();
}

/** The account portrait wins. An empty account uses the card face. */
export function accountFace(accountPath: string, cardPath: string) {
  return accountPath.split("?")[0].trim() || cardPath;
}

/** Fill an empty account portrait from the card. A photo the person uploaded stays. */
export async function copyCardFaceToAccount(userId: string, avatarPath: string, photos?: readonly string[] | null) {
  const photo = cardFace(avatarPath, photos);
  if (!photo) return;
  await getDb()
    .update(users)
    .set({ avatarPath: photo, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.avatarPath, "")));
}
