import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HOME_FAQ } from "@/lib/catalog/site-faq";
import { catalogSportById } from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import {
  categorySearchDescription,
  getSportTaxonomyChildInCategory,
  getTopLevelSportCategory,
  trainerByPhrase,
  trainerIntroPhrase,
  trainerSportDatives,
  trainerSportRoles,
} from "@/lib/catalog/sport-taxonomy";
import { catalogPageHead, categoryRouteHead, cityCatalogDescription } from "@/lib/seo/catalog";
import { seoHead } from "@/lib/seo/head";
import {
  SEO_PAGE_TYPES,
  categoriesIndexHead,
  clubPageHead,
  clubsIndexHead,
  homePageHead,
  infoPageHead,
  MAP_DESCRIPTION,
  mapPageHead,
  searchPageHead,
  type SeoPageKind,
} from "@/lib/seo/pages";
import { robotsTxt } from "@/lib/seo/robots";
import { documentLead, SITE_NAME, siteTitle } from "@/lib/seo/site";
import { cityIn, clipMeta } from "@/lib/seo/text";
import { publicAssetUrl, renderSitemapXml, trainerSitemapPath } from "@/lib/seo/sitemap";
import { trainerDocumentPhrase, trainerSeoHead } from "@/lib/seo/trainer";

const routesDir = join(dirname(fileURLToPath(import.meta.url)), "../../routes");

type HeadWithGraph = { scripts?: Array<{ children: string }> };

function graphTypes(head: HeadWithGraph) {
  const found = new Set<string>();
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    const record = value as Record<string, unknown>;
    if (typeof record["@type"] === "string") found.add(record["@type"]);
    for (const child of Object.values(record)) walk(child);
  };
  for (const script of head.scripts ?? []) walk(JSON.parse(script.children));
  return found;
}

function metaContent(head: { meta: Array<Record<string, unknown>> }, key: string, value: string) {
  const item = head.meta.find((entry) => entry[key] === value);
  return typeof item?.content === "string" ? item.content : "";
}

function documentTitle(head: { meta: Array<Record<string, unknown>> }) {
  const item = head.meta.find((entry) => typeof entry.title === "string" && entry.title);
  return typeof item?.title === "string" ? item.title : "";
}

function assertKind(kind: SeoPageKind, head: HeadWithGraph) {
  const expected = SEO_PAGE_TYPES[kind];
  if (expected.length === 0) {
    assert.equal(head.scripts?.length ?? 0, 0, kind);
    return;
  }
  const found = graphTypes(head);
  for (const type of expected) assert.equal(found.has(type), true, `${kind} missing ${type}`);
  assert.equal(JSON.stringify(head.scripts).includes("telephone"), false, kind);
}

test("the default share image is the wide wordmark card", () => {
  const head = seoHead({
    title: "Найти тренера",
    description: "Каталог тренеров.",
    path: "/",
    jsonLd: [{ "@type": "WebPage" }],
  });
  const image = head.meta.find((item) => "property" in item && item.property === "og:image");
  const card = head.meta.find((item) => "name" in item && item.name === "twitter:card");
  const width = head.meta.find((item) => "property" in item && item.property === "og:image:width");
  assert.equal(image && "content" in image ? image.content : "", "https://trenio.by/og.png");
  assert.equal(card && "content" in card ? card.content : "", "summary_large_image");
  assert.equal(width && "content" in width ? width.content : "", "1200");
});

test("public head uses an absolute canonical and a clipped description", () => {
  const head = seoHead({
    title: "Найти тренера по боксу | Я ищу тренера на trenio.by",
    description: "А".repeat(240),
    path: "/categories/edinoborstva/boks",
    image: "/images/categories/edinoborstva.webp",
    jsonLd: [{ "@type": "WebPage" }],
  });
  const description = head.meta.find((item) => "name" in item && item.name === "description");
  const canonical = head.links[0];
  const graph = head.scripts?.find((script) => script.children.includes("WebPage"));
  const ogTitle = head.meta.find((item) => "property" in item && item.property === "og:title");
  assert.equal(
    ogTitle && "content" in ogTitle ? ogTitle.content : "",
    "Найти тренера по боксу",
  );
  assert.equal(metaContent(head, "name", "twitter:title"), "Найти тренера по боксу");
  assert.equal(head.meta.some((item) => "property" in item && item.property === "og:site_name"), false);
  assert.equal(canonical?.href, "https://trenio.by/categories/edinoborstva/boks");
  assert.ok(graph);
  assert.equal(graph.children.includes("<"), false);
  assert.ok(description && "content" in description && typeof description.content === "string" && description.content.length <= 170);
  assert.equal(head.meta.some((item) => "content" in item && item.content === "index, follow"), true);
});

test("filtered and private documents stay out of the index", () => {
  const search = seoHead({ title: "Поиск", description: "Результаты", path: "/search", index: false });
  assert.equal(search.meta.some((item) => "content" in item && item.content === "noindex, follow"), true);
  const robots = robotsTxt();
  for (const path of ["/admin", "/account", "/me", "/auth", "/search", "/trainers/claim", "/mail", "/favorites"]) {
    assert.equal(robots.includes(`Disallow: ${path}`), true, path);
  }
  assert.equal(robots.includes("Disallow: /map"), false);
  assert.equal(robots.includes("Disallow: /categories"), false);
  assert.match(robots, /Clean-param: sports&city/);
  assert.match(robots, /Sitemap: https:\/\/trenio\.by\/sitemap\.xml/);
});

test("city and category snippets use the Belarus query, not an alias dump", () => {
  const brest = cityCatalogBySlug("brest");
  const boxing = catalogSportById("boks");
  assert.ok(brest && boxing);
  assert.equal(cityIn("brest", "Брест"), "Бресте");
  assert.equal(cityIn("slutsk", "Слуцк"), "городе Слуцк");
  const description = cityCatalogDescription(brest, boxing);
  assert.match(description, /Тренер по боксу в Бресте/);
  assert.equal(description.includes("любительский бокс, бокс"), false);
  const head = catalogPageHead(brest, boxing);
  assert.equal(head.links[0]?.href, "https://trenio.by/city/brest/boks");
  const cityImage = head.meta.find((item) => "property" in item && item.property === "og:image");
  const cityWidth = head.meta.find((item) => "property" in item && item.property === "og:image:width");
  const cityTitle = head.meta.find((item) => "property" in item && item.property === "og:title");
  assert.equal(
    cityImage && "content" in cityImage ? cityImage.content : "",
    "https://trenio.by/og/categories/edinoborstva.jpg",
  );
  assert.equal(cityWidth && "content" in cityWidth ? cityWidth.content : "", "1200");
  assert.equal(
    cityTitle && "content" in cityTitle ? cityTitle.content : "",
    "Найти тренера по боксу в Бресте",
  );
  assert.equal(head.meta.some((item) => "property" in item && item.property === "og:site_name"), false);
  const cityOnly = catalogPageHead(brest, null);
  assert.equal(metaContent(cityOnly, "property", "og:title"), "Найти тренера в Бресте");
  const wordmark = cityOnly.meta.find((item) => "property" in item && item.property === "og:image");
  assert.equal(
    wordmark && "content" in wordmark ? wordmark.content : "",
    "https://trenio.by/og.png",
  );
  const fitness = categorySearchDescription("Найти тренера по фитнесу", "длинный текст", [
    "фитнес",
    "тренажёрный зал",
    "персональный тренер",
  ]);
  assert.match(fitness, /Персональный тренер/);
  assert.equal(fitness.toLowerCase().split("персональный тренер").length, 2);
  assert.ok(fitness.length <= 170);
  assert.ok(clipMeta("Коротко.").length < 20);
});

test("a trainer title lists every sport and the city", () => {
  const datives = trainerSportDatives([
    { slug: "boks", label: "Бокс" },
    { slug: "kikboksing", label: "Кикбоксинг" },
    { slug: "ofp", label: "ОФП" },
  ]);
  assert.equal(
    trainerDocumentPhrase(datives, { slug: "minsk", label: "Минск" }, "Владимир Антипенко"),
    "Тренер по боксу, кикбоксингу и общефизической подготовке Владимир Антипенко в Минске",
  );
  assert.equal(
    trainerDocumentPhrase(["боксу"], { slug: "minsk", label: "Минск" }, "Артём Романович"),
    "Тренер по боксу Артём Романович в Минске",
  );
  assert.equal(
    trainerDocumentPhrase(
      trainerSportDatives([
        { slug: "ofk", label: "ОФК" },
        { slug: "lfk", label: "ЛФК" },
      ]),
      { slug: "gomel", label: "Гомель" },
      "",
      trainerIntroPhrase(trainerSportRoles([
        { slug: "ofk", label: "ОФК" },
        { slug: "lfk", label: "ЛФК" },
      ])),
    ),
    "Инструктор ОФК и ЛФК в Гомеле",
  );
  assert.equal(trainerByPhrase(["боксу"]), "Тренер по боксу");
  assert.equal(
    trainerDocumentPhrase(["боксу"], { slug: "slutsk", label: "Слуцк" }),
    "Тренер по боксу в городе Слуцк",
  );
});

test("a trainer document names the person, the sport, and the city", () => {
  const head = trainerSeoHead({
    slug: "antipenko.training",
    name: "Владимир Антипенко",
    sports: ["Кикбоксинг"],
    sportDatives: ["кикбоксингу"],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    city: { slug: "minsk", label: "Минск" },
    about: ["Зал в Минске."],
    rating: { value: "0", reviewCount: 0 },
    photo: "/trainers/instagram/antipenko.training.jpg",
    instagram: "https://www.instagram.com/antipenko.training/",
    places: [],
    priceLines: ["35 BYN"],
  });
  const title = head.meta.find((item) => "title" in item && item.title);
  assert.equal(title && "title" in title ? title.title : "", "Тренер по кикбоксингу Владимир Антипенко в Минске | Я ищу тренера на trenio.by");
  const description = head.meta.find((item) => "name" in item && item.name === "description");
  assert.equal(
    description && "content" in description ? description.content : "",
    "Тренер по кикбоксингу Владимир Антипенко в Минске. Зал в Минске.",
  );
  const alt = head.meta.find((item) => "property" in item && item.property === "og:image:alt");
  assert.equal(
    alt && "content" in alt ? alt.content : "",
    "Тренер по кикбоксингу Владимир Антипенко в Минске",
  );
  const ogTitle = head.meta.find((item) => "property" in item && item.property === "og:title");
  assert.equal(
    ogTitle && "content" in ogTitle ? ogTitle.content : "",
    "Тренер по кикбоксингу Владимир Антипенко в Минске",
  );
  const ogDescription = head.meta.find((item) => "property" in item && item.property === "og:description");
  assert.equal(ogDescription && "content" in ogDescription ? ogDescription.content : "", "Зал в Минске.");
  const ogImage = head.meta.find((item) => "property" in item && item.property === "og:image");
  assert.equal(
    ogImage && "content" in ogImage ? ogImage.content : "",
    "https://trenio.by/og/trainers/antipenko.training.jpg",
  );
  const width = head.meta.find((item) => "property" in item && item.property === "og:image:width");
  const height = head.meta.find((item) => "property" in item && item.property === "og:image:height");
  assert.equal(width && "content" in width ? width.content : "", "1200");
  assert.equal(height && "content" in height ? height.content : "", "630");
  const graph = head.scripts?.map((script) => JSON.parse(script.children) as {
    "@type"?: string;
    name?: string;
    mainEntity?: { telephone?: string; jobTitle?: string; mainEntityOfPage?: string; makesOffer?: { price: string } };
  }).find((node) => node["@type"] === "ProfilePage");
  assert.ok(graph);
  assert.equal(graph.name, "Тренер по кикбоксингу Владимир Антипенко в Минске");
  assert.equal(graph.mainEntity?.telephone, undefined);
  assert.equal(graph.mainEntity?.jobTitle, "Тренер по кикбоксингу Владимир Антипенко в Минске");
  assert.equal(graph.mainEntity?.mainEntityOfPage, "https://trenio.by/trainers/antipenko.training");
  assert.equal(graph.mainEntity?.makesOffer?.price, "35");
  assert.equal(graphTypes(head).has("AggregateRating"), false);
  assert.equal(JSON.stringify(head.scripts).includes("og.png"), false);

  const long = trainerSeoHead({
    slug: "antipenko.training",
    name: "Владимир Антипенко",
    sports: ["Кикбоксинг", "Бокс", "ОФП"],
    sportDatives: ["кикбоксингу", "боксу", "общефизической подготовке"],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    city: { slug: "minsk", label: "Минск" },
    about: ["🙋🏻‍♂️Владимир Минск Кикбоксинг и бокс. ОФП для любого уровня подготовки. Вопросы в личные сообщения."],
    rating: { value: "0", reviewCount: 0 },
    photo: "/trainers/instagram/antipenko.training.jpg",
    instagram: "https://www.instagram.com/antipenko.training/",
    places: [],
    priceLines: ["35 BYN"],
  });
  const longDescription = long.meta.find((item) => "name" in item && item.name === "description");
  const longText = longDescription && "content" in longDescription ? longDescription.content ?? "" : "";
  assert.match(longText, /^Тренер по кикбоксингу, боксу и общефизической подготовке Владимир Антипенко в Минске\./);
  assert.match(longText, /Кикбоксинг и бокс/);
  const longOg = long.meta.find((item) => "property" in item && item.property === "og:description");
  const longShare = longOg && "content" in longOg ? longOg.content ?? "" : "";
  assert.match(longShare, /^Владимир Минск/);
  assert.equal(longShare.startsWith("Тренер по"), false);
  assert.ok(longShare.length <= 170);
  assert.equal(/\p{Emoji_Modifier}/u.test(longText), false);
  assert.ok(longText.length <= 170);
});

test("each indexable page kind emits its schema types", () => {
  const faq = [{ q: "С какого возраста?", a: "С семи лет." }];
  const minsk = cityCatalogBySlug("minsk");
  const boxing = catalogSportById("boks");
  assert.ok(minsk && boxing);

  const home = homePageHead(HOME_FAQ);
  assertKind("home", home);
  const homeJson = home.scripts.map((script) => script.children).join("");
  assert.match(homeJson, /\/search\?sport=\{search_term_string\}/);
  assert.match(homeJson, /не проверяет квалификацию/);

  assertKind("categories", categoriesIndexHead());
  assertKind("category", categoryRouteHead({
    title: "Найти тренера по единоборствам | Я ищу тренера на trenio.by",
    description: "Тренер по единоборствам в Беларуси.",
    path: "/categories/edinoborstva",
    faq,
    crumbs: [
      { name: "Главная", path: "/" },
      { name: "Категории", path: "/categories" },
      { name: "Единоборства", path: "/categories/edinoborstva" },
    ],
  }));
  assertKind("sport", categoryRouteHead({
    title: "Найти тренера по боксу | Я ищу тренера на trenio.by",
    description: "Тренер по боксу в Беларуси.",
    path: "/categories/edinoborstva/boks",
    faq,
    crumbs: [
      { name: "Главная", path: "/" },
      { name: "Категории", path: "/categories" },
      { name: "Единоборства", path: "/categories/edinoborstva" },
      { name: "Бокс", path: "/categories/edinoborstva/boks" },
    ],
  }));

  const city = catalogPageHead(minsk, null);
  const citySport = catalogPageHead(minsk, boxing);
  assertKind("city", city);
  assertKind("citySport", citySport);
  assert.equal(graphTypes(city).has("ItemList"), false);
  assert.equal(graphTypes(city).has("FAQPage"), false);
  assert.equal(graphTypes(citySport).has("FAQPage"), false);

  const trainer = trainerSeoHead({
    slug: "antipenko.training",
    name: "Владимир Антипенко",
    sports: ["Кикбоксинг"],
    sportDatives: ["кикбоксингу"],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    city: { slug: "minsk", label: "Минск" },
    about: ["Зал в Минске."],
    rating: { value: "4.8", reviewCount: 3 },
    photo: "/trainers/instagram/antipenko.training.jpg",
    instagram: "https://www.instagram.com/antipenko.training/",
    telegram: "https://t.me/antipenko",
    places: [],
    priceLines: ["35 BYN"],
    createdAt: "2026-10-01T08:00:00.000Z",
    updatedAt: "2026-11-04T12:00:00.000Z",
  });
  assertKind("trainer", trainer);
  const person = trainer.scripts
    ?.map((script) => JSON.parse(script.children) as { "@type"?: string; mainEntity?: { jobTitle?: string; sameAs?: string[]; aggregateRating?: { reviewCount: number } } })
    .find((node) => node["@type"] === "ProfilePage")?.mainEntity;
  assert.equal(person?.jobTitle, "Тренер по кикбоксингу Владимир Антипенко в Минске");
  assert.deepEqual(person?.sameAs, [
    "https://www.instagram.com/antipenko.training/",
    "https://t.me/antipenko",
  ]);
  assert.equal(person?.aggregateRating?.reviewCount, 3);
  const profile = trainer.scripts
    ?.map((script) => JSON.parse(script.children) as {
      "@type"?: string;
      dateCreated?: string;
      dateModified?: string;
      primaryImageOfPage?: { url?: string; width?: number; height?: number };
      mainEntity?: { alternateName?: string; image?: { url?: string; width?: number; caption?: string } };
    })
    .find((node) => node["@type"] === "ProfilePage");
  assert.equal(profile?.dateCreated, "2026-10-01T08:00:00.000Z");
  assert.equal(profile?.dateModified, "2026-11-04T12:00:00.000Z");
  assert.equal(profile?.mainEntity?.alternateName, "antipenko.training");
  assert.equal(profile?.mainEntity?.image?.url, "https://trenio.by/og/trainers/antipenko.training.jpg?v=20261104T120000Z");
  assert.equal(profile?.mainEntity?.image?.width, 1200);
  assert.equal(profile?.mainEntity?.image?.caption, "Тренер по кикбоксингу Владимир Антипенко в Минске");
  assert.equal(profile?.primaryImageOfPage?.url, profile?.mainEntity?.image?.url);
  assert.equal(profile?.primaryImageOfPage?.width, 1200);
  assert.equal(profile?.primaryImageOfPage?.height, 630);
  const datedImage = trainer.meta.find((item) => "property" in item && item.property === "og:image");
  assert.equal(
    datedImage && "content" in datedImage ? datedImage.content : "",
    "https://trenio.by/og/trainers/antipenko.training.jpg?v=20261104T120000Z",
  );

  const hidden = trainerSeoHead({
    slug: "hidden",
    name: "Без цены",
    sports: ["Бокс"],
    sportDatives: ["боксу"],
    primarySport: { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
    city: { slug: "minsk", label: "Минск" },
    about: [],
    rating: { value: "0", reviewCount: 0 },
    photo: "",
    instagram: "antipenko",
    telegram: "@antipenko",
    places: [],
    priceLines: ["договорная"],
  });
  assert.equal(graphTypes(hidden).has("Offer"), false);
  assert.equal(graphTypes(hidden).has("AggregateRating"), false);
  assert.equal(JSON.stringify(hidden.scripts).includes("sameAs"), false);
  assert.equal(JSON.stringify(hidden.scripts).includes("og.png"), false);
  const preview = trainerSeoHead({
    slug: "hidden",
    name: "Без цены",
    sports: ["Бокс"],
    sportDatives: ["боксу"],
    primarySport: { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
    city: { slug: "minsk", label: "Минск" },
    about: [],
    rating: { value: "0", reviewCount: 0 },
    photo: "",
    instagram: "antipenko",
    telegram: "@antipenko",
    places: [],
    priceLines: ["договорная"],
    index: false,
  });
  assert.equal(preview.scripts.length, 0);
  assert.equal(preview.meta.some((item) => "content" in item && item.content === "noindex, follow"), true);

  const map = mapPageHead(false);
  assertKind("map", map);
  assert.equal(
    map.meta.some((item) => "name" in item && item.name === "description" && item.content === MAP_DESCRIPTION),
    true,
  );
  assert.equal(JSON.stringify(map.scripts).includes(MAP_DESCRIPTION), true);
  for (const kind of ["about", "contacts", "offer", "privacy", "join"] as const) assertKind(kind, infoPageHead(kind));
  const about = infoPageHead("about");
  assert.equal(graphTypes(about).has("FAQPage"), false);
  assert.equal(about.links[0]?.href, "https://trenio.by/about");
  assert.equal(about.meta.some((item) => "title" in item && item.title === "О сервисе | Я ищу тренера на trenio.by"), true);
  assert.equal(
    about.meta.some(
      (item) =>
        "name" in item &&
        item.name === "description" &&
        item.content ===
          "Каталог тренеров в Беларуси: город, вид спорта и цена. Клиент пишет напрямую, страницу публикует сам тренер, размещение бесплатное.",
    ),
    true,
  );
  assert.equal(about.meta.some((item) => "content" in item && item.content === "index, follow"), true);
  assert.match(JSON.stringify(infoPageHead("join").scripts), /Тренерам/);

  const club = clubPageHead({
    slug: "arena",
    name: "Арена",
    city: { slug: "minsk", label: "Минск" },
    address: "ул. Пример, 1",
  });
  assertKind("club", club);
  assert.match(JSON.stringify(club.scripts), /Клубы в Минске/);
});

test("a noindex page emits no JSON-LD", () => {
  const minsk = cityCatalogBySlug("minsk");
  assert.ok(minsk);
  assertKind("search", searchPageHead("бокс"));
  assertKind("clubs", clubsIndexHead([]));
  assert.equal(mapPageHead(true).scripts.length, 0);
  assert.equal(catalogPageHead(minsk, null, true).scripts.length, 0);
  const missingClub = clubPageHead(null);
  assert.equal("scripts" in missingClub ? missingClub.scripts.length : 0, 0);
  assert.equal(missingClub.meta.some((item) => "content" in item && item.content === "noindex, follow"), true);
  const stripped = seoHead({
    title: "Поиск",
    description: "Результаты",
    path: "/search",
    index: false,
    jsonLd: [{ "@type": "WebPage" }, { "@type": "ItemList" }],
  });
  assert.equal(stripped.scripts.length, 0);
  assert.deepEqual([...SEO_PAGE_TYPES.auth], []);
  assert.deepEqual([...SEO_PAGE_TYPES.cabinet], []);
  assert.throws(
    () => seoHead({ title: "Без графа", description: "Индексируемая страница.", path: "/about" }),
    /no JSON-LD/,
  );
});

test("a category and its sport each lead the share card with their own phrase", () => {
  const parent = getTopLevelSportCategory("raketki");
  const child = getSportTaxonomyChildInCategory("raketki", "bolshoj-tennis");
  assert.ok(parent);
  assert.ok(child?.titleGenitive);

  const headFor = (keyword: string, aliases: string[] | undefined, path: string) => {
    const title = siteTitle(`Найти тренера по ${keyword}`);
    return categoryRouteHead({
      title,
      description: categorySearchDescription(documentLead(title), "", aliases),
      path,
      parentSlug: "raketki",
      faq: [],
      crumbs: [
        { name: "Главная", path: "/" },
        { name: "Категории", path: "/categories" },
        { name: parent.label, path: "/categories/raketki" },
      ],
    });
  };

  const section = headFor(parent.titleGenitive, parent.aliases, "/categories/raketki");
  const sport = headFor(child.titleGenitive, child.aliases, "/categories/raketki/bolshoj-tennis");
  const homeDescription =
    "Тренеры в Беларуси по виду спорта и городу. Цена, формат и контакты: индивидуально или в группе, для себя или для ребёнка.";

  assert.equal(
    documentTitle(section),
    "Найти тренера по теннису и играм с ракеткой | Я ищу тренера на trenio.by",
  );
  assert.equal(metaContent(section, "property", "og:title"), "Найти тренера по теннису и играм с ракеткой");
  assert.equal(metaContent(section, "name", "twitter:title"), "Найти тренера по теннису и играм с ракеткой");
  assert.equal(
    metaContent(section, "name", "description"),
    "Найти тренера по теннису и играм с ракеткой в Беларуси. Город, цена и формат — индивидуально или в группе, для взрослых и детей.",
  );
  assert.equal(metaContent(section, "property", "og:description"), metaContent(section, "name", "description"));

  assert.equal(
    documentTitle(sport),
    "Найти тренера по большому теннису | Я ищу тренера на trenio.by",
  );
  assert.equal(metaContent(sport, "property", "og:title"), "Найти тренера по большому теннису");
  assert.equal(metaContent(sport, "name", "twitter:title"), "Найти тренера по большому теннису");
  assert.equal(
    metaContent(sport, "name", "description"),
    "Найти тренера по большому теннису в Беларуси. Теннис. Город, цена и формат — индивидуально или в группе, для взрослых и детей.",
  );
  assert.equal(metaContent(sport, "property", "og:description"), metaContent(sport, "name", "description"));
  assert.equal(metaContent(sport, "name", "twitter:description"), metaContent(sport, "name", "description"));

  assert.notEqual(metaContent(section, "property", "og:title"), metaContent(sport, "property", "og:title"));
  assert.notEqual(metaContent(section, "name", "description"), metaContent(sport, "name", "description"));
  assert.equal(metaContent(section, "name", "description") === homeDescription, false);
  assert.equal(metaContent(sport, "name", "description") === homeDescription, false);
  assert.equal(metaContent(section, "property", "og:title").includes(SITE_NAME), false);
  assert.equal(metaContent(sport, "property", "og:title").includes(SITE_NAME), false);
  assert.equal(section.meta.some((item) => "property" in item && item.property === "og:site_name"), false);
  assert.equal(sport.meta.some((item) => "property" in item && item.property === "og:site_name"), false);
});

test("a category without a visible FAQ block does not emit FAQPage", () => {
  const head = categoryRouteHead({
    title: "Найти тренера по боксу | Я ищу тренера на trenio.by",
    description: "Тренер по боксу в Беларуси.",
    path: "/categories/edinoborstva/boks",
    faq: [],
    crumbs: [
      { name: "Главная", path: "/" },
      { name: "Бокс", path: "/categories/edinoborstva/boks" },
    ],
  });
  assert.equal(graphTypes(head).has("FAQPage"), false);
  assert.equal(graphTypes(head).has("CollectionPage"), true);
});

test("a published club list is a collection, and a route does not hand-write the graph", () => {
  const head = clubsIndexHead([{ slug: "arena", name: "Арена" }]);
  const types = graphTypes(head);
  for (const type of ["BreadcrumbList", "CollectionPage", "ItemList"]) {
    assert.equal(types.has(type), true, type);
  }
  assert.match(JSON.stringify(head.scripts), /\/clubs\/arena/);

  for (const name of readdirSync(routesDir)) {
    if (!name.endsWith(".ts") && !name.endsWith(".tsx")) continue;
    const source = readFileSync(join(routesDir, name), "utf8");
    assert.equal(source.includes("@type"), false, name);
    assert.equal(source.includes("jsonLd"), false, name);
    assert.equal(source.includes("ld+json"), false, name);
  }
});

test("a published trainer is a sitemap url and a draft slug is not", () => {
  assert.equal(trainerSitemapPath("antipenko.training"), "/trainers/antipenko.training");
  assert.equal(trainerSitemapPath("../admin"), null);
  assert.equal(trainerSitemapPath("a."), null);
  assert.equal(
    publicAssetUrl("/trainers/instagram/antipenko.training.jpg"),
    "https://trenio.by/trainers/instagram/antipenko.training.jpg",
  );
  assert.equal(publicAssetUrl("data/secret.jpg"), null);
  const xml = renderSitemapXml(["/"], [{
    path: "/trainers/antipenko.training",
    lastmod: "2026-11-04",
    image: "https://trenio.by/trainers/instagram/antipenko.training.jpg",
    imageTitle: "Владимир Антипенко — Тренер по кикбоксингу в Минске",
  }]);
  assert.match(xml, /<loc>https:\/\/trenio\.by\/trainers\/antipenko\.training<\/loc>/);
  assert.match(xml, /<lastmod>2026-11-04<\/lastmod>/);
  assert.match(xml, /Владимир Антипенко — Тренер по кикбоксингу в Минске/);
  assert.match(xml, /<loc>https:\/\/trenio\.by\/about<\/loc>/);
  assert.equal(xml.includes("/trainers/draft"), false);
});
