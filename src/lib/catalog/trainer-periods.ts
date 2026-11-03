export type TrainerViewPeriod = {
  current: number;
  previous: number;
};

export type TrainerViewStats = {
  day: TrainerViewPeriod;
  week: TrainerViewPeriod;
  month: TrainerViewPeriod;
};

export type TrainerFavoriteStats = TrainerViewStats & {
  total: number;
};

export const emptyViewStats: TrainerViewStats = {
  day: { current: 0, previous: 0 },
  week: { current: 0, previous: 0 },
  month: { current: 0, previous: 0 },
};

export const emptyFavoriteStats: TrainerFavoriteStats = {
  total: 0,
  ...emptyViewStats,
};

export function minskToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOffset(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const sunday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sunday + 6) % 7;
}

type Span = { start: string; end: string };

export function periodSpans(today: string) {
  const weekStart = addDays(today, -mondayOffset(today));
  const monthStart = `${today.slice(0, 8)}01`;
  const previousMonthEnd = addDays(monthStart, -1);
  const previousMonthStart = `${previousMonthEnd.slice(0, 8)}01`;
  return {
    day: {
      current: { start: today, end: today },
      previous: { start: addDays(today, -1), end: addDays(today, -1) },
    },
    week: {
      current: { start: weekStart, end: today },
      previous: { start: addDays(weekStart, -7), end: addDays(weekStart, -1) },
    },
    month: {
      current: { start: monthStart, end: today },
      previous: { start: previousMonthStart, end: previousMonthEnd },
    },
  };
}

export function sumBetween(rows: Array<{ day: string; total: number }>, start: string, end: string) {
  return rows.reduce((sum, row) => (row.day >= start && row.day <= end ? sum + row.total : sum), 0);
}

export function statsFromDaily(rows: Array<{ day: string; total: number }>, today: string): TrainerViewStats {
  const spans = periodSpans(today);
  const pick = (span: Span) => sumBetween(rows, span.start, span.end);
  return {
    day: { current: pick(spans.day.current), previous: pick(spans.day.previous) },
    week: { current: pick(spans.week.current), previous: pick(spans.week.previous) },
    month: { current: pick(spans.month.current), previous: pick(spans.month.previous) },
  };
}

/** Europe/Minsk midnight. Belarus stays at UTC+3. */
export function minskDayStart(iso: string) {
  return new Date(`${iso}T00:00:00+03:00`).getTime();
}

export function countCreatedBetween(times: number[], start: string, end: string) {
  const from = minskDayStart(start);
  const to = minskDayStart(addDays(end, 1));
  return times.reduce((sum, time) => (time >= from && time < to ? sum + 1 : sum), 0);
}

/** Saves that still exist, grouped by the Minsk day they were added. */
export function favoriteStats(times: number[], today: string): TrainerFavoriteStats {
  const spans = periodSpans(today);
  const pick = (span: Span) => countCreatedBetween(times, span.start, span.end);
  return {
    total: times.length,
    day: { current: pick(spans.day.current), previous: pick(spans.day.previous) },
    week: { current: pick(spans.week.current), previous: pick(spans.week.previous) },
    month: { current: pick(spans.month.current), previous: pick(spans.month.previous) },
  };
}
