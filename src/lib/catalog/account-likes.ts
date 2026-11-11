import { and, count, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { accountLikes, trainerProfiles } from "@/db/schema";
import { AuthError, isAuthError } from "@/lib/auth/errors";
import {
  ensureAccountLikesTable,
  loadAccountLikeHistory,
  loadAccountLikeMarks,
  type AccountLikeHistoryItem,
  type AccountLikeMark,
} from "@/lib/catalog/account-like-load.server";
import { canPlaceAccountLike } from "@/lib/catalog/account-like-rules";
import { logCaught, writeLog } from "@/lib/log/logger";
import { publishCabinet } from "@/lib/messages/live-hub";

const slugSchema = z.object({
  slug: z.string().trim().regex(/^[a-z0-9._-]{1,80}$/),
});

export type { AccountLikeHistoryItem, AccountLikeMark };

async function database() {
  const { getDb } = await import("@/db");
  return getDb();
}

export const listOwnAccountLikesFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<{ received: AccountLikeHistoryItem[]; given: AccountLikeHistoryItem[] }> => {
    try {
      return await loadAccountLikeHistory(context.user.id);
    } catch (error) {
      logCaught("catalog", "catalog.like", error, { actorUserId: context.user.id });
      return { received: [], given: [] };
    }
  });

export const listAccountLikesFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<{ marks: AccountLikeMark[] }> => {
    if (!canPlaceAccountLike(context.user.roles)) return { marks: [] };
    try {
      return { marks: await loadAccountLikeMarks(context.user.id) };
    } catch (error) {
      logCaught("catalog", "catalog.like", error, { actorUserId: context.user.id });
      return { marks: [] };
    }
  });

export const toggleAccountLikeFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(slugSchema)
  .handler(async ({ data, context }): Promise<{ liked: boolean; count: number | null }> => {
    if (!canPlaceAccountLike(context.user.roles)) {
      void writeLog({
        level: "warn",
        domain: "catalog",
        action: "catalog.like",
        outcome: "denied",
        message: "Лайкос доступен зарегистрированным пользователям и тренерам.",
        actorUserId: context.user.id,
        subject: context.user.email,
        target: data.slug,
      });
      throw new AuthError("Лайкос доступен зарегистрированным пользователям и тренерам.", "FORBIDDEN");
    }
    if (!(await ensureAccountLikesTable())) {
      throw new AuthError("Не удалось сохранить лайкос.", "VALIDATION");
    }

    try {
      const db = await database();
      const [card] = await db
        .select({ id: trainerProfiles.id, status: trainerProfiles.status, ownerUserId: trainerProfiles.ownerUserId })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.slug, data.slug))
        .limit(1);
      if (!card || card.status !== "published") {
        throw new AuthError("Тренер не найден.", "VALIDATION");
      }

      const where = and(eq(accountLikes.actorUserId, context.user.id), eq(accountLikes.profileId, card.id));
      const [existing] = await db.select({ id: accountLikes.id }).from(accountLikes).where(where).limit(1);
      if (existing) {
        await db.delete(accountLikes).where(eq(accountLikes.id, existing.id));
      } else {
        await db.insert(accountLikes).values({
          actorUserId: context.user.id,
          profileId: card.id,
        }).onConflictDoNothing();
      }
      const liked = !existing;
      let total: number | null = null;
      if (liked) {
        const [row] = await db.select({ total: count() }).from(accountLikes).where(eq(accountLikes.profileId, card.id));
        total = Number(row?.total ?? 0);
      }

      void writeLog({
        level: "info",
        domain: "catalog",
        action: "catalog.like",
        outcome: "success",
        message: liked ? "Лайкос поставлен." : "Лайкос снят.",
        actorUserId: context.user.id,
        subject: context.user.email,
        target: data.slug,
        context: { on: liked },
      });
      publishCabinet([context.user.id, card.ownerUserId]);
      return { liked, count: total };
    } catch (error) {
      if (isAuthError(error)) throw error;
      logCaught("catalog", "catalog.like", error, {
        actorUserId: context.user.id,
        subject: context.user.email,
        target: data.slug,
      });
      throw new AuthError("Не удалось сохранить лайкос.", "VALIDATION");
    }
  });
