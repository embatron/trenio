import type { CatalogSport } from "@/lib/catalog/catalog-sports";
import { catalogPagePhrase, catalogSportPath, catalogSportPhrase } from "@/lib/catalog/catalog-sports";
import type { CityCatalogPage } from "@/lib/catalog/city-pages";
import {
  getParentCategoryFeaturedImage,
  isPublishedSportCategory,
  getTopLevelSportCategory,
  pickSearchAlias,
} from "@/lib/catalog/sport-taxonomy";
import { SHARE_CARD_HEIGHT, SHARE_CARD_WIDTH } from "@/lib/images/share-size";
import { seoHead } from "@/lib/seo/head";
import { breadcrumbList, collectionPage, faqPage, type SeoCrumb } from "@/lib/seo/schema";
import { documentLead, siteTitle } from "@/lib/seo/site";
import { clipMeta } from "@/lib/seo/text";

/** Wide card for a category illustration. The page picture stays the original file. */
export function categoryShareImagePath(parentSlug: string) {
  const category = getTopLevelSportCategory(parentSlug);
  if (!category || !isPublishedSportCategory(category)) return undefined;
  if (!getParentCategoryFeaturedImage(parentSlug)) return undefined;
  return `/og/categories/${parentSlug}.jpg`;
}

function shareImage(path: string | undefined) {
  if (!path) return {};
  return {
    image: path,
    imageWidth: SHARE_CARD_WIDTH,
    imageHeight: SHARE_CARD_HEIGHT,
    imageType: "image/jpeg" as const,
  };
}

function sentenceAlias(alias: string | undefined) {
  if (!alias) return "";
  return ` ${alias.charAt(0).toUpperCase()}${alias.slice(1)}.`;
}

export function categoryRouteHead(input: {
  title: string;
  description: string;
  path: string;
  crumbs: SeoCrumb[];
  faq: Array<{ q: string; a: string }>;
  parentSlug?: string;
}) {
  const name = documentLead(input.title);
  const image = input.parentSlug ? categoryShareImagePath(input.parentSlug) : undefined;
  return seoHead({
    title: input.title,
    description: input.description,
    path: input.path,
    ...shareImage(image),
    imageAlt: image ? name : undefined,
    jsonLd: [
      breadcrumbList(input.crumbs),
      collectionPage({ name, path: input.path, description: input.description, image }),
      faqPage(input.faq),
    ],
  });
}

export function cityCatalogDescription(city: CityCatalogPage, sport: CatalogSport | null) {
  if (!sport) {
    return `Тренеры в ${city.locative} по всем видам спорта. Подбор по направлению, цене и формату.`;
  }
  const voice = catalogSportPhrase(sport);
  const name = voice.po ? `по ${voice.keyword}` : voice.keyword;
  const extra = sentenceAlias(pickSearchAlias(voice.keyword, sport.aliases));
  return clipMeta(
    `Тренер ${name} в ${city.locative}.${extra} Цена, формат и опыт — индивидуально или в группе, для взрослых и детей.`,
  );
}

export function catalogPageHead(
  city: CityCatalogPage,
  sport: CatalogSport | null,
  noindex = false,
) {
  const phrase = catalogPagePhrase(city, sport);
  const path = sport ? catalogSportPath(city.slug, sport) : `/city/${city.slug}`;
  const crumbs: SeoCrumb[] = [
    { name: "Главная", path: "/" },
    { name: city.name, path: `/city/${city.slug}` },
  ];
  if (sport) crumbs.push({ name: sport.label, path });
  const description = cityCatalogDescription(city, sport);
  const image = sport ? categoryShareImagePath(sport.parentSlug) : undefined;
  return seoHead({
    title: siteTitle(phrase),
    description,
    path,
    index: !noindex,
    ...shareImage(image),
    imageAlt: image ? phrase : undefined,
    jsonLd: noindex
      ? []
      : [breadcrumbList(crumbs), collectionPage({ name: phrase, path, description, image })],
  });
}
