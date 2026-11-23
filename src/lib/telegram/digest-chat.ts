import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FILE = join(process.cwd(), "data/telegram-digest-chat.json");

function numericChatId(value: string): string {
  return /^-?\d+$/.test(value) ? value : "";
}

/** Env wins. Otherwise the first group chat the bot was added to. */
export function digestChatId(): string {
  const fromEnv = numericChatId(process.env.TELEGRAM_DIGEST_CHAT_ID?.trim() ?? "");
  if (fromEnv) return fromEnv;
  try {
    const parsed = JSON.parse(readFileSync(FILE, "utf8")) as { chatId?: number | string };
    return numericChatId(String(parsed.chatId ?? ""));
  } catch {
    return "";
  }
}

/** Keep the first group. A later group does not replace it. */
export function rememberDigestChat(chatId: number): "saved" | "same" | "other" {
  const next = String(chatId);
  if (!numericChatId(next)) return "other";
  const current = digestChatId();
  if (current === next) return "same";
  if (current) return "other";
  mkdirSync(join(process.cwd(), "data"), { recursive: true });
  writeFileSync(FILE, `${JSON.stringify({ chatId })}\n`);
  return "saved";
}
