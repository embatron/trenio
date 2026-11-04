import { pluralRu } from "@/lib/ru-plural";

export type HomeStatCounts = {
  trainers: number;
  sports: number;
  cities: number;
  experience: number | null;
};

/** One eased step from zero toward the real totals. Progress is 0…1. */
export function homeStatFrame(target: HomeStatCounts, progress: number): HomeStatCounts {
  const t = Math.min(1, Math.max(0, progress));
  const eased = 1 - (1 - t) ** 3;
  const step = (value: number) => Math.round(value * eased);
  return {
    trainers: step(target.trainers),
    sports: step(target.sports),
    cities: step(target.cities),
    experience: target.experience == null ? null : step(target.experience),
  };
}

/** Captions under the homepage numbers. The noun agrees with the count. */
export function homeStatLabels(stats: HomeStatCounts) {
  return [
    {
      id: "trainers",
      n: String(stats.trainers),
      l: `${pluralRu(stats.trainers, "тренер", "тренера", "тренеров")} на платформе`,
    },
    {
      id: "sports",
      n: String(stats.sports),
      l: `${pluralRu(stats.sports, "вид", "вида", "видов")} спорта`,
    },
    {
      id: "cities",
      n: String(stats.cities),
      l: `${pluralRu(stats.cities, "город", "города", "городов")} Беларуси`,
    },
    {
      id: "experience",
      n: stats.experience == null ? "—" : String(stats.experience),
      l: stats.experience == null
        ? "средний стаж"
        : `${pluralRu(stats.experience, "год", "года", "лет")} среднего стажа`,
    },
  ];
}
