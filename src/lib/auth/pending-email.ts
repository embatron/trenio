const PENDING_SIGNUP_EMAIL_RE = /^pending\.[0-9a-f-]{36}@users\.trenio\.invalid$/i;

/** Internal mailbox until a phone or Telegram signup saves a real address. */
export function pendingSignupEmail(userId: string): string {
  return `pending.${userId}@users.trenio.invalid`;
}

export function isPendingSignupEmail(email: string | null | undefined): boolean {
  return typeof email === "string" && PENDING_SIGNUP_EMAIL_RE.test(email.trim());
}

/** Addresses the product owns. A person cannot register or claim them. */
export function isReservedAccountEmail(email: string): boolean {
  const host = email.trim().toLowerCase().split("@")[1] ?? "";
  return host === "users.trenio.invalid" || host === "nick.trenio.by";
}
