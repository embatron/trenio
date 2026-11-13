/** Phone sheet. Matches the messages workspace. */
export const PHONE_SHEET = "(max-width: 767px)";

const THREAD = /^\/(?:account|me)\/messages\/[^/]+$/;

export function barePath(pathname: string): string {
  return pathname.split("?")[0].replace(/\/+$/, "") || "/";
}

/** Dialog list for a user or trainer thread. Admin stays on one URL. */
export function messageListPath(pathname: string): "/account/messages" | "/me/messages" | null {
  const path = barePath(pathname);
  if (path === "/account/messages" || path.startsWith("/account/messages/")) return "/account/messages";
  if (path === "/me/messages" || path.startsWith("/me/messages/")) return "/me/messages";
  return null;
}

export function isMessageThreadPath(pathname: string): boolean {
  return THREAD.test(barePath(pathname));
}

/**
 * The system back button left an open dialog for a page that is not its list.
 * The list should open on top of that page. The next back reaches it.
 */
export function backShouldOpenDialogList(fromPath: string, toPath: string): boolean {
  if (!isMessageThreadPath(fromPath)) return false;
  const list = messageListPath(fromPath);
  if (!list) return false;
  return barePath(toPath) !== list;
}

/** History flag: this list entry already pushed its trainer dialog. */
export const TRAINER_DIALOG_OPENED = "trainerDialogOpened";

export function markTrainerDialogOpened(state: unknown, trainer: string): Record<string, unknown> | null {
  if (!state || typeof state !== "object") return null;
  return { ...(state as Record<string, unknown>), [TRAINER_DIALOG_OPENED]: trainer };
}

export function trainerDialogAlreadyOpened(state: unknown, trainer: string): boolean {
  if (!state || typeof state !== "object") return false;
  return (state as { trainerDialogOpened?: unknown }).trainerDialogOpened === trainer;
}
