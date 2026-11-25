import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles, trainerReviews } from "@/db/schema";
import { hiddenStaffIds } from "@/lib/admin/access";
import { countOpenWelcomes } from "@/lib/admin/welcomes";
import type { UserRole } from "@/lib/auth/types";

export type AdminShellCounts = {
  reviewsPending: number;
  welcomesOpen: number;
  draftsOpen: number;
  publishedCount: number;
  unclearCount: number;
  declinedCount: number;
};

async function countTrainerSlices(): Promise<{ draftsOpen: number; publishedCount: number; unclearCount: number; declinedCount: number }> {
  const db = getDb();
  const [row] = await db
    .select({
      draftsOpen: sql<number>`count(*) filter (where ${trainerProfiles.status} = 'draft' and ${trainerProfiles.doorEnteredAt} is null)`,
      publishedCount: sql<number>`count(*) filter (where
        ${trainerProfiles.status} = 'published'
        and ${trainerProfiles.verified} = true
        and exists (
          select 1 from users as account
          where account.id = ${trainerProfiles.ownerUserId}
            and (account.email_verified_at is not null or account.phone_verified_at is not null)
        )
      )`,
      unclearCount: sql<number>`count(*) filter (where
        ${trainerProfiles.status} <> 'declined'
        and ${trainerProfiles.doorEnteredAt} is not null
        and not (
          ${trainerProfiles.verified} = true
          and exists (
            select 1 from users as account
            where account.id = ${trainerProfiles.ownerUserId}
              and (account.email_verified_at is not null or account.phone_verified_at is not null)
          )
        )
      )`,
      declinedCount: sql<number>`count(*) filter (where ${trainerProfiles.status} = 'declined')`,
    })
    .from(trainerProfiles);
  return {
    draftsOpen: Number(row?.draftsOpen ?? 0),
    publishedCount: Number(row?.publishedCount ?? 0),
    unclearCount: Number(row?.unclearCount ?? 0),
    declinedCount: Number(row?.declinedCount ?? 0),
  };
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
    declinedCount: slices.declinedCount,
  };
}
