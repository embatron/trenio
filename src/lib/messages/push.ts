import { eq } from "drizzle-orm";
import webpush from "web-push";

import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { writeLog } from "@/lib/log/logger";
import { ensurePushSchema } from "@/lib/messages/push-schema";
import { SITE_EMAIL } from "@/lib/seo/site";

export type MessagePush = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

function vapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

export function pushPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

/** System notification on browsers and installed apps that subscribed. */
export async function sendMessagePushes(userId: string, payload: MessagePush): Promise<void> {
  const keys = vapid();
  if (!keys) {
    void writeLog({
      level: "warn",
      domain: "message",
      action: "message.push",
      outcome: "skipped",
      message: "Уведомление не отправлено: нет ключей VAPID.",
      target: payload.tag,
    });
    return;
  }
  await ensurePushSchema();
  const rows = await getDb()
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (rows.length === 0) return;
  webpush.setVapidDetails(`mailto:${SITE_EMAIL}`, keys.publicKey, keys.privateKey);
  const body = JSON.stringify(payload);
  let sent = 0;
  for (const row of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        body,
      );
      sent += 1;
    } catch (error) {
      const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
      if (status === 404 || status === 410) {
        await getDb().delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, row.endpoint));
        continue;
      }
      void writeLog({
        level: "error",
        domain: "message",
        action: "message.push",
        outcome: "failure",
        message: "Браузер не принял уведомление о сообщении.",
        target: payload.tag,
        statusCode: status || null,
        error,
      });
    }
  }
  if (sent > 0) {
    void writeLog({
      level: "info",
      domain: "message",
      action: "message.push",
      outcome: "success",
      message: "Уведомление о сообщении ушло в браузер.",
      target: payload.tag,
      context: { devices: sent },
    });
  }
}
