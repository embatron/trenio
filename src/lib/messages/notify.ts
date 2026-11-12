import { and, eq, gt, inArray, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { conversationReads, conversations, messages, trainerProfiles, userRoles, users } from "@/db/schema";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { storedGivenName } from "@/lib/auth/login-name";
import { reviewPlainText } from "@/lib/catalog/review-html";
import { writeLog } from "@/lib/log/logger";
import { renderLetter } from "@/lib/mail/letter";
import { canReceiveMailbox, messageTelegramNoticeAllowed, telegramThreadButton } from "@/lib/mail/notice-rules";
import { letterWaitMs, presenceFor } from "@/lib/messages/presence";
import { sendMessagePushes } from "@/lib/messages/push";
import { recipientAllowsMail } from "@/lib/mail/preferences";
import { mailAppUrl, sendMail } from "@/lib/mail/send.server";

const LETTER_DEBOUNCE_MS = 2 * 60_000;
const PUSH_DEBOUNCE_MS = 15_000;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const letterHeld = new Set<string>();

function personName(firstName: string | null | undefined, lastName: string | null | undefined, email?: string | null) {
  const given = storedGivenName(firstName, email);
  return [given, lastName].filter(Boolean).join(" ") || "Пользователь";
}

function trainerName(fullName: string | null, firstName: string | null, lastName: string | null) {
  const combined = [firstName, lastName].filter(Boolean).join(" ");
  return (fullName ?? "").trim() || combined || "Тренер";
}

export async function deliverMessageNotice(input: {
  conversationId: string;
  messageId: number;
  recipientId: string;
  channel: "push" | "letter";
}) {
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
  if (read && read.lastReadMessageId >= input.messageId) return;

  const here = (await presenceFor([input.recipientId])).get(input.recipientId) ?? "offline";
  const wait = letterWaitMs(here);
  if (wait != null) {
    const key = `${input.conversationId}:${input.recipientId}:${input.channel}`;
    if (input.channel === "letter" && !letterHeld.has(key)) {
      letterHeld.add(key);
      void writeLog({
        level: "info",
        domain: "email",
        action: "email.notice",
        outcome: "skipped",
        message: "Письмо о сообщении ждёт, пока человек не выйдет из сети.",
        target: input.conversationId,
      });
    }
    arm(key, wait, () => deliverMessageNotice(input), input.conversationId);
    return;
  }
  letterHeld.delete(`${input.conversationId}:${input.recipientId}:letter`);

  const [row] = await db
    .select({
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      telegramUserId: users.telegramUserId,
      telegramBotSeenAt: users.telegramBotSeenAt,
      ownerUserId: trainerProfiles.ownerUserId,
      hostUserId: conversations.hostUserId,
      trainerFullName: trainerProfiles.fullName,
      trainerFirstName: trainerProfiles.firstName,
      trainerLastName: trainerProfiles.lastName,
      trainerAvatar: trainerProfiles.avatarPath,
      userFirstName: users.firstName,
      userLastName: users.lastName,
      pushMessages: users.pushMessages,
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
      : personName(row.userFirstName, row.userLastName, row.email);

  const [posted] = await db
    .select({ body: messages.body, senderId: messages.senderId })
    .from(messages)
    .where(eq(messages.id, input.messageId))
    .limit(1);
  if (!posted) return;
  const [sender] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, email: users.email, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, posted.senderId))
    .limit(1);
  const fromOwner = row.ownerUserId != null && posted.senderId === row.ownerUserId;
  const fromPortal = row.hostUserId != null && posted.senderId === row.hostUserId;
  const writerName = fromPortal
    ? "Trenioby"
    : fromOwner
      ? trainerName(row.trainerFullName, row.trainerFirstName, row.trainerLastName)
      : personName(sender?.firstName ?? "", sender?.lastName ?? null, sender?.email);
  if (input.channel === "push") {
    if (row.pushMessages) {
      await sendMessagePushes(input.recipientId, {
        title: writerName,
        body: "Вам написали на Trenio",
        url,
        tag: input.conversationId,
      });
    } else {
      void writeLog({
        level: "info",
        domain: "message",
        action: "message.push",
        outcome: "skipped",
        message: "Уведомление в браузере не отправлено: выключено в настройках.",
        target: input.conversationId,
      });
    }
    return;
  }

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

  if (!canReceiveMailbox(row.email, row.emailVerifiedAt) || isPendingSignupEmail(row.email)) {
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.notice",
      outcome: "skipped",
      message: "Письмо о сообщении не отправлено: почта не подтверждена.",
      subject: isPendingSignupEmail(row.email) ? null : row.email,
      target: input.conversationId,
    });
  } else if (await recipientAllowsMail(row.email, "messages")) {
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

  if (!messageTelegramNoticeAllowed({
    telegramUserId: row.telegramUserId,
    botSeenAt: row.telegramBotSeenAt,
  })) {
    return;
  }
  const token = process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim();
  const text = "Вам написали на Trenio";
  const button = telegramThreadButton(url);
  if (!token) {
    if (process.env.AUTH_DEV_LOG_EMAILS === "true" || process.env.NODE_ENV !== "production") {
      console.info(`[telegram] chat=${row.telegramUserId}\n${text}\n${url}`);
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
        ...(button ? { reply_markup: button } : {}),
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
    service: true,
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

function arm(
  key: string,
  delay: number,
  run: () => Promise<void>,
  conversationId: string,
) {
  const previous = timers.get(key);
  if (previous) clearTimeout(previous);
  const timer = setTimeout(() => {
    timers.delete(key);
    void run().catch((error: unknown) => {
      void writeLog({
        level: "error",
        domain: "message",
        action: "message.notify",
        outcome: "failure",
        message: "Не удалось подготовить уведомление.",
        target: conversationId,
        error,
      });
    });
  }, delay);
  timer.unref?.();
  timers.set(key, timer);
}

/** Push after a short quiet pause. Mail and Telegram wait two minutes. A later message replaces both timers. */
export function scheduleMessageNotification(input: {
  conversationId: string;
  messageId: number;
  recipientId: string;
}) {
  const base = `${input.conversationId}:${input.recipientId}`;
  arm(base + ":push", PUSH_DEBOUNCE_MS, () => deliverMessageNotice({ ...input, channel: "push" }), input.conversationId);
  arm(base + ":letter", LETTER_DEBOUNCE_MS, () => deliverMessageNotice({ ...input, channel: "letter" }), input.conversationId);
}
