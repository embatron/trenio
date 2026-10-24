// upgrade path: PartyKit self-hosted, schema unchanged.
export const MESSAGE_SCAN_MS = 5_000;
export const CONVERSATION_POLL_MS = 5_000;
export const THREAD_POLL_MS = 5_000;

/** Pause polling while the tab is hidden. The interval restarts on the next visible refetch. */
export function visiblePollInterval(ms: number) {
  return () => {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return false as const;
    return ms;
  };
}
