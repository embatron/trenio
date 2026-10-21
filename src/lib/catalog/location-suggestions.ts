import { filterBelarusCities } from "@/lib/catalog/city-taxonomy";

/** Fills a search combo with Belarus city suggestions. */
export function renderLocationSuggestions(menu: HTMLElement, query: string) {
  menu.replaceChildren();
  for (const city of filterBelarusCities(query)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "combo-option";
    button.dataset.value = city;
    button.dataset.keywords = city.toLowerCase();
    button.textContent = city;
    menu.append(button);
  }
}
