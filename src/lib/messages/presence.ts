import { sql } from "drizzle-orm";

import { getDb } from "@/db";
import { logCaught } from "@/lib/log/logger";
import type { Presence } from "@/lib/messages/schemas";

/** A visible tab counts as on the site. */
export const PRESENCE_ONLINE_MS = 60_000;
/** A hidden tab, another browser, or a recent visit stays away for ten minutes. */
export const PRESENCE_AWAY_MS = 10 * 60_000;
/** While the person is not offline, the letter waits and checks again. */
export const PRESENCE_LETTER_WAIT_MS = 60_000;

const WRITE_GAP_MS = 15_000;

type SocketState = { visible: boolean };
type Memory = {
  lastSeenAt: number;
  sockets: Map<object, SocketState>;
  lastWriteAt: number;
  visible: boolean;
};

type Store = {
  memory: Map<string, Memory>;
  tableReady: Promise<void> | null;
  tableFailed: boolean;
};

const STORE = Symbol.for("trenio.userPresence");

/** The websocket and a server function can load this file twice. The map is one per process. */
function store(): Store {
  const host = globalThis as typeof globalThis & { [STORE]?: Store };
  if (!host[STORE]) host[STORE] = { memory: new Map(), tableReady: null, tableFailed: false };
  return host[STORE];
}

/**
 * Green: a tab is on screen and reported within the last minute.
 * Orange: the session is still open but hidden, or the last report was within ten minutes.
 * Gray: nothing for ten minutes.
 */
export function presenceState(input: {
  now: number;
  lastSeenAt: number | null;
  visible: boolean;
}): Presence {
  if (input.lastSeenAt == null) return "offline";
  const age = input.now - input.lastSeenAt;
  if (age > PRESENCE_AWAY_MS) return "offline";
  if (input.visible && age <= PRESENCE_ONLINE_MS) return "online";
  return "away";
}

/** Null means send now. A number means the person is still online or away. */
export function letterWaitMs(presence: Presence): number | null {
  return presence === "offline" ? null : PRESENCE_LETTER_WAIT_MS;
}

function anyVisible(row: Memory) {
  for (const item of row.sockets.values()) if (item.visible) return true;
  return false;
}

function ensureTable() {
  const shared = store();
  if (shared.tableFailed) return Promise.resolve();
  if (!shared.tableReady) {
    shared.tableReady = getDb()
      .execute(sql`
        CREATE TABLE IF NOT EXISTS user_presence (
          user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          last_seen_at timestamptz NOT NULL,
          visible boolean NOT NULL DEFAULT false
        )
      `)
      .then(() => undefined)
      .catch((error: unknown) => {
        shared.tableFailed = true;
        shared.tableReady = null;
        logCaught("message", "message.presence", error);
      });
  }
  return shared.tableReady;
}

async function persist(userId: string, row: Memory, now: number, force: boolean) {
  if (!force && now - row.lastWriteAt < WRITE_GAP_MS) return;
  row.lastWriteAt = now;
  try {
    await ensureTable();
    if (store().tableFailed) return;
    await getDb().execute(sql`
      INSERT INTO user_presence (user_id, last_seen_at, visible)
      VALUES (${userId}::uuid, ${new Date(row.lastSeenAt).toISOString()}::timestamptz, ${row.visible})
      ON CONFLICT (user_id) DO UPDATE
        SET last_seen_at = EXCLUDED.last_seen_at,
            visible = EXCLUDED.visible
    `);
  } catch (error) {
    const code = (error as { cause?: { code?: string } }).cause?.code;
    if (code === "23503") return;
    const shared = store();
    if (!shared.tableFailed) {
      shared.tableFailed = true;
      logCaught("message", "message.presence", error);
    }
  }
}

/** One open page of this account. A hidden tab stays in the set with visible false. */
export function recordPresence(userId: string, socket: object, visible: boolean, now = Date.now()) {
  const memory = store().memory;
  let row = memory.get(userId);
  if (!row) {
    row = { lastSeenAt: now, sockets: new Map(), lastWriteAt: 0, visible: false };
    memory.set(userId, row);
  }
  row.sockets.set(socket, { visible });
  row.lastSeenAt = now;
  const nextVisible = anyVisible(row);
  const flipped = nextVisible !== row.visible;
  row.visible = nextVisible;
  void persist(userId, row, now, flipped || row.lastWriteAt === 0);
}

/** The page closed. The last moment stays, so the next ten minutes are away, then offline. */
export function forgetPresence(userId: string, socket: object, now = Date.now()) {
  const row = store().memory.get(userId);
  if (!row) return;
  row.sockets.delete(socket);
  row.lastSeenAt = now;
  row.visible = anyVisible(row);
  void persist(userId, row, now, true);
}

export function presenceFromMemory(userId: string, now = Date.now()): Presence | null {
  const row = store().memory.get(userId);
  if (!row) return null;
  return presenceState({ now, lastSeenAt: row.lastSeenAt, visible: row.visible });
}

export async function presenceFor(userIds: readonly string[], now = Date.now()): Promise<Map<string, Presence>> {
  const unique = [...new Set(userIds.filter((id) => id.length > 0))];
  const result = new Map<string, Presence>();
  const missing: string[] = [];
  for (const id of unique) {
    const live = presenceFromMemory(id, now);
    if (live) result.set(id, live);
    else missing.push(id);
  }
  if (missing.length === 0) return result;
  try {
    await ensureTable();
    if (store().tableFailed) {
      for (const id of missing) result.set(id, "offline");
      return result;
    }
    const rows = await getDb().execute<{ userId: string; lastSeenAt: Date | string; visible: boolean | string }>(sql`
      SELECT user_id AS "userId", last_seen_at AS "lastSeenAt", visible
      FROM user_presence
      WHERE user_id IN (${sql.join(missing.map((id) => sql`${id}::uuid`), sql`, `)})
    `);
    const found = new Set<string>();
    for (const row of rows) {
      found.add(row.userId);
      const at = new Date(row.lastSeenAt).getTime();
      result.set(row.userId, presenceState({
        now,
        lastSeenAt: Number.isNaN(at) ? null : at,
        visible: row.visible === true || row.visible === "t" || row.visible === "true",
      }));
    }
    for (const id of missing) if (!found.has(id)) result.set(id, "offline");
  } catch (error) {
    logCaught("message", "message.presence", error);
    for (const id of missing) if (!result.has(id)) result.set(id, "offline");
  }
  return result;
}
