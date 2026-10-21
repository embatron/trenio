import { desc, eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import type { UserRole } from "@/lib/auth/types";

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  pending_verification: "На проверке",
  active: "Активен",
  suspended: "Заблокирован",
  deleted: "Удалён",
};

export type AdminAccount = {
  id: string;
  email: string;
  name: string;
  phone: string;
  status: string;
  roles: UserRole[];
  createdAt: string;
};

export type AdminAccountTrainer = {
  slug: string;
  fullName: string;
  status: "draft" | "published" | "hidden" | "archived";
};

export type AdminAccountDetail = AdminAccount & {
  avatarPath: string;
  trainers: AdminAccountTrainer[];
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

export const getAdminAccountFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ context, data }): Promise<AdminAccountDetail | null> => {
    assertStaff(context.user.roles);
    if ((await hiddenStaffIds(context.user.roles)).has(data.id)) return null;
    const db = getDb();
    const [row] = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        status: users.status,
        avatarPath: users.avatarPath,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, data.id))
      .limit(1);
    if (!row) return null;

    const [roleRows, trainerRows] = await Promise.all([
      db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, data.id)),
      db
        .select({
          slug: trainerProfiles.slug,
          fullName: trainerProfiles.fullName,
          status: trainerProfiles.status,
        })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.ownerUserId, data.id)),
    ]);

    return {
      id: row.id,
      email: row.email,
      name: [row.firstName, row.lastName].filter(Boolean).join(" "),
      phone: row.phone ?? "",
      status: row.status,
      roles: roleRows.map((item) => item.role),
      createdAt: row.createdAt.toISOString(),
      avatarPath: row.avatarPath,
      trainers: trainerRows.map((item) => ({
        slug: item.slug,
        fullName: item.fullName || item.slug,
        status: item.status,
      })),
    };
  });
