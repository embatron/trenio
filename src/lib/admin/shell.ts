import { count, eq, isNull } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerReviews, trainerWelcomes } from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";

export const getAdminShellFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const [hidden, rows, [welcomeRow]] = await Promise.all([
      hiddenStaffIds(context.user.roles),
      db
        .select({ userId: trainerReviews.userId })
        .from(trainerReviews)
        .where(eq(trainerReviews.status, "pending")),
      db.select({ value: count() }).from(trainerWelcomes).where(isNull(trainerWelcomes.linkSentAt)),
    ]);
    return {
      reviewsPending: rows.filter((row) => !hidden.has(row.userId)).length,
      welcomesOpen: Number(welcomeRow?.value ?? 0),
    };
  });
