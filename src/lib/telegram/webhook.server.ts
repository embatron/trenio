import { eq } from "drizzle-orm";

import { loginBotToken } from "@/auth/telegram";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { logCaught, writeLog } from "@/lib/log/logger";
import { rememberDigestChat } from "@/lib/telegram/digest-chat";
import { markTelegramBotSeen } from "@/lib/telegram/bot-seen";

import {
  resolveTelegramAction,
  telegramGroupText,
  telegramHomeText,
  telegramMainKeyboard,
  telegramNavItem,
  telegramPublicOrigin,
  telegramSectionNote,
  telegramSectionText,
  telegramSupportInlineKeyboard,
  telegramSupportText,
  telegramUnknownText,
} from "./nav";

const WEBHOOK_PATH = "/api/telegram/webhook";

export function telegramWebhookPath(): string {
  return WEBHOOK_PATH;
}

function webhookSecret(): string {
  return process.env.TELEGRAM_LOGIN_WEBHOOK_SECRET?.trim() ?? "";
}

function verifyWebhookSecret(request: Request): boolean {
  const expected = webhookSecret();
  if (!expected) return process.env.NODE_ENV !== "production";
  return request.headers.get("x-telegram-bot-api-secret-token") === expected;
}

type TelegramUser = { id?: number; username?: string; is_bot?: boolean };
type TelegramChat = { id?: number; type?: string; title?: string };
type TelegramMessage = {
  chat?: TelegramChat;
  text?: string;
  new_chat_members?: TelegramUser[];
};
type TelegramUpdate = {
  message?: TelegramMessage;
  my_chat_member?: {
    chat?: TelegramChat;
    new_chat_member?: { status?: string; user?: TelegramUser };
  };
};

function botUsername(): string {
  return (process.env.TELEGRAM_LOGIN_BOT_USERNAME || "TrenioByBot").replace(/^@/, "").trim().toLowerCase();
}

function isGroupChat(type?: string): boolean {
  return type === "group" || type === "supergroup";
}

function mentionsThisBot(users: TelegramUser[] | undefined): boolean {
  const name = botUsername();
  if (!name) return false;
  return (users || []).some((user) => user.is_bot && (user.username || "").toLowerCase() === name);
}

async function sendBotMessage(
  token: string,
  chatId: number,
  text: string,
  replyMarkup?: Record<string, unknown> | null,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`telegram sendMessage ${response.status}`);
  }
  const body = (await response.json()) as { ok?: boolean; description?: string };
  if (!body.ok) throw new Error(body.description || "telegram sendMessage failed");
}

async function sendMenu(token: string, chatId: number, text: string, origin: string): Promise<void> {
  await sendBotMessage(token, chatId, text, {
    keyboard: telegramMainKeyboard(origin),
    resize_keyboard: true,
    is_persistent: true,
  });
}

async function sendGroupNote(token: string, chatId: number, announce: boolean): Promise<void> {
  const kept = rememberDigestChat(chatId);
  if (kept === "other") {
    await writeLog({
      domain: "admin",
      level: "warn",
      action: "telegram.digest",
      outcome: "skipped",
      message: "Бот добавлен ещё в один чат. Сводка остаётся в первом.",
      target: String(chatId),
    });
    return;
  }
  if (kept === "saved") {
    await writeLog({
      domain: "admin",
      level: "info",
      action: "telegram.digest",
      outcome: "success",
      message: "Сводка будет приходить в этот чат.",
      target: String(chatId),
    });
  }
  if (kept === "saved" || announce) await sendBotMessage(token, chatId, telegramGroupText());
}

async function sendSupport(token: string, chatId: number): Promise<void> {
  await sendBotMessage(token, chatId, telegramSupportText(), telegramSupportInlineKeyboard());
}

async function linkedTelegramAccount(chatId: number): Promise<{ firstName: string } | null> {
  try {
    const [row] = await getDb()
      .select({ firstName: users.firstName, status: users.status })
      .from(users)
      .where(eq(users.telegramUserId, chatId))
      .limit(1);
    if (!row || row.status === "deleted") return null;
    return { firstName: row.firstName };
  } catch (error) {
    logCaught("api", "telegram.menu", error, { target: String(chatId) });
    return null;
  }
}

export async function handleTelegramMenuWebhook(request: Request): Promise<Response> {
  if (!verifyWebhookSecret(request)) {
    await writeLog({
      domain: "api",
      level: "warn",
      action: "telegram.menu",
      outcome: "denied",
      message: "Отклонён запрос меню бота.",
    });
    return new Response("unauthorized", { status: 401 });
  }

  const token = loginBotToken();
  if (!token) return new Response("ok");

  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch (error) {
    logCaught("api", "telegram.menu", error);
    return new Response("ok");
  }

  const membership = update.my_chat_member;
  const joined = membership?.new_chat_member?.status === "member" || membership?.new_chat_member?.status === "administrator";
  if (joined && isGroupChat(membership?.chat?.type) && membership.chat?.id && mentionsThisBot([membership.new_chat_member?.user || {}])) {
    try {
      await sendGroupNote(token, membership.chat.id, true);
    } catch (error) {
      logCaught("api", "telegram.menu", error, { target: String(membership.chat.id) });
    }
    return new Response("ok");
  }

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text ?? "";
  if (chatId && isGroupChat(message?.chat?.type) && (mentionsThisBot(message?.new_chat_members) || text.trim().startsWith("/"))) {
    const announce = mentionsThisBot(message?.new_chat_members) || resolveTelegramAction(text) === "home";
    try {
      await sendGroupNote(token, chatId, announce);
    } catch (error) {
      logCaught("api", "telegram.menu", error, { target: String(chatId) });
    }
    return new Response("ok");
  }
  if (!chatId || message?.chat?.type !== "private" || !text) return new Response("ok");

  try {
    await markTelegramBotSeen(chatId);
  } catch (error) {
    logCaught("api", "telegram.menu", error, { target: String(chatId) });
  }

  const action = resolveTelegramAction(text);
  const origin = telegramPublicOrigin();
  if (action === "support") {
    try {
      await sendSupport(token, chatId);
    } catch (error) {
      logCaught("api", "telegram.menu", error, { target: String(chatId) });
    }
    return new Response("ok");
  }
  const account = await linkedTelegramAccount(chatId);
  let reply = telegramUnknownText();
  if (action === "home") {
    reply = telegramHomeText(account);
  } else if (action) {
    const item = telegramNavItem(action);
    if (!item) return new Response("ok");
    const note = telegramSectionNote(action, account);
    reply = telegramSectionText(item, origin);
    if (note) reply = `${reply}\n\n${note}`;
  }

  try {
    await sendMenu(token, chatId, reply, origin);
  } catch (error) {
    logCaught("api", "telegram.menu", error, { target: String(chatId) });
  }
  return new Response("ok");
}
