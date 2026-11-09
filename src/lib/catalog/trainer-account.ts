import { randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerProfiles, userRoles } from "@/db/schema";
import { claimPathFor } from "@/db/trainer-profiles";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { logCaught } from "@/lib/log/logger";
import { logTrainerPresence } from "@/lib/log/trainer-journal";

const CYR: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "j",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function nameSlug(value: string) {
  const latin = value.toLowerCase().split("").map((char) => CYR[char] ?? char).join("");
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 18).replace(/-+$/g, "") || "trainer";
}

function selfHandle(userId: string) {
  return `self${userId.replace(/-/g, "").slice(0, 12)}`;
}

type ManualTrainer = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
};

/** Trainer role and an owned draft for a person who registered without Instagram. */
export async function openManualTrainerAccount(user: ManualTrainer): Promise<void> {
  const db = getDb();
  const [owned] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, user.id))
    .limit(1);
  if (!owned) {
  const firstName = user.firstName.trim() || "Тренер";
  const lastName = (user.lastName ?? "").trim();
  const handle = selfHandle(user.id);
  const base = nameSlug(joinTrainerName(firstName, lastName));
  let slug = base;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    slug = attempt === 0 ? base : `${base.slice(0, 15)}-${attempt + 1}`.slice(0, 18);
    const [clash] = await db
      .select({ id: trainerProfiles.id })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, slug))
      .limit(1);
    if (!clash) break;
  }
  const claimToken = randomBytes(32).toString("base64url");
  const now = new Date();
  await db.insert(trainerProfiles).values({
    slug,
    instagramHandle: handle,
    sourceUrl: "https://trenio.by/join/account",
    status: "draft",
    claimStatus: "claimed",
    createdSource: "self",
    ownerUserId: user.id,
    firstName,
    lastName: lastName || "",
    fullName: joinTrainerName(firstName, lastName),
    claimToken,
    claimPath: claimPathFor(claimToken),
    claimedAt: now,
    privacyAcceptedAt: now,
    email: user.email,
    emailVerifiedAt: now,
  });
  logTrainerPresence({
    created: true,
    previous: null,
    next: "draft",
    slug,
    actorUserId: user.id,
    subject: user.email,
    source: "self",
    mode: "save",
  });
  }
  await db.insert(userRoles).values({ userId: user.id, role: "trainer" }).onConflictDoNothing();
}

export async function openManualTrainerAccountSafely(user: ManualTrainer): Promise<void> {
  try {
    await openManualTrainerAccount(user);
  } catch (error) {
    logCaught("account", "account.claim", error, { subject: user.email, actorUserId: user.id });
  }
}
