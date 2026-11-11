import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerWelcomes } from "@/db/schema";
import { storedBelarusPhone } from "@/lib/auth/phone";
import { writeLog } from "@/lib/log/logger";

import { isLocalOnlyTrainer } from "./policy";
import { welcomeIdentity, welcomeUpdate, type WelcomeSync } from "./welcomes";

type StoredWelcome = WelcomeSync & { id: string };

let staffColumnReady: Promise<void> | null = null;

function ensureWelcomeStaffColumn() {
  if (!staffColumnReady) {
    staffColumnReady = getDb()
      .execute(
        sql`
        ALTER TABLE trainer_welcomes
        ADD COLUMN IF NOT EXISTS staff_status varchar(16) NOT NULL DEFAULT 'new'
      `,
      )
      .then(() => undefined)
      .catch((error) => {
        staffColumnReady = null;
        throw error;
      });
  }
  return staffColumnReady;
}

function storedPhone(value: string) {
  return storedBelarusPhone(value) ?? (value.trim() || null);
}

async function readRows(): Promise<StoredWelcome[]> {
  await ensureWelcomeStaffColumn();
  const rows = await getDb()
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
    .from(trainerWelcomes);
  return rows.flatMap((row) => {
    const channel =
      row.channel === "other" ? "other" : row.channel === "instagram" ? "instagram" : null;
    if (!channel) return [];
    const status =
      row.staffStatus === "done" || row.staffStatus === "rejected" ? row.staffStatus : "new";
    return [
      {
        id: row.id,
        channel,
        instagram: row.instagram ?? "",
        telegram: row.telegram ?? "",
        phone: row.phone ?? "",
        createdAt: row.createdAt.toISOString(),
        linkSentAt: row.linkSentAt?.toISOString() ?? null,
        staffStatus: status,
      },
    ];
  });
}

/** Every application on this database, for the laptop to copy. Contacts stay in the response and out of the journal. */
export async function listSyncWelcomes(): Promise<WelcomeSync[]> {
  const rows = await readRows();
  return rows.map(({ id: _id, ...row }) => row);
}

/** Copy site applications onto this database. A laptop-only application is left where it is. */
export async function applySyncWelcomes(incoming: WelcomeSync[]) {
  const rows = await readRows();
  const byKey = new Map(rows.map((row) => [welcomeIdentity(row), row]));
  let added = 0;
  let updated = 0;

  for (const welcome of incoming) {
    if (isLocalOnlyTrainer(welcome.instagram)) continue;
    const key = welcomeIdentity(welcome);
    const local = byKey.get(key);
    if (!local) {
      const [created] = await getDb()
        .insert(trainerWelcomes)
        .values({
          channel: welcome.channel,
          instagram: welcome.instagram || null,
          telegram: welcome.telegram || null,
          phone: storedPhone(welcome.phone),
          createdAt: new Date(welcome.createdAt),
          linkSentAt: welcome.linkSentAt ? new Date(welcome.linkSentAt) : null,
          staffStatus: welcome.staffStatus,
        })
        .returning({ id: trainerWelcomes.id });
      if (created) byKey.set(key, { ...welcome, id: created.id });
      added += 1;
      continue;
    }
    const patch = welcomeUpdate(local, welcome);
    if (!patch) continue;
    await getDb()
      .update(trainerWelcomes)
      .set({
        ...(patch.linkSentAt ? { linkSentAt: new Date(patch.linkSentAt) } : {}),
        ...(patch.staffStatus ? { staffStatus: patch.staffStatus } : {}),
      })
      .where(eq(trainerWelcomes.id, local.id));
    if (patch.linkSentAt) local.linkSentAt = patch.linkSentAt;
    if (patch.staffStatus) local.staffStatus = patch.staffStatus;
    updated += 1;
  }

  void writeLog({
    level: "info",
    domain: "admin",
    action: "admin.sync_welcomes",
    outcome: "success",
    message: "Заявки получены с сайта.",
    context: { added, updated },
  });
  return { added, updated };
}
