import { storedBelarusPhone } from "@/lib/auth/phone";

export type YandexIdentity = {
  sub: string;
  email: string;
  name: string;
  lastName: string;
  /** Stored Belarus mobile, or null when Yandex has another number. */
  phone: string | null;
  /** 200px portrait. Empty when Yandex has only the placeholder. */
  avatarUrl: string | null;
};

const SUB = /^[A-Za-z0-9_-]{1,255}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AVATAR_ID = /^[A-Za-z0-9_-]{1,64}$/;

function cleanName(value: unknown): string {
  const raw = typeof value === "string" ? value : "";
  return raw.replace(/\s+/g, " ").replace(/[^\p{L}\p{N} .'-]/gu, "").trim().slice(0, 100);
}

/** Face crop from Yandex. A placeholder id is not a portrait. */
export function yandexPortraitUrl(avatarId: string): string | null {
  if (!AVATAR_ID.test(avatarId)) return null;
  return `https://avatars.yandex.net/get-yapic/${avatarId}/islands-200`;
}

/**
 * Yandex ID profile from `login.yandex.ru/info`.
 * The mailbox must be the default address. A non-Belarus phone is dropped.
 */
export function readYandexIdentity(
  body: Record<string, unknown>,
  clientId: string,
): YandexIdentity | null {
  if (body.client_id !== clientId) return null;
  const sub = typeof body.id === "string" ? body.id.trim() : typeof body.id === "number" ? String(body.id) : "";
  if (!SUB.test(sub)) return null;
  const email = typeof body.default_email === "string" ? body.default_email.trim().toLowerCase() : "";
  if (!EMAIL.test(email) || email.length > 320) return null;
  if (Array.isArray(body.emails)) {
    const list = body.emails
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toLowerCase());
    if (list.length > 0 && !list.includes(email)) return null;
  }
  const phoneRaw = body.default_phone && typeof body.default_phone === "object"
    ? (body.default_phone as { number?: unknown }).number
    : "";
  const given = cleanName(body.first_name);
  const avatarId = typeof body.default_avatar_id === "string" ? body.default_avatar_id.trim() : "";
  return {
    sub,
    email,
    name: given || "Пользователь",
    lastName: cleanName(body.last_name),
    phone: storedBelarusPhone(typeof phoneRaw === "string" ? phoneRaw : ""),
    avatarUrl: body.is_avatar_empty === true || !avatarId ? null : yandexPortraitUrl(avatarId),
  };
}
