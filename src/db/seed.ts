import "dotenv/config";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "./index";
import { userRoles, users } from "./schema";
import { hashPassword, normalizeEmail } from "../auth/password";

async function seed() {
  const db = getDb();

  const adminEmail = normalizeEmail(process.env.SEED_ADMIN_EMAIL ?? "admin@trenio.by");
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin1234";
  const superEmail = normalizeEmail(process.env.SEED_SUPERADMIN_EMAIL ?? "super@trenio.by");
  const superPassword = process.env.SEED_SUPERADMIN_PASSWORD ?? "Super1234";

  async function upsertStaff(
    email: string,
    password: string,
    firstName: string,
    roles: Array<"admin" | "superadmin">,
  ) {
    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    const passwordHash = await hashPassword(password);

    let userId: string;
    if (existing) {
      await db
        .update(users)
        .set({
          passwordHash,
          firstName,
          status: "active",
          emailVerifiedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
      userId = existing.id;
      console.info(`Updated user ${email}`);
    } else {
      const [created] = await db
        .insert(users)
        .values({
          email,
          passwordHash,
          firstName,
          status: "active",
          emailVerifiedAt: new Date(),
          lastSignupIntent: "client_signup",
        })
        .returning({ id: users.id });
      userId = created.id;
      console.info(`Created user ${email}`);
    }

    for (const role of roles) {
      await db
        .insert(userRoles)
        .values({ userId, role })
        .onConflictDoNothing();
    }
  }

  await upsertStaff(adminEmail, adminPassword, "Admin", ["admin"]);
  await upsertStaff(superEmail, superPassword, "Superadmin", ["superadmin", "admin"]);

  console.info("Seed complete.");
  console.info(`  Admin: ${adminEmail} / ${adminPassword}`);
  console.info(`  Superadmin: ${superEmail} / ${superPassword}`);
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
