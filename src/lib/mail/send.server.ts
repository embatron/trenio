import { spawn } from "node:child_process";

import { writeLog } from "@/lib/log/logger";

export type OutboundMail = {
  to: string[];
  subject: string;
  text: string;
  html?: string;
};

/** Service From. The footer mailbox is `SITE_EMAIL` and is not this address. */
export const MAIL_FROM_DEFAULT = "Trenio <noreply@trenio.by>";

const SENDMAIL_PATH = () => process.env.SENDMAIL_PATH?.trim() || "/usr/sbin/sendmail";

function appUrl() {
  return (process.env.APP_URL ?? "http://trenio.local").replace(/\/$/, "");
}

export function mailAppUrl() {
  return appUrl();
}

export function mailFromAddress() {
  const configured = process.env.MAIL_FROM?.trim() || "";
  if (configured.includes("noreply@trenio.by")) return configured;
  return MAIL_FROM_DEFAULT;
}

/** Postfix on the host, the same path BronxGym uses. Off only when `MAIL_ENABLED=false`. */
export function mailSendmailEnabled() {
  if (process.env.MAIL_ENABLED === "false") return false;
  if (process.env.MAIL_ENABLED === "true") return true;
  return process.env.NODE_ENV === "production";
}

/** True when a letter leaves the process: local sendmail, or Resend if sendmail is off. */
export function mailTransportReady() {
  if (mailSendmailEnabled()) return true;
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.MAIL_FROM?.trim());
}

function encodeSubject(subject: string): string {
  if (/^[\x20-\x7E]*$/.test(subject)) return subject;
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function envelopeFrom(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return match?.[1]?.trim() || fromHeader.trim();
}

function foldBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/.{76}/g, "$&\r\n");
}

/** Plain text, or the same letter as HTML plus a text fallback. The body is never logged. */
function mailBody(message: OutboundMail) {
  if (!message.html) {
    return [
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: 8bit",
      "",
      message.text,
    ];
  }
  const boundary = `trenio_${crypto.randomUUID().replace(/-/g, "")}`;
  return [
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(message.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    foldBase64(message.html),
    `--${boundary}--`,
    "",
  ];
}

function sendMailRaw(message: string, fromEnvelope: string, toEnvelope: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(SENDMAIL_PATH(), ["-i", "-f", fromEnvelope, toEnvelope], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });
    proc.on("error", reject);
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `sendmail exited with code ${code}`));
    });
    proc.stdin.write(message);
    proc.stdin.end();
  });
}

function logMail(outcome: "success" | "failure" | "skipped", message: string, to: string[], subject: string, error?: unknown) {
  void writeLog({
    level: outcome === "failure" ? "error" : "info",
    domain: "email",
    action: outcome === "skipped" ? "email.dev" : "email.send",
    outcome,
    message,
    subject: to[0],
    error,
    context: { recipients: to.length, subject },
  });
}

async function sendViaSendmail(message: OutboundMail, to: string[]): Promise<void> {
  const from = mailFromAddress();
  const raw = [
    `From: ${from}`,
    `To: ${to.join(", ")}`,
    `Subject: ${encodeSubject(message.subject)}`,
    ...mailBody(message),
  ].join("\r\n");
  const envelope = envelopeFrom(from);
  for (const recipient of to) {
    await sendMailRaw(raw, envelope, recipient);
  }
}

async function sendViaResend(message: OutboundMail, to: string[], from: string, apiKey: string): Promise<void> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject: message.subject,
      text: message.text,
      ...(message.html ? { html: message.html } : {}),
    }),
  });
  if (!response.ok) {
    throw new Error(`resend ${response.status}`);
  }
}

/** Local Postfix when mail is enabled. Resend only if that path is off and a key is set. False when nothing accepted the letter. */
export async function sendMail(message: OutboundMail): Promise<boolean> {
  const to = [...new Set(message.to.map((item) => item.trim()).filter(Boolean))];
  if (to.length === 0) return false;

  if (mailSendmailEnabled()) {
    try {
      await sendViaSendmail(message, to);
      logMail("success", "Письмо отдано Postfix.", to, message.subject);
      return true;
    } catch (error) {
      logMail("failure", "Postfix не принял письмо.", to, message.subject, error);
      return false;
    }
  }

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const configuredFrom = process.env.MAIL_FROM?.trim();
  if (apiKey && configuredFrom) {
    try {
      await sendViaResend(message, to, mailFromAddress(), apiKey);
      logMail("success", "Письмо отправлено.", to, message.subject);
      return true;
    } catch (error) {
      logMail("failure", "Почтовый сервис отклонил письмо.", to, message.subject, error);
      return false;
    }
  }

  if (process.env.AUTH_DEV_LOG_EMAILS === "true" || process.env.NODE_ENV !== "production") {
    console.info(`[mail] to=${to.join(", ")} subject=${message.subject}\n${message.text}`);
    logMail("skipped", "Письмо оставлено в консоли разработки.", to, message.subject);
    return true;
  }
  return false;
}
