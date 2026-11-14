import { randomInt, randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { hashToken } from "../src/auth/tokens";
import { closeDb, getDb } from "../src/db/index";
import { authDoorClaims, trainerProfiles, users } from "../src/db/schema";

const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyz";

function doorCode(): string {
  return Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

function emit(value: unknown) {
  console.info(JSON.stringify(value));
}

async function seed() {
  const db = getDb();
  const code = doorCode();
  const token = randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "");
  const email = `doorcase-${Date.now().toString(36)}@example.com`;
  const claimToken = randomUUID().replace(/-/g, "");
  const [profile] = await db
    .insert(trainerProfiles)
    .values({
      slug: `d${code}`,
      instagramHandle: `d${code}`,
      sourceUrl: `https://instagram.com/d${code}`,
      status: "draft",
      claimStatus: "unclaimed",
      createdSource: "import",
      firstName: "Кабинет",
      lastName: "Кейс",
      fullName: "Кабинет Кейс",
      claimToken,
      claimPath: `/trainers/claim/${claimToken}`,
      previewToken: code,
    })
    .returning({ id: trainerProfiles.id });
  await db.insert(authDoorClaims).values({
    profileId: profile.id,
    email,
    tokenHash: hashToken(`${profile.id}:${token}`),
    expiresAt: new Date(Date.now() + 24 * 60 * 60_000),
  });
  emit({ code, token, email });
}

async function status(email: string) {
  const db = getDb();
  const [user] = await db
    .select({ needsPassword: users.needsPassword })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const [claim] = await db
    .select({ usedAt: authDoorClaims.usedAt })
    .from(authDoorClaims)
    .where(eq(authDoorClaims.email, email))
    .limit(1);
  emit({
    exists: Boolean(user),
    needsPassword: Boolean(user?.needsPassword),
    used: Boolean(claim?.usedAt),
  });
}

async function cleanup(email: string, code: string) {
  const db = getDb();
  await db.delete(trainerProfiles).where(eq(trainerProfiles.previewToken, code));
  await db.delete(users).where(eq(users.email, email));
  emit({ ok: true });
}

async function main() {
  const [command, email = "", code = ""] = process.argv.slice(2);
  if (command === "seed") await seed();
  else if (command === "status") await status(email);
  else if (command === "cleanup") await cleanup(email, code);
  else throw new Error("Use seed, status, or cleanup");
  await closeDb();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
