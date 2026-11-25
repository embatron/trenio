import { randomBytes } from "node:crypto";

import { and, eq, ne, or } from "drizzle-orm";

import { hashPassword, normalizeEmail } from "@/auth/password";
import { findUserByEmail } from "@/auth/service";
import { getDb } from "@/db";
import { trainerProfiles, userRoles, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import type { ConfirmedMailbox } from "@/lib/catalog/cabinet-entry-state";
import { attachDoorProfile } from "@/lib/catalog/door-attach";
import { publishConfirmedDraft } from "@/lib/catalog/trainer-door-claim";
import { writeLog } from "@/lib/log/logger";
import { sendWelcomeOnPublish } from "@/lib/messages/welcome";

/** Staff bind: the mailbox is confirmed and a draft enters the catalog. A hidden card stays hidden. */
export async function claimConfirmedMailbox(slugOrHandle: string, rawEmail: string): Promise<ConfirmedMailbox> {
  const email = normalizeEmail(rawEmail);
  const key = slugOrHandle.trim().toLowerCase();
  const db = getDb();
  const [row] = await db
    .select()
    .from(trainerProfiles)
    .where(or(eq(trainerProfiles.slug, key), eq(trainerProfiles.instagramHandle, key)))
    .limit(1);
  if (!row) throw new AuthError("Профиль не найден.", "VALIDATION");
  if (row.status === "hidden" || row.status === "archived" || row.status === "declined") {
    throw new AuthError(row.status === "declined" ? "Тренер отказался. Ссылку не выдаю." : "Карточка скрыта. Ссылку не выдаю.", "VALIDATION");
  }

  let user = await findUserByEmail(email);
  if (user && (user.status === "deleted" || user.status === "suspended")) {
    throw new AuthError("Аккаунт закрыт.", "VALIDATION");
  }
  if (row.ownerUserId) {
    const [owner] = await db.select().from(users).where(eq(users.id, row.ownerUserId)).limit(1);
    if (!owner || normalizeEmail(owner.email) !== email) {
      throw new AuthError("Карточка привязана к другой почте.", "VALIDATION");
    }
    user = owner;
  }
  if (user) {
    const [other] = await db
      .select({ slug: trainerProfiles.slug })
      .from(trainerProfiles)
      .where(and(eq(trainerProfiles.ownerUserId, user.id), ne(trainerProfiles.id, row.id)))
      .limit(1);
    if (other) throw new AuthError(`Эта почта уже открывает карточку ${other.slug}.`, "VALIDATION");
  }

  const now = new Date();
  let created = false;
  if (!user) {
    const passwordHash = await hashPassword(randomBytes(32).toString("base64url"));
    try {
      const [inserted] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          emailVerifiedAt: now,
          firstName: row.firstName || "Тренер",
          lastName: row.lastName || null,
          status: "active",
          lastSignupIntent: "trainer_claim",
          needsPassword: true,
        })
        .returning();
      user = inserted;
      created = true;
    } catch (error) {
      user = await findUserByEmail(email);
      if (!user) throw error;
    }
  }
  if (!user) throw new AuthError("Почту не удалось привязать.", "VALIDATION");
  if (!user.emailVerifiedAt || user.status === "pending_verification") {
    await db.update(users).set({
      emailVerifiedAt: user.emailVerifiedAt ?? now,
      status: "active",
      updatedAt: now,
    }).where(eq(users.id, user.id));
    user = { ...user, emailVerifiedAt: user.emailVerifiedAt ?? now, status: "active" };
  }

  let attached = false;
  if (!row.ownerUserId) {
    await attachDoorProfile(row.id, user.id, email);
    attached = true;
  } else {
    await db.update(trainerProfiles).set({
      email,
      emailVerifiedAt: row.emailVerifiedAt ?? now,
      claimStatus: "claimed",
      claimedAt: row.claimedAt ?? now,
      updatedAt: now,
    }).where(eq(trainerProfiles.id, row.id));
    await db.insert(userRoles).values({ userId: user.id, role: "trainer" }).onConflictDoNothing();
  }

  await publishConfirmedDraft(row, { via: "staff-bind", actorUserId: user.id, subject: email });
  if (attached) {
    await sendWelcomeOnPublish({
      previous: row.status,
      next: row.status === "draft" ? "published" : row.status,
      ownerUserId: user.id,
      firstName: row.firstName,
      ownerAttached: true,
    });
    void writeLog({
      level: "info",
      domain: "account",
      action: "account.claim",
      outcome: "success",
      message: "Почта привязана и подтверждена.",
      subject: email,
      actorUserId: user.id,
      target: row.slug,
    });
  }

  const [fresh] = await db
    .select({ status: trainerProfiles.status, previewToken: trainerProfiles.previewToken })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.id, row.id))
    .limit(1);
  const previewToken = fresh?.previewToken || row.previewToken || "";
  if (!previewToken) throw new AuthError("У карточки нет короткой ссылки.", "VALIDATION");
  return {
    profileId: row.id,
    userId: user.id,
    slug: row.slug,
    email,
    name: [row.firstName, row.lastName].filter(Boolean).join(" "),
    previewToken,
    status: fresh?.status ?? row.status,
    needsPassword: Boolean(user.needsPassword && user.lastSignupIntent === "trainer_claim"),
    created,
    attached,
  };
}
