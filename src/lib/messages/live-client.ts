import { TYPING_HOLD_MS } from "@/lib/messages/live";

type Listener = () => void;

const listeners = new Set<Listener>();
let typingConversationId: string | null = null;
let hold = 0;
let sender: ((conversationId: string, on: boolean) => void) | null = null;
const lastOn = new Map<string, number>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeTyping(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function remoteTyping(conversationId: string) {
  return typingConversationId === conversationId;
}

export function noteRemoteTyping(conversationId: string, on: boolean) {
  window.clearTimeout(hold);
  if (!on) {
    if (typingConversationId === conversationId) typingConversationId = null;
  } else {
    typingConversationId = conversationId;
    hold = window.setTimeout(() => {
      if (typingConversationId === conversationId) typingConversationId = null;
      emit();
    }, TYPING_HOLD_MS);
  }
  emit();
}

export function bindTypingSender(next: (conversationId: string, on: boolean) => void) {
  sender = next;
  return () => {
    if (sender === next) sender = null;
  };
}

const cabinetListeners = new Set<Listener>();

export function subscribeCabinet(listener: Listener) {
  cabinetListeners.add(listener);
  return () => {
    cabinetListeners.delete(listener);
  };
}

export function noteCabinet() {
  for (const listener of cabinetListeners) listener();
}

export type ReactionFrame = {
  conversationId: string;
  messageId: number;
  actorId: string;
  on: boolean;
};

const reactionListeners = new Set<(frame: ReactionFrame) => void>();

export function subscribeReaction(listener: (frame: ReactionFrame) => void) {
  reactionListeners.add(listener);
  return () => {
    reactionListeners.delete(listener);
  };
}

export function noteReaction(frame: ReactionFrame) {
  for (const listener of reactionListeners) listener(frame);
}

/** Tell the other person this field is being typed. Repeats of «on» wait two seconds. */
export function notifyTyping(conversationId: string, on: boolean) {
  const now = Date.now();
  if (on) {
    const last = lastOn.get(conversationId) ?? 0;
    if (now - last < 2_000) return;
    lastOn.set(conversationId, now);
  } else {
    lastOn.delete(conversationId);
  }
  sender?.(conversationId, on);
}
