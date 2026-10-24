import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { conversationReads, conversations, messages, trainerProfiles, users } from "@/db/schema";
import { mailAppUrl, sendMail } from "@/lib/mail/send.server";

const DEBOUNCE_MS = 2 * 60_000;
const ONLINE_MS = 30_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function personName(firstName: string, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";
}

function trainerName(fullName: string, firstName: string, lastName: string) {
  const combined = [firstName, lastName].filter(Boolean).join(" ");
  return fullName.trim() || combined || "Тренер";
}

async function deliver(input: { conversationId: string; messageId: number; recipientId: string }) {
  const db = getDb();
  const [newer] = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, input.conversationId),
        gt(messages.id, input.messageId),
        isNull(messages.deletedAt),
      ),
    )
    .limit(1);
  if (newer) return;

  const [read] = await db
    .select({ lastReadAt: conversationReads.lastReadAt, lastReadMessageId: conversationReads.lastReadMessageId })
    .from(conversationReads)
    .where(and(eq(conversationReads.conversationId, input.conversationId), eq(conversationReads.userId, input.recipientId)))
    .limit(1);
  if (
    read &&
    Date.now() - read.lastReadAt.getTime() < ONLINE_MS &&
    read.lastReadMessageId >= input.messageId
  ) {
    return;
  }

  const [row] = await db
    .select({
      email: users.email,
      telegramUserId: users.telegramUserId,
      ownerUserId: trainerProfiles.ownerUserId,
      trainerFullName: trainerProfiles.fullName,
      trainerFirstName: trainerProfiles.firstName,
      trainerLastName: trainerProfiles.lastName,
      userFirstName: users.firstName,
      userLastName: users.lastName,
    })
    .from(conversations)
    .innerJoin(users, eq(users.id, input.recipientId))
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .where(eq(conversations.id, input.conversationId))
    .limit(1);
  if (!row) return;

  const trainerSide = row.ownerUserId === input.recipientId;
  const path = trainerSide
    ? `/trainer-admin/messages/${input.conversationId}`
    : `/account/messages/${input.conversationId}`;
  const url = `${mailAppUrl()}${path}`;
  const greetingName = trainerSide
    ? trainerName(row.trainerFullName, row.trainerFirstName, row.trainerLastName)
    : personName(row.userFirstName, row.userLastName);

  await sendMail({
    to: [row.email],
    subject: "Новое сообщение на Trenio",
    text: [
      `Здравствуйте, ${greetingName}!`,
      "",
      "Вам написали на Trenio. Откройте переписку, чтобы ответить.",
      url,
    ].join("\n"),
  });

  if (!trainerSide || !row.telegramUserId) return;
  const token = process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim();
  const text = `Новое сообщение на Trenio\n${url}`;
  if (!token) {
    if (process.env.AUTH_DEV_LOG_EMAILS === "true" || process.env.NODE_ENV !== "production") {
      console.info(`[telegram] chat=${row.telegramUserId}\n${text}`);
    }
    return;
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: row.telegramUserId,
        text,
        disable_web_page_preview: true,
      }),
    });
    if (!response.ok) console.error(`[telegram] sendMessage ${response.status}`);
  } catch (error) {
    console.error("[telegram] send failed", error instanceof Error ? error.message : "unknown");
  }
}

/** One notice per recipient after two quiet minutes. Later messages replace the timer. */
export function scheduleMessageNotification(input: {
  conversationId: string;
  messageId: number;
  recipientId: string;
}) {
  const key = `${input.conversationId}:${input.recipientId}`;
  const previous = timers.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    timers.delete(key);
    void deliver(input).catch((error) => {
      console.error("[messages] notify failed", error instanceof Error ? error.message : "unknown");
    });
  }, DEBOUNCE_MS);
  timer.unref?.();
  timers.set(key, timer);
}
