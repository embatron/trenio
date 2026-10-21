import { and, desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { userFavorites } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";

const favoriteSchema = z.object({
  type: z.enum(["trainer", "club"]),
  slug: z.string().trim().regex(/^[a-z0-9._-]{1,80}$/),
});

export type FavoriteTarget = z.infer<typeof favoriteSchema>;

function favoriteKey(target: { type: string; slug: string }) {
  return `${target.type}:${target.slug}`;
}

async function keysFor(userId: string) {
  const rows = await getDb()
    .select({ type: userFavorites.targetType, slug: userFavorites.targetSlug })
    .from(userFavorites)
    .where(eq(userFavorites.userId, userId))
    .orderBy(desc(userFavorites.createdAt));
  return rows.map(favoriteKey);
}

export const listFavoritesFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    const keys = await keysFor(context.user.id);
    return { keys, count: keys.length };
  });

export const toggleFavoriteFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(favoriteSchema)
  .handler(async ({ data, context }) => {
    if (data.type === "trainer" && !getPublishedTrainer(data.slug)) {
      throw new AuthError("Тренер не найден.", "VALIDATION");
    }

    const db = getDb();
    const where = and(
      eq(userFavorites.userId, context.user.id),
      eq(userFavorites.targetType, data.type),
      eq(userFavorites.targetSlug, data.slug),
    );
    const [existing] = await db.select({ id: userFavorites.id }).from(userFavorites).where(where).limit(1);

    if (existing) {
      await db.delete(userFavorites).where(eq(userFavorites.id, existing.id));
    } else {
      await db.insert(userFavorites).values({
        userId: context.user.id,
        targetType: data.type,
        targetSlug: data.slug,
      });
    }

    const keys = await keysFor(context.user.id);
    return { saved: !existing, keys, count: keys.length };
  });
