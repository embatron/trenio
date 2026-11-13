import { and, count, desc, eq, inArray, isNull, ne, or, sql } from "drizzle-orm";

import { accountLikes, trainerProfiles, userRoles, users } from "@/db/schema";
import { accountLikePersonName } from "@/lib/catalog/account-like-rules";
import { logCaught } from "@/lib/log/logger";

export type AccountLikeMark = {
  slug: string;
  count: number;
};

export type AccountLikeHistoryItem = {
  id: string;
  name: string;
  avatar: string;
  at: string;
  slug: string | null;
};

const HISTORY_LIMIT = 100;

let tableReady = false;
let tableFailedAt = 0;

async function database() {
  const { getDb } = await import("@/db");
  return getDb();
}

export async function ensureAccountLikesTable() {
  if (tableReady) return true;
  if (tableFailedAt && Date.now() - tableFailedAt < 60_000) return false;
  try {
    const db = await database();
    await db.execute(sql`CREATE TABLE IF NOT EXISTS account_likes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      profile_id uuid NOT NULL REFERENCES trainer_profiles(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now()
    )`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS account_likes_actor_profile_unique ON account_likes (actor_user_id, profile_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS account_likes_profile_idx ON account_likes (profile_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS account_likes_actor_idx ON account_likes (actor_user_id)`);
    tableReady = true;
    return true;
  } catch (error) {
    tableFailedAt = Date.now();
    logCaught("catalog", "catalog.like", error, { target: "account_likes" });
    return false;
  }
}

export async function loadAccountLikeMarks(userId: string): Promise<AccountLikeMark[]> {
  if (!(await ensureAccountLikesTable())) return [];
  const db = await database();
  const mine = await db
    .select({ profileId: accountLikes.profileId, slug: trainerProfiles.slug })
    .from(accountLikes)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, accountLikes.profileId))
    .where(and(
      eq(accountLikes.actorUserId, userId),
      eq(trainerProfiles.status, "published"),
      or(isNull(trainerProfiles.ownerUserId), ne(trainerProfiles.ownerUserId, userId)),
    ));
  if (mine.length === 0) return [];
  const totals = await db
    .select({ profileId: accountLikes.profileId, total: count() })
    .from(accountLikes)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, accountLikes.profileId))
    .where(and(
      inArray(accountLikes.profileId, mine.map((row) => row.profileId)),
      or(isNull(trainerProfiles.ownerUserId), ne(accountLikes.actorUserId, trainerProfiles.ownerUserId)),
    ))
    .groupBy(accountLikes.profileId);
  const byProfile = new Map(totals.map((row) => [row.profileId, Number(row.total)]));
  return mine.map((row) => ({ slug: row.slug, count: byProfile.get(row.profileId) ?? 0 }));
}

/** Likes other people placed. The owner's own row does not count. */
export async function visibleLikeCount(profileId: string, ownerUserId: string | null): Promise<number> {
  const db = await database();
  const where = ownerUserId
    ? and(eq(accountLikes.profileId, profileId), ne(accountLikes.actorUserId, ownerUserId))
    : eq(accountLikes.profileId, profileId);
  const [row] = await db.select({ total: count() }).from(accountLikes).where(where);
  return Number(row?.total ?? 0);
}

/** Public totals for published cards. Missing table returns an empty map. */
export async function loadPublicLikeCounts(): Promise<Record<string, number>> {
  if (!(await ensureAccountLikesTable())) return {};
  const db = await database();
  const rows = await db
    .select({ slug: trainerProfiles.slug, total: count() })
    .from(accountLikes)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, accountLikes.profileId))
    .where(and(
      eq(trainerProfiles.status, "published"),
      or(isNull(trainerProfiles.ownerUserId), ne(accountLikes.actorUserId, trainerProfiles.ownerUserId)),
    ))
    .groupBy(trainerProfiles.slug);
  const counts: Record<string, number> = {};
  for (const row of rows) {
    const total = Number(row.total);
    if (total > 0) counts[row.slug] = total;
  }
  return counts;
}

function cardName(firstName: string, lastName: string, fullName: string): string {
  const full = fullName.trim();
  if (full) return full;
  const named = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
  return named || "Тренер";
}

export async function loadAccountLikeHistory(
  userId: string,
): Promise<{ received: AccountLikeHistoryItem[]; given: AccountLikeHistoryItem[] }> {
  if (!(await ensureAccountLikesTable())) return { received: [], given: [] };
  const db = await database();
  const receivedRows = await db
    .select({
      id: accountLikes.id,
      at: accountLikes.createdAt,
      actorId: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      email: users.email,
      status: users.status,
      avatar: users.avatarPath,
    })
    .from(accountLikes)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, accountLikes.profileId))
    .innerJoin(users, eq(users.id, accountLikes.actorUserId))
    .innerJoin(userRoles, and(eq(userRoles.userId, users.id), eq(userRoles.role, "user")))
    .where(and(eq(trainerProfiles.ownerUserId, userId), ne(accountLikes.actorUserId, userId)))
    .orderBy(desc(accountLikes.createdAt))
    .limit(HISTORY_LIMIT);
  const actorIds = [...new Set(receivedRows.map((row) => row.actorId))];
  const cards = actorIds.length
    ? await db
        .select({ ownerUserId: trainerProfiles.ownerUserId, slug: trainerProfiles.slug })
        .from(trainerProfiles)
        .where(and(inArray(trainerProfiles.ownerUserId, actorIds), eq(trainerProfiles.status, "published")))
        .orderBy(trainerProfiles.slug)
    : [];
  const slugByOwner = new Map<string, string>();
  for (const card of cards) {
    if (card.ownerUserId && !slugByOwner.has(card.ownerUserId)) slugByOwner.set(card.ownerUserId, card.slug);
  }
  const received = receivedRows.map((row) => ({
    id: row.id,
    name: accountLikePersonName(row.firstName, row.lastName, row.email, row.status),
    avatar: row.status === "deleted" ? "" : row.avatar,
    at: row.at.toISOString(),
    slug: row.status === "deleted" ? null : (slugByOwner.get(row.actorId) ?? null),
  }));

  const givenRows = await db
    .select({
      id: accountLikes.id,
      at: accountLikes.createdAt,
      slug: trainerProfiles.slug,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      fullName: trainerProfiles.fullName,
      avatar: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
    })
    .from(accountLikes)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, accountLikes.profileId))
    .where(and(
      eq(accountLikes.actorUserId, userId),
      eq(trainerProfiles.status, "published"),
      or(isNull(trainerProfiles.ownerUserId), ne(trainerProfiles.ownerUserId, userId)),
    ))
    .orderBy(desc(accountLikes.createdAt))
    .limit(HISTORY_LIMIT);
  const given = givenRows.map((row) => ({
    id: row.id,
    name: cardName(row.firstName, row.lastName, row.fullName),
    avatar: row.photos[0] || row.avatar,
    at: row.at.toISOString(),
    slug: row.slug,
  }));
  return { received, given };
}
