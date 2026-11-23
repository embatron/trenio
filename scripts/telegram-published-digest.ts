/**
 * Daily admin note for the past 24 hours: publications, new chats,
 * reviews written, and contact clicks.
 * Cron runs this at 10:00 Europe/Minsk. The chat is the first group the bot
 * joined, or TELEGRAM_DIGEST_CHAT_ID when that is set.
 *
 * Usage: tsx --env-file=.env scripts/telegram-published-digest.ts
 */
import { sql } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index";
import { logCaught, writeLog } from "../src/lib/log/logger";
import { adminDigestText } from "../src/lib/telegram/published-digest";
import { digestChatId } from "../src/lib/telegram/digest-chat";

const ACTION = "telegram.digest";

type DayStats = {
  published: number;
  publishedTotal: number;
  chats: number;
  reviews: number;
  contactClicks: number;
  applications: number;
};

async function statsSinceYesterday(): Promise<DayStats> {
  const result = await getDb().execute<{
    published: number;
    published_total: number;
    chats: number;
    reviews: number;
    clicks: number;
    applications: number;
  }>(sql`
    SELECT
      (
        SELECT count(*)::int
        FROM trainer_profiles
        WHERE published_at >= now() - interval '24 hours'
          AND published_at < now()
          AND slug <> 'test-trener'
          AND replace(lower(slug), '-', '') <> 'testtrener'
      ) AS published,
      (
        SELECT count(*)::int
        FROM trainer_profiles
        WHERE status = 'published'
          AND slug <> 'test-trener'
          AND replace(lower(slug), '-', '') <> 'testtrener'
      ) AS published_total,
      (
        SELECT count(*)::int
        FROM conversations
        WHERE created_at >= now() - interval '24 hours'
          AND created_at < now()
      ) AS chats,
      (
        SELECT count(*)::int
        FROM trainer_reviews
        WHERE created_at >= now() - interval '24 hours'
          AND created_at < now()
      ) AS reviews,
      (
        SELECT count(*)::int
        FROM trainer_contact_clicks
        WHERE created_at >= now() - interval '24 hours'
          AND created_at < now()
      ) AS clicks,
      (
        SELECT count(*)::int
        FROM trainer_welcomes
        WHERE created_at >= now() - interval '24 hours'
          AND created_at < now()
      ) AS applications
  `);
  const row = (Array.isArray(result) ? result[0] : undefined) ?? {
    published: 0,
    published_total: 0,
    chats: 0,
    reviews: 0,
    clicks: 0,
    applications: 0,
  };
  return {
    published: Number(row.published) || 0,
    publishedTotal: Number(row.published_total) || 0,
    chats: Number(row.chats) || 0,
    reviews: Number(row.reviews) || 0,
    contactClicks: Number(row.clicks) || 0,
    applications: Number(row.applications) || 0,
  };
}

async function sendDigest(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim() ?? "";
  if (!token) throw new Error("TELEGRAM_LOGIN_BOT_TOKEN is empty");
  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  const body = (await response.json()) as { ok?: boolean; description?: string };
  if (!response.ok || !body.ok) {
    throw new Error(body.description || `telegram sendMessage ${response.status}`);
  }
}

async function main() {
  const chatId = digestChatId();
  if (!/^-?\d+$/.test(chatId)) {
    await writeLog({
      level: "warn",
      domain: "admin",
      action: ACTION,
      outcome: "skipped",
      message: "Сводка о публикациях не ушла: чат Telegram не задан.",
    });
    console.info("telegram digest skipped: no chat");
    return;
  }

  const stats = await statsSinceYesterday();
  const text = adminDigestText(stats);
  await sendDigest(chatId, text);
  await writeLog({
    level: "info",
    domain: "admin",
    action: ACTION,
    outcome: "success",
    message: "Сводка для админов ушла в Telegram.",
    context: stats,
  });
  console.info(`telegram digest sent: ${stats.published} published`);
}

main()
  .catch(async (error) => {
    logCaught("admin", ACTION, error);
    console.error(error instanceof Error ? error.message : "telegram digest failed");
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
