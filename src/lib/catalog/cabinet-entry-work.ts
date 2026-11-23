import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { consumeRateLimit } from "@/auth/rate-limit";
import { generateSecureToken, hashToken } from "@/auth/tokens";
import { getDb } from "@/db";
import { authCabinetEntries, trainerProfiles, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { appOrigin } from "@/lib/app-origin";
import {
  CABINET_ENTRY_MS,
  CABINET_ENTRY_OPENS,
  cabinetEntryState,
  deskStayClosed,
  type CabinetEntryState,
  type ConfirmedMailbox,
} from "@/lib/catalog/cabinet-entry-state";
import { writeLog } from "@/lib/log/logger";

const DOOR_CODE = /^[23456789abcdefghijkmnpqrstuvwxyz]{8}$/;

export const doorSchema = z.object({
  code: z.string().trim().toLowerCase().regex(DOOR_CODE),
  token: z.string().trim().min(20).max(200),
});

export function noteEntry(reason: ReturnType<typeof cabinetEntryState>, slug: string | null, subject: string | null) {
  const message = {
    live: "Одноразовая ссылка в кабинет ещё действует.",
    used: "Одноразовая ссылка в кабинет уже использована.",
    expired: "Одноразовая ссылка в кабинет истекла.",
    closed: "Одноразовая ссылка в кабинет не открыла закрытый аккаунт.",
    mismatch: "Одноразовая ссылка в кабинет не совпала с карточкой.",
  }[reason];
  void writeLog({
    level: reason === "live" ? "info" : "warn",
    domain: "account",
    action: "account.entry",
    outcome: reason === "live" ? "success" : "denied",
    message,
    subject,
    target: slug,
    context: { reason, opens: CABINET_ENTRY_OPENS },
  });
}

export async function limitDeniedEntry(ip: string) {
  try {
    const limit = await consumeRateLimit(`cabinet-entry:${ip}`, 15 * 60_000, 20);
    if (!limit.ok) throw new AuthError("Слишком много попыток. Попробуйте позже.", "RATE_LIMITED");
  } catch (error) {
    if (error instanceof AuthError) throw error;
  }
}

export type EntryLook = {
  state: CabinetEntryState;
  slug: string | null;
  email: string | null;
  tokenHash: string | null;
  userId: string | null;
  profileId: string | null;
  needsPassword: boolean;
};

export async function lookEntry(code: string, token: string): Promise<EntryLook> {
  const parsed = doorSchema.safeParse({ code, token });
  if (!parsed.success) return { state: "mismatch", slug: null, email: null, tokenHash: null, userId: null, profileId: null, needsPassword: false };
  const tokenHash = hashToken(parsed.data.token);
  const [row] = await getDb()
    .select({
      tokenHash: authCabinetEntries.tokenHash,
      userId: authCabinetEntries.userId,
      profileId: authCabinetEntries.profileId,
      expiresAt: authCabinetEntries.expiresAt,
      useCount: authCabinetEntries.useCount,
      slug: trainerProfiles.slug,
      ownerUserId: trainerProfiles.ownerUserId,
      email: users.email,
      userStatus: users.status,
      needsPassword: users.needsPassword,
      lastSignupIntent: users.lastSignupIntent,
    })
    .from(authCabinetEntries)
    .innerJoin(trainerProfiles, eq(trainerProfiles.id, authCabinetEntries.profileId))
    .innerJoin(users, eq(users.id, authCabinetEntries.userId))
    .where(and(eq(authCabinetEntries.tokenHash, tokenHash), eq(trainerProfiles.previewToken, parsed.data.code)))
    .limit(1);
  if (!row) return { state: "mismatch", slug: null, email: null, tokenHash, userId: null, profileId: null, needsPassword: false };
  const state = deskStayClosed(row.slug, cabinetEntryState({
    useCount: row.useCount,
    expiresAt: row.expiresAt,
    now: new Date(),
    userStatus: row.userStatus,
    ownerUserId: row.ownerUserId,
    entryUserId: row.userId,
    profileId: row.profileId,
    entryProfileId: row.profileId,
  }));
  return {
    state,
    slug: row.slug,
    email: row.email,
    tokenHash,
    userId: row.userId,
    profileId: row.profileId,
    needsPassword: row.needsPassword && row.lastSignupIntent === "trainer_claim",
  };
}

/** Retires unused links for this account and returns one new address. The raw token is not logged. */
export async function issueCabinetEntry(claimed: ConfirmedMailbox): Promise<{ url: string; expiresAt: Date }> {
  const db = getDb();
  const now = new Date();
  const token = generateSecureToken();
  const expiresAt = new Date(now.getTime() + CABINET_ENTRY_MS);
  await db
    .update(authCabinetEntries)
    .set({ usedAt: now, useCount: CABINET_ENTRY_OPENS })
    .where(and(eq(authCabinetEntries.userId, claimed.userId), sql`${authCabinetEntries.useCount} < ${CABINET_ENTRY_OPENS}`));
  await db.insert(authCabinetEntries).values({
    tokenHash: hashToken(token),
    userId: claimed.userId,
    profileId: claimed.profileId,
    expiresAt,
  });
  void writeLog({
    level: "info",
    domain: "account",
    action: "account.entry",
    outcome: "success",
    message: "Одноразовая ссылка в кабинет выдана.",
    subject: claimed.email,
    actorUserId: claimed.userId,
    target: claimed.slug,
  });
  const url = `${appOrigin()}/hi/${claimed.previewToken}?desk=${encodeURIComponent(token)}`;
  return { url, expiresAt };
}
