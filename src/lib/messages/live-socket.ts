import type { Hooks } from "crossws";

import { getSessionUserFromToken } from "@/auth/service";
import type { UserRole } from "@/lib/auth/types";
import { attachLiveSocket, publishTyping } from "@/lib/messages/live-hub";
import { forgetPresence, recordPresence } from "@/lib/messages/presence";
import { liveParticipants } from "@/lib/messages/service";

const SESSION_COOKIE = "trenio_session";

type LiveContext = {
  userId: string;
  roles: UserRole[];
  detach?: () => void;
};

function sessionToken(request: Request) {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== SESSION_COOKIE) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return rest.join("=");
    }
  }
  return null;
}

function frameText(message: { text?: () => string }) {
  if (typeof message.text !== "function") return "";
  const text = message.text();
  return text.length > 240 ? "" : text;
}

export const messageLiveHooks: Partial<Hooks> = {
  async upgrade(request) {
    const user = await getSessionUserFromToken(sessionToken(request));
    if (!user) throw new Response(null, { status: 401 });
    return { context: { userId: user.id, roles: user.roles } satisfies LiveContext };
  },
  open(peer) {
    const context = peer.context as LiveContext;
    context.detach = attachLiveSocket({
      userId: context.userId,
      roles: context.roles,
      send: (payload) => peer.send(payload),
    });
    recordPresence(context.userId, peer, false);
  },
  async message(peer, message) {
    const context = peer.context as LiveContext;
    let body: { type?: unknown; conversationId?: unknown; on?: unknown; visible?: unknown };
    try {
      body = JSON.parse(frameText(message)) as typeof body;
    } catch {
      return;
    }
    if (body.type === "presence") {
      recordPresence(context.userId, peer, body.visible === true);
      return;
    }
    if (body.type !== "typing" || typeof body.conversationId !== "string") return;
    if (!/^[0-9a-f-]{36}$/i.test(body.conversationId)) return;
    const ids = await liveParticipants(body.conversationId, context.userId);
    if (!ids) return;
    publishTyping(body.conversationId, ids, context.userId, body.on === true);
  },
  close(peer) {
    const context = peer.context as LiveContext;
    forgetPresence(context.userId, peer);
    context.detach?.();
  },
};
