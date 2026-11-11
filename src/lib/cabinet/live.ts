/** Quiet interval while a cabinet page is visible and the last pull succeeded. */
export const CABINET_LIVE_MS = 20_000;
/** Cap for the wait after a failed pull. */
export const CABINET_LIVE_MAX_MS = 60_000;
/** One socket hint per person, so a burst of views becomes one pull. */
export const CABINET_HINT_MS = 2_000;
/** Closest two cabinet pulls may be after a hint. The quiet poll stays longer. */
export const CABINET_HINT_GAP_MS = 8_000;

export function cabinetLiveDelay(failures: number) {
  if (failures <= 0) return CABINET_LIVE_MS;
  return Math.min(5_000 * 2 ** (failures - 1), CABINET_LIVE_MAX_MS);
}

export function isCabinetPath(pathname: string) {
  return pathname === "/me" || pathname.startsWith("/me/")
    || pathname === "/account" || pathname.startsWith("/account/")
    || pathname === "/admin" || pathname.startsWith("/admin/");
}

/** Trainer statistics and the like history are read on the trainer cabinet only. */
export function cabinetLiveDetail(pathname: string) {
  return pathname === "/me" || pathname.startsWith("/me/");
}

export function sameList(current: readonly string[], next: readonly string[]) {
  return current.length === next.length && current.every((item, index) => item === next[index]);
}

export function mergeCabinetInterest<T extends Record<string, unknown>>(
  ratings: Record<string, T>,
  slug: string | null | undefined,
  interest: Record<string, unknown> | null,
): Record<string, T> {
  if (!slug || !interest) return ratings;
  const current = ratings[slug];
  if (!current) return ratings;
  return { ...ratings, [slug]: { ...current, ...interest } };
}
