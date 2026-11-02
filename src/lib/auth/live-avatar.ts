import { useSyncExternalStore } from "react";

type LiveFace = { userId: string; src: string };

let current: LiveFace | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function versionOf(src: string) {
  const match = /[?&]v=(\d+)/.exec(src);
  return match ? Number(match[1]) : 0;
}

/** The face to paint. A crop preview wins until the saved file replaces it. */
export function visibleAvatar(
  live: LiveFace | null,
  userId: string | null | undefined,
  sessionSrc: string | null | undefined,
) {
  const session = sessionSrc?.trim() ?? "";
  if (!live || !userId || live.userId !== userId) return session;
  const src = live.src.trim();
  if (!src) return session;
  if (src.startsWith("data:") || src.startsWith("blob:")) return src;
  if (!session) return src;
  return versionOf(src) >= versionOf(session) ? src : session;
}

/** Show this face in the header and cabinets before the session reloads. */
export function publishLiveAvatar(userId: string, src: string) {
  const next = src.trim();
  if (!next) {
    if (current?.userId !== userId) return;
    current = null;
    emit();
    return;
  }
  if (current?.userId === userId && current.src === next) return;
  current = { userId, src: next };
  emit();
}

export function useLiveAvatar(userId: string | null | undefined, sessionSrc: string | null | undefined) {
  const live = useSyncExternalStore(subscribe, () => current, () => null);
  return visibleAvatar(live, userId, sessionSrc);
}
