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

Trainer `jobTitle` is the same phrase as the document title, without the site name: `trainerDocumentPhrase()` — every sport in the dative, then the person's name, then the locative city (`Тренер по боксу Артём Романович в Минске`). The site name is `Я ищу тренера на trenio.by`. `sameAs` is only an `http://` or `https://` Instagram or Telegram URL. `makesOffer` only for an `N BYN` price. `aggregateRating` only when `reviewCount` is greater than 0. `dateCreated` and `dateModified` come from the profile row. `alternateName` is the public slug when it is not the person's name. `mainEntityOfPage` is the trainer URL on trenio.by. There is no image in the graph when the profile has no photo. When a photo exists, every trainer page uses one image: `/og/trainers/{slug}.jpg`. The file is chosen from that trainer's photos. The face file wins when it is a portrait. A wide graphic loses to a later square or portrait frame. Thumbnails lose to the master. A portrait is cut from the top so the head stays. A wide frame follows the skin in the upper part. The card is a 1200×630 baseline JPEG. `og:image`, `Person.image`, `primaryImageOfPage`, and the sitemap image are that same URL, with width 1200 and height 630. The caption is the document phrase. `og:title` is the phrase without the site name. `og:description` is the biography. The document `<title>` and the meta description stay the search strings, with the site name and the phrase. Every other public page also uses that shorter messenger title: `documentLead` of the document title. A category, a sport, and a city-and-sport page share one illustration, `/og/categories/{parent}.jpg`. The drawing stays whole inside the 1200×630 baseline JPEG. Open Graph, the `CollectionPage` image, and that URL are the same file. A page with no picture keeps `/og.png`. A draft, a preview, and a staff view pass `index: false` and emit no graph.

`SportsActivityLocation` only when a club record exists. Address only. The clubs index emits `ItemList` only for clubs that list can render. While `CLUBS_LIST` is empty the index is `noindex` and has no graph.

City and category pages do not emit an `ItemList` of trainers until the loader already has the visible list. One published category is one `ItemList` entry on `/categories`.

Crumbs in the graph use the same names as the nav, including `Тренерам` on `/join/trainer`.

Never emit a telephone, an `AggregateRating` with no reviews, a graph on a `noindex` URL, or a `script:ld+json` meta tag.

## Description helper

`categorySearchDescription` and `cityCatalogDescription` call `pickSearchAlias`. The alias has to be a second query (`персональный тренер`, `для детей`), not another spelling of the sport name (`фитнес` next to `фитнесу`).

## Sitemap

`/sitemap.xml` lists catalog paths from `listCatalogSitemapPaths`, the static info pages, and every `published` trainer profile (`/trainers/{slug}`, with `lastmod` and the card photo when that file is a public URL). Drafts, hidden profiles, and archived profiles stay out. `/clubs` stays off the list while it is empty. There is no blog.
