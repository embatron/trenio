import { MESSAGE_ENVELOPE } from "@/components/messages/direct-mark";

const ICONS = {
  overview: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  stats: "M4 19V5M4 19h16M8 15l3.5-4 3 2.5L19 8",
  trainers: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  reviews: "M5 6h14v9H8l-3 3V6z",
  accounts: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
  profile: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  favorites: "M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z",
  likes: "M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
  bookings: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  finance: "M4 5h16v14H4zM4 9h16M8 13h5",
  messages: MESSAGE_ENVELOPE,
  contacts: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM9 8h6M9 12h6M9 16h4",
  site: "M6 3h8l5 5v13H6zM14 3v5h5M8 13h8M8 17h5",
  edit: "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z",
} as const;

export type CabinetIcon = keyof typeof ICONS;

/** The same line mark used by cabinet sidebars and the phone site menu. */
export function CabinetMark({ icon, className }: { icon: CabinetIcon; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path d={ICONS[icon]} />
    </svg>
  );
}
