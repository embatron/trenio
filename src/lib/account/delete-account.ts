import { randomBytes } from "node:crypto";
import path from "node:path";

import { and, eq, inArray, or, sql, type SQL } from "drizzle-orm";

import { consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/auth/rate-limit";
import { hashPassword, verifyPassword } from "@/auth/password";
import { getDb } from "@/db";
import {
  appLogs,
  authOtpChallenges,
  blockedPairs,
  conversations,
  emailVerificationTokens,
  messages,
  passwordResetTokens,
  sessions,
  trainerProfiles,
  trainerReviews,
  trainerWelcomes,
  userFavorites,
  users,
  type TrainerReviewMessage,
} from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { isGodUser } from "@/lib/auth/god";
import { normalizeBelarusMobile } from "@/lib/auth/phone";
import { belarusPhoneEquals } from "@/lib/auth/phone-match";
import { isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { readCertificates } from "@/lib/catalog/certificate-file";
import { parseInstagramHandle, parseTelegramHandle } from "@/lib/catalog/trainer-welcome";
import { removeImageSet } from "@/lib/images/store";
import { masterImagePath } from "@/lib/images/variants";
import { logCaught, writeLog } from "@/lib/log/logger";
import { maskPhone } from "@/lib/log/redact";
import { removeConversationFiles } from "@/lib/messages/attachment-store";
import { SITE_ORIGIN } from "@/lib/seo/site";

export const DELETED_ACCOUNT_NAME = "Удалённый";

export function deletedAccountEmail(userId: string): string {
  return `deleted.${userId}@users.trenio.invalid`;
}

export function withoutTrainerReplies(value: unknown): TrainerReviewMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is TrainerReviewMessage => {
    return Boolean(item) && typeof item === "object" && (item as TrainerReviewMessage).role !== "trainer";
  });
}

type MediaOwner = {
  userId: string;
  slugs: string[];
  handles: string[];
};

function cleanStoredPath(stored: string): string | null {
  const file = stored.split("?")[0]?.trim() ?? "";
  if (!file.startsWith("/") || file.includes("..") || file.includes("\\") || file.includes("//")) return null;
  return file;
}

function matchesPrefix(file: string, prefix: string): boolean {
  if (!file.startsWith(prefix)) return false;
  const next = file.charAt(prefix.length);
  return next === "." || next === "-" || next === "/";
}

export function ownedMediaPath(stored: string, owner: MediaOwner): string | null {
  const file = cleanStoredPath(stored);
  if (!file || !isOwnedMedia(file, owner)) return null;
  const master = masterImagePath(file).path;
  return isOwnedMedia(master, owner) ? master : file;
}

function isOwnedMedia(file: string, owner: MediaOwner): boolean {
  const userId = owner.userId.toLowerCase();
  const lower = file.toLowerCase();
  return (
    matchesPrefix(lower, `/avatars/${userId}`) ||
    matchesPrefix(lower, `/trainers/self/${userId}`) ||
    owner.slugs.some((slug) => lower.startsWith(`/trainers/admin/${slug.toLowerCase()}/`)) ||
    owner.handles.some((handle) => matchesPrefix(lower, `/trainers/instagram/${handle.toLowerCase()}`))
  );
}

function absolutePublicFile(relative: string): string | null {
  const root = path.resolve(process.cwd(), "public");
  const file = path.resolve(root, relative.replace(/^\/+/, ""));
  if (!file.startsWith(root + path.sep)) return null;
  return file;
}

function welcomeMatches(contact: { instagrams: string[]; telegrams: string[]; phones: string[] }): SQL[] {
  const matches: SQL[] = [];
  for (const instagram of contact.instagrams) {
    matches.push(sql`lower(${trainerWelcomes.instagram}) = ${instagram}`);
  }
  for (const telegram of contact.telegrams) {
    matches.push(sql`lower(${trainerWelcomes.telegram}) = ${telegram}`);
  }
  for (const phone of contact.phones) {
    matches.push(belarusPhoneEquals(trainerWelcomes.phone, phone));
  }
  return matches;
}

async function scrubAccountLogs(userId: string, email: string, phone: string | null) {
  const subjects = [email.trim().toLowerCase(), maskPhone(phone)].filter((value): value is string => Boolean(value));
  const match = subjects.length
    ? or(eq(appLogs.actorUserId, userId), inArray(appLogs.subject, subjects))
    : eq(appLogs.actorUserId, userId);
  await getDb().update(appLogs).set({ subject: null, ip: null, userAgent: null }).where(match);
}

export async function deleteOwnAccount(
  actor: { id: string; roles: UserRole[] },
  password: string,
): Promise<void> {
  if (isGodUser(actor.id) || isStaff(actor.roles)) {
    throw new AuthError("Удаление служебного аккаунта недоступно. Напишите в поддержку.", "FORBIDDEN");
  }

  const limit = consumeRateLimit(`account-delete:${actor.id}`, 15 * 60_000, 8);
  if (!limit.ok) throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, actor.id)).limit(1);
  if (!user || user.status === "deleted") {
    throw new AuthError("Неверный пароль.", "INVALID_CREDENTIALS");
  }
  const matches = await verifyPassword(password, user.passwordHash);
  if (!matches) throw new AuthError("Неверный пароль.", "INVALID_CREDENTIALS");

  const profiles = await db.select().from(trainerProfiles).where(eq(trainerProfiles.ownerUserId, user.id));
  const profileIds = profiles.map((profile) => profile.id);
  const slugs = profiles.map((profile) => profile.slug);
  const handles = profiles.map((profile) => profile.instagramHandle).filter(Boolean);

  const threadRows = await db
    .select({ id: conversations.id })
    .from(conversations)
    .where(
      profileIds.length
        ? or(
            eq(conversations.userId, user.id),
            eq(conversations.hostUserId, user.id),
            inArray(conversations.trainerProfileId, profileIds),
          )
        : or(eq(conversations.userId, user.id), eq(conversations.hostUserId, user.id)),
    );
  const sentRows = await db
    .select({ id: messages.conversationId })
    .from(messages)
    .where(eq(messages.senderId, user.id));
  const conversationIds = [...new Set([...threadRows.map((row) => row.id), ...sentRows.map((row) => row.id)])];

  const media = new Set<string>();
  const mediaOwner = { userId: user.id, slugs, handles };
  for (const stored of [
    user.avatarPath,
    ...profiles.flatMap((profile) => [
      profile.avatarPath,
      ...profile.photos,
      ...readCertificates(profile.certificates).map((item) => item.path),
    ]),
  ]) {
    const owned = ownedMediaPath(stored, mediaOwner);
    if (owned) media.add(owned);
    if (stored.split("?")[0]?.toLowerCase().startsWith(`/avatars/${user.id.toLowerCase()}.`)) {
      for (const ext of ["jpg", "png", "webp"]) {
        const sibling = ownedMediaPath(`/avatars/${user.id}.${ext}`, mediaOwner);
        if (sibling) media.add(sibling);
      }
    }
  }

  const instagrams = new Set<string>();
  const telegrams = new Set<string>();
  const phones = new Set<string>();
  const userPhone = normalizeBelarusMobile(user.phone ?? "");
  if (userPhone) phones.add(userPhone);
  for (const profile of profiles) {
    for (const raw of [profile.instagramHandle, profile.instagramUrl]) {
      const handle = parseInstagramHandle(raw);
      if (handle) instagrams.add(handle.toLowerCase());
    }
    const telegram = parseTelegramHandle(profile.telegram);
    if (telegram) telegrams.add(telegram.toLowerCase());
    const phone = normalizeBelarusMobile(profile.phone);
    if (phone) phones.add(phone);
  }

  const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
  const leads = welcomeMatches({
    instagrams: [...instagrams],
    telegrams: [...telegrams],
    phones: [...phones],
  });

  await db.transaction(async (tx) => {
    if (leads.length) await tx.delete(trainerWelcomes).where(or(...leads));
    if (slugs.length) {
      await tx.delete(userFavorites).where(
        or(eq(userFavorites.userId, user.id), and(eq(userFavorites.targetType, "trainer"), inArray(userFavorites.targetSlug, slugs))),
      );
    } else {
      await tx.delete(userFavorites).where(eq(userFavorites.userId, user.id));
    }
    await tx.delete(trainerReviews).where(eq(trainerReviews.userId, user.id));
    if (slugs.length) {
      const kept = await tx
        .select({
          id: trainerReviews.id,
          messages: trainerReviews.messages,
          reply: trainerReviews.reply,
        })
        .from(trainerReviews)
        .where(inArray(trainerReviews.trainerSlug, slugs));
      for (const review of kept) {
        const next = withoutTrainerReplies(review.messages);
        const original = Array.isArray(review.messages) ? review.messages.length : 0;
        if (!review.reply && next.length === original) continue;
        await tx
          .update(trainerReviews)
          .set({ messages: next, reply: null, repliedAt: null })
          .where(eq(trainerReviews.id, review.id));
      }
    }
    if (conversationIds.length) {
      await tx.delete(conversations).where(inArray(conversations.id, conversationIds));
    }
    if (profileIds.length) {
      await tx.delete(blockedPairs).where(
        or(eq(blockedPairs.userId, user.id), inArray(blockedPairs.trainerProfileId, profileIds)),
      );
    } else {
      await tx.delete(blockedPairs).where(eq(blockedPairs.userId, user.id));
    }
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id));
    const otpMatch = userPhone
      ? or(eq(authOtpChallenges.userId, user.id), belarusPhoneEquals(authOtpChallenges.phone, userPhone))
      : eq(authOtpChallenges.userId, user.id);
    await tx.delete(authOtpChallenges).where(otpMatch);

    for (const profile of profiles) {
      const claimToken = randomBytes(32).toString("base64url");
      await tx
        .update(trainerProfiles)
        .set({
          status: "archived",
          claimStatus: "claimed",
          firstName: "",
          lastName: "",
          fullName: "",
          gender: "",
          headline: "",
          bio: "",
          sourceBio: "",
          about: [],
          pinnedPosts: [],
          sports: [],
          primarySport: null,
          audiences: [],
          formats: [],
          city: "",
          citySlug: "",
          district: "",
          trainingPlaces: [],
          address: null,
          addressLat: null,
          addressLng: null,
          geocodeStatus: null,
          priceFrom: null,
          languages: [],
          avatarPath: "",
          photos: [],
          certificates: [],
          phone: "",
          email: "",
          emailVerifiedAt: null,
          website: "",
          instagramUrl: "",
          telegram: "",
          telegramVerifiedAt: null,
          experienceYears: 0,
          claimToken,
          claimPath: `/trainers/claim/${claimToken}`,
          previewToken: null,
          editToken: null,
          sourceUrl: `${SITE_ORIGIN}/trainers/${profile.slug}`,
          updatedAt: new Date(),
        })
        .where(eq(trainerProfiles.id, profile.id));
    }

    await tx
      .update(users)
      .set({
        email: deletedAccountEmail(user.id),
        emailVerifiedAt: null,
        phone: null,
        phoneVerifiedAt: null,
        passwordHash,
        firstName: DELETED_ACCOUNT_NAME,
        lastName: "",
        avatarPath: "",
        status: "deleted",
        telegramUserId: null,
        telegramUsername: null,
        mailMessages: false,
        mailReviews: false,
        mailSite: false,
        mailMarketing: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  });

  try {
    await Promise.all(
      [...media].map(async (relative) => {
        const absolute = absolutePublicFile(relative);
        if (absolute) await removeImageSet(absolute);
      }),
    );
    await Promise.all(conversationIds.map((id) => removeConversationFiles(id)));
  } catch (error) {
    logCaught("account", "account.delete", error, { actorUserId: user.id, target: slugs[0] ?? null });
  }

  await writeLog({
    level: "info",
    domain: "account",
    action: "account.delete",
    outcome: "success",
    message: "Аккаунт удалён.",
    subject: user.email,
    actorUserId: user.id,
    target: slugs[0] ?? null,
    context: { profiles: slugs.length, conversations: conversationIds.length },
  });
  try {
    await scrubAccountLogs(user.id, user.email, user.phone);
  } catch (error) {
    logCaught("account", "account.delete", error, { actorUserId: user.id });
  }
}
