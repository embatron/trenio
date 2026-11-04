import { and, eq, isNull, ne } from "drizzle-orm";

import { normalizeEmail } from "@/auth/password";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users } from "@/db/schema";
import { writeLog } from "@/lib/log/logger";

const DOOR_PROFILE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DOOR_SLUG = /^[a-z0-9._]{1,30}$/;

export type DoorGoogleClaim = "claimed" | "own" | "missing" | "taken" | "busy";

/** Google on the short link proves the mailbox and binds the imported card. No password step. */
export async function claimDoorAfterGoogle(input: {
  userId: string;
  email: string;
  created: boolean;
  profileId: string;
  previewSlug: string;
}): Promise<DoorGoogleClaim> {
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
    && (row?.status === "draft" || row?.status === "published");
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

  await db.insert(userRoles).values({ userId: input.userId, role: "trainer" }).onConflictDoNothing();
  const firstName = row.firstName.trim();
  const lastName = row.lastName.trim();
  await db.update(users).set({
    ...(input.created && firstName ? { firstName } : {}),
    ...(input.created ? { lastName: lastName || null, lastSignupIntent: "trainer_claim" as const } : {}),
    needsPassword: false,
    updatedAt: now,
  }).where(eq(users.id, input.userId));

  void writeLog({
    level: "info",
    domain: "account",
    action: "account.claim",
    outcome: "success",
    message: "Google привязал импортированный профиль. Почта подтверждена.",
    subject: email,
    actorUserId: input.userId,
    target: row.slug,
  });

  const { sendTrainerWelcome } = await import("@/lib/messages/welcome");
  await sendTrainerWelcome({ id: input.userId, firstName: row.firstName.trim() || "Тренер" });
  return "claimed";
}
