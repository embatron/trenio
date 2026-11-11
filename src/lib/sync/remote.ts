import type { TrainerPatch } from "./apply-card";
import type { TrainerSyncHead } from "./trainers";
import { readWelcomeSync, type WelcomeSync } from "./welcomes";

export type MarkPush = {
  handle: string;
  outreachSentAt?: string | null;
  inviteSentAt?: string | null;
  doorEnteredAt?: string | null;
  previewToken?: string | null;
};

export type PushStatus = "ok" | "undeployed" | "denied" | "failed";

export type PushOutcome = {
  status: PushStatus;
  tokens: Record<string, string>;
  missing: string[];
};

function origin() {
  return (process.env.SYNC_ORIGIN || "https://trenio.by").replace(/\/$/, "");
}

async function postJson(path: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const token = process.env.SYNC_TOKEN ?? "";
  if (token.length < 32) return { status: 0, json: null };
  const response = await fetch(`${origin()}${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json: json && typeof json === "object" ? json as Record<string, unknown> : null };
}

function tokensOf(json: Record<string, unknown> | null) {
  const raw = json?.tokens;
  if (!raw || typeof raw !== "object") return {};
  const tokens: Record<string, string> = {};
  for (const [handle, token] of Object.entries(raw)) {
    if (typeof token === "string" && token) tokens[handle] = token;
  }
  return tokens;
}

/** Push marks to the live site. This process is the live database when NODE_ENV is production. */
export async function pushMarks(marks: MarkPush[]): Promise<PushOutcome> {
  if (process.env.NODE_ENV === "production") return { status: "ok", tokens: {}, missing: [] };
  try {
    const { status, json } = await postJson("/api/sync/marks", { marks });
    if (status === 404) return { status: "undeployed", tokens: {}, missing: [] };
    if (status === 401) return { status: "denied", tokens: {}, missing: [] };
    if (status !== 200 || json?.ok !== true) return { status: "failed", tokens: {}, missing: [] };
    const missing = Array.isArray(json.missing) ? json.missing.filter((item): item is string => typeof item === "string") : [];
    if (missing.length > 0) return { status: "failed", tokens: tokensOf(json), missing };
    return { status: "ok", tokens: tokensOf(json), missing: [] };
  } catch {
    return { status: "failed", tokens: {}, missing: [] };
  }
}

async function getJson(path: string): Promise<{ status: number; json: Record<string, unknown> | null }> {
  const token = process.env.SYNC_TOKEN ?? "";
  if (token.length < 32) return { status: 0, json: null };
  const response = await fetch(`${origin()}${path}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const json = await response.json().catch(() => null);
  return { status: response.status, json: json && typeof json === "object" ? json as Record<string, unknown> : null };
}

function remoteStatus(status: number, json: Record<string, unknown> | null, read = false): PushStatus {
  if (status === 404 || status === 405) return "undeployed";
  if (read && status === 429) return "failed";
  if (read && (status !== 200 || json?.ok !== true)) return status === 401 ? "denied" : "undeployed";
  if (status === 401) return "denied";
  if (status === 200 && json?.ok === true) return "ok";
  return "failed";
}

export async function fetchWelcomes(): Promise<{ status: PushStatus; welcomes: WelcomeSync[] }> {
  if (process.env.NODE_ENV === "production") return { status: "ok", welcomes: [] };
  try {
    const { status, json } = await getJson("/api/sync/welcomes");
    const result = remoteStatus(status, json, true);
    const welcomes = Array.isArray(json?.welcomes)
      ? json.welcomes.flatMap((row) => {
          const welcome = readWelcomeSync(row);
          return welcome ? [welcome] : [];
        })
      : [];
    return { status: result, welcomes: result === "ok" ? welcomes : [] };
  } catch {
    return { status: "failed", welcomes: [] };
  }
}

export async function fetchTrainerHeads(): Promise<{ status: PushStatus; trainers: TrainerSyncHead[] }> {
  if (process.env.NODE_ENV === "production") return { status: "ok", trainers: [] };
  try {
    const { status, json } = await getJson("/api/sync/trainer");
    const result = remoteStatus(status, json, true);
    const trainers = Array.isArray(json?.trainers) ? json.trainers as TrainerSyncHead[] : [];
    return { status: result, trainers: result === "ok" ? trainers : [] };
  } catch {
    return { status: "failed", trainers: [] };
  }
}

export async function fetchTrainerCard(handle: string): Promise<{
  status: PushStatus;
  card: TrainerPatch["card"];
  head: TrainerSyncHead | null;
  files: Array<{ name?: unknown; data?: unknown }>;
}> {
  if (process.env.NODE_ENV === "production") return { status: "ok", card: null, head: null, files: [] };
  try {
    const { status, json } = await getJson(`/api/sync/trainer?handle=${encodeURIComponent(handle)}`);
    const result = remoteStatus(status, json, true);
    return {
      status: result,
      card: (json?.card ?? null) as TrainerPatch["card"],
      head: (json?.head ?? null) as TrainerSyncHead | null,
      files: Array.isArray(json?.files) ? json.files as Array<{ name?: unknown; data?: unknown }> : [],
    };
  } catch {
    return { status: "failed", card: null, head: null, files: [] };
  }
}

export async function pushTrainerPatch(
  patch: TrainerPatch,
  files: Array<{ name?: unknown; data?: unknown }>,
): Promise<PushStatus> {
  if (process.env.NODE_ENV === "production") return "ok";
  try {
    const { status, json } = await postJson("/api/sync/trainer", { patch, files });
    return remoteStatus(status, json);
  } catch {
    return "failed";
  }
}

export async function pushTrainer(body: unknown): Promise<PushStatus> {
  if (process.env.NODE_ENV === "production") return "ok";
  try {
    const { status, json } = await postJson("/api/sync/trainer", body);
    if (status === 404) return "undeployed";
    if (status === 401) return "denied";
    if (status === 200 && json?.ok === true) return "ok";
    return "failed";
  } catch {
    return "failed";
  }
}
