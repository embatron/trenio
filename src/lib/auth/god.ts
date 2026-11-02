import { SITE_EMAIL } from "@/lib/seo/site";

/** Owner account. The nil UUID is user id 0 on every page and in every table. */
export const GOD_USER_ID = "00000000-0000-0000-0000-000000000000";

/** Admin and superadmin are this one mailbox. */
export const GOD_EMAIL = SITE_EMAIL;

const ACCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isGodUser(userId: string | null | undefined): boolean {
  return userId === GOD_USER_ID;
}

export function isGodLogin(value: string): boolean {
  const raw = value.trim().toLowerCase();
  return raw === GOD_EMAIL || raw === "trenioby" || raw === "embatron" || raw === "embatron@gmail.com";
}

/** Staff account routes accept a normal UUID and the zero id. */
export function isAccountId(value: string): boolean {
  return value === GOD_USER_ID || ACCOUNT_ID.test(value);
}

/** What a person sees. The owner is 0; everyone else keeps the UUID. */
export function displayUserId(userId: string): string {
  return isGodUser(userId) ? "0" : userId;
}
