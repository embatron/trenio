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
  if (hasRole(roles, "superadmin") || hasRole(roles, "admin")) {
    return "/trainer-admin";
  }
  if (hasRole(roles, "trainer")) {
    return "/trainer-admin";
  }
  if (hasRole(roles, "club")) {
    return "/trainer-admin";
  }
  return "/";
}

export const ROLE_LABELS: Record<UserRole, string> = {
  user: "Пользователь",
  trainer: "Тренер",
  club: "Клуб",
  admin: "Администратор",
  superadmin: "Суперадмин",
};
