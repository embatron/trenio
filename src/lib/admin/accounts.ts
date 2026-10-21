import { desc } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { userRoles, users } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import type { UserRole } from "@/lib/auth/types";

export type AdminAccount = {
  id: string;
  email: string;
  name: string;
  phone: string;
  status: string;
  roles: UserRole[];
  createdAt: string;
};

export const getAdminAccountsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<AdminAccount[]> => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [accountRows, roleRows] = await Promise.all([
      db
        .select({
          id: users.id,
          email: users.email,
          firstName: users.firstName,
          lastName: users.lastName,
          phone: users.phone,
          status: users.status,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt)),
      db.select({ userId: userRoles.userId, role: userRoles.role }).from(userRoles),
    ]);

    const rolesByUser = new Map<string, UserRole[]>();
    for (const row of roleRows) {
      const list = rolesByUser.get(row.userId) ?? [];
      list.push(row.role);
      rolesByUser.set(row.userId, list);
    }

    const hidden = await hiddenStaffIds(context.user.roles);
    return accountRows.flatMap((row) => {
      if (hidden.has(row.id)) return [];
      return [{
        id: row.id,
        email: row.email,
        name: [row.firstName, row.lastName].filter(Boolean).join(" "),
        phone: row.phone ?? "",
        status: row.status,
        roles: rolesByUser.get(row.id) ?? [],
        createdAt: row.createdAt.toISOString(),
      }];
    });
  });
