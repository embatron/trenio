import { SMS_BY_CANONICAL_ALPHANAME_ID } from "@/lib/sms/alphaname";

export function isSmsByEnabled(): boolean {
  return process.env.SMS_BY_ENABLED === "true" && Boolean(process.env.SMS_BY_API_KEY?.trim());
}

function smsByApiKey(): string {
  return process.env.SMS_BY_API_KEY?.trim() ?? "";
}

function smsByAlphanameId(): string {
  return process.env.SMS_BY_ALPHANAME_ID?.trim() || SMS_BY_CANONICAL_ALPHANAME_ID;
}

const SMS_BY_BASE = "https://app.sms.by/api/v1";

export function otpSmsText(code: string): string {
  return `Trenio.by: код ${code}. Никому не сообщайте.`;
}

/** One transactional SMS. Phone must already be `375XXXXXXXXX`. */
export async function sendQuickSms(phone: string, message: string): Promise<boolean> {
  if (!isSmsByEnabled()) return false;

  const payload: Record<string, string> = { message, phone, token: smsByApiKey() };
  const alphanameId = smsByAlphanameId();
  if (alphanameId) payload.alphaname_id = alphanameId;

  try {
    const response = await fetch(`${SMS_BY_BASE}/sendQuickSMS`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: new URLSearchParams(payload).toString(),
    });
    const text = await response.text();
    const data = JSON.parse(text) as { error?: string };
    if (data?.error) {
      console.error("[sms.by] sendQuickSMS rejected");
      return false;
    }
    return true;
  } catch {
    console.error("[sms.by] sendQuickSMS failed");
    return false;
  }
}
