import { desc, eq } from "drizzle-orm";
import { sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerRevisions, users } from "@/db/schema";
import { reviewPlainText } from "@/lib/catalog/review-html";

/** How many post-images one card keeps. Older rows are deleted in the same write. */
export const TRAINER_REVISION_KEEP = 12;

export const TRAINER_REVISION_SOURCES = ["admin", "cabinet", "sync", "import", "door", "write"] as const;
export type TrainerRevisionSource = (typeof TRAINER_REVISION_SOURCES)[number];

export const TRAINER_REVISION_FIELDS = [
  ["slug", "Адрес страницы"],
  ["instagram", "Instagram"],
  ["status", "Статус"],
  ["verified", "Верификация"],
  ["unclear", "Непонятные"],
  ["firstName", "Имя"],
  ["lastName", "Фамилия"],
  ["headline", "Заголовок"],
  ["bio", "О себе"],
  ["sourceBio", "Текст из источника"],
  ["about", "Как проходят тренировки"],
  ["pinned", "Закреплённые посты"],
  ["sports", "Виды спорта"],
  ["city", "Город"],
  ["district", "Район"],
  ["places", "Адреса"],
  ["price", "Цена"],
  ["experience", "Стаж"],
  ["phone", "Телефон"],
  ["email", "Почта"],
  ["instagramUrl", "Ссылка Instagram"],
  ["telegram", "Telegram"],
  ["threads", "Threads"],
  ["website", "Сайт"],
  ["formats", "Формат"],
  ["audiences", "С кем работает"],
  ["languages", "Языки"],
  ["gender", "Пол"],
  ["hidePhone", "Скрыть телефон"],
  ["hideInstagram", "Скрыть Instagram"],
  ["hideTelegram", "Скрыть Telegram"],
  ["hideThreads", "Скрыть Threads"],
  ["hideEmail", "Скрыть почту"],
  ["photos", "Фото"],
  ["certificates", "Документы"],
] as const;

const LONG_FIELDS = new Set(["bio", "sourceBio", "about", "pinned", "places", "photos", "certificates"]);

const SOURCE_LABEL: Record<string, string> = {
  admin: "Админка",
  cabinet: "Кабинет",
  sync: "Синхронизация",
  import: "Импорт",
  door: "Короткая ссылка",
  write: "Запись",
};

const FIELD_LABEL = new Map<string, string>(TRAINER_REVISION_FIELDS);

export type TrainerRevisionChange = {
  key: string;
  label: string;
  before: string;
  after: string;
  long: boolean;
};

export type TrainerRevisionView = {
  id: number;
  at: string;
  source: string;
  sourceLabel: string;
  actor: string;
  kind: "create" | "update" | "baseline";
  note: string;
  changes: TrainerRevisionChange[];
};

function present(key: string, value: string) {
  const text = key === "bio" || key === "sourceBio" ? reviewPlainText(value) : value;
  return text.trim();
}

function blankSeed(value: string) {
  return value === "" || value === "0" || value === "нет";
}

/** Visible differences between two stored snapshots. `previous` null means the older copy was already dropped. */
export function revisionChanges(
  previous: Record<string, string> | null,
  next: Record<string, string>,
): TrainerRevisionChange[] {
  if (!previous) return [];
  const creating = Object.keys(previous).length === 0;
  const seen = new Set<string>();
  const keys = [
    ...TRAINER_REVISION_FIELDS.map(([key]) => key),
    ...Object.keys(next),
    ...Object.keys(previous),
  ];
  const changes: TrainerRevisionChange[] = [];
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const before = present(key, previous[key] ?? "");
    const after = present(key, next[key] ?? "");
    if (before === after) continue;
    if (creating && blankSeed(after)) continue;
    changes.push({
      key,
      label: FIELD_LABEL.get(key) ?? key,
      before: creating ? "" : before,
      after,
      long: LONG_FIELDS.has(key),
    });
  }
  return changes;
}

function asRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    record[key] = item == null ? "" : String(item);
  }
  return record;
}

function actorLabel(actorUserId: string | null, firstName: string | null, lastName: string | null) {
  const name = [firstName, lastName].filter((part) => part && part.trim()).join(" ").trim();
  if (name) return name;
  return actorUserId ? "Аккаунт" : "Система";
}

function missingTable(error: unknown) {
  const current = error as { code?: string; cause?: { code?: string; message?: string }; message?: string };
  if (current.code === "42P01" || current.cause?.code === "42P01") return true;
  const message = `${current.message ?? ""} ${current.cause?.message ?? ""}`;
  return message.includes("trainer_revisions") && message.includes("does not exist");
}

/**
 * Marks the card write that follows on this same transaction.
 * `set_config(..., true)` dies with the transaction, so a pooled connection cannot leak the actor.
 */
export async function stampTrainerRevision(
  tx: { execute: (query: SQL) => Promise<unknown> },
  source: TrainerRevisionSource,
  actorUserId?: string | null,
) {
  await tx.execute(sql`select set_config('trenio.revision_source', ${source}, true)`);
  await tx.execute(sql`select set_config('trenio.revision_actor', ${actorUserId ?? ""}, true)`);
}

export async function listTrainerRevisionViews(profileId: string): Promise<TrainerRevisionView[]> {
  try {
    const rows = await getDb()
      .select({
        id: trainerRevisions.id,
        createdAt: trainerRevisions.createdAt,
        actorUserId: trainerRevisions.actorUserId,
        source: trainerRevisions.source,
        kind: trainerRevisions.kind,
        snapshot: trainerRevisions.snapshot,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(trainerRevisions)
      .leftJoin(users, eq(users.id, trainerRevisions.actorUserId))
      .where(eq(trainerRevisions.profileId, profileId))
      .orderBy(desc(trainerRevisions.id))
      .limit(TRAINER_REVISION_KEEP);

    return rows.map((row, index) => {
      const older = rows[index + 1];
      const kind = row.kind === "create" || row.kind === "baseline" ? row.kind : "update";
      const next = asRecord(row.snapshot);
      const previous = older
        ? asRecord(older.snapshot)
        : kind === "create"
          ? {}
          : null;
      const changes = kind === "baseline" && !older ? [] : revisionChanges(previous, next);
      let note = "";
      if (kind === "baseline" && !older) {
        note = "Сохранено текущее состояние. Следующее изменение покажет разницу.";
      } else if (!previous) {
        note = "Более ранние изменения не хранятся.";
      } else if (kind === "create") {
        note = "Карточка создана.";
      } else if (changes.length === 0) {
        note = "Видимый текст не изменился.";
      }
      return {
        id: row.id,
        at: row.createdAt.toISOString(),
        source: row.source,
        sourceLabel: SOURCE_LABEL[row.source] ?? SOURCE_LABEL.write,
        actor: actorLabel(row.actorUserId, row.firstName, row.lastName),
        kind,
        note,
        changes,
      };
    });
  } catch (error) {
    if (missingTable(error)) return [];
    throw error;
  }
}
