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
/** A few pixels of rounding so the last line counts once it clears the pane edge. */
export const READ_EDGE_SLACK = 8;

/**
 * The read cutoff is the bottom edge of the visible log.
 * A message counts once its own bottom has crossed that edge.
 * The same measurement is the phone sheet, the tablet pane, and the wide pane.
 */
export function seenMessageId(
  rows: Array<{ id: number; bottom: number }>,
  paneBottom: number,
  slack = READ_EDGE_SLACK,
): number | null {
  const edge = paneBottom + slack;
  let seen: number | null = null;
  for (const row of rows) {
    if (row.id <= 0 || row.bottom > edge) continue;
    if (seen == null || row.id > seen) seen = row.id;
  }
  return seen;
}

/** Keep the same line on screen when older messages are added above it. */
export function prependedScrollTop(input: {
  scrollTop: number;
  previousHeight: number;
  nextHeight: number;
}): number {
  const delta = input.nextHeight - input.previousHeight;
  if (delta <= 0) return input.scrollTop;
  return input.scrollTop + delta;
}

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
