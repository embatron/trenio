import { addDays } from "@/lib/catalog/trainer-periods";
import { isLocalOnlyRow } from "@/lib/sync/policy";

/** First day on the admin calendar. The catalog opened on this date. Today is the last block. */
export const CATALOG_PULSE_START = "2026-10-31";

export type CatalogPulseInput = {
  slug: string;
  handle: string;
  status: string;
  city: string;
  createdAt: Date | string | null;
  publishedAt: Date | string | null;
  outreach: boolean;
  invite: boolean;
  door: boolean;
  owned: boolean;
  verified: boolean;
  hasPhoto: boolean;
  hasPrice: boolean;
  hasPhone: boolean;
  hasAddress: boolean;
  hasStreet: boolean;
  section: string;
};

export type CatalogShare = {
  label: string;
  count: number;
  percent: number;
};

export type CatalogDay = {
  day: string;
  weekday: string;
  date: number;
  month: string;
  added: number;
  published: number;
  label: string;
};

export type CatalogPulse = {
  publishedTotal: number;
  cardsTotal: number;
  cities: CatalogShare[];
  days: CatalogDay[];
  addedInWindow: number;
  publishedInWindow: number;
  statuses: CatalogShare[];
  gaps: CatalogShare[];
  sections: CatalogShare[];
};

const STATUS_ORDER = ["published", "draft", "hidden", "archived", "declined"] as const;

const STATUS_LABEL: Record<(typeof STATUS_ORDER)[number], string> = {
  published: "Опубликованы",
  draft: "Черновики",
  hidden: "Скрыты",
  archived: "Сняты",
  declined: "Отказались",
};

const WEEKDAYS = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
const MONTHS = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const MONTHS_FULL = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

function percent(count: number, total: number) {
  if (total <= 0 || count <= 0) return 0;
  return Math.round((count / total) * 100);
}

function shares(rows: Array<{ label: string; count: number }>, total: number): CatalogShare[] {
  return rows.map((row) => ({ ...row, percent: percent(row.count, total) }));
}

function asDate(value: Date | string | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minskDay(date: Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dayParts(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day));
  return {
    date: day,
    weekday: WEEKDAYS[utc.getUTCDay()] ?? "",
    month: MONTHS[month - 1] ?? "",
    monthFull: MONTHS_FULL[month - 1] ?? "",
  };
}

/** Staff figures for the catalog. The laptop fixture stays out. Days are Europe/Minsk. */
export function buildCatalogPulse(rows: CatalogPulseInput[], today: string): CatalogPulse {
  const cards = rows.filter((row) => !isLocalOnlyRow({ slug: row.slug, handle: row.handle }));
  const published = cards.filter((row) => row.status === "published");
  const publishedTotal = published.length;

  const cityCounts = new Map<string, number>();
  for (const row of published) {
    const label = row.city.trim() || "Без города";
    cityCounts.set(label, (cityCounts.get(label) ?? 0) + 1);
  }
  const cities = shares(
    [...cityCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru")),
    publishedTotal,
  );

  const start = today < CATALOG_PULSE_START ? today : CATALOG_PULSE_START;
  const added = new Map<string, number>();
  const appeared = new Map<string, number>();
  for (const row of cards) {
    const created = asDate(row.createdAt);
    if (created) {
      const day = minskDay(created);
      if (day >= start && day <= today) added.set(day, (added.get(day) ?? 0) + 1);
    }
    const stamped = asDate(row.publishedAt) ?? (row.status === "published" ? created : null);
    if (stamped) {
      const day = minskDay(stamped);
      if (day >= start && day <= today) appeared.set(day, (appeared.get(day) ?? 0) + 1);
    }
  }

  const days: CatalogDay[] = [];
  for (let cursor = start; cursor <= today; cursor = addDays(cursor, 1)) {
    const parts = dayParts(cursor);
    const publishedCount = appeared.get(cursor) ?? 0;
    const addedCount = added.get(cursor) ?? 0;
    days.push({
      day: cursor,
      weekday: parts.weekday,
      date: parts.date,
      month: parts.month,
      added: addedCount,
      published: publishedCount,
      label: `${parts.date} ${parts.monthFull}: ${publishedCount} опубликовано, ${addedCount} новых`,
    });
  }

  const statusCounts = new Map<string, number>(STATUS_ORDER.map((status) => [status, 0]));
  for (const row of cards) statusCounts.set(row.status, (statusCounts.get(row.status) ?? 0) + 1);
  const statuses = shares(
    STATUS_ORDER.map((status) => ({ label: STATUS_LABEL[status], count: statusCounts.get(status) ?? 0 })),
    cards.length,
  );

  const gaps = shares(
    [
      { label: "Без фото", count: published.filter((row) => !row.hasPhoto).length },
      { label: "Без цены", count: published.filter((row) => !row.hasPrice).length },
      { label: "Без телефона", count: published.filter((row) => !row.hasPhone).length },
      { label: "Без города", count: published.filter((row) => !row.city.trim()).length },
      { label: "Без адреса", count: published.filter((row) => !row.hasAddress).length },
      { label: "Без улицы", count: published.filter((row) => !row.hasStreet).length },
      { label: "Аккаунт не подтверждён", count: published.filter((row) => !row.verified).length },
    ].filter((row) => row.count > 0),
    publishedTotal,
  );

  const sectionCounts = new Map<string, number>();
  let sectionless = 0;
  for (const row of published) {
    const section = row.section.trim();
    if (!section) {
      sectionless += 1;
      continue;
    }
    sectionCounts.set(section, (sectionCounts.get(section) ?? 0) + 1);
  }
  const sections = shares(
    [...sectionCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru")),
    publishedTotal,
  );
  if (sectionless > 0) {
    sections.push({ label: "Раздел не указан", count: sectionless, percent: percent(sectionless, publishedTotal) });
  }

  return {
    publishedTotal,
    cardsTotal: cards.length,
    cities,
    days,
    addedInWindow: [...added.values()].reduce((sum, count) => sum + count, 0),
    publishedInWindow: [...appeared.values()].reduce((sum, count) => sum + count, 0),
    statuses,
    gaps,
    sections,
  };
}

export function emptyCatalogPulse(today: string) {
  return buildCatalogPulse([], today);
}
