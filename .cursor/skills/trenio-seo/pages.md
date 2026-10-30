# Pages

Live indexable URLs are the ones below. `docs/PRODUCT.md` §3.1 still sketches an older `/trainers/{city}` map. Do not build that map. The catalog lives at `/city` and `/categories`.

JSON-LD for each row comes from the helper in [markup.md](markup.md). A `noindex` row emits none.

| Template | URL | Index | Title |
| --- | --- | --- | --- |
| Home | `/` | yes | `Найти тренера в Беларуси \| trenio.by` |
| Categories | `/categories` | yes | `Категории спорта — тренеры в Беларуси \| trenio.by` |
| Category | `/categories/{parent}` | yes | `Найти тренера по {titleGenitive} \| trenio.by` |
| Sport | `/categories/{parent}/{child}` | yes | same pattern, child dative |
| City | `/city/{city}` | yes | `Найти тренера в {locative} \| trenio.by` |
| City + sport | `/city/{city}/{sport}` | yes | `Найти тренера по {dative} в {locative} \| trenio.by` |
| Nested sport | `/city/minsk/yoga/yoga` | yes | same, when the sport slug equals its parent |
| Trainer | `/trainers/{slug}` | yes | `Тренер по {все виды в дательном, через «и»} \| trenio.by`. ОФП, ЛФК and ОФК expand. The name and city stay in the description. |
| Map | `/map` | yes | `Тренеры на карте Беларуси \| trenio.by` |
| Map with query | `/map?sports=` or `?city=` | no | canonical stays `/map` |
| Join | `/join/trainer` | yes | `Стать тренером — бесплатная карточка \| trenio.by`. H1 stays `Привет!` |
| About, contacts, offer, privacy | those paths | yes | the H1, then `\| trenio.by` |
| Clubs index | `/clubs` | no, until a club is published | — |
| Club | `/clubs/{slug}` | yes, when the record exists | `{name} — клуб в {city} \| trenio.by` |
| Search | `/search` | no | any query |
| City with several sports | `/city/{city}?sports=` | no | canonical is the city path |
| Auth | `/auth/*` | no. Token pages are `nofollow` | — |
| Account, trainer cabinet, admin | `/account`, `/me`, `/admin` | no | — |
| Claim | `/trainers/claim/{token}` | no | — |
| 403, 404, SSR crash | those responses | no | — |

Twenty cities have pages: Minsk, Gomel, Grodno, Vitebsk, Mogilev, Brest, then Bobruisk through Zhodino. The list is `CITY_PAGES` in `src/lib/catalog/city-pages.ts`. A smaller town does not get a URL. On a trainer profile the locative falls back to `городе {name}`.

H1 on a category or city page is the phrase without the brand: `Найти тренера по боксу в Бресте`. The dative comes from `titleGenitive`. `ОФП`, `ЛФК`, and `ОФК` expand only in that phrase. Crumbs, menus, and cards keep the short name.

The home H1 is `Я ищу тренера`. Leave it. The title already matches `найти тренера в Беларуси`.

Old category slugs redirect in `src/lib/catalog/slug-policy.ts`. A renamed slug keeps the old segment there.

Unpublished taxonomy (`published: false`, currently wellness) is not a public URL and not a sitemap row.

There is no blog. Do not add `/blog` until an article is published.
