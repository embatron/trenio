/** Messages, reviews, and marketing can be turned off. Site notices stay on. A code, a verify link, and a password reset stay on. */
export const MAIL_KINDS = ["messages", "reviews", "site", "marketing"] as const;

export type MailKind = (typeof MAIL_KINDS)[number];
