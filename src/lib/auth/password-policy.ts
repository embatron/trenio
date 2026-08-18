export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Пароль должен содержать минимум 8 символов";
  }
  if (!/[0-9]/.test(password)) {
    return "Пароль должен содержать хотя бы одну цифру";
  }
  if (!/[A-ZА-ЯЁ]/.test(password)) {
    return "Пароль должен содержать хотя бы одну заглавную букву";
  }
  return null;
}
