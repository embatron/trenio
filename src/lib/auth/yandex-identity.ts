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
const AVATAR_ID = /^[A-Za-z0-9_-]{1,80}(?:\/[A-Za-z0-9_-]{1,80}){0,2}$/;

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
  const named = yandexPersonName(body);
  const avatarId = yandexAvatarId(body.default_avatar_id);
  const emptyPortrait = body.is_avatar_empty === true || body.is_avatar_empty === "true";
  return {
    sub,
    email,
    name: named.name,
    lastName: named.lastName,
    phone: storedBelarusPhone(typeof phoneRaw === "string" ? phoneRaw : ""),
    avatarUrl: emptyPortrait || !avatarId ? null : yandexPortraitUrl(avatarId),
  };
}

function yandexAvatarId(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  return typeof value === "string" ? value.trim() : "";
}

function yandexPersonName(body: Record<string, unknown>): { name: string; lastName: string } {
  const first = cleanName(body.first_name);
  const last = cleanName(body.last_name);
  if (first || last) return { name: first || "Пользователь", lastName: last };
  const real = cleanName(body.real_name);
  if (real) {
    const [given, ...rest] = real.split(" ");
    return { name: given || "Пользователь", lastName: rest.join(" ") };
  }
  const display = cleanName(body.display_name);
  if (display) return { name: display, lastName: "" };
  return { name: "Пользователь", lastName: "" };
}
