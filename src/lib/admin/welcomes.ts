import { desc } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerWelcomes } from "@/db/schema";
import { assertStaff } from "@/lib/admin/access";
import { formatBelarusPhone } from "@/lib/auth/phone";

export type AdminWelcome = {
  id: string;
  channel: "instagram" | "other";
  instagram: string;
  telegram: string;
  phone: string;
  createdAt: string;
  open: boolean;
};

export const getAdminWelcomesFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<AdminWelcome[]> => {
    assertStaff(context.user.roles);
    const rows = await getDb()
      .select({
        id: trainerWelcomes.id,
        channel: trainerWelcomes.channel,
        instagram: trainerWelcomes.instagram,
        telegram: trainerWelcomes.telegram,
        phone: trainerWelcomes.phone,
        createdAt: trainerWelcomes.createdAt,
        linkSentAt: trainerWelcomes.linkSentAt,
      })
      .from(trainerWelcomes)
      .orderBy(desc(trainerWelcomes.createdAt));
    return rows.map((row) => ({
      id: row.id,
      channel: row.channel === "other" ? "other" : "instagram",
      instagram: row.instagram ?? "",
      telegram: row.telegram ?? "",
      phone: formatBelarusPhone(row.phone),
      createdAt: row.createdAt.toISOString(),
      open: row.linkSentAt == null,
    }));
  });
