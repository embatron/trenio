import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { userRoles } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { hasRole, isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";

export function assertStaff(roles: UserRole[]) {
  if (!isStaff(roles)) {
    throw new AuthError("Недостаточно прав.", "FORBIDDEN");
  }
}

export function canSeeSuperadmins(roles: UserRole[]) {
  return hasRole(roles, "superadmin");
}

/** User ids a regular admin must not see. Empty for a superadmin. */
export async function hiddenStaffIds(viewerRoles: UserRole[]) {
  if (canSeeSuperadmins(viewerRoles)) return new Set<string>();
  const rows = await getDb()
    .select({ userId: userRoles.userId })
    .from(userRoles)
    .where(eq(userRoles.role, "superadmin"));
  return new Set(rows.map((row) => row.userId));
}
