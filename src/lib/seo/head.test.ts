import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { HOME_FAQ } from "@/lib/catalog/site-faq";
import { catalogSportById } from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { categorySearchDescription, trainerByPhrase, trainerSportDatives } from "@/lib/catalog/sport-taxonomy";
import { catalogPageHead, categoryRouteHead, cityCatalogDescription } from "@/lib/seo/catalog";
import { seoHead } from "@/lib/seo/head";
import {
  SEO_PAGE_TYPES,
  categoriesIndexHead,
  clubPageHead,
  clubsIndexHead,
  homePageHead,
  infoPageHead,
  mapPageHead,
  searchPageHead,
  type SeoPageKind,
} from "@/lib/seo/pages";
import { robotsTxt } from "@/lib/seo/robots";
import { cityIn, clipMeta } from "@/lib/seo/text";
import { trainerSeoHead } from "@/lib/seo/trainer";

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
    title: "Найти тренера по боксу | trenio.by",
    description: "А".repeat(240),
    path: "/categories/edinoborstva/boks",
    image: "/images/categories/edinoborstva.webp",
    jsonLd: [{ "@type": "WebPage" }],
  });
  const description = head.meta.find((item) => "name" in item && item.name === "description");
  const canonical = head.links[0];
  const graph = head.scripts?.find((script) => script.children.includes("WebPage"));
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
  for (const path of ["/admin", "/account", "/me", "/auth", "/search", "/trainers/claim"]) {
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

test("a trainer title lists every sport the way the profile line does", () => {
  const datives = trainerSportDatives([
    { slug: "boks", label: "Бокс" },
    { slug: "kikboksing", label: "Кикбоксинг" },
    { slug: "ofp", label: "ОФП" },
  ]);
  assert.equal(trainerByPhrase(datives), "Тренер по боксу, кикбоксингу и общефизической подготовке");
  assert.equal(
    trainerByPhrase(trainerSportDatives([
      { slug: "ofk", label: "ОФК" },
      { slug: "lfk", label: "ЛФК" },
    ])),
    "Тренер по оздоровительной физической культуре и лечебной физической культуре",
  );
  assert.equal(trainerByPhrase(["боксу"]), "Тренер по боксу");
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
  assert.equal(title && "title" in title ? title.title : "", "Тренер по кикбоксингу | trenio.by");
  const graph = head.scripts?.map((script) => JSON.parse(script.children) as { "@type"?: string; mainEntity?: { telephone?: string; makesOffer?: { price: string } } })
    .find((node) => node["@type"] === "ProfilePage");
  assert.ok(graph);
  assert.equal(graph.mainEntity?.telephone, undefined);
  assert.equal(graph.mainEntity?.makesOffer?.price, "35");
  assert.equal(graphTypes(head).has("AggregateRating"), false);
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
    title: "Найти тренера по единоборствам | trenio.by",
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
    title: "Найти тренера по боксу | trenio.by",
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
  });
  assertKind("trainer", trainer);
  const person = trainer.scripts
    ?.map((script) => JSON.parse(script.children) as { "@type"?: string; mainEntity?: { jobTitle?: string; sameAs?: string[]; aggregateRating?: { reviewCount: number } } })
    .find((node) => node["@type"] === "ProfilePage")?.mainEntity;
  assert.equal(person?.jobTitle, "Тренер по кикбоксингу");
  assert.deepEqual(person?.sameAs, [
    "https://www.instagram.com/antipenko.training/",
    "https://t.me/antipenko",
  ]);
  assert.equal(person?.aggregateRating?.reviewCount, 3);

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

  assertKind("map", mapPageHead(false));
  for (const kind of ["about", "contacts", "offer", "privacy", "join"] as const) assertKind(kind, infoPageHead(kind));
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

test("a category without a visible FAQ block does not emit FAQPage", () => {
  const head = categoryRouteHead({
    title: "Найти тренера по боксу | trenio.by",
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
