import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { users } from "@/db/schema";

/** The bot has received a private message from this chat. Later direct-message notices may use it. */
export async function markTelegramBotSeen(chatId: number): Promise<void> {
  await getDb()
    .update(users)
    .set({ telegramBotSeenAt: new Date() })
    .where(and(eq(users.telegramUserId, chatId), isNull(users.telegramBotSeenAt)));
}

/** Mini App confirm means this chat already exists, even when the webhook was missed. */
export async function markTelegramBotSeenForUser(userId: string, telegramUserId: number): Promise<void> {
  await getDb()
    .update(users)
    .set({ telegramBotSeenAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.telegramUserId, telegramUserId), isNull(users.telegramBotSeenAt)));
}
