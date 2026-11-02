import { verifyTelegramWebAppQuery } from "@/auth/telegram-webapp";

/** A shared contact is a one-shot proof, shorter than a Mini App session. */
const CONTACT_MAX_AGE_SECONDS = 10 * 60;

export type TelegramContact = {
  userId: number;
  phone: string;
};

function contactUserId(value: unknown): number | null {
  const id = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(id) || id <= 0 || id > Number.MAX_SAFE_INTEGER) return null;
  return id;
}

/**
 * Phone shared through `Telegram.WebApp.requestContact`.
 * The query string is the signed `response`, not `responseUnsafe`.
 * A phone typed next to it is ignored because this reader never sees it.
 */
export function readTelegramContact(
  query: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): TelegramContact | null {
  const params = verifyTelegramWebAppQuery(query, nowSeconds, CONTACT_MAX_AGE_SECONDS);
  const raw = params?.get("contact");
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;
  const userId = contactUserId(data.user_id);
  const phone = typeof data.phone_number === "string" ? data.phone_number.trim() : "";
  if (!userId || !phone || phone.length > 32) return null;
  return { userId, phone };
}
