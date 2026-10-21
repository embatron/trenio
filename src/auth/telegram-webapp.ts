import { createHmac, timingSafeEqual } from "node:crypto";

import { isTelegramLoginConfigured, loginBotToken } from "./telegram";

const TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS = 24 * 60 * 60;

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function secretKey(token: string): Buffer {
  return createHmac("sha256", "WebAppData").update(token).digest();
}

function hexEqual(left: string, right: string): boolean {
  try {
    return timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
  } catch {
    return false;
  }
}

function parseUser(raw: unknown): TelegramWebAppUser | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const id = typeof data.id === "number" ? data.id : Number(data.id);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    first_name: typeof data.first_name === "string" ? data.first_name : undefined,
    last_name: typeof data.last_name === "string" ? data.last_name : undefined,
    username: typeof data.username === "string" ? data.username : undefined,
  };
}

export function verifyTelegramWebAppInitData(
  initData: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramWebAppUser | null {
  if (!isTelegramLoginConfigured()) return null;
  const token = loginBotToken();
  if (!token || !initData.trim()) return null;

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");
  if (!hash || !authDateRaw || !userRaw) return null;

  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate) || Math.abs(nowSeconds - authDate) > TELEGRAM_WEBAPP_AUTH_MAX_AGE_SECONDS) {
    return null;
  }

  const pairs = [...params.entries()]
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const digest = createHmac("sha256", secretKey(token)).update(pairs.join("\n")).digest("hex");
  if (!hexEqual(digest, hash)) return null;

  try {
    return parseUser(JSON.parse(userRaw));
  } catch {
    return null;
  }
}
