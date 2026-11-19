import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/db";
import { trainerProfiles, users } from "@/db/schema";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { cabinetInstagram } from "@/lib/catalog/trainer-contact-cross";
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

/** A contact the trainer marked «Не показывать на странице» leaves the public page. */
export function omitHiddenContacts(
  contacts: PublicTrainerContacts,
  hidden: { phone: boolean; instagram: boolean; telegram: boolean; email: boolean },
): PublicTrainerContacts {
  return {
    phone: hidden.phone ? "" : contacts.phone,
    instagram: hidden.instagram ? "" : contacts.instagram,
    telegram: hidden.telegram ? "" : contacts.telegram,
    email: hidden.email ? "" : contacts.email,
  };
}

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
        instagramHandle: trainerProfiles.instagramHandle,
        createdSource: trainerProfiles.createdSource,
        telegram: trainerProfiles.telegram,
        telegramVerifiedAt: trainerProfiles.telegramVerifiedAt,
        hidePhone: trainerProfiles.hidePhone,
        hideInstagram: trainerProfiles.hideInstagram,
        hideTelegram: trainerProfiles.hideTelegram,
        hideEmail: trainerProfiles.hideEmail,
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

    const instagram = row
      ? cabinetInstagram({
          instagramUrl: row.instagramUrl,
          instagramHandle: row.instagramHandle,
          createdSource: row.createdSource,
        }) || listed?.instagram || ""
      : listed?.instagram || "";
    const email = row?.ownerUserId
      ? row.accountEmailVerifiedAt ? row.accountEmail ?? "" : ""
      : row?.emailVerifiedAt ? row.email : "";
    const phone = row?.phoneVerifiedAt
      ? formatBelarusPhone(row.phone || row.accountPhone || "") || row.phone || ""
      : "";
    const telegram = row?.telegramVerifiedAt ? row.telegram : "";

    if (!listed && !row) return emptyContacts;
    return omitHiddenContacts(
      { phone, instagram, telegram, email },
      {
        phone: row?.hidePhone ?? false,
        instagram: row?.hideInstagram ?? false,
        telegram: row?.hideTelegram ?? false,
        email: row?.hideEmail ?? false,
      },
    );
  });
