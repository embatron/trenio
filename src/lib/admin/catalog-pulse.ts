import { addDays } from "@/lib/catalog/trainer-periods";
import { isLocalOnlyRow } from "@/lib/sync/policy";

/** Calendar length on the admin overview. Today is the last block. */
export const CATALOG_PULSE_DAYS = 90;

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
  sport: string;
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
  sports: CatalogShare[];
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

  const start = addDays(today, -(CATALOG_PULSE_DAYS - 1));
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
      label: `${parts.date} ${parts.monthFull}: ${publishedCount} в каталог, ${addedCount} новых`,
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
      { label: "Аккаунт не подтверждён", count: published.filter((row) => !row.verified).length },
      { label: "Без владельца", count: published.filter((row) => !row.owned).length },
    ].filter((row) => row.count > 0),
    publishedTotal,
  );

  const sportCounts = new Map<string, number>();
  let sportless = 0;
  for (const row of published) {
    const sport = row.sport.trim();
    if (!sport) {
      sportless += 1;
      continue;
    }
    sportCounts.set(sport, (sportCounts.get(sport) ?? 0) + 1);
  }
  const sports = shares(
    [...sportCounts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "ru"))
      .slice(0, 8),
    publishedTotal,
  );
  if (sportless > 0) {
    sports.push({ label: "Вид не указан", count: sportless, percent: percent(sportless, publishedTotal) });
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
    sports,
  };
}

export function emptyCatalogPulse(today: string) {
  return buildCatalogPulse([], today);
}
