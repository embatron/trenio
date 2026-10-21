import {
  getSportTaxonomyChild,
  getTopLevelSportCategory,
  TOP_LEVEL_SPORT_CATEGORIES,
} from "@/lib/catalog/sport-taxonomy";

type SportSuggestion = {
  label: string;
  keywords: string;
};

const QUICK_SPORT_SLUGS = ["boks", "fitnes", "yoga", "plavanie", "futbol", "bolshoj-tennis"];

function fold(value: string) {
  return value.trim().toLowerCase().replace(/ё/g, "е");
}

function labelForSlug(slug: string) {
  return getSportTaxonomyChild(slug)?.label ?? getTopLevelSportCategory(slug)?.label;
}

function buildCatalog(): SportSuggestion[] {
  const byLabel = new Map<string, Set<string>>();
  const add = (label: string, words: Array<string | undefined>) => {
    const name = label.trim();
    if (!name) return;
    const bag = byLabel.get(name) ?? new Set<string>();
    bag.add(fold(name));
    for (const word of words) {
      const folded = word ? fold(word) : "";
      if (folded) bag.add(folded);
    }
    byLabel.set(name, bag);
  };

  for (const category of TOP_LEVEL_SPORT_CATEGORIES) {
    add(category.label, [category.label, ...(category.aliases ?? [])]);
    for (const child of category.children) {
      add(child.label, [child.label, category.label, ...(child.aliases ?? []), ...(category.aliases ?? [])]);
    }
  }

  return [...byLabel.entries()].map(([label, words]) => ({
    label,
    keywords: [...words].join(" "),
  }));
}

const SPORT_SUGGESTIONS = buildCatalog();

/** Labels shown before the visitor types. Each one is resolved from the sport taxonomy. */
export function quickSportLabels(): string[] {
  const labels: string[] = [];
  for (const slug of QUICK_SPORT_SLUGS) {
    const label = labelForSlug(slug);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}

export function filterSportSuggestions(query: string, limit = 8): string[] {
  const q = fold(query);
  if (!q) return quickSportLabels();

  const starts: string[] = [];
  const includes: string[] = [];
  for (const item of SPORT_SUGGESTIONS) {
    const label = fold(item.label);
    if (label.startsWith(q)) starts.push(item.label);
    else if (item.keywords.includes(q)) includes.push(item.label);
  }
  return [...starts, ...includes].slice(0, limit);
}

/** Fills a search combo with sport suggestions from the taxonomy. */
export function renderSportSuggestions(menu: HTMLElement, query: string) {
  menu.replaceChildren();
  for (const sport of filterSportSuggestions(query)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "combo-option";
    button.dataset.value = sport;
    button.dataset.keywords = fold(sport);
    button.textContent = sport;
    menu.append(button);
  }
}
