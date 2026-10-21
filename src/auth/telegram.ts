import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";

const AUTH_MAX_AGE_SECONDS = 10 * 60;

export function loginBotToken(): string {
  return process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim() ?? "";
}

export function telegramLoginBotUsername(): string {
  return (
    process.env.VITE_TELEGRAM_LOGIN_BOT_USERNAME?.trim() ||
    process.env.TELEGRAM_LOGIN_BOT_USERNAME?.trim() ||
    ""
  );
}

export function isTelegramLoginConfigured(): boolean {
  return Boolean(loginBotToken() && telegramLoginBotUsername());
}

export function getTelegramLoginConfig(): { enabled: boolean; username: string | null } {
  const username = telegramLoginBotUsername();
  return {
    enabled: isTelegramLoginConfigured(),
    username: username || null,
  };
}

export function parseTelegramWidgetUser(raw: unknown): TelegramWidgetUser | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const id = typeof data.id === "number" ? data.id : Number(data.id);
  const authDate = typeof data.auth_date === "number" ? data.auth_date : Number(data.auth_date);
  const hash = typeof data.hash === "string" ? data.hash : "";
  if (!Number.isFinite(id) || id <= 0 || !Number.isFinite(authDate) || !hash) return null;
  return {
    id,
    first_name: typeof data.first_name === "string" ? data.first_name : undefined,
    last_name: typeof data.last_name === "string" ? data.last_name : undefined,
    username: typeof data.username === "string" ? data.username : undefined,
    photo_url: typeof data.photo_url === "string" ? data.photo_url : undefined,
    auth_date: authDate,
    hash,
  };
}

export function verifyTelegramWidgetUser(
  user: TelegramWidgetUser,
  nowSeconds = Math.floor(Date.now() / 1000),
): boolean {
  const token = loginBotToken();
  if (!token) return false;
  if (Math.abs(nowSeconds - user.auth_date) > AUTH_MAX_AGE_SECONDS) return false;

  const pairs = Object.entries(user)
    .filter(([key, value]) => key !== "hash" && value !== undefined && value !== "")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const dataCheckString = pairs.join("\n");
  const secretKey = createHash("sha256").update(token).digest();
  const digest = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(user.hash, "hex"));
  } catch {
    return false;
  }
}
