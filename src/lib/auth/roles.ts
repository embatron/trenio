import type { SignupIntent, UserRole } from "@/lib/auth/types";

/** Roles assignable during public registration. */
export const PUBLIC_SIGNUP_ROLES = ["user", "trainer", "club"] as const;
export type PublicSignupRole = (typeof PUBLIC_SIGNUP_ROLES)[number];

export const ALL_ROLES: UserRole[] = [
  "user",
  "trainer",
  "club",
  "admin",
  "superadmin",
];

/** Higher index = more privilege for guard checks. */
export const ROLE_RANK: Record<UserRole, number> = {
  user: 0,
  trainer: 1,
  club: 1,
  admin: 2,
  superadmin: 3,
};

export function signupRoleToIntent(role: PublicSignupRole): SignupIntent {
  switch (role) {
    case "user":
      return "client_signup";
    case "trainer":
      return "trainer_create";
    case "club":
      return "branch_create";
  }
}

export function hasRole(userRoles: UserRole[], role: UserRole): boolean {
  return userRoles.includes(role);
}

export function hasAnyRole(userRoles: UserRole[], roles: UserRole[]): boolean {
  return roles.some((role) => userRoles.includes(role));
}

export function hasMinimumRole(userRoles: UserRole[], minimum: UserRole): boolean {
  const minRank = ROLE_RANK[minimum];
  return userRoles.some((role) => ROLE_RANK[role] >= minRank);
}

export function isStaff(userRoles: UserRole[]): boolean {
  return hasAnyRole(userRoles, ["admin", "superadmin"]);
}

export function canAccessFinance(userRoles: UserRole[]): boolean {
  return hasRole(userRoles, "superadmin");
}

export function getPostLoginPath(roles: UserRole[]): string {
  if (isStaff(roles)) return "/admin";
  if (hasAnyRole(roles, ["trainer", "club"])) return "/me";
  return "/account";
}

export function getCabinetPath(roles: UserRole[]): "/admin" | "/me" | "/account" {
  if (isStaff(roles)) return "/admin";
  if (hasAnyRole(roles, ["trainer", "club"])) return "/me";
  return "/account";
}

/** Trainer cabinet path that keeps the open thread and the `trainer` query. */
export function accountPathForTrainer(pathname: string, searchStr = ""): string {
  const conversation = pathname.match(/^\/account\/messages\/([0-9a-f-]{36})\/?$/i)?.[1];
  if (conversation) return `/me/messages/${conversation}`;
  if (pathname.startsWith("/account/messages")) {
    const trainer = new URLSearchParams(searchStr.replace(/^\?/, "")).get("trainer")?.trim().slice(0, 30) ?? "";
    return trainer ? `/me/messages?trainer=${encodeURIComponent(trainer)}` : "/me/messages";
  }
  if (pathname.startsWith("/account/reviews")) return "/me/reviews";
  if (pathname.startsWith("/account/favorites")) return "/me/favorites";
  if (pathname.startsWith("/account/settings")) return "/me/settings";
  return "/me";
}

/**
 * Null when this role may open the cabinet. Otherwise the path to send them to.
 * A staff member who is also a trainer may open `/me`. Everyone else stays in one cabinet.
 */
export function deniedCabinetTarget(
  area: "admin" | "me" | "account",
  roles: UserRole[],
  pathname = "",
  searchStr = "",
): string | null {
  if (area === "admin") {
    if (isStaff(roles)) return null;
    return hasAnyRole(roles, ["trainer", "club"]) ? "/me" : "/";
  }
  if (area === "me") {
    if (hasAnyRole(roles, ["trainer", "club"])) return null;
    return isStaff(roles) ? "/admin" : "/";
  }
  if (isStaff(roles)) return "/admin";
  if (hasAnyRole(roles, ["trainer", "club"])) return accountPathForTrainer(pathname, searchStr);
  return null;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Пользователь",
  trainer: "Тренер",
  club: "Клуб",
  admin: "Администратор",
  superadmin: "Суперадмин",
};
