import { writeLog } from "@/lib/log/logger";

export type OutboundMail = {
  to: string[];
  subject: string;
  text: string;
};

function appUrl() {
  return (process.env.APP_URL ?? "http://trenio.local").replace(/\/$/, "");
}

export function mailAppUrl() {
  return appUrl();
}

/** Resend when configured. Otherwise the message is written to the server log outside production. */
export async function sendMail(message: OutboundMail): Promise<void> {
  const to = [...new Set(message.to.map((item) => item.trim()).filter(Boolean))];
  if (to.length === 0) return;

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.MAIL_FROM?.trim();
  if (apiKey && from) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to, subject: message.subject, text: message.text }),
      });
      if (!response.ok) {
        void writeLog({
          level: "error",
          domain: "email",
          action: "email.send",
          outcome: "failure",
          message: "Почтовый сервис отклонил письмо.",
          subject: to[0],
          statusCode: response.status,
          context: { recipients: to.length, subject: message.subject },
        });
        return;
      }
      void writeLog({
        level: "info",
        domain: "email",
        action: "email.send",
        outcome: "success",
        message: "Письмо отправлено.",
        subject: to[0],
        context: { recipients: to.length, subject: message.subject },
      });
    } catch (error) {
      void writeLog({
        level: "error",
        domain: "email",
        action: "email.send",
        outcome: "failure",
        message: "Не удалось отправить письмо.",
        subject: to[0],
        error,
        context: { recipients: to.length, subject: message.subject },
      });
    }
    return;
  }

  if (process.env.AUTH_DEV_LOG_EMAILS === "true" || process.env.NODE_ENV !== "production") {
    console.info(`[mail] to=${to.join(", ")} subject=${message.subject}\n${message.text}`);
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.dev",
      outcome: "skipped",
      message: "Письмо оставлено в консоли разработки.",
      subject: to[0],
      context: { recipients: to.length, subject: message.subject },
    });
  }
}
