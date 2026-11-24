import { and, eq, isNull, ne, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { accountLikes, trainerProfiles, userRoles, users } from "@/db/schema";
import { ensureAccountLikesTable } from "@/lib/catalog/account-like-load.server";
import { isPlainLikeActor } from "@/lib/catalog/plain-user-like";
import { logCaught, writeLog } from "@/lib/log/logger";

async function plainLikeActorId(): Promise<string | null> {
  const rows = await getDb()
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      role: userRoles.role,
    })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(
      sql`lower(${users.firstName}) = 'eugene'`,
      sql`lower(${users.lastName}) = 'sokolov'`,
      eq(users.status, "active"),
    ));
  const byId = new Map<string, { firstName: string; lastName: string | null; roles: string[] }>();
  for (const row of rows) {
    const current = byId.get(row.id) ?? { firstName: row.firstName, lastName: row.lastName, roles: [] };
    current.roles.push(row.role);
    byId.set(row.id, current);
  }
  const matches = [...byId.entries()].filter(([, actor]) => isPlainLikeActor(actor));
  return matches.length === 1 ? matches[0][0] : null;
}

/** One like from the plain user on every trainer card that does not have it yet. */
export async function grantPlainUserLikes(profileId?: string): Promise<number> {
  if (!(await ensureAccountLikesTable())) return 0;
  const actorId = await plainLikeActorId();
  if (!actorId) return 0;
  const db = getDb();
  const missing = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .leftJoin(
      accountLikes,
      and(eq(accountLikes.profileId, trainerProfiles.id), eq(accountLikes.actorUserId, actorId)),
    )
    .where(and(
      isNull(accountLikes.id),
      or(isNull(trainerProfiles.ownerUserId), ne(trainerProfiles.ownerUserId, actorId)),
      ...(profileId ? [eq(trainerProfiles.id, profileId)] : []),
    ));
  if (missing.length === 0) return 0;
  await db.insert(accountLikes).values(missing.map((row) => ({
    actorUserId: actorId,
    profileId: row.id,
  }))).onConflictDoNothing();
  return missing.length;
}

/** A new card gets the like. A failure here does not undo the card. */
export async function grantPlainUserLike(profileId: string): Promise<void> {
  try {
    const placed = await grantPlainUserLikes(profileId);
    if (placed < 1) return;
    void writeLog({
      level: "info",
      domain: "catalog",
      action: "catalog.like",
      outcome: "success",
      message: "Лайкос простого пользователя поставлен.",
      target: profileId,
    });
  } catch (error) {
    logCaught("catalog", "catalog.like", error, { target: profileId });
  }
}
