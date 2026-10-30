import { and, eq, gt, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { conversationReads, conversations, messages, trainerProfiles, userRoles, users } from "@/db/schema";
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

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, input.recipientId));
  const trainerSide = row.ownerUserId === input.recipientId;
  const trainerCabinet = trainerSide || roles.some((item) => item.role === "trainer" || item.role === "club");
  const path = trainerCabinet
    ? `/me/messages/${input.conversationId}`
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
    const { writeLog } = await import("@/lib/log/logger");
    void writeLog({
      level: response.ok ? "info" : "error",
      domain: "message",
      action: "message.notify",
      outcome: response.ok ? "success" : "failure",
      message: response.ok ? "Уведомление ушло в Telegram." : "Telegram не принял уведомление.",
      target: input.conversationId,
      statusCode: response.status,
    });
  } catch (error) {
    const { writeLog } = await import("@/lib/log/logger");
    void writeLog({
      level: "error",
      domain: "message",
      action: "message.notify",
      outcome: "failure",
      message: "Не удалось отправить уведомление в Telegram.",
      target: input.conversationId,
      error,
    });
  }
}

/** Mail every active admin and superadmin. The comment is the reporter's note, not the chat. */
export async function notifyStaffAboutReport(input: {
  conversationId: string;
  reporterName: string;
  reporterSide: "client" | "trainer";
  trainerName: string;
  reason: string;
  comment: string;
}) {
  const rows = await getDb()
    .select({ email: users.email })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(inArray(userRoles.role, ["admin", "superadmin"]), eq(users.status, "active")));
  const to = [...new Set(rows.map((row) => row.email))];
  const { writeLog } = await import("@/lib/log/logger");
  if (to.length === 0) {
    void writeLog({
      level: "warn",
      domain: "message",
      action: "message.report.notify",
      outcome: "failure",
      message: "Нет администратора для письма о жалобе.",
      target: input.conversationId,
    });
    return;
  }
  const side = input.reporterSide === "trainer" ? "Тренер" : "Клиент";
  await sendMail({
    to,
    subject: `Жалоба на переписку: ${input.trainerName}`,
    text: [
      "Новая жалоба на переписку.",
      `Кто пожаловался: ${input.reporterName} (${side})`,
      `Тренер: ${input.trainerName}`,
      `Причина: ${input.reason}`,
      "",
      input.comment,
      "",
      `Разобрать: ${mailAppUrl()}/admin/messages`,
    ].join("\n"),
  });
  void writeLog({
    level: "info",
    domain: "message",
    action: "message.report.notify",
    outcome: "success",
    message: "Письмо о жалобе ушло администраторам.",
    target: input.conversationId,
    context: { recipients: to.length, side: input.reporterSide },
  });
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
    void deliver(input).catch(async (error) => {
      const { writeLog } = await import("@/lib/log/logger");
      void writeLog({
        level: "error",
        domain: "message",
        action: "message.notify",
        outcome: "failure",
        message: "Не удалось подготовить уведомление.",
        target: input.conversationId,
        error,
      });
    });
  }, DEBOUNCE_MS);
  timer.unref?.();
  timers.set(key, timer);
}
