import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles, userRoles } from "@/db/schema";
import { phoneSignatureName } from "@/lib/auth/phone-label";

/** A plain client with no trainer card takes the phone as a name. A card keeps its own name. */
export async function plainUserPhoneSignature(
  userId: string,
  current: string | null | undefined,
  phone: string | null | undefined,
): Promise<string | null> {
  const next = phoneSignatureName(current, phone);
  if (!next) return null;
  const db = getDb();
  const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, userId));
  if (roles.some((row) => row.role !== "user")) return null;
  const [card] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  return card ? null : next;
}
