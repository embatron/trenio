import { listCityCatalogPages, type CityCatalogPage } from "@/lib/catalog/city-pages";
import { foldSearchText, leadingTarget, rankTargets, type FlexTarget } from "@/lib/catalog/query-flex";
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
  return foldSearchText(value);
}

function sportTarget(sport: CatalogSport): FlexTarget {
  const parent = sport.level === 2 ? getTopLevelSportCategory(sport.parentSlug) : undefined;
  const loose = parent
    ? [parent.label, ...(parent.aliases ?? [])].filter((phrase) => fold(phrase) !== fold(sport.label))
    : [];
  return { label: sport.label, aliases: sport.aliases, loose };
}

const sportByNameCache = new Map<string, CatalogSport | null>();

/** Label, alias, or a crooked spelling that points at one sport. A shared prefix stays unresolved. */
export function catalogSportByName(query: string): CatalogSport | null {
  const q = fold(query);
  if (!q) return null;
  const cached = sportByNameCache.get(q);
  if (cached !== undefined) return cached;
  const sport = leadingTarget(rankTargets(q, SPORTS, sportTarget, (sport) => sport.level), q);
  if (sportByNameCache.size > 80) sportByNameCache.clear();
  sportByNameCache.set(q, sport);
  return sport;
}

/** Second-level sports that belong to one top-level category. */
export function catalogCategorySports(parentSlug: string): CatalogSport[] {
  return SPORTS.filter((sport) => sport.level === 2 && sport.parentSlug === parentSlug);
}

export function filterCatalogSports(query: string, limit = 8): CatalogSport[] {
  const q = fold(query);
  if (!q) return SPORTS.filter((sport) => sport.level === 1).slice(0, limit);
  return rankTargets(q, SPORTS, sportTarget, (sport) => sport.level)
    .slice(0, limit)
    .map((row) => row.item);
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

  const resolved = catalogSportByName(query);
  if (resolved) return matchesSport(resolved);

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
