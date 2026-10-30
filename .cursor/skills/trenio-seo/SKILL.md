---
name: trenio-seo
description: Adapts Trenio.by pages for Google and Yandex in Belarus — titles, descriptions, canonical URLs, robots, sitemap, and schema.org. Use when editing a public route, head meta, catalog copy, sitemap, robots.txt, or when the user mentions SEO, индексацию, мета-теги, schema.org, микроразметку, or ключевые слова.
---

# Trenio SEO

Search for this catalog is Russian, local, and split between Google and Yandex. The page is written for one query. Filters stay filters.

## Read

| Task | File |
| --- | --- |
| Which URL is indexable, and what its title is | [pages.md](pages.md) |
| Why that query, and what not to add | [demand.md](demand.md) |
| Head tags and JSON-LD | [markup.md](markup.md) |

Product copy and the URL rules stay in `docs/PRODUCT.md` §6 and `.cursor/rules/url-slugs.mdc`. Do not invent a second URL map.

## Adapt a page

1. Classify it with [pages.md](pages.md). Private, token, empty-shell, and filtered URLs are `noindex`. A city + one sport page stays indexable even when no trainer is published, because the title and the about copy already exist.
2. Build the document with the page-kind helper. It calls `seoHead` from `src/lib/seo/head.ts`. Canonical is absolute and has no query string.
3. H1 stays the product sentence already on the page (`Найти тренера по …`, `Я ищу тренера`, `Привет!`). The title carries the same query. Do not rewrite the H1 to stuff a keyword.
4. Description is one or two sentences: the query, then city, price, and format. One extra alias from `pickSearchAlias`. Never a comma list of aliases.
5. Call the helper for that page kind (`homePageHead`, `categoryRouteHead`, `catalogPageHead`, `trainerSeoHead`, `mapPageHead`, `infoPageHead`, `clubPageHead`, `clubsIndexHead`, `searchPageHead`). The helper attaches the graph. Do not write a JSON-LD object in the route. Breadcrumbs match the crumbs on the page. FAQ matches the questions on the page. No `AggregateRating` when `reviewCount` is 0. No telephone in the graph. A `noindex` page emits no graph.
6. New indexable URLs go into `listCatalogSitemapPaths` or the static list in `src/routes/sitemap[.]xml.ts`. `noindex` URLs stay out of the sitemap.
7. Run `npm test` so `src/lib/seo/head.test.ts` still passes.

```ts
// wrong: a filter becomes a URL, the description is a keyword list, and the route writes JSON-LD
title: "Бокс для детей недорого Минск | тренер бокс бокс Минск"

// right: the city page that already exists. The helper attaches BreadcrumbList and CollectionPage.
catalogPageHead(brest, boxing)
```

## Recommend

Recommend only when the change would move indexing, the query match, crawl, or trust. One item, this shape:

```
Page:
Evidence:
Change:
Leave:
```

`Leave` is the tempting extra that should not be done. No volumes, no tool list, no "consider adding more content".

## Do not

- A Belarusian (`be`) mirror. Commercial sports queries in Belarus are Russian. `html lang` is `ru`.
- A URL for audience, format, goal, price, or "онлайн". Those are filters and `noindex`.
- District or metro URLs until Wordstat (Belarus) shows that query as its own intent, separate from the city page.
- Claims that a trainer is checked, certified, or safe. Confirmation of a phone, Telegram, or email is confirmation of the channel.
- Keyword density, link schemes, or a second sitemap for filters.
- Changing `--layout-max`, icon stroke, or the PWA manifest `lang` (it is already `ru`).

## Open

These are the live gaps. Repeat one only when the task touches it.

- The default share image is `/og.png`: the white wordmark on `#111827`, 1200×630. Pages with their own photo pass `image` and skip the width and height.
- There is no blog. Do not add `/blog` until an article is actually published.
- `/clubs` is `noindex` while `CLUBS_LIST` is empty. Index it when a published club exists, and use the `SportsActivityLocation` graph already on `/clubs/$slug`.
- City and category pages do not emit `ItemList` of trainers. Add it only from the trainers the page actually renders.
- Yandex Webmaster and Google Search Console are not connected in the repo. Submit `https://trenio.by/sitemap.xml` there. Do not commit verification tokens.
- `/search` is disallowed and `noindex`. The `SearchAction` still points at `?sport=`. Do not open `/search` to crawlers to chase a sitelinks box.
- The SSR crash page in `src/lib/error-page.ts` is English. It is `noindex`. Translating it is a product-language fix, not a ranking project.
