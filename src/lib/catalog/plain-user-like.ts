const STAFF_ROLES = ["trainer", "club", "admin", "superadmin"] as const;

/** Eugene Sokolov, and only while that account stays a plain user. */
export function isPlainLikeActor(input: {
  firstName: string;
  lastName: string | null | undefined;
  roles: readonly string[];
}): boolean {
  const first = input.firstName.trim().toLowerCase();
  const last = (input.lastName ?? "").trim().toLowerCase();
  if (first !== "eugene" || last !== "sokolov") return false;
  const roles = new Set(input.roles);
  return roles.has("user") && STAFF_ROLES.every((role) => !roles.has(role));
}
