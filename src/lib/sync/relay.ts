import { mirrorDoorToProduction, type DoorMirror } from "@/lib/catalog/outreach-mirror.server";

import { pushMarks } from "./remote";

export type RelayVia = "api" | "server" | "local";

/** Write one door mark on the live site, then fall back to the server database. */
export async function relayDoorMark(input: DoorMirror): Promise<{ ok: boolean; token: string; via: RelayVia }> {
  const pushed = await pushMarks([{
    handle: input.handle,
    previewToken: input.token,
    outreachSentAt: input.outreachAt,
    inviteSentAt: input.linkAt,
  }]);
  if (pushed.status === "ok") {
    return { ok: true, token: pushed.tokens[input.handle] || input.token, via: "api" };
  }
  const mirrored = await mirrorDoorToProduction(input);
  if (mirrored.reason === "failed") return { ok: false, token: input.token, via: "server" };
  return {
    ok: true,
    token: mirrored.token || input.token,
    via: mirrored.reason === "local" ? "local" : "server",
  };
}
