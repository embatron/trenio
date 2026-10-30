import { listPublishedSportCategories } from "@/lib/catalog/sport-taxonomy";
import { seoHead } from "@/lib/seo/head";
import { aboutPage, breadcrumbList, collectionPage, contactPage, homeGraph, webPage, type SeoCrumb } from "@/lib/seo/schema";
import { absoluteUrl } from "@/lib/seo/site";

/**
 * `@type` values each live template emits. An empty list is noindex and has no JSON-LD.
 * Offer and AggregateRating are not listed: they appear only for an `N BYN` price or a published review.
 * FAQPage is omitted when that page has no visible questions.
 * A route calls the helper for its kind. It does not build a schema.org object.
 */
export const SEO_PAGE_TYPES = {
  home: ["Organization", "WebSite", "SearchAction", "FAQPage"],
  categories: ["BreadcrumbList", "CollectionPage", "ItemList"],
  category: ["BreadcrumbList", "CollectionPage", "FAQPage"],
  sport: ["BreadcrumbList", "CollectionPage", "FAQPage"],
  city: ["BreadcrumbList", "CollectionPage"],
  citySport: ["BreadcrumbList", "CollectionPage"],
  trainer: ["BreadcrumbList", "ProfilePage", "Person"],
  map: ["BreadcrumbList", "WebPage"],
  about: ["BreadcrumbList", "AboutPage"],
  contacts: ["BreadcrumbList", "ContactPage", "Organization"],
  offer: ["BreadcrumbList", "WebPage"],
  privacy: ["BreadcrumbList", "WebPage"],
  join: ["BreadcrumbList", "WebPage"],
  club: ["BreadcrumbList", "SportsActivityLocation", "PostalAddress"],
  clubs: [],
  search: [],
  auth: [],
  cabinet: [],
} as const;

export type SeoPageKind = keyof typeof SEO_PAGE_TYPES;

const HOME_TITLE = "Найти тренера в Беларуси | trenio.by";
const HOME_DESCRIPTION =
  "Тренеры в Беларуси по виду спорта и городу. Цена, формат и контакты: индивидуально или в группе, для себя или для ребёнка.";

export const CATEGORIES_CRUMB = "Категории спорта";
const CATEGORIES_TITLE = "Категории спорта — тренеры в Беларуси | trenio.by";
const CATEGORIES_DESCRIPTION =
  "Категории спорта в каталоге тренеров Беларуси: единоборства, фитнес, йога, плавание, командные игры и другие направления.";

export const MAP_CRUMB = "Карта";
const MAP_TITLE = "Тренеры на карте Беларуси | trenio.by";
const MAP_DESCRIPTION = "Карта мест тренировок в Беларуси. Направление и город — фильтры, карточки рядом с картой.";

export const CLUBS_CRUMB = "Клубы";
const CLUBS_TITLE = "Спортивные клубы и залы Беларуси | trenio.by";
const CLUBS_DESCRIPTION = "Каталог клубов, студий и залов Беларуси. Карточки появятся здесь после публикации.";

const INFO_PAGES = {
  about: {
    path: "/about",
    crumb: "О сервисе",
    title: "О сервисе | trenio.by",
    description:
      "trenio.by — каталог тренеров в Беларуси. Поиск по виду спорта и городу, карточка, сообщение и отзыв. Размещение профиля бесплатное.",
  },
  contacts: {
    path: "/contacts",
    crumb: "Контакты",
    title: "Контакты | trenio.by",
    description: "Написать trenio.by: hello@trenio.by. Вопросы по карточке, оферте и персональным данным.",
  },
  offer: {
    path: "/offer",
    crumb: "Договор оферты",
    title: "Договор оферты | trenio.by",
    description: "Публичная оферта на бесплатное размещение профиля тренера в каталоге trenio.by.",
  },
  privacy: {
    path: "/privacy",
    crumb: "Политика конфиденциальности",
    title: "Политика конфиденциальности | trenio.by",
    description: "Какие данные обрабатывает trenio.by: аккаунт, карточка тренера, сообщения, отзывы и cookie города.",
  },
  join: {
    path: "/join/trainer",
    crumb: "Тренерам",
    title: "Стать тренером — бесплатная карточка | trenio.by",
    description:
      "Скинь свой Instagram — профиль заполним мы. Бесплатная карточка в каталоге Беларуси. Не опубликуем, пока ты её не увидишь.",
  },
} as const;

export type InfoPageKind = keyof typeof INFO_PAGES;

export function infoPageCopy(kind: InfoPageKind) {
  return INFO_PAGES[kind];
}

export function homePageHead(faq: Array<{ q: string; a: string }>) {
  return seoHead({
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    path: "/",
    jsonLd: homeGraph(faq),
  });
}

export function categoriesIndexHead() {
  return seoHead({
    title: CATEGORIES_TITLE,
    description: CATEGORIES_DESCRIPTION,
    path: "/categories",
    jsonLd: [
      breadcrumbList([
        { name: "Главная", path: "/" },
        { name: CATEGORIES_CRUMB, path: "/categories" },
      ]),
      collectionPage({
        name: CATEGORIES_CRUMB,
        path: "/categories",
        description: CATEGORIES_DESCRIPTION,
        items: listPublishedSportCategories().map((category) => ({
          name: category.label,
          path: `/categories/${category.slug}`,
        })),
      }),
    ],
  });
}

/** `filtered` is a `?sports=` or `?city=` map. That URL stays noindex and emits no graph. */
export function mapPageHead(filtered = false) {
  return seoHead({
    title: MAP_TITLE,
    description: MAP_DESCRIPTION,
    path: "/map",
    index: !filtered,
    jsonLd: [
      breadcrumbList([
        { name: "Главная", path: "/" },
        { name: MAP_CRUMB, path: "/map" },
      ]),
      webPage({ name: "Тренеры на карте", path: "/map", description: MAP_DESCRIPTION }),
    ],
  });
}

export function infoPageHead(kind: InfoPageKind) {
  const page = INFO_PAGES[kind];
  const node =
    kind === "about"
      ? aboutPage({ name: page.crumb, path: page.path, description: page.description })
      : kind === "contacts"
        ? contactPage({ name: page.crumb, path: page.path, description: page.description })
        : webPage({ name: page.crumb, path: page.path, description: page.description });
  return seoHead({
    title: page.title,
    description: page.description,
    path: page.path,
    jsonLd: [
      breadcrumbList([
        { name: "Главная", path: "/" },
        { name: page.crumb, path: page.path },
      ]),
      node,
    ],
  });
}

export type ClubSeoSource = {
  slug: string;
  name: string;
  city: { slug: string; label: string };
  address: string;
};

/** Visible club crumbs. The city step matches the nav under the header. */
export function clubBreadcrumbs(club: ClubSeoSource): SeoCrumb[] {
  const place = club.city.label === "Минск" ? "Минске" : club.city.label;
  return [
    { name: "Главная", path: "/" },
    { name: `Клубы в ${place}`, path: `/clubs/${club.city.slug}` },
    { name: club.name, path: `/clubs/${club.slug}` },
  ];
}

export function clubPageHead(club: ClubSeoSource | null | undefined) {
  if (!club) {
    return { meta: [{ title: "Клуб · trenio.by" }, { name: "robots", content: "noindex, follow" }] };
  }
  const path = `/clubs/${club.slug}`;
  return seoHead({
    title: `${club.name} — клуб в ${club.city.label} | trenio.by`,
    description: `${club.name}: направления, тренеры и контакты. ${club.address}.`,
    path,
    type: "profile",
    jsonLd: [
      breadcrumbList(clubBreadcrumbs(club)),
      {
        "@context": "https://schema.org",
        "@type": "SportsActivityLocation",
        name: club.name,
        url: absoluteUrl(path),
        address: {
          "@type": "PostalAddress",
          streetAddress: club.address,
          addressLocality: club.city.label,
          addressCountry: "BY",
        },
      },
    ],
  });
}

/** Empty shell stays noindex. A published club list becomes a collection of those cards. */
export function clubsIndexHead(clubs: Array<{ slug: string; name: string }>) {
  if (clubs.length === 0) {
    return seoHead({
      title: CLUBS_TITLE,
      description: CLUBS_DESCRIPTION,
      path: "/clubs",
      index: false,
    });
  }
  return seoHead({
    title: CLUBS_TITLE,
    description: CLUBS_DESCRIPTION,
    path: "/clubs",
    jsonLd: [
      breadcrumbList([
        { name: "Главная", path: "/" },
        { name: CLUBS_CRUMB, path: "/clubs" },
      ]),
      collectionPage({
        name: "Спортивные клубы и залы Беларуси",
        path: "/clubs",
        description: CLUBS_DESCRIPTION,
        items: clubs.map((club) => ({ name: club.name, path: `/clubs/${club.slug}` })),
      }),
    ],
  });
}

export function searchPageHead(query: string) {
  const q = query.trim() || "Поиск тренера";
  return seoHead({
    title: `${q} — trenio.by`,
    description: `Результаты поиска тренеров: ${q}. Карта и карточки рядом.`,
    path: "/search",
    index: false,
  });
}
