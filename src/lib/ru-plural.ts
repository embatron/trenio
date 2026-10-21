/** Russian noun after a number: 1 тренер, 3 тренера, 5 тренеров, 11 тренеров, 21 тренер. */
export function pluralRu(count: number, one: string, few: string, many: string) {
  const n = Math.abs(Math.trunc(count));
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function countRu(count: number, one: string, few: string, many: string) {
  return `${count} ${pluralRu(count, one, few, many)}`;
}
