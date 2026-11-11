/** How long the other side keeps «печатает…» after the last keystroke. */
export const TYPING_HOLD_MS = 4_000;

export function shouldReceiveThread(userId: string, staff: boolean, participantIds: readonly string[]) {
  return staff || participantIds.includes(userId);
}

export function shouldReceiveTyping(userId: string, fromUserId: string, participantIds: readonly string[]) {
  return userId !== fromUserId && participantIds.includes(userId);
}
