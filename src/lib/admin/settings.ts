import { eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertStaff } from "@/lib/admin/access";

export const getAdminSettingsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const [row] = await getDb()
      .select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
      .from(users)
      .where(eq(users.id, context.user.id))
      .limit(1);
    return {
      phone: row?.phone ?? null,
      phoneVerified: row?.phoneVerifiedAt != null,
    };
  });
