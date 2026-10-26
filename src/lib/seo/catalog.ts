import type { CatalogSport } from "@/lib/catalog/catalog-sports";
import { catalogPagePhrase, catalogSportPath } from "@/lib/catalog/catalog-sports";
import type { CityCatalogPage } from "@/lib/catalog/city-pages";
import { getParentCategoryFeaturedImage, pickSearchAlias } from "@/lib/catalog/sport-taxonomy";
import { seoHead } from "@/lib/seo/head";
import { breadcrumbList, collectionPage, faqPage, type SeoCrumb } from "@/lib/seo/schema";
import { clipMeta } from "@/lib/seo/text";

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
  image?: string;
}) {
  const name = input.title.replace(/\s*\|\s*trenio\.by\s*$/i, "").trim();
  return seoHead({
    title: input.title,
    description: input.description,
    path: input.path,
    image: input.image,
    jsonLd: [
      breadcrumbList(input.crumbs),
      collectionPage({ name, path: input.path, description: input.description }),
      faqPage(input.faq),
    ],
  });
}

export function cityCatalogDescription(city: CityCatalogPage, sport: CatalogSport | null) {
  if (!sport) {
    return `Тренеры в ${city.locative} по всем видам спорта. Подбор по направлению, цене и формату.`;
  }
  const extra = sentenceAlias(pickSearchAlias(sport.titleGenitive, sport.aliases));
  return clipMeta(
    `Тренер по ${sport.titleGenitive} в ${city.locative}.${extra} Цена, формат и опыт — индивидуально или в группе, для взрослых и детей.`,
  );
}

export function catalogPageHead(city: CityCatalogPage, sport: CatalogSport | null, noindex = false) {
  const phrase = catalogPagePhrase(city, sport);
  const path = sport ? catalogSportPath(city.slug, sport) : `/city/${city.slug}`;
  const crumbs: SeoCrumb[] = [
    { name: "Главная", path: "/" },
    { name: city.name, path: `/city/${city.slug}` },
  ];
  if (sport) crumbs.push({ name: sport.label, path });
  const description = cityCatalogDescription(city, sport);
  return seoHead({
    title: `${phrase} | trenio.by`,
    description,
    path,
    index: !noindex,
    image: sport ? getParentCategoryFeaturedImage(sport.parentSlug) : undefined,
    jsonLd: noindex
      ? []
      : [
          breadcrumbList(crumbs),
          collectionPage({ name: phrase, path, description }),
        ],
  });
}
