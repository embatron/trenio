import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { assertStaff } from "@/lib/admin/access";
import { loadAdminShell } from "@/lib/admin/shell.server";

export const getAdminShellFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    return loadAdminShell(context.user.roles);
  });
