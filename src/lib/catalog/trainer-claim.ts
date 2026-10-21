import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { hashPassword, normalizeEmail, validatePasswordStrength } from "@/auth/password";
import { setSessionCookie } from "@/auth/session";
import { createSession } from "@/auth/service";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { OFFER_VERSION } from "@/lib/catalog/offer";
import { genderAddress, inferTrainerGender } from "@/lib/catalog/trainer-gender";
import { instagramProfileSlug } from "@/lib/catalog/trainer-slugs";

const tokenSchema = z.object({
  token: z.string().trim().min(20).max(80),
});

const claimSchema = tokenSchema.extend({
  nick: z.string().trim().min(3).max(32),
  email: z.string().trim().email("Введите корректный e-mail").max(320),
  password: z.string().min(8).max(128),
  passwordConfirm: z.string().min(8).max(128),
  offer: z.literal(true),
  privacy: z.literal(true),
});

export const getTrainerClaimFn = createServerFn({ method: "GET" })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .select({
        firstName: trainerProfiles.firstName,
        fullName: trainerProfiles.fullName,
        gender: trainerProfiles.gender,
        headline: trainerProfiles.headline,
        city: trainerProfiles.city,
        avatarPath: trainerProfiles.avatarPath,
        slug: trainerProfiles.slug,
        handle: trainerProfiles.instagramHandle,
        claimStatus: trainerProfiles.claimStatus,
        ownerUserId: trainerProfiles.ownerUserId,
        status: trainerProfiles.status,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.claimToken, data.token))
      .limit(1);
    if (!row) throw new AuthError("Ссылка не найдена или уже не действует.", "VALIDATION");
    const gender = row.gender === "male" || row.gender === "female"
      ? row.gender
      : inferTrainerGender(row.firstName, row.fullName);
    return {
      givenName: row.firstName.trim() || row.fullName.trim() || "тренер",
      addressAs: genderAddress(gender),
      fullName: row.fullName,
      headline: row.headline,
      city: row.city,
      photo: row.avatarPath,
      handle: instagramProfileSlug(row.handle),
      slug: row.slug,
      claimed: row.claimStatus === "claimed" || row.ownerUserId != null,
      published: row.status === "published",
    };
  });

export const claimTrainerProfileFn = createServerFn({ method: "POST" })
  .validator(claimSchema)
  .handler(async ({ data }) => {
    const passwordError = validatePasswordStrength(data.password);
    if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");
    const db = getDb();
    const [profile] = await db
      .select()
      .from(trainerProfiles)
      .where(eq(trainerProfiles.claimToken, data.token))
      .limit(1);
    if (!profile) throw new AuthError("Ссылка не найдена или уже не действует.", "VALIDATION");
    if (profile.status === "published") {
      throw new AuthError("Этот профиль уже опубликован. Откройте его страницу.", "VALIDATION");
    }
    if (profile.claimStatus === "claimed" || profile.ownerUserId) {
      throw new AuthError("Этот профиль уже привязан. Войдите в аккаунт.", "VALIDATION");
    }
    if (data.password !== data.passwordConfirm) {
      throw new AuthError("Пароли не совпадают.", "VALIDATION");
    }
    const handle = instagramProfileSlug(profile.instagramHandle);
    const nick = instagramProfileSlug(data.nick);
    if (nick !== handle) {
      throw new AuthError("Сменить ник можно только по запросу в поддержку.", "VALIDATION");
    }
    const email = normalizeEmail(data.email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new AuthError("Введите корректный e-mail.", "VALIDATION");
    }
    const [existingLogin] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existingLogin) throw new AuthError("Такая почта уже занята. Войдите в аккаунт.", "EMAIL_TAKEN");

    const now = new Date();
    const user = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(users)
        .values({
          email,
          passwordHash: await hashPassword(data.password),
          firstName: profile.firstName || profile.fullName || "Тренер",
          lastName: profile.lastName || null,
          status: "active",
          lastSignupIntent: "trainer_claim",
        })
        .returning();
      await tx.insert(userRoles).values({ userId: created.id, role: "trainer" });
      const updated = await tx
        .update(trainerProfiles)
        .set({
          ownerUserId: created.id,
          slug: handle,
          claimStatus: "claimed",
          claimedAt: now,
          offerAcceptedAt: now,
          privacyAcceptedAt: now,
          offerVersion: OFFER_VERSION,
          status: "draft",
          updatedAt: now,
        })
        .where(and(
          eq(trainerProfiles.id, profile.id),
          eq(trainerProfiles.claimStatus, "unclaimed"),
          isNull(trainerProfiles.ownerUserId),
        ))
        .returning({ id: trainerProfiles.id });
      if (updated.length === 0) throw new AuthError("Этот профиль уже привязан. Войдите в аккаунт.", "VALIDATION");
      return created;
    });

    const session = await createSession(user.id, { remember: true });
    setSessionCookie(session.token, true);
    return { ok: true as const };
  });
