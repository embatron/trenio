import type { MessageNotice } from "@/lib/messages/schemas";

const MESSAGE_PATHS = ["/admin/messages", "/account/messages", "/me/messages"];

/** The inbox already shows the new row, so the page does not also toast. */
export function onMessagePage(pathname: string) {
  return MESSAGE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Toast only for a message that arrived after this tab already knew the inbox.
 * The first snapshot is the baseline: old unread stays a badge.
 */
export function nextMessageAnnounce(
  seen: number | null,
  notice: MessageNotice | null,
  pathname: string,
): { seen: number; announce: boolean } {
  const nextSeen = notice ? notice.messageId : (seen ?? 0);
  if (seen == null) return { seen: nextSeen, announce: false };
  const announce = notice != null && notice.messageId > seen && !onMessagePage(pathname);
  return { seen: notice ? Math.max(seen, notice.messageId) : seen, announce };
}
