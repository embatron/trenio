/** A later open of the same page counts when the browser has been away this long. */
export const VISIT_GAP_MS = 30 * 60 * 1000;

/** True when this open is a new visit. An immediate reload stays the same visit. */
export function visitCountsAsNew(previousAt: number | null, now: number, gapMs = VISIT_GAP_MS) {
  return previousAt == null || now - previousAt >= gapMs;
}
