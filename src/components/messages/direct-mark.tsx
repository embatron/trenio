/**
 * Outline paper plane. On a contact row it sits in a rounded square
 * the same size as the Instagram mark, so the stroke can stay large.
 */
const PLANE = ["M21 3 14.7 21 11.1 12.9 3 9.3Z", "M21 3 11.1 12.9"] as const;

export function DirectMark({ disc = false }: { disc?: boolean }) {
  const plane = PLANE.map((d) => <path key={d} d={d} />);
  if (!disc) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round">
        {plane}
      </svg>
    );
  }
  return (
    <svg viewBox="-1.5 -1.5 27 27" aria-hidden="true">
      <rect className="direct-mark__plate" x="0" y="0" width="24" height="24" rx="5.5" />
      <g fill="none" stroke="#fff" strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round">
        {plane}
      </g>
    </svg>
  );
}

/** Inbox mark. Rounded corners and a curved flap. Still an envelope, not a plane. */
export const MESSAGE_ENVELOPE =
  "M5.2 7.2h13.6a1.8 1.8 0 0 1 1.8 1.8v7.2a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V9a1.8 1.8 0 0 1 1.8-1.8zM4.2 9.2C6.6 11.2 9.2 13.2 12 14.8c2.8-1.6 5.4-3.6 7.8-5.6";
