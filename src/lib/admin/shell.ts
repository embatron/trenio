import { count, eq, inArray, isNull } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { countOpenWelcomes } from "@/lib/admin/welcomes";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";

async function countUnsentTrainers(): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(trainerProfiles)
    .where(isNull(trainerProfiles.outreachSentAt));
  const catalogSlugs = PUBLISHED_TRAINERS.map((trainer) => trainer.slug);
  if (catalogSlugs.length === 0) return Number(row?.value ?? 0);
  const present = await db
    .select({ slug: trainerProfiles.slug })
    .from(trainerProfiles)
    .where(inArray(trainerProfiles.slug, catalogSlugs));
  const known = new Set(present.map((item) => item.slug));
  return Number(row?.value ?? 0) + catalogSlugs.filter((slug) => !known.has(slug)).length;
}

export const getAdminShellFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [hidden, rows, welcomesOpen, draftsOpen] = await Promise.all([
      hiddenStaffIds(context.user.roles),
      db
        .select({ userId: trainerReviews.userId })
        .from(trainerReviews)
        .where(eq(trainerReviews.status, "pending")),
      countOpenWelcomes(),
      countUnsentTrainers(),
    ]);
    return {
      reviewsPending: rows.filter((row) => !hidden.has(row.userId)).length,
      welcomesOpen,
      draftsOpen,
    };
  });
