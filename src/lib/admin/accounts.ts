import { and, desc, eq, isNotNull, ne } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { buildAdminUserLogs, loadAdminUserActivity, type AdminUserLogin, type AdminUserLog } from "@/lib/admin/user-activity";
import type { UserRole } from "@/lib/auth/types";

export type { AdminUserLogin as AdminAccountLogin, AdminUserLog as AdminAccountLog };

export const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  pending_verification: "На проверке",
  active: "Активен",
  suspended: "Заблокирован",
  deleted: "Удалён",
};

export type AdminAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  phone: string;
  status: string;
  roles: UserRole[];
  createdAt: string;
  lastLoginAt: string;
  avatarPath: string;
};

export type AdminAccountTrainer = {
  slug: string;
  firstName: string;
  lastName: string;
  fullName: string;
  status: "draft" | "published" | "hidden" | "archived";
};

export type AdminAccountDetail = AdminAccount & {
  trainers: AdminAccountTrainer[];
  emailVerifiedAt: string;
  phoneVerifiedAt: string;
  lastSignupIntent: string | null;
  logins: AdminUserLogin[];
  logs: AdminUserLog[];
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
          avatarPath: users.avatarPath,
          createdAt: users.createdAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(users)
        .where(and(ne(users.status, "deleted"), isNotNull(users.emailVerifiedAt)))
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
        firstName: row.firstName,
        lastName: row.lastName ?? "",
        name: [row.firstName, row.lastName].filter(Boolean).join(" "),
        phone: row.phone ?? "",
        status: row.status,
        roles: rolesByUser.get(row.id) ?? [],
        createdAt: row.createdAt.toISOString(),
        lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : "",
        avatarPath: row.avatarPath,
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
        updatedAt: users.updatedAt,
        emailVerifiedAt: users.emailVerifiedAt,
        phoneVerifiedAt: users.phoneVerifiedAt,
        lastSignupIntent: users.lastSignupIntent,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.id, data.id))
      .limit(1);
    if (!row) return null;

    const activity = await loadAdminUserActivity(data.id);

    const [roleRows, trainerRows] = await Promise.all([
      db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, data.id)),
      db
        .select({
          slug: trainerProfiles.slug,
          firstName: trainerProfiles.firstName,
          lastName: trainerProfiles.lastName,
          fullName: trainerProfiles.fullName,
          status: trainerProfiles.status,
        })
        .from(trainerProfiles)
        .where(eq(trainerProfiles.ownerUserId, data.id)),
    ]);

    const logs = buildAdminUserLogs({
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      emailVerifiedAt: row.emailVerifiedAt,
      phoneVerifiedAt: row.phoneVerifiedAt,
      lastSignupIntent: row.lastSignupIntent,
      lastLoginAt: row.lastLoginAt,
      reviewRows: activity.reviewRows,
      trainerRows: activity.trainerRows,
      resetRows: activity.resetRows,
      emailRows: activity.emailRows,
      otpRows: activity.otpRows,
    });

    return {
      id: row.id,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName ?? "",
      name: [row.firstName, row.lastName].filter(Boolean).join(" "),
      phone: row.phone ?? "",
      status: row.status,
      roles: roleRows.map((item) => item.role),
      createdAt: row.createdAt.toISOString(),
      lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : "",
      avatarPath: row.avatarPath,
      emailVerifiedAt: row.emailVerifiedAt ? row.emailVerifiedAt.toISOString() : "",
      phoneVerifiedAt: row.phoneVerifiedAt ? row.phoneVerifiedAt.toISOString() : "",
      lastSignupIntent: row.lastSignupIntent,
      logins: activity.logins,
      logs,
      trainers: trainerRows.map((item) => ({
        slug: item.slug,
        firstName: item.firstName,
        lastName: item.lastName,
        fullName: item.fullName || [item.firstName, item.lastName].filter(Boolean).join(" ") || item.slug,
        status: item.status,
      })),
    };
  });
