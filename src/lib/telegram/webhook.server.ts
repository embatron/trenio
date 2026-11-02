import { eq } from "drizzle-orm";

import { loginBotToken } from "@/auth/telegram";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { logCaught, writeLog } from "@/lib/log/logger";

import {
  resolveTelegramAction,
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

type TelegramUpdate = {
  message?: {
    chat?: { id?: number; type?: string };
    text?: string;
  };
};

async function sendBotMessage(
  token: string,
  chatId: number,
  text: string,
  replyMarkup: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
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

  const message = update.message;
  const chatId = message?.chat?.id;
  const text = message?.text;
  if (!chatId || message?.chat?.type !== "private" || !text) return new Response("ok");

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
