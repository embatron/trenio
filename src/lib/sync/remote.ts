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
