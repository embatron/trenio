import type { TelegramWidgetUser } from "@/lib/auth/telegram-widget";
import { parseTelegramWidgetUser, verifyTelegramWidgetUser } from "@/auth/telegram";
import { readTelegramContact, type TelegramContact } from "@/auth/telegram-contact";
import { verifyTelegramWebAppInitData, type TelegramWebAppUser } from "@/auth/telegram-webapp";

import { claimProof } from "./replay";

const WIDGET_SECONDS = 10 * 60;
const WEBAPP_SECONDS = 15 * 60;
const CONTACT_SECONDS = 10 * 60;

export async function acceptTelegramWidget(raw: unknown): Promise<TelegramWidgetUser | null> {
  const user = parseTelegramWidgetUser(raw);
  if (!user || !verifyTelegramWidgetUser(user)) return null;
  const ok = await claimProof(`widget:${user.hash}`, new Date((user.auth_date + WIDGET_SECONDS) * 1000));
  return ok ? user : null;
}

export async function acceptTelegramWebApp(initData: string): Promise<TelegramWebAppUser | null> {
  const user = verifyTelegramWebAppInitData(initData);
  if (!user) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  const authDate = Number(params.get("auth_date"));
  if (!hash || !Number.isFinite(authDate)) return null;
  const ok = await claimProof(`webapp:${hash}`, new Date((authDate + WEBAPP_SECONDS) * 1000));
  return ok ? user : null;
}

export async function acceptTelegramContact(query: string): Promise<TelegramContact | null> {
  const contact = readTelegramContact(query);
  if (!contact) return null;
  const params = new URLSearchParams(query);
  const hash = params.get("hash") ?? "";
  const authDate = Number(params.get("auth_date"));
  if (!hash || !Number.isFinite(authDate)) return null;
  const ok = await claimProof(`contact:${hash}`, new Date((authDate + CONTACT_SECONDS) * 1000));
  return ok ? contact : null;
}
