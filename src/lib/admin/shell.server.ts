import { eq, inArray, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import { hiddenStaffIds } from "@/lib/admin/access";
import { countOpenWelcomes } from "@/lib/admin/welcomes";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";
import type { UserRole } from "@/lib/auth/types";

export type AdminShellCounts = {
  reviewsPending: number;
  welcomesOpen: number;
  draftsOpen: number;
  publishedCount: number;
  unclearCount: number;
};

async function countTrainerSlices(): Promise<{ draftsOpen: number; publishedCount: number; unclearCount: number }> {
  const db = getDb();
  const [row] = await db
    .select({
      draftsOpen: sql<number>`count(*) filter (where ${trainerProfiles.doorEnteredAt} is null)`,
      publishedCount: sql<number>`count(*) filter (where ${trainerProfiles.status} = 'published')`,
      unclearCount: sql<number>`count(*) filter (where ${trainerProfiles.outreachSentAt} is not null and ${trainerProfiles.doorEnteredAt} is not null and ${trainerProfiles.status} = 'draft' and ${trainerProfiles.ownerUserId} is null and ${trainerProfiles.claimedAt} is null and ${trainerProfiles.offerAcceptedAt} is null)`,
    })
    .from(trainerProfiles);
  const draftsOpen = Number(row?.draftsOpen ?? 0);
  const publishedCount = Number(row?.publishedCount ?? 0);
  const unclearCount = Number(row?.unclearCount ?? 0);
  const catalogSlugs = PUBLISHED_TRAINERS.map((trainer) => trainer.slug);
  if (catalogSlugs.length === 0) return { draftsOpen, publishedCount, unclearCount };
  const present = await db
    .select({ slug: trainerProfiles.slug })
    .from(trainerProfiles)
    .where(inArray(trainerProfiles.slug, catalogSlugs));
  const known = new Set(present.map((item) => item.slug));
  const extra = catalogSlugs.filter((slug) => !known.has(slug)).length;
  return { draftsOpen: draftsOpen + extra, publishedCount: publishedCount + extra, unclearCount };
}

/** Queue sizes shown beside the admin cabinet links. */
export async function loadAdminShell(roles: UserRole[]): Promise<AdminShellCounts> {
  const db = getDb();
  const [hidden, rows, welcomesOpen, slices] = await Promise.all([
    hiddenStaffIds(roles),
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
    unclearCount: slices.unclearCount,
  };
}
