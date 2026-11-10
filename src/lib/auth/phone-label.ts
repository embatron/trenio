import { normalizeBelarusMobile } from "@/lib/auth/phone";

const STAND_IN_NAME = "Пользователь";
const PHONE_SIGNATURE_RE = /^\+375(?:25|29|33|44)\.{5}\d{2}$/;

/** Staff and review lines show `+375298516745`, with no spaces. */
export function compactBelarusPhone(raw: string | null | undefined): string {
  const digits = normalizeBelarusMobile(raw ?? "");
  return digits ? `+${digits}` : "";
}

/** Public signature of a confirmed mobile: `+37529.....51`. */
export function maskedBelarusPhone(raw: string | null | undefined): string {
  const digits = normalizeBelarusMobile(raw ?? "");
  if (!digits) return "";
  return `+${digits.slice(0, 5)}.....${digits.slice(-2)}`;
}

export function isPhoneSignature(name: string | null | undefined): boolean {
  return PHONE_SIGNATURE_RE.test((name ?? "").trim());
}

/** Empty, the old placeholder, or a phone signature. A name the person typed stays. */
export function isStandInAccountName(name: string | null | undefined): boolean {
  const value = (name ?? "").trim();
  return !value || value === STAND_IN_NAME || isPhoneSignature(value);
}

/**
 * Name to store when a confirmed mobile is the signature.
 * Null when the person already has a real name, or the signature is already this number.
 */
export function phoneSignatureName(current: string | null | undefined, phone: string | null | undefined): string | null {
  const mask = maskedBelarusPhone(phone);
  if (!mask || !isStandInAccountName(current)) return null;
  return (current ?? "").trim() === mask ? null : mask;
}
