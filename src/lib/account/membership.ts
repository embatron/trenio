/** Whole calendar days in Europe/Minsk from the account's first day until today. */
export function membershipDays(createdAt: Date, now: Date): number {
  const start = Date.parse(`${minskDay(createdAt)}T00:00:00+03:00`);
  const today = Date.parse(`${minskDay(now)}T00:00:00+03:00`);
  if (!Number.isFinite(start) || !Number.isFinite(today)) return 0;
  return Math.max(0, Math.round((today - start) / 86_400_000));
}

function minskDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
