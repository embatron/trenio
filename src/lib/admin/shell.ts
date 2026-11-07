import { eq, inArray, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { countOpenWelcomes } from "@/lib/admin/welcomes";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";

async function countTrainerSlices(): Promise<{ draftsOpen: number; publishedCount: number }> {
  const db = getDb();
  const [row] = await db
    .select({
      draftsOpen: sql<number>`count(*) filter (where ${trainerProfiles.outreachSentAt} is null)`,
      publishedCount: sql<number>`count(*) filter (where ${trainerProfiles.status} = 'published')`,
    })
    .from(trainerProfiles);
  const draftsOpen = Number(row?.draftsOpen ?? 0);
  const publishedCount = Number(row?.publishedCount ?? 0);
  const catalogSlugs = PUBLISHED_TRAINERS.map((trainer) => trainer.slug);
  if (catalogSlugs.length === 0) return { draftsOpen, publishedCount };
  const present = await db
    .select({ slug: trainerProfiles.slug })
    .from(trainerProfiles)
    .where(inArray(trainerProfiles.slug, catalogSlugs));
  const known = new Set(present.map((item) => item.slug));
  const extra = catalogSlugs.filter((slug) => !known.has(slug)).length;
  return { draftsOpen: draftsOpen + extra, publishedCount: publishedCount + extra };
}

export const getAdminShellFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [hidden, rows, welcomesOpen, slices] = await Promise.all([
      hiddenStaffIds(context.user.roles),
      db
        .select({ userId: trainerReviews.userId })
        .from(trainerReviews)
        .where(eq(trainerReviews.status, "pending")),
      countOpenWelcomes(),
      countTrainerSlices(),
    ]);
    return {
      reviewsPending: rows.filter((row) => !hidden.has(row.userId)).length,
      welcomesOpen,
      draftsOpen: slices.draftsOpen,
      publishedCount: slices.publishedCount,
    };
  });
