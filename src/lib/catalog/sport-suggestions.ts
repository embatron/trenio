import { filterCatalogSports } from "@/lib/catalog/catalog-sports";
import { foldSearchText } from "@/lib/catalog/query-flex";
import {
  getSportTaxonomyChild,
  getTopLevelSportCategory,
} from "@/lib/catalog/sport-taxonomy";

const QUICK_SPORT_SLUGS = ["boks", "fitnes", "yoga", "plavanie", "futbol", "bolshoj-tennis"];

function fold(value: string) {
  return foldSearchText(value);
}

function labelForSlug(slug: string) {
  return getSportTaxonomyChild(slug)?.label ?? getTopLevelSportCategory(slug)?.label;
}

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
  if (!fold(query)) return quickSportLabels();
  const labels: string[] = [];
  for (const sport of filterCatalogSports(query, limit)) {
    if (!labels.includes(sport.label)) labels.push(sport.label);
  }
  return labels;
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
