import { isStaff } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/auth/types";
import { CABINET_HINT_MS } from "@/lib/cabinet/live";
import { shouldReceiveThread, shouldReceiveTyping } from "@/lib/messages/live";

export type LiveSocket = {
  userId: string;
  roles: UserRole[];
  send: (payload: string) => void;
};

type Hub = { sockets: Set<LiveSocket>; cabinetWait: Set<string> };

const KEY = Symbol.for("trenio.message.live");

function hub(): Hub {
  const scope = globalThis as typeof globalThis & { [KEY]?: Hub };
  if (!scope[KEY]) scope[KEY] = { sockets: new Set(), cabinetWait: new Set() };
  if (!scope[KEY].cabinetWait) scope[KEY].cabinetWait = new Set();
  return scope[KEY];
}

export function attachLiveSocket(socket: LiveSocket) {
  const sockets = hub().sockets;
  sockets.add(socket);
  return () => {
    sockets.delete(socket);
  };
}

function safeSend(socket: LiveSocket, payload: string) {
  try {
    socket.send(payload);
  } catch {
    /* a closing tab is not a dialog failure */
  }
}

/** Tell open pages that a thread changed. Participants also refresh the unread total. */
export function publishThread(conversationId: string, participantIds: readonly string[]) {
  const thread = JSON.stringify({ type: "thread", conversationId });
  const unread = JSON.stringify({ type: "unread" });
  for (const socket of hub().sockets) {
    if (!shouldReceiveThread(socket.userId, isStaff(socket.roles), participantIds)) continue;
    safeSend(socket, thread);
    if (participantIds.includes(socket.userId)) safeSend(socket, unread);
  }
}

/** Ask this person's open pages to pull cabinet numbers. A burst stays one hint. */
export function publishCabinet(userIds: readonly (string | null | undefined)[]) {
  const state = hub();
  for (const userId of userIds) {
    if (!userId || state.cabinetWait.has(userId)) continue;
    let open = false;
    for (const socket of state.sockets) {
      if (socket.userId === userId) {
        open = true;
        break;
      }
    }
    if (!open) continue;
    state.cabinetWait.add(userId);
    setTimeout(() => {
      state.cabinetWait.delete(userId);
      const payload = JSON.stringify({ type: "cabinet" });
      for (const socket of state.sockets) {
        if (socket.userId === userId) safeSend(socket, payload);
      }
    }, CABINET_HINT_MS);
  }
}

/** The other person in the pair sees that this account is typing. Staff do not. */
export function publishTyping(conversationId: string, participantIds: readonly string[], fromUserId: string, on: boolean) {
  const payload = JSON.stringify({ type: "typing", conversationId, on });
  for (const socket of hub().sockets) {
    if (!shouldReceiveTyping(socket.userId, fromUserId, participantIds)) continue;
    safeSend(socket, payload);
  }
}
