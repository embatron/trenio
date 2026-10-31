#!/usr/bin/env node
/**
 * Menu button, commands, and webhook for @TrenioByBot.
 * Usage: node --env-file=.env scripts/setup-telegram-bot.mjs
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const token = process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim();
if (!token) {
  console.error("Set TELEGRAM_LOGIN_BOT_TOKEN");
  process.exit(1);
}

const origin = (process.env.APP_URL ?? "").trim().startsWith("https://")
  ? process.env.APP_URL.trim().replace(/\/$/, "")
  : "https://trenio.by";

let webhookSecret = process.env.TELEGRAM_LOGIN_WEBHOOK_SECRET?.trim() ?? "";
if (!webhookSecret) {
  webhookSecret = randomBytes(24).toString("hex");
  const path = new URL("../.env", import.meta.url);
  const file = readFileSync(path, "utf8");
  const next = file.includes("TELEGRAM_LOGIN_WEBHOOK_SECRET=")
    ? file.replace(/TELEGRAM_LOGIN_WEBHOOK_SECRET=.*/, `TELEGRAM_LOGIN_WEBHOOK_SECRET=${webhookSecret}`)
    : `${file.trimEnd()}\nTELEGRAM_LOGIN_WEBHOOK_SECRET=${webhookSecret}\n`;
  writeFileSync(path, next.endsWith("\n") ? next : `${next}\n`);
  console.log("TELEGRAM_LOGIN_WEBHOOK_SECRET written to .env");
}

const api = async (method, body) => {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description ?? `${method} failed`);
  return data;
};

const me = await api("getMe");
console.log(`bot: @${me.result?.username ?? "?"}`);

await api("setMyCommands", {
  commands: [
    { command: "start", description: "Меню" },
    { command: "trainers", description: "Тренеры" },
    { command: "categories", description: "Категории" },
    { command: "map", description: "На карте" },
    { command: "messages", description: "Сообщения" },
    { command: "account", description: "Мой кабинет" },
    { command: "me", description: "Кабинет тренера" },
    { command: "join", description: "Стать тренером" },
    { command: "contacts", description: "Контакты" },
  ],
});
console.log("setMyCommands: ok");

await api("setChatMenuButton", {
  menu_button: {
    type: "web_app",
    text: "Открыть",
    web_app: { url: `${origin}/` },
  },
});
console.log(`setChatMenuButton: ${origin}/`);

const probe = await fetch(`${origin}/api/telegram/webhook`, { method: "POST" }).catch(() => null);
if (probe && probe.status !== 404 && probe.status !== 502 && probe.status !== 503) {
  await api("setWebhook", {
    url: `${origin}/api/telegram/webhook`,
    secret_token: webhookSecret,
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
  console.log(`setWebhook: ${origin}/api/telegram/webhook`);
} else {
  await api("deleteWebhook", { drop_pending_updates: false });
  console.log("deleteWebhook: live site has no menu handler yet, so /start is not sent there");
}
