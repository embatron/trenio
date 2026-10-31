import { loginBotToken } from "@/auth/telegram";
import { logCaught, writeLog } from "@/lib/log/logger";

import {
  resolveTelegramAction,
  telegramHomeText,
  telegramMainKeyboard,
  telegramNavItem,
  telegramPublicOrigin,
  telegramSectionText,
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

async function sendMenu(token: string, chatId: number, text: string, origin: string): Promise<void> {
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: {
        keyboard: telegramMainKeyboard(origin),
        resize_keyboard: true,
        is_persistent: true,
      },
    }),
  });
  if (!response.ok) {
    throw new Error(`telegram sendMessage ${response.status}`);
  }
  const body = (await response.json()) as { ok?: boolean; description?: string };
  if (!body.ok) throw new Error(body.description || "telegram sendMessage failed");
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
  if (!action) return new Response("ok");

  const origin = telegramPublicOrigin();
  const item = action === "home" ? null : telegramNavItem(action);
  const reply = item ? telegramSectionText(item, origin) : telegramHomeText();

  try {
    await sendMenu(token, chatId, reply, origin);
  } catch (error) {
    logCaught("api", "telegram.menu", error, { target: String(chatId) });
  }
  return new Response("ok");
}
