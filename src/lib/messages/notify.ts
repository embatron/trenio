import { and, eq, gt, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { conversationReads, conversations, messages, trainerProfiles, userRoles, users } from "@/db/schema";
import { reviewPlainText } from "@/lib/catalog/review-html";
import { writeLog } from "@/lib/log/logger";
import { renderLetter } from "@/lib/mail/letter";
import { recipientAllowsMail } from "@/lib/mail/preferences";
import { mailAppUrl, sendMail } from "@/lib/mail/send.server";

const DEBOUNCE_MS = 2 * 60_000;
const ONLINE_MS = 30_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();

function personName(firstName: string, lastName: string | null) {
  return [firstName, lastName].filter(Boolean).join(" ") || "Пользователь";
}

function trainerName(fullName: string | null, firstName: string | null, lastName: string | null) {
  const combined = [firstName, lastName].filter(Boolean).join(" ");
  return (fullName ?? "").trim() || combined || "Тренер";
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
      hostUserId: conversations.hostUserId,
      trainerFullName: trainerProfiles.fullName,
      trainerFirstName: trainerProfiles.firstName,
      trainerLastName: trainerProfiles.lastName,
      trainerAvatar: trainerProfiles.avatarPath,
      userFirstName: users.firstName,
      userLastName: users.lastName,
    })
    .from(conversations)
    .innerJoin(users, eq(users.id, input.recipientId))
    .leftJoin(trainerProfiles, eq(trainerProfiles.id, conversations.trainerProfileId))
    .where(eq(conversations.id, input.conversationId))
    .limit(1);
  if (!row) return;

  const roles = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, input.recipientId));
  const trainerSide = row.ownerUserId === input.recipientId || row.hostUserId === input.recipientId;
  const trainerCabinet = trainerSide || roles.some((item) => item.role === "trainer" || item.role === "club");
  const path = trainerCabinet
    ? `/me/messages/${input.conversationId}`
    : `/account/messages/${input.conversationId}`;
  const url = `${mailAppUrl()}${path}`;
  const greetingName = row.hostUserId === input.recipientId
    ? "Trenioby"
    : trainerSide
      ? trainerName(row.trainerFullName, row.trainerFirstName, row.trainerLastName)
      : personName(row.userFirstName, row.userLastName);

  const [posted] = await db
    .select({ body: messages.body, senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.id, input.messageId))
    .limit(1);
  if (!posted) return;
  const [sender] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, posted.senderId))
    .limit(1);
  const fromOwner = row.ownerUserId != null && posted.senderId === row.ownerUserId;
  const fromPortal = row.hostUserId != null && posted.senderId === row.hostUserId;
  const writerName = fromPortal
    ? "Trenioby"
    : fromOwner
      ? trainerName(row.trainerFullName, row.trainerFirstName, row.trainerLastName)
      : personName(sender?.firstName ?? "", sender?.lastName ?? null);
  const quote = reviewPlainText(posted.body).trim() || "В сообщении нет текста, только вложение.";
  const letter = renderLetter({
    title: `${writerName} написал вам`,
    lead: `Здравствуйте, ${greetingName}!`,
    person: {
      name: writerName,
      avatarUrl: (fromOwner ? row.trainerAvatar : sender?.avatarPath) || undefined,
      caption: fromPortal ? "Trenio" : fromOwner ? "Тренер" : "Клиент",
    },
    quote,
    action: { href: url, label: "Открыть переписку" },
  });

  if (await recipientAllowsMail(row.email, "messages")) {
    await sendMail({
      to: [row.email],
      subject: `${writerName} написал вам на Trenio`,
      text: letter.text,
      html: letter.html,
    });
  } else {
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.preference",
      outcome: "skipped",
      message: "Письмо о сообщении не отправлено: этот вид писем выключен.",
      subject: row.email,
      target: input.conversationId,
      context: { kind: "messages" },
    });
  }

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
  reporterAvatar?: string;
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
  const letter = renderLetter({
    title: "Жалоба на переписку",
    person: { name: input.reporterName, avatarUrl: input.reporterAvatar, caption: side },
    quote: input.comment,
    lines: [`Тренер: ${input.trainerName}`, `Причина: ${input.reason}`],
    action: { href: `${mailAppUrl()}/admin/messages`, label: "Разобрать" },
  });
  await sendMail({
    to,
    subject: `Жалоба на переписку: ${input.trainerName}`,
    text: letter.text,
    html: letter.html,
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
