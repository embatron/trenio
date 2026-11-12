import type { Presence } from "@/lib/messages/schemas";

const LABEL = {
  online: "В сети",
  away: "Был недавно",
  offline: "Не в сети",
} as const;

/** Green is on the site. Orange left the tab or was here within ten minutes. Gray is offline. */
export function PresenceDot({ presence }: { presence: Presence }) {
  const label = LABEL[presence];
  return <span className={`presence presence--${presence}`} title={label} aria-label={label} />;
}
