import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { userDevices } from "@/db/schema";
import { writeLog } from "@/lib/log/logger";
import { ensurePushSchema } from "@/lib/messages/push-schema";
import { listApnsTokens } from "@/lib/mobile/devices";

type Notice = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

const TOPIC = "by.trenio.app";

type Note = {
  topic?: string;
  alert?: { title: string; body: string };
  payload?: Record<string, string>;
  sound?: string;
};

type Provider = {
  send: (note: Note, token: string) => Promise<{ failed?: Array<{ status?: string | number; response?: { reason?: string } }> }>;
};

type ApnModule = {
  Provider: new (options: { token: { key: string; keyId: string; teamId: string }; production: boolean }) => Provider;
  Notification: new () => Note;
};

let provider: Provider | null = null;
let providerKey = "";

function apnsConfig() {
  const key = process.env.APN_KEY_PATH?.trim() ?? "";
  const keyId = process.env.APN_KEY_ID?.trim() ?? "";
  const teamId = process.env.APN_TEAM_ID?.trim() ?? "";
  if (!key || !keyId || !teamId) return null;
  return { key, keyId, teamId };
}

async function sender(): Promise<Provider | null> {
  const config = apnsConfig();
  if (!config) return null;
  const stamp = `${config.key}:${config.keyId}:${config.teamId}`;
  if (provider && providerKey === stamp) return provider;
  const apn = (await import("apn")) as unknown as ApnModule;
  provider = new apn.Provider({
    token: { key: config.key, keyId: config.keyId, teamId: config.teamId },
    production: process.env.NODE_ENV === "production",
  });
  providerKey = stamp;
  return provider;
}

/** Sends the same message notice to iOS shells. A missing key does not fail the message. */
export async function sendApnsPushes(userId: string, payload: Notice): Promise<void> {
  await ensurePushSchema();
  const tokens = await listApnsTokens(userId);
  if (tokens.length === 0) return;
  const config = apnsConfig();
  if (!config) {
    void writeLog({
      level: "warn",
      domain: "message",
      action: "message.push",
      outcome: "skipped",
      message: "Уведомление на iPhone не отправлено: нет ключа APNs.",
      target: payload.tag,
      context: { channel: "apns", devices: tokens.length },
    });
    return;
  }
  let gateway: Provider | null = null;
  try {
    gateway = await sender();
  } catch (error) {
    void writeLog({
      level: "error",
      domain: "message",
      action: "message.push",
      outcome: "failure",
      message: "Ключ APNs не открылся.",
      target: payload.tag,
      context: { channel: "apns" },
      error,
    });
    return;
  }
  if (!gateway) return;
  const apn = (await import("apn")) as unknown as ApnModule;
  const note = new apn.Notification();
  note.topic = TOPIC;
  note.alert = { title: payload.title, body: payload.body };
  note.payload = { url: payload.url };
  note.sound = "default";
  let sent = 0;
  for (const token of tokens) {
    try {
      const result = await gateway.send(note, token);
      const failed = result.failed ?? [];
      if (failed.length === 0) {
        sent += 1;
        continue;
      }
      const reason = failed[0]?.response?.reason ?? "";
      const status = Number(failed[0]?.status ?? 0);
      if (reason === "BadDeviceToken" || reason === "Unregistered" || status === 410) {
        await getDb().delete(userDevices).where(eq(userDevices.pushToken, token));
        continue;
      }
      void writeLog({
        level: "error",
        domain: "message",
        action: "message.push",
        outcome: "failure",
        message: "APNs не принял уведомление.",
        target: payload.tag,
        statusCode: status || null,
        context: { channel: "apns", reason },
      });
    } catch (error) {
      void writeLog({
        level: "error",
        domain: "message",
        action: "message.push",
        outcome: "failure",
        message: "APNs не принял уведомление.",
        target: payload.tag,
        context: { channel: "apns" },
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
      message: "Уведомление о сообщении ушло на iPhone.",
      target: payload.tag,
      context: { channel: "apns", devices: sent },
    });
  }
}
