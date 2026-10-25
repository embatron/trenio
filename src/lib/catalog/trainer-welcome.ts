import { storedBelarusPhone, validateBelarusMobile } from "@/lib/auth/phone";

/** Instagram name from `@name`, `name`, or an instagram.com link. Null when it is not a handle. */
export function parseInstagramHandle(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  const fromUrl = value.match(/^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@+/, "").split(/[/?#\s]/)[0] ?? "";
  if (!/^[A-Za-z0-9._]{1,30}$/.test(value)) return null;
  if (!/[A-Za-z0-9]/.test(value)) return null;
  return value;
}

/** Telegram name from `@name`, `name`, or a t.me link. Null when it is not a public username. */
export function parseTelegramHandle(raw: string): string | null {
  let value = raw.trim();
  if (!value) return null;
  const fromUrl = value.match(/^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{5,32})\/?(?:[?#].*)?$/i);
  if (fromUrl) value = fromUrl[1];
  value = value.replace(/^@+/, "").split(/[/?#\s]/)[0] ?? "";
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(value)) return null;
  return value;
}

/** A Belarus mobile, or nothing when the field still holds only `+375`. */
export function optionalBelarusPhone(raw: string): { phone: string | null; error: string | null } {
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 3) return { phone: null, error: null };
  const error = validateBelarusMobile(raw);
  if (error) return { phone: null, error };
  const phone = storedBelarusPhone(raw);
  if (!phone) return { phone: null, error: "Укажите мобильный номер РБ: +375 25/29/33/44 …" };
  return { phone, error: null };
}
