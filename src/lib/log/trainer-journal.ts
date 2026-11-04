import { and, eq, or } from "drizzle-orm";

import { getDb } from "@/db";
import { trainerJournal, trainerProfiles, userRoles } from "@/db/schema";
import type { LogDomain, LogLevel, LogOutcome } from "@/lib/log/policy";
import { writeLog } from "@/lib/log/logger";

/** Profile lifecycle is always kept. Account actions are kept when the actor is a trainer or a club. */
const ALWAYS =
  /^(trainer\.|catalog\.trainer|admin\.trainer|form\.trainer|form\.become_trainer|form\.nick_support|form\.welcome|account\.claim|account\.password$|message\.welcome)/;

const ACCOUNT = /^(auth\.|account\.|sms\.|email\.notice|email\.preference)/;

export function trainerJournalKind(action: string): "always" | "account" | "no" {
  if (ALWAYS.test(action)) return "always";
  if (ACCOUNT.test(action)) return "account";
  return "no";
}

export type TrainerJournalEvent = {
  level: LogLevel;
  domain: LogDomain;
  action: string;
  message: string;
  outcome?: LogOutcome | null;
  actorUserId?: string | null;
  subject?: string | null;
  target?: string | null;
  context?: Record<string, unknown> | null;
};

let persistFailureLogged = false;

export async function keepTrainerJournal(event: TrainerJournalEvent): Promise<void> {
  const kind = trainerJournalKind(event.action);
  if (kind === "no") return;
  try {
    const db = getDb();
    const actor = event.actorUserId ?? null;
    const target = event.target?.slice(0, 80) ?? null;
    let profileId: string | null = null;
    let slug = target;
    let actorIsTrainer = false;

    if (actor) {
      const [role] = await db
        .select({ role: userRoles.role })
        .from(userRoles)
        .where(and(eq(userRoles.userId, actor), or(eq(userRoles.role, "trainer"), eq(userRoles.role, "club"))))
        .limit(1);
      actorIsTrainer = Boolean(role);
    }

    if (actor || target) {
      const match = [];
      if (target) {
        match.push(eq(trainerProfiles.slug, target), eq(trainerProfiles.instagramHandle, target));
      }
      if (actor) match.push(eq(trainerProfiles.ownerUserId, actor));
      const [profile] = await db
        .select({
          id: trainerProfiles.id,
          slug: trainerProfiles.slug,
          ownerUserId: trainerProfiles.ownerUserId,
        })
        .from(trainerProfiles)
        .where(or(...match))
        .limit(1);
      if (profile) {
        profileId = profile.id;
        slug = profile.slug;
        if (actor && profile.ownerUserId === actor) actorIsTrainer = true;
      }
    }

    if (kind === "account" && !actorIsTrainer) return;

    await db.insert(trainerJournal).values({
      profileId,
      actorUserId: actor,
      subject: event.subject?.slice(0, 320) ?? null,
      target: slug,
      domain: event.domain,
      action: event.action.slice(0, 80),
      outcome: event.outcome ?? null,
      level: event.level,
      message: event.message.slice(0, 500),
      context: event.context ?? null,
    });
    persistFailureLogged = false;
  } catch (error) {
    if (!persistFailureLogged) {
      persistFailureLogged = true;
      console.error("[log] trainer journal failed", error instanceof Error ? error.message : "unknown");
    }
  }
}

/** Addition, a later import update, and the moment the card enters or leaves the catalog. */
export function logTrainerPresence(input: {
  created: boolean;
  previous: string | null;
  next: string;
  slug: string;
  actorUserId?: string | null;
  subject?: string | null;
  source?: string | null;
  mode: "import" | "save";
}): void {
  const base = {
    level: "info" as const,
    domain: "catalog" as const,
    outcome: "success" as const,
    target: input.slug,
    actorUserId: input.actorUserId ?? null,
    subject: input.subject ?? null,
  };
  if (input.mode === "import" || input.created) {
    void writeLog({
      ...base,
      action: input.created ? "trainer.add" : "trainer.sync",
      message: input.created ? "Тренер добавлен на сайт." : "Карточка тренера обновлена.",
      context: { status: input.next, source: input.source ?? "import" },
    });
  }
  if (input.next === "published" && input.previous !== "published") {
    void writeLog({
      ...base,
      action: "trainer.appear",
      message: "Тренер появился на сайте.",
      context: { from: input.previous, to: input.next },
    });
  } else if (input.previous === "published" && input.next !== "published") {
    void writeLog({
      ...base,
      action: "trainer.withdraw",
      message: "Тренер снят с сайта.",
      context: { from: input.previous, to: input.next },
    });
  }
}

export const TRAINER_JOURNAL_DDL = `
CREATE TABLE IF NOT EXISTS trainer_journal (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  profile_id uuid,
  actor_user_id uuid,
  subject varchar(320),
  target varchar(80),
  domain varchar(16) NOT NULL,
  action varchar(80) NOT NULL,
  outcome varchar(16),
  level varchar(8) NOT NULL,
  message text NOT NULL,
  context jsonb
);
CREATE INDEX IF NOT EXISTS trainer_journal_created_idx ON trainer_journal (created_at DESC);
CREATE INDEX IF NOT EXISTS trainer_journal_actor_created_idx ON trainer_journal (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trainer_journal_target_created_idx ON trainer_journal (target, created_at DESC);
CREATE INDEX IF NOT EXISTS trainer_journal_profile_created_idx ON trainer_journal (profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trainer_journal_subject_created_idx ON trainer_journal (subject, created_at DESC);
CREATE INDEX IF NOT EXISTS trainer_journal_action_created_idx ON trainer_journal (action, created_at DESC);
`.trim();
