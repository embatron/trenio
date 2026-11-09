import { randomInt } from "node:crypto";
import { unlink } from "node:fs/promises";
import path from "node:path";

import { and, desc, eq, gt, isNotNull, isNull, ne } from "drizzle-orm";

import { belarusPhoneEquals } from "@/lib/auth/phone-match";

import { getDb } from "@/db";
import {
  emailVerificationTokens,
  passwordResetTokens,
  sessions,
  trainerProfiles,
  userRoles,
  users,
  type User,
  type UserRole,
} from "@/db/schema";
import { addDays, addMinutes, generateSecureToken, hashToken } from "@/auth/tokens";
import {
  getDummyPasswordHash,
  hashPassword,
  normalizeEmail,
  upgradePasswordHash,
  validatePasswordStrength,
  verifyPassword,
} from "@/auth/password";
import { issueOtp, verifyOtp } from "@/auth/otp";
import { consumeRateLimit } from "@/auth/rate-limit";
import { issueLoginTicket } from "@/auth/login-ticket";
import { acceptTelegramContact, acceptTelegramWebApp, acceptTelegramWidget } from "@/auth/telegram-accept";
import { authMac, authMacEqual } from "@/auth/otp";
import { consumeStepUpGrant } from "@/auth/step-up";
import { isSmsByEnabled, sendQuickSms } from "@/auth/sms";
import { openManualTrainerAccountSafely } from "@/lib/catalog/trainer-account";
import {
  planTrainerPhoneOnly,
  planTrainerTelegramConfirm,
  type TelegramPhoneAction,
} from "@/lib/catalog/trainer-contact-cross";
import { cleanTelegramUsername, decideTelegramBind } from "@/lib/auth/telegram-link";
import { AuthError } from "@/lib/auth/errors";
import { GOD_USER_ID, GOD_EMAIL, isGodLogin, isGodUser } from "@/lib/auth/god";
import { parseTelegramHandle } from "@/lib/catalog/trainer-welcome";
import { mailboxForNick, resolveAccountLogin } from "@/lib/auth/login-name";
import { writeImageSet } from "@/lib/images/store";
import {
  normalizeBelarusMobile,
  OTP_CODE_LENGTH,
  storedBelarusPhone,
  validateBelarusMobile,
} from "@/lib/auth/phone";
import { markTelegramBotSeenForUser } from "@/lib/telegram/bot-seen";
import { sendNewBrowserNotice } from "@/lib/mail/account-notices";
import { isNewBrowserLogin } from "@/lib/mail/notice-rules";
import { parseUserWelcome } from "@/lib/site-texts/defaults";
import { loadSiteText } from "@/lib/site-texts/store";
import { renderLetter } from "@/lib/mail/letter";
import type { MailKind } from "@/lib/mail/kinds";
import { mailTransportReady, sendMail } from "@/lib/mail/send.server";
import { signupRoleToIntent, type PublicSignupRole } from "@/lib/auth/roles";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { staffTotpAtLogin } from "@/lib/auth/staff-totp";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { writeLog, logCaught } from "@/lib/log/logger";

export type SessionUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  avatarPath: string;
  emailVerified: boolean;
  roles: UserRole[];
  status: User["status"];
  lastSignupIntent: User["lastSignupIntent"];
  mailMessages: boolean;
  mailReviews: boolean;
  mailSite: boolean;
  mailMarketing: boolean;
  pushMessages: boolean;
  telegramLinked: boolean;
  telegramUsername: string | null;
  /** Short Instagram link created the account and the trainer has not chosen a password yet. */
  needsPassword: boolean;
  /** The person has typed a password. Google-only and unfinished magic-link accounts stay false. */
  hasPassword: boolean;
  totpEnabled: boolean;
};

/** Face and public nick for the header. The nick is the Instagram handle. */
export async function trainerHeaderFace(
  userId: string,
): Promise<{ avatarPath: string; nick: string } | null> {
  const [row] = await getDb()
    .select({
      handle: trainerProfiles.instagramHandle,
      slug: trainerProfiles.slug,
      avatarPath: trainerProfiles.avatarPath,
      photos: trainerProfiles.photos,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!row) return null;
  const photo = (row.photos[0] || row.avatarPath || "").split("?")[0];
  const handle = row.handle.startsWith("self") ? "" : row.handle;
  return { avatarPath: photo, nick: handle || row.slug };
}

function versionedAvatar(path: string, updatedAt: Date) {
  const clean = path.split("?")[0];
  if (!clean) return "";
  return `${clean}?v=${updatedAt.getTime()}`;
}

function toSessionUser(user: User, roles: UserRole[]): SessionUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarPath: versionedAvatar(user.avatarPath ?? "", user.updatedAt),
    emailVerified: user.emailVerifiedAt != null,
    roles,
    status: user.status,
    lastSignupIntent: user.lastSignupIntent,
    mailMessages: user.mailMessages,
    mailReviews: user.mailReviews,
    mailSite: user.mailSite,
    mailMarketing: user.mailMarketing,
    pushMessages: user.pushMessages,
    telegramLinked: user.telegramUserId != null,
    telegramUsername: user.telegramUsername,
    needsPassword: user.needsPassword && !user.googleSub && !user.yandexSub,
    hasPassword: user.passwordSetAt != null,
    totpEnabled: user.totpEnabledAt != null,
  };
}

async function getUserRoles(userId: string): Promise<UserRole[]> {
  if (isGodUser(userId)) return ["superadmin", "admin"];
  const db = getDb();
  const rows = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(eq(userRoles.userId, userId));
  return rows.map((row) => row.role);
}

export async function assertUserCanAuthenticate(user: User) {
  if (isGodUser(user.id)) return;
  if (user.status === "suspended") {
    const limit = await consumeRateLimit(`notice:suspended:${user.id}`, 60 * 60_000, 1);
    if (limit.ok && user.email && !isPendingSignupEmail(user.email)) {
      const letter = renderLetter({
        service: true,
        title: "Аккаунт заблокирован",
        person: {
          name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Ваш аккаунт",
          avatarUrl: user.avatarPath,
        },
        lines: ["Вход не выполнен: аккаунт заблокирован. Если это были вы, напишите в поддержку."],
      });
      void sendMail({
        to: [user.email],
        subject: "Аккаунт trenio.by заблокирован",
        text: letter.text,
        html: letter.html,
      }).catch(() => undefined);
    }
    throw new AuthError("Неверный логин или пароль.", "INVALID_CREDENTIALS");
  }
  if (user.status === "deleted") {
    throw new AuthError("Неверный e-mail или пароль.", "INVALID_CREDENTIALS");
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const db = getDb();
  const normalized = normalizeEmail(email);
  const [user] = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
  return user ?? null;
}

/** Email matches `users.email`. A nick matches the trainer card address. */
export async function findUserByLogin(value: string): Promise<User | null> {
  if (isGodLogin(value)) {
    const owner = await findUserById(GOD_USER_ID);
    if (owner) return owner;
  }
  const aliased = mailboxForNick(value);
  if (aliased) {
    const byNick = await findUserByEmail(aliased);
    if (byNick) return byNick;
  }
  const login = resolveAccountLogin(value);
  const direct = await findUserByEmail(login);
  if (direct) return direct;
  const nick = login.endsWith("@nick.trenio.by") ? login.slice(0, -"@nick.trenio.by".length) : "";
  if (!nick) return null;
  const [profile] = await getDb()
    .select({ ownerUserId: trainerProfiles.ownerUserId })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.slug, nick))
    .limit(1);
  if (!profile?.ownerUserId) return null;
  return findUserById(profile.ownerUserId);
}

export async function findUserById(userId: string): Promise<User | null> {
  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return user ?? null;
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null; remember?: boolean },
) {
  const db = getDb();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addDays(new Date(), 21);
  const incomingAgent = meta?.userAgent?.trim() ?? "";
  const live = incomingAgent
    ? await db
        .select({ userAgent: sessions.userAgent })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    : [];

  await db.insert(sessions).values({
    userId,
    tokenHash,
    expiresAt,
    ipAddress: meta?.ipAddress ?? null,
    userAgent: meta?.userAgent ?? null,
  });

  await db
    .update(users)
    .set({ lastLoginAt: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId));

  if (isNewBrowserLogin({ incomingUserAgent: incomingAgent, liveUserAgents: live.map((row) => row.userAgent ?? "") })) {
    const [person] = await db
      .select({ email: users.email, emailVerifiedAt: users.emailVerifiedAt })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (person) {
      void sendNewBrowserNotice({
        email: person.email,
        emailVerifiedAt: person.emailVerifiedAt,
        actorUserId: userId,
      });
    }
  }

  return { token: rawToken, expiresAt };
}

export async function beginLogin(
  user: User,
  meta?: { ipAddress?: string | null; userAgent?: string | null; remember?: boolean },
): Promise<{ token: string } | { totpTicket: string }> {
  const roles = await getUserRoles(user.id);
  if (staffTotpAtLogin(roles, user.totpEnabledAt != null)) {
    return { totpTicket: await issueLoginTicket(user.id) };
  }
  const session = await createSession(user.id, meta);
  return { token: session.token };
}

export async function revokeOtherUserSessions(userId: string, currentToken: string | null) {
  if (!currentToken) {
    await revokeAllUserSessions(userId);
    return;
  }
  await getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashToken(currentToken))));
}

export async function revokeSessionByToken(rawToken: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(rawToken)));
}

export async function revokeAllUserSessions(userId: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function listAccountSessions(userId: string, currentToken: string | null) {
  const rows = await getDb()
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      tokenHash: sessions.tokenHash,
    })
    .from(sessions)
    .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, new Date())))
    .orderBy(desc(sessions.createdAt));
  const currentHash = currentToken ? hashToken(currentToken) : null;
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    ip: row.ipAddress,
    userAgent: row.userAgent,
    current: row.tokenHash === currentHash,
  }));
}

export async function revokeAccountSession(userId: string, sessionId: string, currentToken: string | null) {
  const [row] = await getDb()
    .select({ tokenHash: sessions.tokenHash })
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  if (!row) return { ok: true as const, current: false };
  await getDb().delete(sessions).where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)));
  const current = currentToken != null && hashToken(currentToken) === row.tokenHash;
  return { ok: true as const, current };
}

export async function changeAccountPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  currentToken: string | null,
) {
  const user = await findUserById(userId);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");

  const limit = await consumeRateLimit(`password-change:${userId}`, 15 * 60_000, 8);
  if (!limit.ok) {
    throw new AuthError("Слишком много попыток. Подождите и попробуйте снова.", "RATE_LIMITED");
  }

  const chosen = user.passwordSetAt != null;
  if (chosen) {
    if (!currentPassword) throw new AuthError("Введите текущий пароль.", "VALIDATION");
    const matches = await verifyPassword(currentPassword, user.passwordHash);
    if (!matches) throw new AuthError("Неверный текущий пароль.", "INVALID_CREDENTIALS");
    if (currentPassword === newPassword) {
      throw new AuthError("Новый пароль должен отличаться от текущего.", "VALIDATION");
    }
  }

  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");

  const now = new Date();
  await getDb()
    .update(users)
    .set({
      passwordHash: await hashPassword(newPassword),
      passwordSetAt: now,
      needsPassword: false,
      updatedAt: now,
    })
    .where(eq(users.id, userId));

  if (currentToken) {
    await getDb()
      .delete(sessions)
      .where(and(eq(sessions.userId, userId), ne(sessions.tokenHash, hashToken(currentToken))));
  } else {
    await revokeAllUserSessions(userId);
  }

  void notifyFactorChange(user, "Пароль изменён. Если это были не вы, напишите в поддержку.");
  return { ok: true as const, message: "Пароль изменён." };
}

export async function setAccountAvatar(userId: string, dataUrl: string) {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) throw new AuthError("Выберите изображение JPEG, PNG или WebP.", "VALIDATION");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (buffer.length < 32 || buffer.length > 1_500_000) {
    throw new AuthError("Фото должно быть меньше 1,5 МБ.", "VALIDATION");
  }
  const relative = `/avatars/${userId}.jpg`;
  await writeImageSet(buffer, path.join(process.cwd(), "public", relative), "centre", "later");
  await Promise.all(
    ["png", "webp"].map((ext) =>
      unlink(path.join(process.cwd(), "public", "avatars", `${userId}.${ext}`)).catch(
        () => undefined,
      ),
    ),
  );
  await getDb()
    .update(users)
    .set({ avatarPath: relative, updatedAt: new Date() })
    .where(eq(users.id, userId));
  return {
    ok: true as const,
    avatarPath: `${relative}?v=${Date.now()}`,
    message: "Фото обновлено.",
  };
}

export async function findValidSession(rawToken: string): Promise<SessionUser | null> {
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)))
    .limit(1);

  if (!session) return null;

  const user = await findUserById(session.userId);
  if (!user) {
    await db.delete(sessions).where(eq(sessions.id, session.id));
    return null;
  }

  if (user.status === "suspended" || user.status === "deleted") {
    await revokeAllUserSessions(user.id);
    return null;
  }

  const roles = await getUserRoles(user.id);
  return toSessionUser(user, roles);
}

export async function loginUser(input: {
  email: string;
  password: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  remember?: boolean;
}) {
  const user = await findUserByLogin(input.email);
  const hashToCheck = user?.passwordHash ?? (await getDummyPasswordHash());
  const passwordMatches = await verifyPassword(input.password, hashToCheck);

  if (!user || !passwordMatches) {
    if (isGodLogin(input.email)) {
      void writeLog({
        level: "warn",
        domain: "auth",
        action: "auth.login",
        outcome: "denied",
        message: "Отказ входа владельца.",
        subject: GOD_EMAIL,
      });
    }
    throw new AuthError("Неверный логин или пароль.", "INVALID_CREDENTIALS");
  }

  await upgradePasswordHash(user.id, input.password, user.passwordHash);

  if (user.status === "deleted") {
    const { resolveDeletedLogin } = await import("@/lib/account/delete-account");
    const decision = await resolveDeletedLogin(user);
    if (decision === "restore") {
      return { restore: true as const, userId: user.id, email: user.email };
    }
    throw new AuthError("Неверный логин или пароль.", "INVALID_CREDENTIALS");
  }

  if (!user.emailVerifiedAt && user.status === "pending_verification") {
    throw new AuthError("Неверный логин или пароль.", "INVALID_CREDENTIALS");
  }

  await assertUserCanAuthenticate(user);
  return beginLogin(user, {
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    remember: input.remember,
  });
}

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  signupRole: PublicSignupRole;
}) {
  const db = getDb();
  const email = normalizeEmail(input.email);
  const rawPhone = input.phone?.trim() ?? "";
  const phone = rawPhone ? storedBelarusPhone(rawPhone) : null;
  if (rawPhone && !phone) {
    throw new AuthError(
      validateBelarusMobile(rawPhone) ?? "Укажите мобильный номер РБ.",
      "VALIDATION",
    );
  }

  const passwordError = validatePasswordStrength(input.password);
  if (passwordError) {
    throw new AuthError(passwordError, "WEAK_PASSWORD");
  }

  if (await findUserByEmail(email)) {
    throw new AuthError("Аккаунт с таким e-mail уже существует.", "EMAIL_TAKEN");
  }

  if (phone) {
    const digits = normalizeBelarusMobile(phone);
    const [existingPhone] = digits
      ? await db.select().from(users).where(belarusPhoneEquals(users.phone, digits)).limit(1)
      : [];
    if (existingPhone) {
      throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");
    }
  }

  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  if (!firstName) throw new AuthError("Укажите имя.", "VALIDATION");
  if (!lastName) throw new AuthError("Укажите фамилию.", "VALIDATION");

  const passwordHash = await hashPassword(input.password);
  const intent = signupRoleToIntent(input.signupRole);

  const [user] = await db
    .insert(users)
    .values({
      email,
      phone,
      passwordHash,
      passwordSetAt: new Date(),
      firstName,
      lastName,
      status: "pending_verification",
      lastSignupIntent: intent,
    })
    .returning();

  await db.insert(userRoles).values({
    userId: user.id,
    role: input.signupRole,
  });

  if (input.signupRole === "trainer") {
    const { sendTrainerWelcome } = await import("@/lib/messages/welcome");
    await sendTrainerWelcome({ id: user.id, firstName });
  }

  const verification = await issueEmailVerification(user.id);
  const userLetter = input.signupRole === "user"
    ? parseUserWelcome(await loadSiteText("user_welcome"))
    : null;
  const verifyLetter = renderLetter({
    service: true,
    title: userLetter?.title ?? "Подтвердите почту",
    person: {
      name: [firstName, lastName].filter(Boolean).join(" ") || "Ваш аккаунт",
      avatarUrl: user.avatarPath,
    },
    lead: userLetter?.lead ?? "Остался один шаг, чтобы пользоваться trenio.by.",
    action: { href: verification.url, label: userLetter?.button ?? "Подтвердить почту" },
    note: userLetter?.note ?? "Ссылка действует сутки. Никому её не пересылайте.",
  });
  await sendMail({
    to: [email],
    subject: userLetter?.subject ?? "Подтвердите почту trenio.by",
    text: verifyLetter.text,
    html: verifyLetter.html,
  });

  return user;
}

export async function issueEmailVerification(userId: string) {
  const db = getDb();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = addDays(new Date(), 1);

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const url = `${getAppUrl()}/auth/verify-email?token=${encodeURIComponent(rawToken)}`;
  return { token: rawToken, url, expiresAt };
}

/** Signup proof. Older unused proofs for this account are closed first. */
export async function issueSignupEmailProof(userId: string) {
  const db = getDb();
  const now = new Date();
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.usedAt),
        isNull(emailVerificationTokens.pendingEmail),
      ),
    );
  const proof = await issueEmailVerification(userId);
  proof.url = `${getAppUrl()}/auth/confirm-email?token=${encodeURIComponent(proof.token)}`;
  return proof;
}

export async function confirmSignupEmailToken(
  rawToken: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const userId = await verifyEmailToken(rawToken);
  const user = await findUserById(userId);
  if (!user) throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  if (user.lastSignupIntent === "trainer_create") await openManualTrainerAccountSafely(user);
  return beginLogin(user, meta);
}

export async function verifyEmailToken(rawToken: string) {
  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, now),
        isNull(emailVerificationTokens.usedAt),
      ),
    )
    .limit(1);

  if (!tokenRow || tokenRow.pendingEmail) {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  }

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, tokenRow.id));

  await db
    .update(users)
    .set({
      emailVerifiedAt: now,
      status: "active",
      updatedAt: now,
    })
    .where(eq(users.id, tokenRow.userId));

  return tokenRow.userId;
}

export async function setPasswordFromEmailLink(
  rawToken: string,
  newPassword: string,
  meta?: { ipAddress?: string | null; userAgent?: string | null },
) {
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) throw new AuthError(passwordError, "WEAK_PASSWORD");

  const db = getDb();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const [tokenRow] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        gt(emailVerificationTokens.expiresAt, now),
        isNull(emailVerificationTokens.usedAt),
      ),
    )
    .limit(1);

  if (!tokenRow || tokenRow.pendingEmail) {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  }

  const [owner] = await db
    .select({ status: users.status })
    .from(users)
    .where(eq(users.id, tokenRow.userId))
    .limit(1);
  if (!owner || owner.status === "deleted" || owner.status === "suspended") {
    throw new AuthError("Ссылка недействительна или устарела.", "INVALID_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, tokenRow.id));
  await db
    .update(users)
    .set({
      passwordHash,
      passwordSetAt: now,
      emailVerifiedAt: now,
      status: "active",
      updatedAt: now,
    })
    .where(eq(users.id, tokenRow.userId));

  await revokeAllUserSessions(tokenRow.userId);
  return createSession(tokenRow.userId, meta);
}

export async function requestPasswordReset(email: string) {
  const user = await findUserByEmail(email);
  if (user) {
    const reset = await issuePasswordReset(user.id);
    const letter = renderLetter({
      service: true,
      title: "Сброс пароля",
      person: {
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Ваш аккаунт",
        avatarUrl: user.avatarPath,
      },
      lead: "Вы запросили новый пароль на trenio.by.",
      action: { href: reset.url, label: "Задать новый пароль" },
      note: "Ссылка действует 30 минут. Никому её не пересылайте.",
    });
    await sendMail({
      to: [user.email],
      subject: "Сброс пароля trenio.by",
      text: letter.text,
      html: letter.html,
    });
  }
  return { ok: true as const };
}

export async function issuePasswordReset(userId: string) {
  const db = getDb();
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const now = new Date();
  const expiresAt = addMinutes(now, 30);

  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)));

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  const url = `${getAppUrl()}/auth/reset-password?token=${encodeURIComponent(rawToken)}`;
  return { token: rawToken, url, expiresAt };
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const db = getDb();
  const passwordError = validatePasswordStrength(newPassword);
  if (passwordError) {
    throw new AuthError(passwordError, "WEAK_PASSWORD");
  }

  const tokenHash = hashToken(rawToken);
  const now = new Date();

  const [tokenRow] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        gt(passwordResetTokens.expiresAt, now),
        isNull(passwordResetTokens.usedAt),
      ),
    )
    .limit(1);

  if (!tokenRow) {
    throw new AuthError("Ссылка недействительна или устарела.", "EXPIRED_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);

  await db
    .update(passwordResetTokens)
    .set({ usedAt: now })
    .where(eq(passwordResetTokens.id, tokenRow.id));

  await db.update(users).set({ passwordHash, passwordSetAt: now, needsPassword: false, updatedAt: now }).where(eq(users.id, tokenRow.userId));

  await revokeAllUserSessions(tokenRow.userId);

  return { ok: true as const };
}

function emailCode(): string {
  const max = 10 ** OTP_CODE_LENGTH;
  const min = 10 ** (OTP_CODE_LENGTH - 1);
  return String(randomInt(min, max));
}

export async function requestAccountEmailCode(userId: string, emailRaw: string, stepUpToken: string) {
  await consumeStepUpGrant(userId, stepUpToken);
  const email = normalizeEmail(emailRaw);
  const user = await findUserById(userId);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
  if (email === user.email && user.emailVerifiedAt) {
    const db = getDb();
    await db
      .update(trainerProfiles)
      .set({ email, emailVerifiedAt: user.emailVerifiedAt, updatedAt: new Date() })
      .where(eq(trainerProfiles.ownerUserId, userId));
    return { ok: true as const, already: true, message: "Почта уже подтверждена." };
  }

  const taken = await findUserByEmail(email);
  if (taken && taken.id !== userId) {
    throw new AuthError("Этот e-mail уже занят.", "EMAIL_TAKEN");
  }

  const limit = await consumeRateLimit(`email-confirm:${userId}`, 60_000, 1);
  if (!limit.ok) {
    throw new AuthError(
      `Код можно отправить снова через ${limit.retryAfterSec} с.`,
      "RATE_LIMITED",
    );
  }

  const db = getDb();
  const now = new Date();
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.usedAt),
        isNotNull(emailVerificationTokens.pendingEmail),
      ),
    );

  const code = emailCode();
  await db.insert(emailVerificationTokens).values({
    userId,
    pendingEmail: email,
    tokenHash: authMac(`email:${userId}:${email}:${code}`),
    expiresAt: addMinutes(now, 10),
  });

  const [account] = await db
    .select({ firstName: users.firstName, lastName: users.lastName, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const letter = renderLetter({
    service: true,
    title: "Код подтверждения почты",
    person: {
      name: [account?.firstName, account?.lastName].filter(Boolean).join(" ") || "Ваш аккаунт",
      avatarUrl: account?.avatarPath,
    },
    code,
    lines: ["Он действует 10 минут. Никому не сообщайте."],
  });
  await sendMail({
    to: [email],
    subject: "Код подтверждения trenio.by",
    text: letter.text,
    html: letter.html,
  });

  const delivered = mailTransportReady();
  return {
    ok: true as const,
    already: false,
    message: "Код отправлен на почту.",
    devCode: !delivered && process.env.NODE_ENV !== "production" ? code : undefined,
  };
}

export async function confirmAccountEmailCode(
  userId: string,
  emailRaw: string,
  codeRaw: string,
  currentToken: string | null,
) {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  const limit = await consumeRateLimit(`email-confirm-try:${userId}`, 15 * 60_000, 5);
  if (!limit.ok) {
    throw new AuthError("Слишком много попыток. Подождите и попробуйте снова.", "RATE_LIMITED");
  }

  const db = getDb();
  const now = new Date();
  const matched = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, userId),
          eq(emailVerificationTokens.pendingEmail, email),
          isNull(emailVerificationTokens.usedAt),
          gt(emailVerificationTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(emailVerificationTokens.createdAt))
      .limit(1)
      .for("update");
    if (!row || row.attemptCount >= 5) return null;
    await tx
      .update(emailVerificationTokens)
      .set({ attemptCount: row.attemptCount + 1 })
      .where(eq(emailVerificationTokens.id, row.id));
    if (!authMacEqual(authMac(`email:${userId}:${email}:${code}`), row.tokenHash)) return null;
    return row;
  });

  if (!matched) {
    throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");
  }

  const taken = await findUserByEmail(email);
  if (taken && taken.id !== userId) {
    throw new AuthError("Этот e-mail уже занят.", "EMAIL_TAKEN");
  }

  const previous = await findUserById(userId);
  await db
    .update(emailVerificationTokens)
    .set({ usedAt: now })
    .where(eq(emailVerificationTokens.id, matched.id));
  await db
    .update(users)
    .set({ email, emailVerifiedAt: now, status: "active", updatedAt: now })
    .where(eq(users.id, userId));
  await db
    .update(trainerProfiles)
    .set({ email, emailVerifiedAt: now, updatedAt: now })
    .where(eq(trainerProfiles.ownerUserId, userId));
  await revokeOtherUserSessions(userId, currentToken);
  if (previous) {
    void notifyFactorChange(previous, "Почта аккаунта изменена. Если это не вы, напишите в поддержку.");
  }

  return { ok: true as const, message: "Почта подтверждена." };
}

export async function requestAccountPhoneCode(
  userId: string,
  phoneRaw: string,
  stepUpToken: string | null,
  options?: { skipStepUp?: boolean },
) {
  const phoneError = validateBelarusMobile(phoneRaw);
  if (phoneError) throw new AuthError(phoneError, "VALIDATION");
  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) throw new AuthError("Укажите мобильный номер РБ.", "VALIDATION");

  const stored = storedBelarusPhone(phone);
  if (!stored) throw new AuthError("Укажите мобильный номер РБ.", "VALIDATION");
  const db = getDb();
  const user = await findUserById(userId);
  if (!user) throw new AuthError("Требуется авторизация.", "UNAUTHORIZED");
  if (normalizeBelarusMobile(user.phone ?? "") === phone && user.phoneVerifiedAt) {
    return { ok: true as const, already: true, message: "Телефон уже подтверждён." };
  }
  if (!options?.skipStepUp) {
    if (!stepUpToken) throw new AuthError("Сначала подтвердите, что это вы.", "FORBIDDEN");
    await consumeStepUpGrant(userId, stepUpToken);
  }

  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(belarusPhoneEquals(users.phone, phone), ne(users.id, userId)))
    .limit(1);
  if (owner) throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");

  const ipLimit = await consumeRateLimit(`otp:user:${userId}`, 60_000, 1);
  if (!ipLimit.ok) {
    throw new AuthError(
      `Код можно отправить снова через ${ipLimit.retryAfterSec} с.`,
      "RATE_LIMITED",
    );
  }

  const issued = await issueOtp({ phone, purpose: "verify_phone", userId, send: true });
  if (!issued.ok) {
    throw new AuthError(
      issued.error,
      issued.code === "rate_limited" ? "RATE_LIMITED" : "VALIDATION",
    );
  }

  return {
    ok: true as const,
    already: false,
    message: "Код отправлен по SMS.",
    retryAfterSec: issued.retryAfterSec,
    devCode: isSmsByEnabled() ? undefined : issued.devCode,
  };
}

export async function confirmAccountPhoneCode(
  userId: string,
  phoneRaw: string,
  codeRaw: string,
  currentToken: string | null,
) {
  const phone = normalizeBelarusMobile(phoneRaw);
  if (!phone) throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");

  const verified = await verifyOtp({ phone, purpose: "verify_phone", code: codeRaw });
  if (!verified.ok || (verified.userId && verified.userId !== userId)) {
    throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");
  }

  const stored = storedBelarusPhone(phone);
  if (!stored) throw new AuthError("Неверный или устаревший код.", "INVALID_TOKEN");
  const db = getDb();
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(belarusPhoneEquals(users.phone, phone), ne(users.id, userId)))
    .limit(1);
  if (owner) throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");

  const previous = await findUserById(userId);
  const now = new Date();
  await db
    .update(users)
    .set({ phone: stored, phoneVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, userId));
  await db
    .update(trainerProfiles)
    .set({ phone: stored, updatedAt: now })
    .where(eq(trainerProfiles.ownerUserId, userId));
  await revokeOtherUserSessions(userId, currentToken);
  if (previous) {
    void notifyFactorChange(previous, "Телефон аккаунта изменён. Если это не вы, напишите в поддержку.");
  }

  return { ok: true as const, message: "Телефон подтверждён." };
}

export async function requestTrainerContactEmailCode(userId: string, emailRaw: string, stepUpToken: string) {
  return requestAccountEmailCode(userId, emailRaw, stepUpToken);
}

export async function confirmTrainerContactEmailCode(
  userId: string,
  emailRaw: string,
  codeRaw: string,
  currentToken: string | null,
) {
  return confirmAccountEmailCode(userId, emailRaw, codeRaw, currentToken);
}

function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 4 && current; depth += 1) {
    if (typeof current === "object" && current && "code" in current && (current as { code?: string }).code === "23505") {
      return true;
    }
    current = typeof current === "object" && current && "cause" in current ? (current as { cause?: unknown }).cause : null;
  }
  return false;
}

async function markMatchingTrainerTelegram(userId: string, username: string | null, now: Date) {
  const handle = username ? parseTelegramHandle(username) : null;
  if (!handle) return false;
  const db = getDb();
  const [profile] = await db
    .select({ id: trainerProfiles.id, telegram: trainerProfiles.telegram, telegramVerifiedAt: trainerProfiles.telegramVerifiedAt })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  const saved = profile ? parseTelegramHandle(profile.telegram) : null;
  if (!profile || !saved || saved.toLowerCase() !== handle.toLowerCase()) return false;
  if (profile.telegramVerifiedAt) return true;
  await db
    .update(trainerProfiles)
    .set({ telegramVerifiedAt: now, updatedAt: now })
    .where(eq(trainerProfiles.id, profile.id));
  return true;
}

export async function bindTelegramLogin(
  userId: string,
  incomingId: number,
  usernameRaw: string | undefined,
  stepUpToken: string,
  currentToken: string | null,
) {
  await consumeStepUpGrant(userId, stepUpToken);
  const db = getDb();
  const [self] = await db
    .select({ id: users.id, telegramUserId: users.telegramUserId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!self) throw new AuthError("Аккаунт недоступен.", "UNAUTHORIZED");
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.telegramUserId, incomingId))
    .limit(1);
  const decision = decideTelegramBind({
    userId,
    incomingId,
    currentId: self.telegramUserId,
    ownerId: owner?.id ?? null,
  });
  if (decision === "taken") {
    throw new AuthError("Этот Telegram уже привязан к другому аккаунту.", "VALIDATION");
  }
  if (decision === "replace-blocked") {
    throw new AuthError("К аккаунту уже привязан другой Telegram.", "VALIDATION");
  }

  const username = cleanTelegramUsername(usernameRaw);
  const now = new Date();
  if (decision === "link") {
    try {
      await db
        .update(users)
        .set({ telegramUserId: incomingId, telegramUsername: username, telegramBotSeenAt: null, updatedAt: now })
        .where(eq(users.id, userId));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new AuthError("Этот Telegram уже привязан к другому аккаунту.", "VALIDATION");
      }
      throw error;
    }
  } else if (username && username !== undefined) {
    await db.update(users).set({ telegramUsername: username, updatedAt: now }).where(eq(users.id, userId));
  }

  await markMatchingTrainerTelegram(userId, username, now);
  const previous = await findUserById(userId);
  if (decision === "link" && previous) {
    await revokeOtherUserSessions(userId, currentToken);
    void notifyFactorChange(previous, "К аккаунту привязан Telegram. Если это не вы, напишите в поддержку.");
  }
  return {
    ok: true as const,
    already: decision === "same",
    linkedAccount: decision === "link",
    telegramUsername: username ?? "",
      message: decision === "same"
      ? "Этот Telegram уже подтверждён."
      : "Telegram подтверждён.",
  };
}

export async function linkAccountTelegram(
  userId: string,
  raw: unknown,
  stepUpToken: string,
  currentToken: string | null,
) {
  const widget = await acceptTelegramWidget(raw);
  if (!widget) {
    throw new AuthError("Не удалось подтвердить Telegram.", "VALIDATION");
  }
  return bindTelegramLogin(userId, widget.id, widget.username, stepUpToken, currentToken);
}

export async function linkAccountTelegramWebApp(
  userId: string,
  initData: string,
  stepUpToken: string,
  currentToken: string | null,
) {
  const profile = await acceptTelegramWebApp(initData);
  if (!profile) throw new AuthError("Не удалось подтвердить Telegram.", "VALIDATION");
  return bindTelegramLogin(userId, profile.id, profile.username, stepUpToken, currentToken);
}

export async function unlinkAccountTelegram(userId: string, stepUpToken: string, currentToken: string | null) {
  await consumeStepUpGrant(userId, stepUpToken);
  const previous = await findUserById(userId);
  await getDb()
    .update(users)
    .set({ telegramUserId: null, telegramUsername: null, telegramBotSeenAt: null, updatedAt: new Date() })
    .where(eq(users.id, userId));
  await revokeOtherUserSessions(userId, currentToken);
  if (previous) {
    void notifyFactorChange(previous, "Telegram отвязан от аккаунта. Если это не вы, напишите в поддержку.");
  }
  return { ok: true as const, message: "Telegram отвязан." };
}

async function storeVerifiedTrainerPhone(
  userId: string,
  stored: string,
  now: Date,
  currentToken: string | null,
) {
  const digits = normalizeBelarusMobile(stored);
  if (!digits) throw new AuthError("Укажите мобильный номер РБ.", "VALIDATION");
  const previous = await findUserById(userId);
  const db = getDb();
  const [owner] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(belarusPhoneEquals(users.phone, digits), ne(users.id, userId)))
    .limit(1);
  if (owner) throw new AuthError("Этот телефон уже привязан к другому аккаунту.", "PHONE_TAKEN");
  await db
    .update(users)
    .set({ phone: stored, phoneVerifiedAt: now, updatedAt: now })
    .where(eq(users.id, userId));
  await db
    .update(trainerProfiles)
    .set({ phone: stored, updatedAt: now })
    .where(eq(trainerProfiles.ownerUserId, userId));
  const changed = !previous?.phoneVerifiedAt || normalizeBelarusMobile(previous.phone ?? "") !== digits;
  if (changed) {
    await revokeOtherUserSessions(userId, currentToken);
    if (previous) {
      void notifyFactorChange(previous, "Телефон аккаунта изменён. Если это не вы, напишите в поддержку.");
    }
  }
}

function phoneNote(action: TelegramPhoneAction, taken: boolean): { text: string; stored: boolean } {
  if (taken) return { text: " Номер из Telegram уже занят другим аккаунтом.", stored: false };
  if (action.kind === "store") return { text: " Номер из Telegram подтверждён.", stored: true };
  if (action.kind === "keep-other") return { text: " Подтверждённый телефон оставлен.", stored: false };
  return { text: "", stored: false };
}

async function applyTelegramPhone(
  userId: string,
  action: TelegramPhoneAction,
  now: Date,
  currentToken: string | null,
) {
  if (action.kind !== "store") return phoneNote(action, false);
  try {
    await storeVerifiedTrainerPhone(userId, action.phone, now, currentToken);
    return phoneNote(action, false);
  } catch (error) {
    if (error instanceof AuthError && error.code === "PHONE_TAKEN") return phoneNote(action, true);
    throw error;
  }
}

type TelegramIdentity = { id: number; username?: string; phone: string | null; acceptPhone: boolean };

async function confirmTrainerTelegramIdentity(
  userId: string,
  identity: TelegramIdentity,
  stepUpToken: string,
  currentToken: string | null,
) {
  const db = getDb();
  const [profile] = await db
    .select({
      id: trainerProfiles.id,
      telegram: trainerProfiles.telegram,
      telegramVerifiedAt: trainerProfiles.telegramVerifiedAt,
      phone: trainerProfiles.phone,
    })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  if (!profile) throw new AuthError("Сначала сохраните профиль.", "VALIDATION");
  const [account] = await db
    .select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const plan = planTrainerTelegramConfirm({
    savedTelegram: profile.telegram,
    incomingUsername: identity.username ?? null,
    currentPhone: account?.phone || profile.phone || "",
    phoneVerified: account?.phoneVerifiedAt != null,
    incomingPhone: identity.phone,
    acceptPhone: identity.acceptPhone,
  });
  if (plan.error === "missing") throw new AuthError("В Telegram нет имени пользователя.", "VALIDATION");
  if (plan.error === "mismatch") {
    throw new AuthError("Имя в Telegram не совпадает с тем, что указано в профиле.", "VALIDATION");
  }
  if (plan.decision.kind !== "write" && plan.decision.kind !== "verify") {
    throw new AuthError("Не удалось подтвердить Telegram.", "VALIDATION");
  }

  const now = new Date();
  const telegram = plan.decision.kind === "write" ? `@${plan.decision.handle}` : profile.telegram;
  const skippedPhone = identity.acceptPhone && identity.phone && plan.phone.kind === "ignore"
    ? " Номер из Telegram не является мобильным РБ."
    : "";

  let bound: { linkedAccount: boolean } | null = null;
  let blockedMessage = "";
  try {
    bound = await bindTelegramLogin(userId, identity.id, identity.username, stepUpToken, currentToken);
  } catch (error) {
    const blocked =
      error instanceof AuthError &&
      (error.message.startsWith("Этот Telegram уже привязан") ||
        error.message.startsWith("К аккаунту уже привязан"));
    if (!blocked) throw error;
    blockedMessage = error.message;
  }

  if (plan.decision.kind === "write" || !profile.telegramVerifiedAt) {
    await db
      .update(trainerProfiles)
      .set({ telegram, telegramVerifiedAt: now, updatedAt: now })
      .where(eq(trainerProfiles.id, profile.id));
  }
  if (!bound) {
    return {
      ok: true as const,
      linkedAccount: false,
      phoneStored: false,
      message: `Telegram на карточке подтверждён. ${blockedMessage}`,
    };
  }
  const phone = await applyTelegramPhone(userId, plan.phone, now, currentToken);
  const phoneText = skippedPhone || phone.text;
  const base = bound.linkedAccount
    ? "Telegram добавлен и подтверждён. Теперь им можно войти в этот аккаунт."
    : profile.telegramVerifiedAt && plan.decision.kind === "verify"
      ? "Telegram уже подтверждён."
      : "Telegram добавлен и подтверждён.";
  return { ok: true as const, linkedAccount: bound.linkedAccount, phoneStored: phone.stored, message: `${base}${phoneText}` };
}

export async function confirmTrainerTelegram(
  userId: string,
  raw: unknown,
  stepUpToken: string,
  currentToken: string | null,
) {
  const widget = await acceptTelegramWidget(raw);
  if (!widget) {
    throw new AuthError("Не удалось подтвердить Telegram.", "VALIDATION");
  }
  return confirmTrainerTelegramIdentity(
    userId,
    {
      id: widget.id,
      username: widget.username,
      phone: widget.phone_number ?? null,
      acceptPhone: Boolean(widget.phone_number),
    },
    stepUpToken,
    currentToken,
  );
}

export async function confirmTrainerTelegramWebApp(
  userId: string,
  initData: string,
  stepUpToken: string,
  currentToken: string | null,
  contactRaw?: string,
) {
  const profile = await acceptTelegramWebApp(initData);
  if (!profile) throw new AuthError("Не удалось подтвердить Telegram.", "VALIDATION");
  const contact = contactRaw?.trim() ? await acceptTelegramContact(contactRaw) : null;
  const acceptPhone = Boolean(contact && contact.userId === profile.id);
  const result = await confirmTrainerTelegramIdentity(
    userId,
    {
      id: profile.id,
      username: profile.username,
      phone: acceptPhone ? contact!.phone : null,
      acceptPhone,
    },
    stepUpToken,
    currentToken,
  );
  try {
    await markTelegramBotSeenForUser(userId, profile.id);
  } catch (error) {
    logCaught("api", "telegram.menu", error, { actorUserId: userId });
  }
  if (contactRaw?.trim() && !acceptPhone) {
    return { ...result, message: `${result.message} Номер из Telegram не принят.` };
  }
  return result;
}

export async function confirmTrainerPhoneFromTelegram(
  userId: string,
  proof: { initData?: string; widget?: unknown },
  contactRaw: string,
  stepUpToken: string,
  currentToken: string | null,
) {
  await consumeStepUpGrant(userId, stepUpToken);
  const ids: number[] = [];
  if (proof.initData?.trim()) {
    const profile = await acceptTelegramWebApp(proof.initData);
    if (!profile) throw new AuthError("Не удалось подтвердить Telegram.", "VALIDATION");
    ids.push(profile.id);
  }
  if (proof.widget) {
    const widget = await acceptTelegramWidget(proof.widget);
    if (!widget) throw new AuthError("Не удалось подтвердить Telegram.", "VALIDATION");
    ids.push(widget.id);
  }
  const contact = await acceptTelegramContact(contactRaw);
  if (!contact || ids.length === 0 || ids.some((id) => id !== contact.userId)) {
    throw new AuthError("Не удалось подтвердить номер из Telegram.", "VALIDATION");
  }

  const db = getDb();
  const [account] = await db
    .select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const [profile] = await db
    .select({ phone: trainerProfiles.phone })
    .from(trainerProfiles)
    .where(eq(trainerProfiles.ownerUserId, userId))
    .limit(1);
  const plan = planTrainerPhoneOnly({
    currentPhone: account?.phone || profile?.phone || "",
    phoneVerified: account?.phoneVerifiedAt != null,
    incomingPhone: contact.phone,
    proofMatchesContact: true,
  });
  if (plan.touchesTelegram) {
    throw new AuthError("Не удалось подтвердить номер из Telegram.", "VALIDATION");
  }
  if (plan.phone.kind === "ignore") {
    throw new AuthError("Telegram не передал мобильный номер РБ. Телефон не изменён.", "VALIDATION");
  }
  if (plan.phone.kind === "keep") return { ok: true as const, message: "Телефон уже подтверждён." };
  if (plan.phone.kind === "keep-other") return { ok: true as const, message: "Подтверждённый телефон оставлен." };
  await storeVerifiedTrainerPhone(userId, plan.phone.phone, new Date(), currentToken);
  return { ok: true as const, message: "Телефон подтверждён через Telegram." };
}

export async function updateAccountName(userId: string, firstName: string, lastName: string) {
  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  if (!trimmedFirst) {
    throw new AuthError("Укажите имя.", "VALIDATION");
  }
  if (!trimmedLast) {
    throw new AuthError("Укажите фамилию.", "VALIDATION");
  }
  const now = new Date();
  const db = getDb();
  const given = trimmedFirst.slice(0, 100);
  const family = trimmedLast.slice(0, 100);
  await db
    .update(users)
    .set({ firstName: given, lastName: family, updatedAt: now })
    .where(eq(users.id, userId));
  await db
    .update(trainerProfiles)
    .set({
      firstName: given,
      lastName: family,
      fullName: joinTrainerName(given, family),
      updatedAt: now,
    })
    .where(eq(trainerProfiles.ownerUserId, userId));
}

export async function updateMailPreference(userId: string, kind: MailKind, enabled: boolean) {
  if (kind === "site" && !enabled) {
    throw new AuthError("Служебные оповещения отключить нельзя.", "VALIDATION");
  }
  const patch = {
    messages: { mailMessages: enabled },
    reviews: { mailReviews: enabled },
    site: { mailSite: enabled },
    marketing: { mailMarketing: enabled },
  }[kind];
  await getDb()
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId));
}

export async function getSessionUserFromToken(
  rawToken: string | null,
): Promise<SessionUser | null> {
  if (!rawToken) return null;
  return findValidSession(rawToken);
}

function getAppUrl() {
  return process.env.APP_URL ?? "http://localhost:8080";
}

function notifyFactorChange(user: User, text: string) {
  if (user.emailVerifiedAt && !isPendingSignupEmail(user.email)) {
    const letter = renderLetter({
      service: true,
      title: "Изменение аккаунта",
      person: {
        name: [user.firstName, user.lastName].filter(Boolean).join(" ") || "Ваш аккаунт",
        avatarUrl: user.avatarPath,
      },
      lines: [text],
    });
    void sendMail({
      to: [user.email],
      subject: "Изменение аккаунта trenio.by",
      text: letter.text,
      html: letter.html,
    }).catch(() => undefined);
  }
  const phone = user.phoneVerifiedAt ? normalizeBelarusMobile(user.phone ?? "") : null;
  if (phone && isSmsByEnabled()) {
    void sendQuickSms(phone, `Trenio.by: ${text}`).catch(() => undefined);
  }
}

export async function buildSessionUser(userId: string): Promise<SessionUser | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  const roles = await getUserRoles(userId);
  return toSessionUser(user, roles);
}
