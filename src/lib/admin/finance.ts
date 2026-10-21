import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { assertStaff } from "@/lib/admin/access";

export const getAdminFinanceFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    return { payments: [] as Array<{ id: string }> };
  });
