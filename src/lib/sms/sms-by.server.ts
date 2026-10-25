import { maskPhone, writeLog } from "@/lib/log/logger";

import { isSmsByEnabled, smsByAlphanameId, smsByApiKey } from "./sms-by-config.server";

const SMS_BY_BASE = "https://app.sms.by/api/v1";

export type SmsSendResult = { ok: true; smsId?: string } | { ok: false; error: string };

async function smsByPost(command: string, body: Record<string, string>): Promise<unknown> {
  const params = new URLSearchParams({ token: smsByApiKey(), ...body });
  const response = await fetch(`${SMS_BY_BASE}/${command}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: params.toString(),
  });
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`SMS.BY ${command} non-JSON (${response.status})`);
  }
}

/** One transactional SMS. Phone must already be `375XXXXXXXXX`. */
export async function sendQuickSms(phone: string, message: string): Promise<SmsSendResult> {
  if (!isSmsByEnabled()) {
    return { ok: false, error: "sms_disabled" };
  }

  const payload: Record<string, string> = { message, phone };
  const alphanameId = smsByAlphanameId();
  if (alphanameId) payload.alphaname_id = alphanameId;

  try {
    const data = (await smsByPost("sendQuickSMS", payload)) as {
      error?: string;
      sms_id?: string | number;
      status?: string;
    };
    if (data?.error) {
      void writeLog({
        level: "error",
        domain: "sms",
        action: "sms.send",
        outcome: "failure",
        message: "SMS.BY отклонил сообщение.",
        subject: maskPhone(phone),
        errorCode: "rejected",
      });
      return { ok: false, error: String(data.error) };
    }
    void writeLog({
      level: "info",
      domain: "sms",
      action: "sms.send",
      outcome: "success",
      message: "SMS отправлено.",
      subject: maskPhone(phone),
    });
    return { ok: true, smsId: data?.sms_id != null ? String(data.sms_id) : undefined };
  } catch (error) {
    void writeLog({
      level: "error",
      domain: "sms",
      action: "sms.send",
      outcome: "failure",
      message: "Не удалось отправить SMS.",
      subject: maskPhone(phone),
      error,
    });
    return { ok: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}

export function otpSmsText(code: string): string {
  return `Trenio.by: код ${code}. Никому не сообщайте.`;
}
