import { desc, eq } from "drizzle-orm";

import { getDb } from "@/db";
import { userFavorites } from "@/db/schema";

function favoriteKey(target: { type: string; slug: string }) {
  return `${target.type}:${target.slug}`;
}

/** Saved trainer and club keys for one account, newest first. */
export async function favoriteKeysFor(userId: string) {
  const rows = await getDb()
    .select({ type: userFavorites.targetType, slug: userFavorites.targetSlug })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId))
    .orderBy(desc(userFavorites.createdAt));
  return rows.map(favoriteKey);
}
