import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { trainerProfiles, users } from "@/db/schema";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";

export type PublicTrainerContacts = {
  phone: string;
  instagram: string;
  telegram: string;
  email: string;
};

const emptyContacts: PublicTrainerContacts = {
  phone: "",
  instagram: "",
  telegram: "",
  email: "",
};

/** Phone needs SMS. Telegram needs the bot. The public email is the verified login email. Instagram stays visible. */
export const getPublicTrainerContactsFn = createServerFn({ method: "GET" })
  .validator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }): Promise<PublicTrainerContacts> => {
    const listed = getPublishedTrainer(data.slug);
    const db = getDb();
    const [row] = await db
      .select({
        phone: trainerProfiles.phone,
        email: trainerProfiles.email,
        emailVerifiedAt: trainerProfiles.emailVerifiedAt,
        instagramUrl: trainerProfiles.instagramUrl,
        telegram: trainerProfiles.telegram,
        telegramVerifiedAt: trainerProfiles.telegramVerifiedAt,
        ownerUserId: trainerProfiles.ownerUserId,
        accountEmail: users.email,
        accountEmailVerifiedAt: users.emailVerifiedAt,
        accountPhone: users.phone,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(trainerProfiles)
      .leftJoin(users, eq(users.id, trainerProfiles.ownerUserId))
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);

    const instagram = row?.instagramUrl || listed?.instagram || "";
    const email = row?.ownerUserId
      ? row.accountEmailVerifiedAt ? row.accountEmail ?? "" : ""
      : row?.emailVerifiedAt ? row.email : "";
    const phone = row?.phoneVerifiedAt
      ? formatBelarusPhone(row.phone || row.accountPhone || "") || row.phone || ""
      : "";
    const telegram = row?.telegramVerifiedAt ? row.telegram : "";

    if (!listed && !row) return emptyContacts;
    return { phone, instagram, telegram, email };
  });
