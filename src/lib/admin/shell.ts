import { eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerReviews } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";

export const getAdminShellFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const hidden = await hiddenStaffIds(context.user.roles);
    const rows = await getDb()
      .select({ userId: trainerReviews.userId })
      .from(trainerReviews)
      .where(eq(trainerReviews.status, "pending"));
    return { reviewsPending: rows.filter((row) => !hidden.has(row.userId)).length };
  });
