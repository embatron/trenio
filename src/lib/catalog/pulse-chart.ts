import { periodSpans } from "@/lib/catalog/trainer-periods";

export type PulseChartPoint = {
  day: string;
  shows: number;
  opens: number;
  contacts: number;
  messages: number;
};

export type PulseChartSort = "day" | "shows" | "opens" | "contacts" | "messages";

/** Days of the selected period. Missing or broken points stay off the chart. */
export function pulseChartSpan(
  points: PulseChartPoint[] | null | undefined,
  mode: "day" | "week" | "month",
): PulseChartPoint[] {
  if (!points?.length) return [];
  const today = points.at(-1)?.day;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return [];
  const span = periodSpans(today)[mode].current;
  return points.filter((point) => point.day >= span.start && point.day <= span.end);
}

/** Date stays chronological. A count puts the larger day first. */
export function sortPulseChart(points: PulseChartPoint[], sort: PulseChartSort) {
  const rows = [...points];
  if (sort === "day") return rows.sort((a, b) => a.day.localeCompare(b.day));
  return rows.sort((a, b) => b[sort] - a[sort] || a.day.localeCompare(b.day));
}

export function pulseChartDayLabel(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)));
}
