import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { trainerPresenceFn } from "@/lib/catalog/trainer-presence";
import type { Presence } from "@/lib/messages/schemas";

const LABEL: Record<Presence, string> = {
  online: "Тренер сейчас онлайн",
  away: "Тренер отошёл",
  offline: "Тренер сейчас не в сети",
};

const cache = new Map<string, Presence>();
const listeners = new Map<string, Set<(value: Presence) => void>>();
let pending = new Set<string>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let refreshTimer: ReturnType<typeof setInterval> | null = null;

function emit(slug: string, value: Presence) {
  cache.set(slug, value);
  listeners.get(slug)?.forEach((listener) => listener(value));
}

async function flush() {
  const slugs = [...pending].slice(0, 80);
  for (const slug of slugs) pending.delete(slug);
  if (pending.size > 0) schedule();
  if (slugs.length === 0) return;
  try {
    const rows = await trainerPresenceFn({ data: { slugs } });
    for (const slug of slugs) emit(slug, rows[slug] ?? "offline");
  } catch {
    for (const slug of slugs) emit(slug, cache.get(slug) ?? "offline");
  }
}

function schedule() {
  if (flushTimer != null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, 30);
}

function watch(slug: string, listener: (value: Presence) => void) {
  let group = listeners.get(slug);
  if (!group) {
    group = new Set();
    listeners.set(slug, group);
  }
  group.add(listener);
  const known = cache.get(slug);
  if (known) listener(known);
  else {
    pending.add(slug);
    schedule();
  }
  if (refreshTimer == null) {
    refreshTimer = setInterval(() => {
      if (document.visibilityState !== "visible" || listeners.size === 0) return;
      for (const key of listeners.keys()) pending.add(key);
      schedule();
    }, 30_000);
  }
  return () => {
    group?.delete(listener);
    if (group && group.size === 0) listeners.delete(slug);
    if (listeners.size === 0 && refreshTimer != null) {
      clearInterval(refreshTimer);
      refreshTimer = null;
    }
  };
}

function useTrainerPresence(slug: string) {
  const [presence, setPresence] = useState<Presence | null>(() => cache.get(slug) ?? null);
  useEffect(() => watch(slug, setPresence), [slug]);
  return presence;
}

/** A small presence pip after the given name. The phrase appears on hover. */
export function TrainerPresenceMark({ slug, linked = false }: { slug: string; linked?: boolean }) {
  const presence = useTrainerPresence(slug);
  if (!presence) return null;
  const label = LABEL[presence];
  const className = `trainer-presence trainer-presence--${presence}`;
  if (!linked) return <span className={className} title={label} aria-label={label} />;
  return (
    <Link
      className={className}
      to="/trainers/$slug"
      params={{ slug }}
      title={label}
      aria-label={label}
    />
  );
}
