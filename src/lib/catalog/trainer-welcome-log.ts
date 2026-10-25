import { and, isNull, or, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerWelcomes } from "@/db/schema";
import { normalizeBelarusMobile } from "@/lib/auth/phone";
import { belarusPhoneEquals } from "@/lib/auth/phone-match";
import { parseInstagramHandle, parseTelegramHandle } from "@/lib/catalog/trainer-welcome";

/** Mark matching leads when the trainer opens the draft through the claim link. The first open sticks. */
export async function markTrainerWelcomeLinkSent(contact: {
  instagram: string;
  telegram: string;
  phone: string;
}) {
  const instagram = (parseInstagramHandle(contact.instagram) ?? "").toLowerCase();
  const telegram = (parseTelegramHandle(contact.telegram) ?? "").toLowerCase();
  const phone = normalizeBelarusMobile(contact.phone);
  const matches = [];
  if (instagram) matches.push(sql`lower(${trainerWelcomes.instagram}) = ${instagram}`);
  if (telegram) matches.push(sql`lower(${trainerWelcomes.telegram}) = ${telegram}`);
  if (phone) matches.push(belarusPhoneEquals(trainerWelcomes.phone, phone));
  if (matches.length === 0) return;

  await getDb()
    .update(trainerWelcomes)
    .set({ linkSentAt: new Date() })
    .where(and(isNull(trainerWelcomes.linkSentAt), or(...matches)));
}
