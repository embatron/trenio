export type AdminDayStats = {
  published: number;
  publishedTotal: number;
  chats: number;
  reviews: number;
  contactClicks: number;
  applications: number;
};

/** Zero stays `0`. A positive count keeps the plus from the admin note. */
export function adminStatValue(count: number): string {
  const n = Math.max(0, Math.floor(count));
  return n === 0 ? "0" : `+${n}`;
}

/** Calendar day in Minsk, `ДД.ММ.ГГ`. */
export function adminDigestDate(when: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Minsk",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).formatToParts(when);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${pick("day")}.${pick("month")}.${pick("year")}`;
}

export function adminDigestText(stats: AdminDayStats, when = new Date()): string {
  return [
    `Админские статы за ${adminDigestDate(when)}`,
    "",
    `Тренеров опубликовано: ${adminStatValue(stats.published)} (всего ${Math.max(0, Math.floor(stats.publishedTotal))})`,
    `Открыто внутренних чатов: ${adminStatValue(stats.chats)}`,
    `Отзывов написано: ${adminStatValue(stats.reviews)}`,
    `Переходов по контактам: ${adminStatValue(stats.contactClicks)}`,
    `Новых заявок от тренеров: ${adminStatValue(stats.applications)}`,
  ].join("\n");
}
