import { and, eq, isNull } from "drizzle-orm";

import { getDb } from "@/db";
import { authLoginTickets } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { addMinutes, generateSecureToken, hashToken } from "@/auth/tokens";

import { consumeTotpFactor } from "./totp";

const TICKET_MINUTES = 5;
const TICKET_ATTEMPTS = 5;

export async function issueLoginTicket(userId: string): Promise<string> {
  const raw = generateSecureToken();
  await getDb().insert(authLoginTickets).values({
    tokenHash: hashToken(raw),
    userId,
    expiresAt: addMinutes(new Date(), TICKET_MINUTES),
  });
  return raw;
}

export async function consumeLoginTicket(raw: string, code: string): Promise<string> {
  const db = getDb();
  const now = new Date();
  const tokenHash = hashToken(raw);
  const row = await db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(authLoginTickets)
      .where(and(eq(authLoginTickets.tokenHash, tokenHash), isNull(authLoginTickets.consumedAt)))
      .limit(1)
      .for("update");
    if (!current || current.expiresAt.getTime() <= now.getTime() || current.attemptCount >= TICKET_ATTEMPTS) {
      return null;
    }
    await tx
      .update(authLoginTickets)
      .set({ attemptCount: current.attemptCount + 1 })
      .where(eq(authLoginTickets.tokenHash, tokenHash));
    return current;
  });
  if (!row) throw new AuthError("Код не подошёл. Войдите ещё раз.", "INVALID_TOKEN");
  const ok = await consumeTotpFactor(row.userId, code);
  if (!ok) throw new AuthError("Неверный код.", "INVALID_TOKEN");
  const [consumed] = await db
    .update(authLoginTickets)
    .set({ consumedAt: now })
    .where(and(eq(authLoginTickets.tokenHash, tokenHash), isNull(authLoginTickets.consumedAt)))
    .returning({ tokenHash: authLoginTickets.tokenHash });
  if (!consumed) throw new AuthError("Код не подошёл. Войдите ещё раз.", "INVALID_TOKEN");
  return row.userId;
}
