/** How long the other side keeps «печатает…» after the last keystroke. */
export const TYPING_HOLD_MS = 4_000;

/** A frame stays with the two people in the thread. A staff role does not add a reader. */
export function shouldReceiveThread(userId: string, _staff: boolean, participantIds: readonly string[]) {
  return participantIds.includes(userId);
}

export function shouldReceiveTyping(userId: string, fromUserId: string, participantIds: readonly string[]) {
  return userId !== fromUserId && participantIds.includes(userId);
}
