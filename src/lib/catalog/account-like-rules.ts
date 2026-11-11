import { storedGivenName } from "@/lib/auth/login-name";
import type { UserRole } from "@/lib/auth/types";
import { countRu, pluralRu } from "@/lib/ru-plural";

/** A plain account and a trainer account. A club or a staff-only session does not like. */
export function canPlaceAccountLike(roles: readonly UserRole[]): boolean {
  return roles.includes("user") || roles.includes("trainer");
}

/** 1 лайкос, 2 лайкоса, 5 лайкосов, 11 лайкосов, 21 лайкос. The bare plural is «лайкосы». */
export function accountLikeWord(count: number): string {
  return pluralRu(count, "лайкос", "лайкоса", "лайкосов");
}

/** Visible total: «1 лайкос», «2 лайкоса», «5 лайкосов», «11 лайкосов», «21 лайкос». */
export function accountLikeLabel(count: number): string {
  return countRu(count, "лайкос", "лайкоса", "лайкосов");
}

/** The person who liked, without the mailbox. A phone mask and a typed name stay. */
export function accountLikePersonName(firstName: string, lastName: string | null | undefined, email: string): string {
  const given = storedGivenName(firstName, email);
  const family = (lastName ?? "").trim();
  if (!family || family === given) return given;
  return `${given} ${family}`;
}
