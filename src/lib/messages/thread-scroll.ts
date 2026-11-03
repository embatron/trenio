export type ScrollMessage = {
  id: number;
  mine: boolean;
};

/** Oldest loaded message this participant has not read. Staff who are only watching stay caught up. */
export function firstUnreadMessageId(
  messages: ScrollMessage[],
  readUpTo: number | null | undefined,
  participant: boolean,
): number | null {
  if (!participant || readUpTo === undefined) return null;
  for (const message of messages) {
    if (message.mine || message.id <= 0) continue;
    if (readUpTo == null || message.id > readUpTo) return message.id;
  }
  return null;
}

/**
 * Pin the log to the bottom when the unread tail fits.
 * A taller tail keeps the top of that message on screen, 8px below the pane edge.
 */
export function messageScrollTop(input: {
  anchorTop: number | null;
  scrollHeight: number;
  clientHeight: number;
}): { top: number; stick: boolean } {
  const bottom = Math.max(0, input.scrollHeight - input.clientHeight);
  if (input.anchorTop == null || input.clientHeight <= 0) return { top: bottom, stick: true };
  const tail = input.scrollHeight - input.anchorTop;
  if (tail > input.clientHeight + 1) return { top: Math.max(0, input.anchorTop - 8), stick: false };
  return { top: bottom, stick: true };
}
