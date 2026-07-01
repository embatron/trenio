export type BelarusSettlementsPayload = {
  source: string;
  license: string;
  updated: string;
  count: number;
  settlements: string[];
};

let cachedSettlements: string[] | null = null;
let loadPromise: Promise<string[]> | null = null;

export async function loadBelarusSettlements(): Promise<string[]> {
  if (cachedSettlements) return cachedSettlements;
  if (!loadPromise) {
    loadPromise = fetch("/data/belarus-settlements.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load settlements: ${res.status}`);
        return res.json() as Promise<BelarusSettlementsPayload>;
      })
      .then((payload) => {
        cachedSettlements = payload.settlements;
        return cachedSettlements;
      })
      .catch((err) => {
        loadPromise = null;
        throw err;
      });
  }
  return loadPromise;
}

export function filterBelarusSettlements(
  settlements: string[],
  query: string,
  limit = 8,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q || !settlements.length) return [];

  const starts: string[] = [];
  const includes: string[] = [];

  for (const name of settlements) {
    const lower = name.toLowerCase();
    if (lower.startsWith(q)) starts.push(name);
    else if (lower.includes(q)) includes.push(name);
  }

  return [...starts, ...includes].slice(0, limit);
}

/** Областные центры и крупнейшие города — быстрые переключатели в фильтре каталога */
export const BELARUS_QUICK_CITIES = [
  "Минск",
  "Гомель",
  "Могилёв",
  "Витебск",
  "Гродно",
  "Брест",
  "Бобруйск",
  "Барановичи",
  "Пинск",
  "Орша",
] as const;

export function toggleFilterValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}
