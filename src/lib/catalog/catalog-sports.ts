import { listCityCatalogPages, type CityCatalogPage } from "@/lib/catalog/city-pages";
import {
  TOP_LEVEL_SPORT_CATEGORIES,
  getTopLevelSportCategory,
} from "@/lib/catalog/sport-taxonomy";

/** Public origin for canonical URLs and the sitemap. */
export const CATALOG_ORIGIN = "https://trenio.by";

export type CatalogSport = {
  id: string;
  slug: string;
  parentSlug: string;
  label: string;
  titleGenitive: string;
  level: 1 | 2;
  parentLabel: string;
  aliases: string[];
};

const SPORTS: CatalogSport[] = buildCatalogSports();

function buildCatalogSports(): CatalogSport[] {
  const used = new Set<string>();
  const sports: CatalogSport[] = [];

  for (const category of TOP_LEVEL_SPORT_CATEGORIES) {
    if (category.published === false) continue;
    used.add(category.slug);
    sports.push({
      id: category.slug,
      slug: category.slug,
      parentSlug: category.slug,
      label: category.label,
      titleGenitive: category.titleGenitive,
      level: 1,
      parentLabel: category.label,
      aliases: category.aliases ?? [],
    });

    for (const child of category.children) {
      const nested = Boolean(getTopLevelSportCategory(child.slug)) || used.has(child.slug);
      const id = nested ? `${category.slug}/${child.slug}` : child.slug;
      used.add(child.slug);
      used.add(id);
      sports.push({
        id,
        slug: child.slug,
        parentSlug: category.slug,
        label: child.label,
        titleGenitive: child.titleGenitive || child.label,
        level: 2,
        parentLabel: category.label,
        aliases: child.aliases ?? [],
      });
    }
  }

  return sports;
}

export function listCatalogSports(): CatalogSport[] {
  return SPORTS;
}

export function catalogSportById(id: string): CatalogSport | null {
  const direct = SPORTS.find((sport) => sport.id === id);
  if (direct) return direct;
  return SPORTS.find((sport) => sport.level === 2 && `${sport.parentSlug}/${sport.slug}` === id) ?? null;
}

export function catalogSportsFromQuery(value: string | undefined, limit = 8): CatalogSport[] {
  if (!value) return [];
  const seen = new Set<string>();
  const sports: CatalogSport[] = [];
  for (const part of value.split(",")) {
    const sport = catalogSportById(part.trim());
    if (!sport || seen.has(sport.id)) continue;
    seen.add(sport.id);
    sports.push(sport);
    if (sports.length === limit) break;
  }
  return sports;
}

function fold(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

/** Exact label or alias. A partial query stays a suggestion, not a selected sport. */
export function catalogSportByName(query: string): CatalogSport | null {
  const q = fold(query);
  if (!q) return null;
  return SPORTS.find((sport) => fold(sport.label) === q || sport.aliases.some((alias) => fold(alias) === q)) ?? null;
}

/** Second-level sports that belong to one top-level category. */
export function catalogCategorySports(parentSlug: string): CatalogSport[] {
  return SPORTS.filter((sport) => sport.level === 2 && sport.parentSlug === parentSlug);
}

export function filterCatalogSports(query: string, limit = 8): CatalogSport[] {
  const q = fold(query);
  if (!q) return SPORTS.filter((sport) => sport.level === 1).slice(0, limit);

  const rank = (sport: CatalogSport) => {
    const label = fold(sport.label);
    if (label.startsWith(q)) return 0;
    if (sport.aliases.some((alias) => fold(alias).startsWith(q))) return 1;
    if (label.includes(q)) return 2;
    if (sport.aliases.some((alias) => fold(alias).includes(q))) return 3;
    if (sport.level === 2 && fold(sport.parentLabel).includes(q)) return 4;
    return 9;
  };

  return SPORTS
    .map((sport) => ({ sport, rank: rank(sport) }))
    .filter((item) => item.rank < 9)
    .sort((a, b) => a.rank - b.rank || a.sport.level - b.sport.level || a.sport.label.localeCompare(b.sport.label, "ru"))
    .slice(0, limit)
    .map((item) => item.sport);
}

export function catalogSportPath(citySlug: string, sport: CatalogSport) {
  if (sport.id.includes("/")) return `/city/${citySlug}/${sport.parentSlug}/${sport.slug}`;
  return `/city/${citySlug}/${sport.slug}`;
}

export function catalogSportLocation(citySlug: string, sport: CatalogSport) {
  if (sport.id.includes("/")) {
    return {
      to: "/city/$slug/$sport/$child" as const,
      params: { slug: citySlug, sport: sport.parentSlug, child: sport.slug },
    };
  }
  return {
    to: "/city/$slug/$sport" as const,
    params: { slug: citySlug, sport: sport.slug },
  };
}

export function trainerMatchesSportSelection(
  card: { sportSlugs: string[]; sportParents: string[]; tags: string[] },
  sports: CatalogSport[],
  query: string,
) {
  const q = fold(query);
  const hasSelection = sports.length > 0;
  const hasQuery = q.length > 0;
  if (!hasSelection && !hasQuery) return true;

  const matchesSport = (sport: CatalogSport) =>
    sport.level === 1
      ? card.sportParents.includes(sport.slug) || card.sportSlugs.includes(sport.slug)
      : card.sportSlugs.includes(sport.slug);

  if (hasSelection && sports.some(matchesSport)) return true;
  if (!hasQuery) return false;

  if (card.tags.some((tag) => fold(tag).includes(q))) return true;
  return card.sportSlugs.some((slug) => {
    const sport = catalogSportById(slug);
    if (!sport) return false;
    return fold(sport.label).includes(q) || sport.aliases.some((alias) => fold(alias).includes(q));
  });
}

export function catalogPagePhrase(city: CityCatalogPage, sport: CatalogSport | null) {
  return sport
    ? `Найти тренера по ${sport.titleGenitive} в ${city.locative}`
    : `Найти тренера в ${city.locative}`;
}

export function listCatalogSitemapPaths() {
  const paths = new Set<string>(["/", "/categories", "/map"]);
  for (const category of TOP_LEVEL_SPORT_CATEGORIES) {
    if (category.published === false) continue;
    paths.add(`/categories/${category.slug}`);
    for (const child of category.children) paths.add(`/categories/${category.slug}/${child.slug}`);
  }
  for (const city of listCityCatalogPages()) {
    paths.add(`/city/${city.slug}`);
    for (const sport of SPORTS) paths.add(catalogSportPath(city.slug, sport));
  }
  return [...paths];
}
