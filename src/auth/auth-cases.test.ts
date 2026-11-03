import assert from "node:assert/strict";
import { createHash, createHmac, randomInt, randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { eq, like, or } from "drizzle-orm";

import { openGoogleAccount } from "@/auth/google-account";
import { claimDoorAfterGoogle } from "@/lib/catalog/trainer-magic";
import {
  confirmPasswordResetByPhone,
  confirmSmsLogin,
  consumeForgotEmailLimit,
  consumePasswordLoginLimit,
  requestSmsLogin,
  type LoginMeta,
} from "@/auth/login-channels";
import { consumeLoginTicket } from "@/auth/login-ticket";
import { authMac, authMacEqual, issueOtp, verifyOtp } from "@/auth/otp";
import { hashPassword, verifyPassword } from "@/auth/password";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { claimProof } from "@/auth/replay";
import {
  beginLogin,
  confirmAccountEmailCode,
  confirmAccountPhoneCode,
  confirmSignupEmailToken,
  createSession,
  findUserByEmail,
  findUserById,
  findValidSession,
  issuePasswordReset,
  issueSignupEmailProof,
  listAccountSessions,
  loginUser,
  requestAccountEmailCode,
  requestAccountPhoneCode,
  resetPassword,
  revokeAccountSession,
} from "@/auth/service";
import { consumeStepUpGrant, issueStepUpGrant } from "@/auth/step-up";
import {
  confirmSignupLink,
  confirmSmsSignup,
  requestSignupLink,
  saveSignupCredentials,
  signupWithEmail,
  signupWithTelegramWebApp,
  signupWithTelegramWidget,
} from "@/auth/signup-channels";
import { acceptTelegramWebApp, acceptTelegramWidget } from "@/auth/telegram-accept";
import { verifyTelegramWidgetUser } from "@/auth/telegram";
import { verifyTelegramWebAppInitData } from "@/auth/telegram-webapp";
import { encodeBase32, recoveryHash, sealSecret, totpCode } from "@/auth/totp";
import { getDb } from "@/db";
import {
  authOtpChallenges,
  authRateBuckets,
  trainerProfiles,
  userRoles,
  users,
} from "@/db/schema";
import { accountGatePath } from "@/lib/auth/auth-decisions";
import { AuthError } from "@/lib/auth/errors";
import { readGoogleIdentity } from "@/lib/auth/google-identity";
import { pendingSignupEmail } from "@/lib/auth/pending-email";
import { storedBelarusPhone } from "@/lib/auth/phone";
import { hashToken } from "@/auth/tokens";

const PASSWORD = "CasesPass1";
const PHRASE =
  "Если этот адрес можно использовать, мы отправили письмо со ссылкой. Откройте его и подтвердите почту.";
const stamp = Date.now().toString(36);
const createdUsers: string[] = [];
const createdProfiles: string[] = [];
const createdTelegramIds: number[] = [];
const otpPhones: string[] = [];
let phoneSerial = 0;

function meta(name: string, honeypot = ""): LoginMeta {
  return {
    clientKey: `cases-${stamp}-${name}`,
    ipAddress: "127.0.0.1",
    userAgent: "auth-cases",
    honeypot,
    remember: true,
  };
}

function email(name: string): string {
  return `authcase-${stamp}-${name}@example.com`;
}

function botToken(): string {
  return process.env.TELEGRAM_LOGIN_BOT_TOKEN?.trim() || "123456:auth-cases-token";
}

function webAppQuery(authDate: number, id: number): string {
  const user = JSON.stringify({ id, first_name: "Кейс" });
  const fields: Record<string, string> = {
    auth_date: String(authDate),
    query_id: `cases-${stamp}-${id}`,
    user,
  };
  const pairs = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken()).digest();
  const hash = createHmac("sha256", secret).update(pairs).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}

function widgetUser(authDate: number, id: number) {
  const fields: Record<string, string | number> = {
    id,
    first_name: "Кейс",
    auth_date: authDate,
  };
  const pairs = Object.entries(fields)
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");
  const secret = createHash("sha256").update(botToken()).digest();
  const hash = createHmac("sha256", secret).update(pairs).digest("hex");
  return { ...fields, hash };
}

async function freePhone(): Promise<string> {
  const db = getDb();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    phoneSerial += 1;
    const tail = String((randomInt(0, 9_000_000) + phoneSerial) % 10_000_000).padStart(7, "0");
    const digits = `37529${tail}`;
    const stored = storedBelarusPhone(digits);
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.phone, digits), eq(users.phone, stored ?? digits)))
      .limit(1);
    if (!row) {
      otpPhones.push(digits);
      return digits;
    }
  }
  throw new Error("no free test phone");
}

async function insertAccount(input: {
  name: string;
  status?: "pending_verification" | "active" | "suspended" | "deleted";
  verified?: boolean;
  phone?: string | null;
  phoneVerified?: boolean;
  pendingShell?: boolean;
  role?: "user" | "admin";
  password?: string;
}) {
  const db = getDb();
  const id = randomUUID();
  const passwordHash = await hashPassword(input.password ?? PASSWORD);
  const phone = input.phone ? storedBelarusPhone(input.phone) : null;
  const [row] = await db
    .insert(users)
    .values({
      id,
      email: input.pendingShell ? pendingSignupEmail(id) : email(input.name),
      passwordHash,
      firstName: "Проверка",
      lastName: "Кейс",
      status: input.status ?? "active",
      emailVerifiedAt: input.verified === false || input.pendingShell ? null : new Date(),
      phone,
      phoneVerifiedAt: input.phoneVerified && phone ? new Date() : null,
    })
    .returning();
  await db.insert(userRoles).values({ userId: row.id, role: input.role ?? "user" });
  createdUsers.push(row.id);
  return row;
}

async function expectAuth(run: () => Promise<unknown>, code: AuthError["code"]) {
  await assert.rejects(run, (error: unknown) => error instanceof AuthError && error.code === code);
}

describe("auth cases", { concurrency: false }, () => {
  before(async () => {
    process.env.TELEGRAM_LOGIN_BOT_TOKEN = botToken();
    process.env.TELEGRAM_LOGIN_BOT_USERNAME ||= "auth_cases_bot";
    const { ensureAuthSchema } = await import("@/auth/auth-schema");
    await ensureAuthSchema();
    const db = getDb();
    await db.delete(users).where(like(users.email, "authcase-%@example.com"));
    await db.delete(trainerProfiles).where(eq(trainerProfiles.firstName, "Дверь"));
  });

  after(async () => {
    const db = getDb();
    for (const phone of otpPhones) {
      await db.delete(authOtpChallenges).where(eq(authOtpChallenges.phone, phone));
    }
    for (const id of createdProfiles) {
      await db.delete(trainerProfiles).where(eq(trainerProfiles.id, id));
    }
    for (const telegramId of createdTelegramIds) {
      await db.delete(users).where(eq(users.telegramUserId, telegramId));
    }
    for (const id of createdUsers) {
      await db.delete(users).where(eq(users.id, id));
    }
    await db.delete(users).where(like(users.email, `authcase-${stamp}-%@example.com`));
  });

  test("honeypot signup returns the same phrase and stores nothing", async () => {
    const address = email("honey");
    const result = await signupWithEmail(
      { email: address, password: PASSWORD },
      meta("honey", "filled-by-bot"),
    );
    assert.deepEqual(result, { message: PHRASE });
    assert.equal(await findUserByEmail(address), null);
  });

  test("a new email stays unverified and the response has no session", async () => {
    const address = email("new");
    const result = await signupWithEmail({ email: address, password: PASSWORD }, meta("new"));
    assert.deepEqual(result, { message: PHRASE });
    assert.equal("token" in result, false);
    const user = await findUserByEmail(address);
    assert.ok(user);
    createdUsers.push(user.id);
    assert.equal(user.status, "pending_verification");
    assert.equal(user.emailVerifiedAt, null);
    assert.equal(await verifyPassword(PASSWORD, user.passwordHash), true);
    await expectAuth(
      () => loginUser({ email: address, password: PASSWORD }),
      "INVALID_CREDENTIALS",
    );
  });

  test("repeating an unverified signup replaces the password and still does not log in", async () => {
    const address = email("refresh");
    await signupWithEmail({ email: address, password: PASSWORD }, meta("refresh-a"));
    const first = await findUserByEmail(address);
    assert.ok(first);
    createdUsers.push(first.id);
    const next = "RefreshPass2";
    const result = await signupWithEmail({ email: address, password: next }, meta("refresh-b"));
    assert.deepEqual(result, { message: PHRASE });
    const second = await findUserByEmail(address);
    assert.ok(second);
    assert.equal(second.id, first.id);
    assert.equal(second.emailVerifiedAt, null);
    assert.equal(await verifyPassword(next, second.passwordHash), true);
    assert.equal(await verifyPassword(PASSWORD, second.passwordHash), false);
  });

  test("signup of a verified address does not change the password or open a session", async () => {
    const user = await insertAccount({ name: "verified", verified: true });
    const beforeHash = user.passwordHash;
    const result = await signupWithEmail(
      { email: user.email, password: "OtherPass9" },
      meta("verified"),
    );
    assert.deepEqual(result, { message: PHRASE });
    const after = await findUserById(user.id);
    assert.equal(after?.passwordHash, beforeHash);
    assert.equal(await verifyPassword(PASSWORD, after?.passwordHash ?? ""), true);
  });

  test("a signup link verifies once and a second use fails", async () => {
    const address = email("proof");
    await signupWithEmail({ email: address, password: PASSWORD }, meta("proof"));
    const user = await findUserByEmail(address);
    assert.ok(user);
    createdUsers.push(user.id);
    const first = await issueSignupEmailProof(user.id);
    const second = await issueSignupEmailProof(user.id);
    await expectAuth(() => confirmSignupEmailToken(first.token), "INVALID_TOKEN");
    const opened = await confirmSignupEmailToken(second.token);
    assert.ok("token" in opened);
    const session = await findValidSession(opened.token);
    assert.equal(session?.id, user.id);
    const verified = await findUserById(user.id);
    assert.ok(verified?.emailVerifiedAt);
    await expectAuth(() => confirmSignupEmailToken(second.token), "INVALID_TOKEN");
  });

  test("an email-change code cannot confirm signup", async () => {
    const user = await insertAccount({ name: "codeconfuse", verified: false, status: "pending_verification" });
    const grant = await issueStepUpGrant(user.id, { password: PASSWORD });
    const next = email("codeconfuse-next");
    const issued = await requestAccountEmailCode(user.id, next, grant);
    assert.ok(issued.devCode);
    await expectAuth(() => confirmSignupEmailToken(issued.devCode ?? ""), "INVALID_TOKEN");
    const confirmed = await confirmAccountEmailCode(user.id, next, issued.devCode ?? "", null);
    assert.equal(confirmed.ok, true);
    const row = await findUserById(user.id);
    assert.equal(row?.email, next);
    assert.ok(row?.emailVerifiedAt);
  });

  test("Google replaces an unverified password row and refuses a different verified Google id", async () => {
    const address = email("google");
    await signupWithEmail({ email: address, password: PASSWORD }, meta("google"));
    const user = await findUserByEmail(address);
    assert.ok(user);
    createdUsers.push(user.id);
    const oldSession = await createSession(user.id);
    const taken = await openGoogleAccount(
      { sub: `sub-${stamp}`, email: address, name: "Гугл" },
      null,
      {},
    );
    assert.equal(taken.kind, "session");
    assert.equal(await findValidSession(oldSession.token), null);
    const linked = await findUserById(user.id);
    assert.equal(linked?.googleSub, `sub-${stamp}`);
    assert.ok(linked?.emailVerifiedAt);
    assert.equal(await verifyPassword(PASSWORD, linked?.passwordHash ?? ""), false);

    const other = await insertAccount({ name: "google-taken", verified: true });
    await getDb().update(users).set({ googleSub: "owned-sub" }).where(eq(users.id, other.id));
    const before = (await findUserById(other.id))?.passwordHash;
    const refused = await openGoogleAccount(
      { sub: "other-sub", email: other.email, name: "Чужой" },
      null,
      {},
    );
    assert.equal(refused.kind, "refuse");
    const after = await findUserById(other.id);
    assert.equal(after?.googleSub, "owned-sub");
    assert.equal(after?.passwordHash, before);
  });

  test("Google verifies the mailbox and claims an imported trainer card", async () => {
    const db = getDb();
    const address = email("google-door");
    const slug = `gdoor${stamp}`.slice(0, 30);
    const claimToken = randomUUID().replace(/-/g, "");
    const [profile] = await db
      .insert(trainerProfiles)
      .values({
        slug,
        instagramHandle: slug,
        sourceUrl: `https://instagram.com/${slug}`,
        status: "draft",
        claimStatus: "unclaimed",
        createdSource: "import",
        firstName: "Дверь",
        lastName: "Гугл",
        fullName: "Дверь Гугл",
        previewToken: `p${stamp}`.slice(0, 16),
        claimToken,
        claimPath: `/trainers/claim/${claimToken}`,
      })
      .returning();
    createdProfiles.push(profile.id);

    const opened = await openGoogleAccount(
      { sub: `sub-door-${stamp}`, email: address, name: "Гугл" },
      null,
      {},
    );
    assert.equal(opened.kind, "session");
    if (opened.kind !== "session") return;
    createdUsers.push(opened.userId);
    const claimed = await claimDoorAfterGoogle({
      userId: opened.userId,
      email: address,
      created: opened.created,
      profileId: profile.id,
      previewSlug: slug,
    });
    assert.equal(claimed, "claimed");
    const [card] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.id, profile.id)).limit(1);
    assert.equal(card?.ownerUserId, opened.userId);
    assert.equal(card?.claimStatus, "claimed");
    assert.equal(card?.email, address);
    assert.ok(card?.emailVerifiedAt);
    const owner = await findUserById(opened.userId);
    assert.ok(owner?.emailVerifiedAt);
    assert.equal(owner?.needsPassword, false);
    assert.equal(owner?.firstName, "Дверь");
    assert.equal(owner?.lastName, "Гугл");
    assert.equal(owner?.lastSignupIntent, "trainer_claim");
    const roles = await db.select({ role: userRoles.role }).from(userRoles).where(eq(userRoles.userId, opened.userId));
    assert.ok(roles.some((item) => item.role === "trainer"));

    const otherSlug = `gbusy${stamp}`.slice(0, 30);
    const otherToken = randomUUID().replace(/-/g, "");
    const [other] = await db
      .insert(trainerProfiles)
      .values({
        slug: otherSlug,
        instagramHandle: otherSlug,
        sourceUrl: `https://instagram.com/${otherSlug}`,
        status: "draft",
        claimStatus: "unclaimed",
        createdSource: "import",
        firstName: "Дверь",
        lastName: "Занята",
        fullName: "Дверь Занята",
        previewToken: `b${stamp}`.slice(0, 16),
        claimToken: otherToken,
        claimPath: `/trainers/claim/${otherToken}`,
      })
      .returning();
    createdProfiles.push(other.id);
    assert.equal(await claimDoorAfterGoogle({
      userId: opened.userId,
      email: address,
      created: false,
      profileId: other.id,
      previewSlug: otherSlug,
    }), "busy");
    const [still] = await db.select({ ownerUserId: trainerProfiles.ownerUserId }).from(trainerProfiles).where(eq(trainerProfiles.id, other.id)).limit(1);
    assert.equal(still?.ownerUserId, null);

    const owned = await insertAccount({ name: "google-card", verified: true });
    await db.update(users).set({ googleSub: `sub-card-${stamp}` }).where(eq(users.id, owned.id));
    const cardSlug = `gcard${stamp}`.slice(0, 30);
    const cardToken = randomUUID().replace(/-/g, "");
    const [ownedCard] = await db
      .insert(trainerProfiles)
      .values({
        slug: cardSlug,
        instagramHandle: cardSlug,
        sourceUrl: `https://instagram.com/${cardSlug}`,
        status: "draft",
        claimStatus: "claimed",
        createdSource: "import",
        ownerUserId: owned.id,
        firstName: "Дверь",
        lastName: "Карта",
        fullName: "Дверь Карта",
        email: "",
        claimToken: cardToken,
        claimPath: `/trainers/claim/${cardToken}`,
      })
      .returning();
    createdProfiles.push(ownedCard.id);
    const again = await openGoogleAccount(
      { sub: `sub-card-${stamp}`, email: owned.email, name: "Карта" },
      null,
      {},
    );
    assert.equal(again.kind, "session");
    const [stamped] = await db.select().from(trainerProfiles).where(eq(trainerProfiles.id, ownedCard.id)).limit(1);
    assert.equal(stamped?.email, owned.email);
    assert.ok(stamped?.emailVerifiedAt);
  });

  test("Google identity rejects an unverified mailbox, a wrong audience, and an expired token", () => {
    const now = 1_700_000_000_000;
    const base = {
      iss: "https://accounts.google.com",
      aud: "client",
      exp: now / 1000 + 60,
      email_verified: true,
      email: "person@example.com",
      sub: "abc",
      given_name: "Имя",
    };
    assert.equal(readGoogleIdentity(base, "client", now)?.email, "person@example.com");
    assert.equal(readGoogleIdentity({ ...base, email_verified: false }, "client", now), null);
    assert.equal(readGoogleIdentity({ ...base, aud: "other" }, "client", now), null);
    assert.equal(readGoogleIdentity({ ...base, exp: now / 1000 - 10 }, "client", now), null);
  });

  test("the client IP comes only from the trusted header", () => {
    assert.equal(clientIpFromHeaders("203.0.113.8"), "203.0.113.8");
    assert.equal(clientIpFromHeaders("  "), "unknown");
    assert.equal(clientIpFromHeaders("1".repeat(65)), "unknown");
    assert.equal(clientIpFromHeaders(null), "unknown");
  });

  test("password limits apply to every address, including a ninth try", async () => {
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("./login-channels.ts", import.meta.url), "utf8"),
    );
    const fn = source.slice(
      source.indexOf("export async function consumePasswordLoginLimit"),
      source.indexOf("export async function consumeForgotEmailLimit"),
    );
    assert.equal(fn.includes("isGodLogin"), false);
    const address = email("limit");
    for (let i = 0; i < 8; i += 1) {
      await consumePasswordLoginLimit(address, meta(`limit-${i}`).clientKey);
    }
    const [bucket] = await getDb()
      .select({ hitCount: authRateBuckets.hitCount })
      .from(authRateBuckets)
      .where(eq(authRateBuckets.bucketKey, `login:id:${address}`))
      .limit(1);
    assert.equal(bucket?.hitCount, 8);
    await expectAuth(
      () => consumePasswordLoginLimit(address, meta("limit-last").clientKey),
      "RATE_LIMITED",
    );
  });

  test("forgot-password is limited per mailbox, not only per IP", async () => {
    const client = meta("forgot").clientKey;
    const one = email("forgot-a");
    const two = email("forgot-b");
    for (let i = 0; i < 5; i += 1) {
      await consumeForgotEmailLimit(`${client}-${i}`, one);
    }
    await expectAuth(() => consumeForgotEmailLimit(`${client}-more`, one), "RATE_LIMITED");
    await consumeForgotEmailLimit(`${client}-other`, two);
  });

  test("an unknown phone gets the same reply and is not an instant answer", async () => {
    const phone = await freePhone();
    const started = Date.now();
    const result = await requestSmsLogin(phone, meta("sms-unknown"));
    assert.ok(Date.now() - started >= 550);
    assert.equal(result.message, "Если номер привязан к аккаунту, мы отправили код.");
    assert.equal(result.devCode, undefined);
  });

  test("a landline is refused", async () => {
    await expectAuth(() => requestSmsLogin("+375 17 123-45-67", meta("landline")), "VALIDATION");
  });

  test("a signup code cannot take a phone that was linked later", async () => {
    const phone = await freePhone();
    const issued = await issueOtp({ phone, purpose: "register", userId: null, send: false });
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    const owner = await insertAccount({ name: "phone-owner", phone, phoneVerified: true });
    await expectAuth(
      () => confirmSmsSignup(phone, issued.devCode ?? "", meta("sms-hijack")),
      "INVALID_CREDENTIALS",
    );
    const still = await findUserById(owner.id);
    assert.equal(still?.phone, storedBelarusPhone(phone));
  });

  test("a login code fails when the phone no longer belongs to that account", async () => {
    const phone = await freePhone();
    const owner = await insertAccount({ name: "sms-login", phone, phoneVerified: true });
    const issued = await issueOtp({ phone, purpose: "login", userId: owner.id, send: false });
    assert.equal(issued.ok, true);
    if (!issued.ok) return;
    await getDb().update(users).set({ phone: null, phoneVerifiedAt: null }).where(eq(users.id, owner.id));
    await expectAuth(
      () => confirmSmsLogin(phone, issued.devCode ?? "", meta("sms-moved")),
      "INVALID_CREDENTIALS",
    );
  });

  test("one OTP succeeds once, even when two checks race, and five misses burn it", async () => {
    const phone = await freePhone();
    const issued = await issueOtp({ phone, purpose: "login", userId: null, send: false });
    assert.equal(issued.ok, true);
    if (!issued.ok || !issued.devCode) return;
    const [first, second] = await Promise.all([
      verifyOtp({ phone, purpose: "login", code: issued.devCode }),
      verifyOtp({ phone, purpose: "login", code: issued.devCode }),
    ]);
    const wins = [first, second].filter((item) => item.ok);
    assert.equal(wins.length, 1);
    const again = await verifyOtp({ phone, purpose: "login", code: issued.devCode });
    assert.equal(again.ok, false);

    const burned = await issueOtp({ phone, purpose: "register", userId: null, send: false });
    assert.equal(burned.ok, true);
    if (!burned.ok || !burned.devCode) return;
    for (let i = 0; i < 5; i += 1) {
      const miss = await verifyOtp({ phone, purpose: "register", code: "000000" });
      assert.equal(miss.ok, false);
    }
    const late = await verifyOtp({ phone, purpose: "register", code: burned.devCode });
    assert.equal(late.ok, false);
  });

  test("SMS password reset revokes the old session and the email reset does not log in", async () => {
    const phone = await freePhone();
    const user = await insertAccount({ name: "reset", phone, phoneVerified: true });
    const old = await createSession(user.id);
    const issued = await issueOtp({ phone, purpose: "reset_password", userId: user.id, send: false });
    assert.equal(issued.ok, true);
    if (!issued.ok || !issued.devCode) return;
    const opened = await confirmPasswordResetByPhone(
      { phone, code: issued.devCode, password: "ResetPass2" },
      meta("reset-phone"),
    );
    assert.equal(await findValidSession(old.token), null);
    assert.ok("token" in opened);
    assert.equal(await verifyPassword("ResetPass2", (await findUserById(user.id))?.passwordHash ?? ""), true);

    const mailUser = await insertAccount({ name: "reset-mail", verified: true });
    const mailSession = await createSession(mailUser.id);
    const firstLink = await issuePasswordReset(mailUser.id);
    const secondLink = await issuePasswordReset(mailUser.id);
    await expectAuth(() => resetPassword(firstLink.token, "MailPass3"), "EXPIRED_TOKEN");
    const done = await resetPassword(secondLink.token, "MailPass3");
    assert.deepEqual(done, { ok: true });
    assert.equal("token" in done, false);
    assert.equal(await findValidSession(mailSession.token), null);
  });

  test("a suspended login uses the same phrase as a wrong password", async () => {
    const user = await insertAccount({ name: "suspended", status: "suspended", verified: true });
    await expectAuth(
      () => loginUser({ email: user.email, password: PASSWORD }),
      "INVALID_CREDENTIALS",
    );
  });

  test("email codes are HMAC and an old unsalted hash does not match", async () => {
    const user = await insertAccount({ name: "hmac", verified: true });
    const grant = await issueStepUpGrant(user.id, { password: PASSWORD });
    const next = email("hmac-next");
    const issued = await requestAccountEmailCode(user.id, next, grant);
    assert.ok(issued.devCode);
    const mac = authMac(`email:${user.id}:${next}:${issued.devCode}`);
    const unsalted = createHash("sha256").update(`${user.id}:${issued.devCode}`).digest("hex");
    assert.equal(authMacEqual(mac, unsalted), false);
    await expectAuth(
      () => confirmAccountEmailCode(user.id, next, "000000", null),
      "INVALID_TOKEN",
    );
    const confirmed = await confirmAccountEmailCode(user.id, next, issued.devCode ?? "", null);
    assert.equal(confirmed.ok, true);
  });

  test("a contact change needs one step-up and drops the other sessions", async () => {
    const user = await insertAccount({ name: "step", verified: true });
    const current = await createSession(user.id);
    const other = await createSession(user.id);
    const phone = await freePhone();
    await expectAuth(
      () => requestAccountPhoneCode(user.id, phone, null),
      "FORBIDDEN",
    );
    const grant = await issueStepUpGrant(user.id, { password: PASSWORD });
    await consumeStepUpGrant(user.id, grant);
    await expectAuth(() => consumeStepUpGrant(user.id, grant), "VALIDATION");
    const fresh = await issueStepUpGrant(user.id, { password: PASSWORD });
    const issued = await requestAccountPhoneCode(user.id, phone, fresh);
    assert.ok(issued.devCode);
    await expectAuth(
      () => requestAccountPhoneCode(user.id, phone, fresh),
      "VALIDATION",
    );
    const saved = await confirmAccountPhoneCode(user.id, phone, issued.devCode ?? "", current.token);
    assert.equal(saved.ok, true);
    assert.equal((await findUserById(user.id))?.phone, storedBelarusPhone(phone));
    assert.ok(await findValidSession(current.token));
    assert.equal(await findValidSession(other.token), null);
  });

  test("a pending shell links only into an empty verified mailbox", async () => {
    const phone = await freePhone();
    const shell = await insertAccount({ name: "shell", pendingShell: true, phone, phoneVerified: true });
    const target = await insertAccount({ name: "target", verified: true });
    const targetHash = target.passwordHash;
    const offered = await saveSignupCredentials(shell.id, target.email, "ShouldNot4");
    assert.deepEqual(offered, { ok: true, linkAvailable: true });
    assert.equal((await findUserById(shell.id))?.email, pendingSignupEmail(shell.id));
    assert.equal((await findUserById(target.id))?.passwordHash, targetHash);

    const linked = await requestSignupLink(shell.id, target.email);
    assert.ok(linked.devCode);
    await expectAuth(
      () => confirmSignupLink(shell.id, target.email, "000000", meta("link-wrong")),
      "INVALID_TOKEN",
    );
    const opened = await confirmSignupLink(shell.id, target.email, linked.devCode ?? "", meta("link"));
    assert.equal(opened.session && "token" in opened.session, true);
    const moved = await findUserById(target.id);
    const discarded = await findUserById(shell.id);
    assert.equal(moved?.phone, storedBelarusPhone(phone));
    assert.equal(moved?.passwordHash, targetHash);
    assert.equal(discarded?.status, "deleted");
    assert.equal(discarded?.phone, null);

    const busyPhone = await freePhone();
    const shellAgain = await insertAccount({
      name: "shell-busy",
      pendingShell: true,
      phone: busyPhone,
      phoneVerified: true,
    });
    const busy = await insertAccount({ name: "busy", verified: true, phone: await freePhone(), phoneVerified: true });
    const code = await requestSignupLink(shellAgain.id, busy.email);
    await expectAuth(
      () => confirmSignupLink(shellAgain.id, busy.email, code.devCode ?? "", meta("link-busy")),
      "VALIDATION",
    );
    assert.equal((await findUserById(shellAgain.id))?.status, "active");
  });

  test("staff with an authenticator get a ticket, and the session list hides the token", async () => {
    const secret = encodeBase32(Buffer.from("12345678901234567890"));
    const user = await insertAccount({ name: "staff", verified: true, role: "admin" });
    await getDb()
      .update(users)
      .set({
        totpSecret: sealSecret(secret),
        totpEnabledAt: new Date(),
        totpRecoveryHashes: JSON.stringify([recoveryHash("abcd1234")]),
      })
      .where(eq(users.id, user.id));
    const fresh = await findUserById(user.id);
    assert.ok(fresh);
    const opened = await beginLogin(fresh);
    assert.ok("totpTicket" in opened);
    assert.equal("token" in opened, false);
    await expectAuth(() => consumeLoginTicket(opened.totpTicket, "000000"), "INVALID_TOKEN");
    const userId = await consumeLoginTicket(opened.totpTicket, totpCode(Buffer.from("12345678901234567890")));
    assert.equal(userId, user.id);
    await expectAuth(
      () => consumeLoginTicket(opened.totpTicket, totpCode(Buffer.from("12345678901234567890"))),
      "INVALID_TOKEN",
    );

    const plain = await insertAccount({ name: "staff-plain", verified: true, role: "admin" });
    const plainUser = await findUserById(plain.id);
    assert.ok(plainUser);
    const session = await beginLogin(plainUser);
    assert.ok("token" in session);
    const gate = accountGatePath({
      needsCredentials: false,
      needsDoorPassword: false,
      needsTotp: true,
    });
    assert.equal(gate, "/auth/totp");

    const listed = await listAccountSessions(plain.id, session.token);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.current, true);
    assert.equal(JSON.stringify(listed).includes(session.token), false);
    const revoked = await revokeAccountSession(plain.id, listed[0]?.id ?? "", session.token);
    assert.equal(revoked.current, true);
    assert.equal(await findValidSession(session.token), null);
  });

  test("Telegram proofs expire, replay, and do not invent an account", async () => {
    const now = Math.floor(Date.now() / 1000);
    const id = 7_000_000_000_000 + randomInt(0, 1_000_000_000);
    const stale = webAppQuery(now - 16 * 60, id);
    const fresh = webAppQuery(now - 60, id);
    assert.equal(verifyTelegramWebAppInitData(stale, now), null);
    assert.ok(verifyTelegramWebAppInitData(fresh, now));
    assert.ok(await acceptTelegramWebApp(fresh));
    assert.equal(await acceptTelegramWebApp(fresh), null);

    const widget = widgetUser(now - 30, id + 1);
    const oldWidget = widgetUser(now - 11 * 60, id + 2);
    assert.equal(verifyTelegramWidgetUser(oldWidget, now), false);
    assert.equal(verifyTelegramWidgetUser(widget, now), true);
    assert.ok(await acceptTelegramWidget(widget));
    assert.equal(await acceptTelegramWidget(widget), null);
    await expectAuth(
      () => signupWithTelegramWidget(widget, meta("tg-widget")),
      "INVALID_CREDENTIALS",
    );

    const signupId = id + 3;
    createdTelegramIds.push(signupId, signupId + 1);
    const signupWidget = widgetUser(now - 20, signupId);
    const created = await signupWithTelegramWidget(signupWidget, meta("tg-create"));
    assert.equal(created.created, true);
    const shell = await getDb()
      .select()
      .from(users)
      .where(eq(users.telegramUserId, signupId))
      .limit(1);
    assert.equal(shell.length, 1);
    createdUsers.push(shell[0]!.id);
    await expectAuth(
      () => signupWithTelegramWidget(signupWidget, meta("tg-replay")),
      "INVALID_CREDENTIALS",
    );
    const mini = webAppQuery(now - 40, signupId + 1);
    const miniCreated = await signupWithTelegramWebApp(mini, meta("tg-mini"));
    assert.equal(miniCreated.created, true);
    const miniUser = await getDb()
      .select()
      .from(users)
      .where(eq(users.telegramUserId, signupId + 1))
      .limit(1);
    createdUsers.push(miniUser[0]!.id);
    assert.equal(await acceptTelegramWebApp(mini), null);
    assert.equal(await claimProof(`cases-${stamp}`, new Date(Date.now() + 60_000)), true);
    assert.equal(await claimProof(`cases-${stamp}`, new Date(Date.now() + 60_000)), false);
  });

  test("a trainer door claim is a POST token and the old code path stays closed", async () => {
    const db = getDb();
    const slug = `case${stamp}`.slice(0, 18);
    const claimToken = randomUUID().replace(/-/g, "");
    const [profile] = await db
      .insert(trainerProfiles)
      .values({
        slug,
        instagramHandle: slug,
        sourceUrl: `https://instagram.com/${slug}`,
        status: "draft",
        claimStatus: "unclaimed",
        createdSource: "import",
        firstName: "Дверь",
        lastName: "Кейс",
        fullName: "Дверь Кейс",
        claimToken,
        claimPath: `/trainers/claim/${claimToken}`,
      })
      .returning();
    createdProfiles.push(profile.id);
    const { authDoorClaims } = await import("@/db/schema");
    const raw = `door-token-${stamp}-abcdefghij`;
    const expiresAt = new Date(Date.now() + 60 * 60_000);
    await db.insert(authDoorClaims).values({
      profileId: profile.id,
      email: email("door"),
      tokenHash: hashToken(`${profile.id}:${raw}`),
      expiresAt,
    });
    const [stored] = await db
      .select()
      .from(authDoorClaims)
      .where(eq(authDoorClaims.profileId, profile.id))
      .limit(1);
    assert.equal(stored?.usedAt, null);
    assert.ok(stored && stored.expiresAt.getTime() - Date.now() < 61 * 60_000);
    assert.ok(stored && stored.expiresAt.getTime() - Date.now() > 50 * 60_000);
    assert.equal(stored?.tokenHash, hashToken(`${profile.id}:${raw}`));
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile(new URL("../lib/catalog/trainer-magic.ts", import.meta.url), "utf8"),
    );
    const handler = source.slice(
      source.indexOf("export const confirmDoorEmailFn"),
      source.indexOf("async function freshDoorClaim"),
    );
    assert.match(handler, /INVALID_TOKEN/);
    assert.equal(handler.includes("hashToken"), false);
  });
});
