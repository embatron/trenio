import { COMMON_PASSWORDS } from "@/lib/auth/common-passwords";

const PASSWORD_MAX = 128;

export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.normalize("NFKC").toLowerCase());
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Пароль должен содержать минимум 8 символов";
  }
  if (password.length > PASSWORD_MAX) {
    return "Пароль не длиннее 128 символов";
  }
  if (isCommonPassword(password)) {
    return "Этот пароль слишком известный. Выберите другой.";
  }
  return null;
}

/** Three bars: 8 characters, 12 characters, and not a commonly breached password. */
export function passwordMeterScore(password: string): number {
  if (!password) return 0;
  let met = 0;
  if (password.length >= 8) met += 1;
  if (password.length >= 12) met += 1;
  if (password.length >= 8 && password.length <= PASSWORD_MAX && !isCommonPassword(password)) met += 1;
  return met;
}
