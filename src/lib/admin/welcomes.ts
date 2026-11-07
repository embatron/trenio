import { desc, eq, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { trainerProfiles, trainerWelcomes } from "@/db/schema";
import { assertStaff } from "@/lib/admin/access";
import { AuthError } from "@/lib/auth/errors";
import { formatBelarusPhone, normalizeBelarusMobile } from "@/lib/auth/phone";
import { parseTelegramHandle } from "@/lib/catalog/trainer-welcome";
import { writeLog } from "@/lib/log/logger";

export type WelcomeStaffStatus = "new" | "done" | "rejected";

export type WelcomeTrainerStatus = "draft" | "published" | "hidden" | "archived";

export type AdminWelcome = {
  id: string;
  channel: "instagram" | "other";
  instagram: string;
  telegram: string;
  phone: string;
  createdAt: string;
  linkOpen: boolean;
  staffStatus: WelcomeStaffStatus;
  trainer: {
    slug: string;
    name: string;
    status: WelcomeTrainerStatus;
  } | null;
};

let staffColumnReady: Promise<void> | null = null;

async function database() {
  const { getDb } = await import("@/db");
  return getDb();
}

function ensureWelcomeStaffColumn(): Promise<void> {
  if (!staffColumnReady) {
    staffColumnReady = database()
      .then((db) =>
        db.execute(
          sql`
        ALTER TABLE trainer_welcomes
        ADD COLUMN IF NOT EXISTS staff_status varchar(16) NOT NULL DEFAULT 'new'
      `,
        ),
      )
      .then(() => undefined)
      .catch((error) => {
        staffColumnReady = null;
        throw error;
      });
  }
  return staffColumnReady;
}

function telegramKey(raw: string): string {
  return (parseTelegramHandle(raw) ?? "").toLowerCase();
}

function phoneKey(raw: string): string {
  return normalizeBelarusMobile(raw) ?? "";
}

type ProfileHit = {
  slug: string;
  name: string;
  status: WelcomeTrainerStatus;
  instagram: string;
  telegram: string;
  phone: string;
};

function asTrainerStatus(value: string): WelcomeTrainerStatus {
  if (value === "published" || value === "hidden" || value === "archived") return value;
  return "draft";
}

function asStaffStatus(value: string): WelcomeStaffStatus {
  if (value === "done" || value === "rejected") return value;
  return "new";
}

function matchTrainer(
  welcome: { instagram: string; telegram: string; phone: string },
  profiles: ProfileHit[],
): ProfileHit | null {
  const instagram = welcome.instagram.toLowerCase();
  const telegram = welcome.telegram.toLowerCase();
  const phone = phoneKey(welcome.phone);
  let best: { score: number; profile: ProfileHit } | null = null;
  for (const profile of profiles) {
    let score = 0;
    if (instagram && profile.instagram === instagram) score += 4;
    if (telegram && profile.telegram === telegram) score += 2;
    if (phone && profile.phone === phone) score += 1;
    if (score === 0) continue;
    if (profile.status === "published") score += 8;
    if (!best || score > best.score) best = { score, profile };
  }
  return best?.profile ?? null;
}

async function loadProfiles(): Promise<ProfileHit[]> {
  const rows = await (await database())
    .select({
      slug: trainerProfiles.slug,
      firstName: trainerProfiles.firstName,
      lastName: trainerProfiles.lastName,
      status: trainerProfiles.status,
      instagramHandle: trainerProfiles.instagramHandle,
      telegram: trainerProfiles.telegram,
      phone: trainerProfiles.phone,
    })
    .from(trainerProfiles);
  return rows.map((row) => ({
    slug: row.slug,
    name: [row.firstName, row.lastName].filter(Boolean).join(" ") || row.instagramHandle,
    status: asTrainerStatus(row.status),
    instagram: row.instagramHandle.toLowerCase(),
    telegram: telegramKey(row.telegram),
    phone: phoneKey(row.phone),
  }));
}

export function welcomeIsOpen(row: {
  staffStatus: WelcomeStaffStatus;
  trainerStatus: WelcomeTrainerStatus | null;
}) {
  if (row.staffStatus !== "new") return false;
  return row.trainerStatus !== "published";
}

export async function countOpenWelcomes(): Promise<number> {
  await ensureWelcomeStaffColumn();
  const db = await database();
  const [welcomes, profiles] = await Promise.all([
    db
      .select({
        instagram: trainerWelcomes.instagram,
        telegram: trainerWelcomes.telegram,
        phone: trainerWelcomes.phone,
        staffStatus: trainerWelcomes.staffStatus,
      })
      .from(trainerWelcomes),
    loadProfiles(),
  ]);
  return welcomes.filter((row) => {
    const trainer = matchTrainer(
      { instagram: row.instagram ?? "", telegram: row.telegram ?? "", phone: row.phone ?? "" },
      profiles,
    );
    return welcomeIsOpen({
      staffStatus: asStaffStatus(row.staffStatus),
      trainerStatus: trainer?.status ?? null,
    });
  }).length;
}

export const getAdminWelcomesFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<AdminWelcome[]> => {
    assertStaff(context.user.roles);
    await ensureWelcomeStaffColumn();
    const [rows, profiles] = await Promise.all([
      (await database())
        .select({
          id: trainerWelcomes.id,
          channel: trainerWelcomes.channel,
          instagram: trainerWelcomes.instagram,
          telegram: trainerWelcomes.telegram,
          phone: trainerWelcomes.phone,
          createdAt: trainerWelcomes.createdAt,
          linkSentAt: trainerWelcomes.linkSentAt,
          staffStatus: trainerWelcomes.staffStatus,
        })
        .from(trainerWelcomes)
        .orderBy(desc(trainerWelcomes.createdAt)),
      loadProfiles(),
    ]);
    return rows.map((row) => {
      const instagram = row.instagram ?? "";
      const telegram = row.telegram ?? "";
      const phone = formatBelarusPhone(row.phone);
      const trainer = matchTrainer({ instagram, telegram, phone: row.phone ?? "" }, profiles);
      return {
        id: row.id,
        channel: row.channel === "other" ? "other" : "instagram",
        instagram,
        telegram,
        phone,
        createdAt: row.createdAt.toISOString(),
        linkOpen: row.linkSentAt != null,
        staffStatus: asStaffStatus(row.staffStatus),
        trainer: trainer
          ? { slug: trainer.slug, name: trainer.name, status: trainer.status }
          : null,
      };
    });
  });

const decisionSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["done", "rejected"]),
});

export const setAdminWelcomeStatusFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(decisionSchema)
  .handler(async ({ data, context }) => {
    assertStaff(context.user.roles);
    await ensureWelcomeStaffColumn();
    const [existing] = await (await database())
      .select({ id: trainerWelcomes.id, instagram: trainerWelcomes.instagram })
      .from(trainerWelcomes)
      .where(eq(trainerWelcomes.id, data.id))
      .limit(1);
    if (!existing) throw new AuthError("Заявка не найдена.", "VALIDATION");
    await (await database())
      .update(trainerWelcomes)
      .set({ staffStatus: data.status })
      .where(eq(trainerWelcomes.id, data.id));
    void writeLog({
      level: "info",
      domain: "admin",
      action: "admin.welcome",
      outcome: "success",
      message: data.status === "done" ? "Заявка разобрана." : "Заявка отклонена.",
      actorUserId: context.user.id,
      target: existing.instagram || existing.id,
      context: { status: data.status },
    });
    return { ok: true as const };
  });
