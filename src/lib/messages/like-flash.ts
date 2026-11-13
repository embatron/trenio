export type ReactionNote = {
  messageId: number;
  actorId: string;
  on: boolean;
};

export function reactionOn(message: { liked: boolean; peerLiked?: boolean }) {
  return message.liked || message.peerLiked === true;
}

/** Ids that just turned on. A first paint and a newly loaded row do not blink. */
export function freshReactionIds(
  previous: ReadonlyMap<number, boolean> | null,
  messages: readonly { id: number; liked: boolean; peerLiked?: boolean }[],
) {
  if (!previous) return [];
  const born: number[] = [];
  for (const message of messages) {
    if (message.id <= 0) continue;
    if (reactionOn(message) && previous.get(message.id) === false) born.push(message.id);
  }
  return born;
}

export function reactionSnapshot(
  messages: readonly { id: number; liked: boolean; peerLiked?: boolean }[],
) {
  const next = new Map<number, boolean>();
  for (const message of messages) {
    if (message.id > 0) next.set(message.id, reactionOn(message));
  }
  return next;
}

export function patchMessageReaction<T extends { id: number; liked: boolean; peerLiked: boolean }>(
  messages: readonly T[],
  viewerId: string,
  note: ReactionNote,
) {
  return messages.map((message) => {
    if (message.id !== note.messageId) return message;
    if (note.actorId === viewerId) return { ...message, liked: note.on };
    return { ...message, peerLiked: note.on };
  });
}
