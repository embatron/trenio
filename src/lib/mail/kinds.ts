/** Kinds a person can turn off. A code, a verify link, and a password reset stay on. */
export const MAIL_KINDS = ["messages", "reviews", "site", "marketing"] as const;

export type MailKind = (typeof MAIL_KINDS)[number];
