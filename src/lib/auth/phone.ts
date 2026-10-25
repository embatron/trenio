/** Belarus mobile prefixes that can receive SMS. */
export const BY_MOBILE_PREFIXES = ["25", "29", "33", "44"] as const;

/** Locked country code in phone inputs — user types the operator code next. */
export const BY_PHONE_COUNTRY_PREFIX = "+375";

export const OTP_RESEND_SECONDS = 60;
export const OTP_TTL_SECONDS = 10 * 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_CODE_LENGTH = 6;

const MOBILE_RE = new RegExp(`^375(${BY_MOBILE_PREFIXES.join("|")})\\d{7}$`);

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Normalize a Belarus mobile number to `375XXXXXXXXX`. Accepts +375…, 375…, 80…. */
export function normalizeBelarusMobile(raw: string): string | null {
  let digits = digitsOnly(raw);
  if (digits.startsWith("80") && digits.length === 11) {
    digits = `375${digits.slice(2)}`;
  }
  if (!MOBILE_RE.test(digits)) return null;
  return digits;
}

/**
 * One value for every stored Belarus mobile: users, trainer cards, and welcomes.
 * `+375 29 123-45-67`. Null when the text is not a mobile from 25, 29, 33, or 44.
 * SMS and OTP keep the digits from `normalizeBelarusMobile` (`375291234567`).
 */
export function storedBelarusPhone(raw: string | null | undefined): string | null {
  const formatted = formatBelarusPhone(raw);
  return formatted || null;
}

/**
 * Same stored string as `storedBelarusPhone`, or `""` when the text is not a Belarus mobile.
 */
export function formatBelarusPhone(raw: string | null | undefined): string {
  const digits = normalizeBelarusMobile(raw ?? "");
  if (!digits) return "";
  return constrainBelarusPhoneInput(`+${digits}`);
}

export function validateBelarusMobile(raw: string): string | null {
  if (!raw.trim()) return "Введите номер телефона";
  if (!normalizeBelarusMobile(raw)) {
    return "Укажите мобильный номер РБ: +375 25/29/33/44 …";
  }
  return null;
}

/** Keep +375 in the field; format operator + number as the user types. */
export function constrainBelarusPhoneInput(raw: string): string {
  let digits = digitsOnly(raw);
  if (digits.startsWith("80")) {
    digits = `375${digits.slice(2)}`;
  }
  if (!digits.startsWith("375")) {
    digits = `375${digits}`;
  }
  const national = digits.slice(3, 12);
  if (!national) return BY_PHONE_COUNTRY_PREFIX;

  const operator = national.slice(0, 2);
  const a = national.slice(2, 5);
  const b = national.slice(5, 7);
  const c = national.slice(7, 9);
  let formatted = `${BY_PHONE_COUNTRY_PREFIX} ${operator}`;
  if (a) formatted += ` ${a}`;
  if (b) formatted += `-${b}`;
  if (c) formatted += `-${c}`;
  return formatted;
}
