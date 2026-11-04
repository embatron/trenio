import { pluralRu } from "@/lib/ru-plural";

export type HomeStatCounts = {
  trainers: number;
  sports: number;
  cities: number;
  experience: number | null;
};

/** Captions under the homepage numbers. The noun agrees with the count. */
export function homeStatLabels(stats: HomeStatCounts) {
  return [
    {
      n: String(stats.trainers),
      l: `${pluralRu(stats.trainers, "тренер", "тренера", "тренеров")} на платформе`,
    },
    {
      n: String(stats.sports),
      l: `${pluralRu(stats.sports, "вид", "вида", "видов")} спорта`,
    },
    {
      n: String(stats.cities),
      l: `${pluralRu(stats.cities, "город", "города", "городов")} Беларуси`,
    },
    {
      n: stats.experience == null ? "—" : String(stats.experience),
      l: stats.experience == null
        ? "средний стаж"
        : `${pluralRu(stats.experience, "год", "года", "лет")} среднего стажа`,
    },
  ];
}
