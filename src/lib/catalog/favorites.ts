import { and, desc, eq, inArray } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, userFavorites } from "@/db/schema";
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
    const db = getDb();
    if (data.type === "trainer" && !getPublishedTrainer(data.slug)) {
      const [card] = await db
        .select({ status: trainerProfiles.status })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.slug, data.slug))
        .limit(1);
      if (card?.status !== "published") throw new AuthError("Тренер не найден.", "VALIDATION");
    }

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

export type FavoriteTrainerFace = {
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  photo: string;
  line: string;
  desc: string;
  city: string;
  district: string;
  tags: string[];
  experience: number;
  price: number | null;
};

/** Published cards other people can keep. The static seed list is empty, so the heart reads the database. */
export const favoriteTrainerFacesFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ slugs: z.array(z.string().trim().regex(/^[a-z0-9._-]{1,80}$/)).max(200) }))
  .handler(async ({ data }): Promise<FavoriteTrainerFace[]> => {
    const slugs = [...new Set(data.slugs)];
    if (slugs.length === 0) return [];
    const rows = await getDb()
      .select({
        slug: trainerProfiles.slug,
        firstName: trainerProfiles.firstName,
        lastName: trainerProfiles.lastName,
        fullName: trainerProfiles.fullName,
        avatarPath: trainerProfiles.avatarPath,
        photos: trainerProfiles.photos,
        bio: trainerProfiles.bio,
        city: trainerProfiles.city,
        district: trainerProfiles.district,
        experienceYears: trainerProfiles.experienceYears,
        priceFrom: trainerProfiles.priceFrom,
        sports: trainerProfiles.sports,
      })
      .from(trainerProfiles)
      .where(and(eq(trainerProfiles.status, "published"), inArray(trainerProfiles.slug, slugs)));
    return rows.map((row) => {
      const tags = (row.sports ?? []).map((sport) => sport.label?.trim() || sport.slug).filter(Boolean);
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ") || row.fullName || row.slug;
      return {
        slug: row.slug,
        name,
        firstName: row.firstName,
        lastName: row.lastName,
        photo: row.photos[0] || row.avatarPath,
        line: tags.join(", ") || "Тренер",
        desc: row.bio,
        city: row.city,
        district: row.district,
        tags,
        experience: row.experienceYears,
        price: row.priceFrom,
      };
    });
  });
