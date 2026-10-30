# Markup

`seoHead` in `src/lib/seo/head.ts` is the only head builder. It sets title, description (clipped at 170), `robots`, canonical, Open Graph, and Twitter. JSON-LD is a `script` with `type="application/ld+json"`. `<` in the JSON is escaped so a biography cannot close the tag.

`html lang` on the document is `ru`. Open Graph locale is `ru_BY`. The origin is `https://trenio.by` (`SITE_ORIGIN`).

## Robots

`src/lib/seo/robots.ts` allows `/` and disallows `/admin`, `/account`, `/me`, `/auth`, `/trainer-admin`, `/trainers/claim`, and `/search`.

The Yandex group adds `Clean-param` for `sports`, `city`, and the usual campaign parameters, plus `Host: trenio.by`. `sports` and `city` on `/map` and `/city/{slug}` are filters. Cleaning them matches the canonical.

Google reads the first group. It ignores `Clean-param` and `Host`.

## Helpers

A public `head()` calls the helper for its kind. The kind list is `SEO_PAGE_TYPES` in `src/lib/seo/pages.ts`. The helper passes nodes to `seoHead`. `seoHead` writes them as `scripts` with `type: "application/ld+json"`. It refuses an indexable head whose graph is empty, and it drops the graph when `index` is false.

Do not put `@type` or `jsonLd` in a route file. A new indexable info page uses `infoPageHead`. A new catalog URL uses `categoryRouteHead` or `catalogPageHead`. A new kind needs a row in `SEO_PAGE_TYPES`, a helper, and a case in `src/lib/seo/head.test.ts` before the route ships. Private pages keep `NOINDEX_FOLLOW` or `NOINDEX_NOFOLLOW` and do not call `seoHead`.

| Kind | Helper | `@type` |
| --- | --- | --- |
| Home | `homePageHead` | `Organization`, `WebSite`, `SearchAction`, `FAQPage` |
| Categories index | `categoriesIndexHead` | `BreadcrumbList`, `CollectionPage`, `ItemList` |
| Category, sport | `categoryRouteHead` | `BreadcrumbList`, `CollectionPage`, `FAQPage` |
| City, city + sport | `catalogPageHead` | `BreadcrumbList`, `CollectionPage` |
| Trainer | `trainerSeoHead` | `BreadcrumbList`, `ProfilePage`, `Person` |
| Map, no query | `mapPageHead(false)` | `BreadcrumbList`, `WebPage` |
| About | `infoPageHead("about")` | `BreadcrumbList`, `AboutPage` |
| Contacts | `infoPageHead("contacts")` | `BreadcrumbList`, `ContactPage`, `Organization` |
| Offer, privacy, join | `infoPageHead` | `BreadcrumbList`, `WebPage` |
| Club, when a record exists | `clubPageHead` | `BreadcrumbList`, `SportsActivityLocation`, `PostalAddress` |
| Empty clubs index | `clubsIndexHead([])` | none |
| Search, filtered map, filtered city | `searchPageHead`, `mapPageHead(true)`, `catalogPageHead(..., true)` | none |
| Auth, account, `/me`, admin | robots meta only | none |

## Graphs

`BreadcrumbList` only when the names and paths match the visible crumbs. Home has no crumbs and no `BreadcrumbList`. `FAQPage` only when those questions are on the page. Home uses `HOME_FAQ`. Category and sport pass the FAQ block under the catalog. A city page does not show that block, so it has no `FAQPage`.

The home `Organization` says the catalog does not check qualifications. `SearchAction` targets `/search?sport={search_term_string}`. Leave `/search` `noindex`.

Trainer `jobTitle` is the same phrase as the document title, from `trainerByPhrase()`. `sameAs` is only an `http://` or `https://` Instagram or Telegram URL. `makesOffer` only for an `N BYN` price. `aggregateRating` only when `reviewCount` is greater than 0.

`SportsActivityLocation` only when a club record exists. Address only. The clubs index emits `ItemList` only for clubs that list can render. While `CLUBS_LIST` is empty the index is `noindex` and has no graph.

City and category pages do not emit an `ItemList` of trainers until the loader already has the visible list. One published category is one `ItemList` entry on `/categories`.

Crumbs in the graph use the same names as the nav, including `Тренерам` on `/join/trainer`.

Never emit a telephone, an `AggregateRating` with no reviews, a graph on a `noindex` URL, or a `script:ld+json` meta tag.

## Description helper

`categorySearchDescription` and `cityCatalogDescription` call `pickSearchAlias`. The alias has to be a second query (`персональный тренер`, `для детей`), not another spelling of the sport name (`фитнес` next to `фитнесу`).

## Sitemap

`/sitemap.xml` lists catalog paths from `listCatalogSitemapPaths`, plus `/about`, `/contacts`, `/offer`, `/privacy`, and `/join/trainer`. `/clubs` stays off the list while it is empty. There is no blog.
