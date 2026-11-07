import { and, eq, isNull, ne } from "drizzle-orm";

import { normalizeEmail } from "@/auth/password";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users } from "@/db/schema";
import { writeLog } from "@/lib/log/logger";
import { logTrainerPresence } from "@/lib/log/trainer-journal";

const PLACEHOLDER_NAME = "Пользователь";
const DOOR_PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOOR_SLUG = /^[a-z0-9._]{1,30}$/;

export type DoorGoogleClaim = "claimed" | "own" | "missing" | "taken" | "busy";

/** The mailbox is confirmed by the letter or by Google. A draft then enters the catalog. A hidden card stays hidden. */
export async function publishConfirmedDraft(row: { id: string; slug: string; status: string }) {
  if (row.status !== "draft") return;
  const updated = await getDb()
    .update(trainerProfiles)
    .set({ status: "published", updatedAt: new Date() })
    .where(and(eq(trainerProfiles.id, row.id), eq(trainerProfiles.status, "draft")))
    .returning({ id: trainerProfiles.id });
  if (updated.length === 0) return;
  logTrainerPresence({
    created: false,
    previous: "draft",
    next: "published",
    slug: row.slug,
    mode: "save",
  });
}

type DoorClaimInput = {
  userId: string;
  email: string;
  created: boolean;
  profileId: string;
  previewSlug: string;
  via?: "google" | "yandex";
};

/** A new account takes the card name. An empty or placeholder card name leaves the provider name. */
export function doorAccountName(created: boolean, card: { firstName: string; lastName: string }) {
  if (!created) return {};
  const firstName = card.firstName.trim();
  const lastName = card.lastName.trim();
  return {
    ...(firstName && firstName !== PLACEHOLDER_NAME ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    lastSignupIntent: "trainer_claim" as const,
  };
}

/** Google or Yandex on the short link proves the mailbox and binds the imported card. No password step. */
export async function claimDoorAfterGoogle(input: DoorClaimInput): Promise<DoorGoogleClaim> {
  const profileId = input.profileId.trim();
  const previewSlug = input.previewSlug.trim().toLowerCase();
  if (!DOOR_PROFILE_ID.test(profileId) || !DOOR_SLUG.test(previewSlug)) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "Короткая ссылка не привязала профиль.",
      subject: input.email,
      actorUserId: input.userId,
    });
    return "missing";
  }

  const db = getDb();
  const [row] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.id, profileId)).limit(1);
  const open = Boolean(row?.previewToken)
    && row?.slug === previewSlug
    && !row?.ownerUserId
    && row?.status !== "published";
  if (!row || !open) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "Короткая ссылка не привязала профиль.",
      subject: input.email,
      actorUserId: input.userId,
      target: previewSlug,
    });
    return "missing";
  }
  if (row.ownerUserId === input.userId) return "own";
  if (row.ownerUserId) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "Этот профиль уже привязан.",
      subject: input.email,
      actorUserId: input.userId,
      target: row.slug,
    });
    return "taken";
  }

  const [other] = await db
    .select({ id: trainerProfiles.id })
    .from(trainerProfiles)
    .where(and(eq(trainerProfiles.ownerUserId, input.userId), ne(trainerProfiles.id, row.id)))
    .limit(1);
  if (other) {
    void writeLog({
      level: "warn",
      domain: "account",
      action: "account.claim",
      outcome: "denied",
      message: "У этого аккаунта уже есть другая карточка.",
      subject: input.email,
      actorUserId: input.userId,
      target: row.slug,
    });
    return "busy";
  }

  const now = new Date();
  const email = normalizeEmail(input.email);
  const accountName = doorAccountName(input.created, row);
  const updated = await db
    .update(trainerProfiles)
    .set({
      ownerUserId: input.userId,
      claimStatus: "claimed",
      claimedAt: now,
      email,
      emailVerifiedAt: now,
      updatedAt: now,
    })
    .where(and(eq(trainerProfiles.id, row.id), isNull(trainerProfiles.ownerUserId)))
    .returning({ id: trainerProfiles.id });
  if (updated.length === 0) {
    const [again] = await db
      .select({ ownerUserId: trainerProfiles.ownerUserId })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.id, row.id))
      .limit(1);
    return again?.ownerUserId === input.userId ? "own" : "taken";
  }

  await publishConfirmedDraft(row);
  await db.insert(userRoles).values({ userId: input.userId, role: "trainer" }).onConflictDoNothing();
  await db.update(users).set({
    ...accountName,
    needsPassword: false,
    updatedAt: now,
  }).where(eq(users.id, input.userId));

  void writeLog({
    level: "info",
    domain: "account",
    action: "account.claim",
    outcome: "success",
    message: input.via === "yandex"
      ? "Яндекс привязал импортированный профиль. Почта подтверждена."
      : "Google привязал импортированный профиль. Почта подтверждена.",
    subject: email,
    actorUserId: input.userId,
    target: row.slug,
  });

  const { sendTrainerWelcome } = await import("@/lib/messages/welcome");
  await sendTrainerWelcome({ id: input.userId, firstName: row.firstName.trim() || "Тренер" });
  return "claimed";
}

/** Yandex on the short link uses the same mailbox proof as Google. */
export function claimDoorAfterYandex(input: Omit<DoorClaimInput, "via">): Promise<DoorGoogleClaim> {
  return claimDoorAfterGoogle({ ...input, via: "yandex" });
}
