import { eq } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerReviews } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import { countOpenWelcomes } from "@/lib/admin/welcomes";

export const getAdminShellFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [hidden, rows, welcomesOpen] = await Promise.all([
      hiddenStaffIds(context.user.roles),
      db
        .select({ userId: trainerReviews.userId })
        .from(trainerReviews)
        .where(eq(trainerReviews.status, "pending")),
      countOpenWelcomes(),
    ]);
    return {
      reviewsPending: rows.filter((row) => !hidden.has(row.userId)).length,
      welcomesOpen,
    };
  });
