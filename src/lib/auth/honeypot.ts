export const HONEYPOT_FIELD = "company_url";

export function isHoneypotFilled(value: string | undefined | null): boolean {
  return Boolean(value?.trim());
}
