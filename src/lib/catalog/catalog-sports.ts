import { listCityCatalogPages, type CityCatalogPage } from "@/lib/catalog/city-pages";
import { editDistance, foldSearchText, leadingTarget, queryReadings, rankTargets, type FlexTarget } from "@/lib/catalog/query-flex";
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
  /** Genitive that follows «тренер» directly. Empty when the phrase uses «по». */
  titleBare: string;
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
      titleBare: "",
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
        titleBare: child.titleBare ?? "",
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

const SECOND_LEVEL_SPORTS = SPORTS.filter((sport) => sport.level === 2);

export type TrainerSportSection = {
  slug: string;
  label: string;
  count: number;
};

export type TrainerSportMenu = {
  /** The typed words named a site section. The trainer still picks a sport inside it. */
  section: { slug: string; label: string } | null;
  sections: TrainerSportSection[];
  sports: CatalogSport[];
};

function trainerSections(): TrainerSportSection[] {
  return SPORTS.filter((sport) => sport.level === 1).map((sport) => ({
    slug: sport.slug,
    label: sport.label,
    count: SECOND_LEVEL_SPORTS.filter((child) => child.parentSlug === sport.slug).length,
  }));
}

function sectionSports(slug: string): CatalogSport[] {
  return SECOND_LEVEL_SPORTS.filter((sport) => sport.parentSlug === slug);
}

function slugKey(value: string) {
  return fold(value).replace(/-/g, "");
}

/** A latin slug, including a section that shares its slug with a child. */
function sportBySlug(query: string): CatalogSport | null {
  const key = slugKey(query);
  if (key.length < 3) return null;
  const hits = SPORTS.filter((sport) => slugKey(sport.slug) === key);
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  return hits.find((sport) => sport.level === 1) ?? null;
}

function phraseDistance(reading: string, phrase: string): number | null {
  const text = fold(phrase);
  const readingLength = [...reading].length;
  if (!text || readingLength < 4) return null;
  const tokens = [text];
  for (const word of text.split(/[\s-]+/)) {
    const length = [...word].length;
    if (length >= 5 && length + 1 >= readingLength) tokens.push(word);
  }
  let best: number | null = null;
  for (const token of tokens) {
    if (Math.abs([...token].length - readingLength) > 2) continue;
    const distance = token === reading ? 0 : editDistance(reading, token, 2);
    if (distance == null) continue;
    if (best == null || distance < best) best = distance;
  }
  return best;
}

/** A miss two edits away, after the strict catalog reading found nothing. */
function looseDictionaryHits(query: string): CatalogSport[] {
  const readings = queryReadings(query).filter((reading) => [...reading].length >= 4);
  if (readings.length === 0) return [];
  let best = Number.POSITIVE_INFINITY;
  const found: CatalogSport[] = [];
  for (const sport of SPORTS) {
    const phrases = [sport.label, ...sport.aliases];
    let distance: number | null = null;
    for (const reading of readings) {
      for (const phrase of phrases) {
        const gap = phraseDistance(reading, phrase);
        if (gap == null) continue;
        if (distance == null || gap < distance) distance = gap;
      }
    }
    if (distance == null) continue;
    if (distance < best) {
      best = distance;
      found.length = 0;
      found.push(sport);
    } else if (distance === best) found.push(sport);
  }
  return found;
}

function resolveTrainerSport(query: string): CatalogSport | null {
  return catalogSportByName(query) ?? sportBySlug(query);
}

/** Sports a trainer can store. A section name opens every sport inside it. */
export function filterTrainerSports(query: string, limit = 8): CatalogSport[] {
  const q = fold(query);
  if (!q) {
    return [...SECOND_LEVEL_SPORTS].sort((a, b) => a.label.localeCompare(b.label, "ru")).slice(0, limit);
  }
  const resolved = resolveTrainerSport(query);
  if (resolved?.level === 1) return sectionSports(resolved.slug);
  const ranked = rankTargets(q, SECOND_LEVEL_SPORTS, sportTarget).map((row) => row.item);
  if (resolved?.level === 2) {
    return [resolved, ...ranked.filter((sport) => sport.id !== resolved.id)].slice(0, limit);
  }
  if (ranked.length > 0) return ranked.slice(0, limit);

  const loose = looseDictionaryHits(query);
  const section = loose.find((sport) => sport.level === 1);
  const sports = loose.filter((sport) => sport.level === 2);
  if (section && sports.every((sport) => sport.parentSlug === section.slug)) return sectionSports(section.slug);
  return sports.slice(0, limit);
}

/** What the trainer sport field shows: sections first, then the sports inside the one that was named. */
export function trainerSportMenu(query: string, browseSlug?: string | null): TrainerSportMenu {
  const q = fold(query);
  if (!q) {
    if (browseSlug) {
      const section = SPORTS.find((sport) => sport.level === 1 && sport.slug === browseSlug);
      if (section) {
        return {
          section: { slug: section.slug, label: section.label },
          sections: [],
          sports: sectionSports(section.slug),
        };
      }
    }
    return { section: null, sections: trainerSections(), sports: [] };
  }

  const resolved = resolveTrainerSport(query);
  if (resolved?.level === 1) {
    return {
      section: { slug: resolved.slug, label: resolved.label },
      sections: [],
      sports: sectionSports(resolved.slug),
    };
  }
  const sports = filterTrainerSports(query, 12);
  const parent = sports[0]?.parentSlug;
  const opened = parent
    && !resolved
    && sports.length === sectionSports(parent).length
    && sports.every((sport) => sport.parentSlug === parent);
  if (opened) {
    const section = SPORTS.find((sport) => sport.level === 1 && sport.slug === parent);
    if (section) {
      return {
        section: { slug: section.slug, label: section.label },
        sections: [],
        sports,
      };
    }
  }
  return { section: null, sections: [], sports };
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

export function catalogSportPhrase(sport: Pick<CatalogSport, "titleGenitive" | "titleBare">): { keyword: string; po: boolean } {
  return sport.titleBare
    ? { keyword: sport.titleBare, po: false }
    : { keyword: sport.titleGenitive, po: true };
}

export function catalogPagePhrase(city: CityCatalogPage, sport: CatalogSport | null) {
  if (!sport) return `Найти тренера в ${city.locative}`;
  const voice = catalogSportPhrase(sport);
  const name = voice.po ? `по ${voice.keyword}` : voice.keyword;
  return `Найти тренера ${name} в ${city.locative}`;
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

export type CitySportPresence = {
  city: string;
  sportSlugs: string[];
  sportParents: string[];
};

function cityNameKey(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

/** Same city and sport test the catalog page uses before any audience or price filter. */
export function citySportHasTrainer(
  trainers: CitySportPresence[],
  city: CityCatalogPage,
  sport: CatalogSport,
) {
  const name = cityNameKey(city.name);
  if (!name) return false;
  return trainers.some((trainer) => {
    if (!cityNameKey(trainer.city).includes(name)) return false;
    return trainerMatchesSportSelection(
      { sportSlugs: trainer.sportSlugs, sportParents: trainer.sportParents, tags: [] },
      [sport],
      "",
    );
  });
}

export function citySportPageIsOpen(
  trainers: Array<{ city: { label: string }; sports: Array<{ slug: string; parentSlug: string }> }> | undefined,
  city: CityCatalogPage | null,
  sport: CatalogSport | null,
) {
  if (!trainers || !city || !sport) return false;
  return citySportHasTrainer(
    trainers.map((trainer) => ({
      city: trainer.city.label,
      sportSlugs: trainer.sports.map((item) => item.slug),
      sportParents: trainer.sports.map((item) => item.parentSlug),
    })),
    city,
    sport,
  );
}

/** City + sport paths that currently have a published trainer. */
export function indexableCitySportPaths(trainers: CitySportPresence[]) {
  const paths: string[] = [];
  for (const city of listCityCatalogPages()) {
    for (const sport of SPORTS) {
      if (citySportHasTrainer(trainers, city, sport)) paths.push(catalogSportPath(city.slug, sport));
    }
  }
  return paths;
}

/** Full catalog list, with empty city + sport pages left out. City hubs stay. */
export function catalogPathsForSitemap(indexableCitySports: readonly string[]) {
  const open = new Set(indexableCitySports);
  return listCatalogSitemapPaths().filter((path) => !/^\/city\/[^/]+\/.+/.test(path) || open.has(path));
}
