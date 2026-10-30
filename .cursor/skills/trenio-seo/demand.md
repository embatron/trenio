# Demand in Belarus

Recorded October 2026. Volumes are not stored. They go stale, and a made-up number would steer URLs. Re-check Yandex Wordstat with the Belarus region, and Google Keyword Planner, before proposing a new indexable URL. Order below is intent and population, not a volume table.

## Engines

Statcounter, all devices, Belarus, September 2026: Google 58.98%, Yandex 38.54%, Bing 1.24%. Mobile, February 2026: Google 66.39%, Yandex 32.71%. A March 2026 advertising note cited Google 63.35% and Yandex 34.95%. Both engines are required. Bing does not get its own template.

DataReportal Digital 2026, cited in that note: 8.47 million internet users and 94.3% penetration at the end of 2025. Most of that use is a phone. The PWA and the mobile layout are the page Google and Yandex render.

Ignore unsourced "billions of queries" dashboards.

## How people type

The useful query is short and Russian:

- `тренер по {dative} {city}` — `тренер по боксу минск`. This is the catalog sentence.
- `{sport} {city}` — `йога минск`, `бокс минск`. Mixed intent: trainer, section, club. The same page answers it. Do not split a second URL.
- `персональный тренер {city}` — fitness, strongest in Minsk. It is an alias of `/categories/fitnes` and of the fitness city page, not its own path.
- `секция {sport} {city}`, `{sport} для детей {city}` — a parent looking for a section. Audience is the `для ребёнка` filter, not a URL.
- `инструктор по йоге`, `инструктор по плаванию` — the same sport page.

Price, "индивидуально", "для начинающих", and "с нуля" belong in the description and the filters.

## Where the demand sits

Minsk is the commercial center. Then the oblast centers: Gomel, Brest, Grodno, Vitebsk, Mogilev. Then the rest of the twenty catalog cities. Internal links from a sport page should prefer that order, which `CITY_PAGES` already has. A town outside the twenty stays a profile field.

Sports that carry the non-brand demand, in the order worth watching in Search Console:

1. Fitness and the gym, including `персональный тренер`.
2. Boxing, kickboxing, MMA, and the martial-arts parent.
3. Swimming, especially for children.
4. Yoga, pilates, stretching.
5. Football, dance, rhythmic gymnastics, and hockey for children.
6. Tennis, sambo, judo, karate, crossfit, figure skating, rehabilitation and ЛФК.

Every other published sport already has a page and a paragraph in `src/lib/catalog/category-copy.ts`. Keep it. Do not noindex it for being quiet, and do not write a second page for a synonym that is already an alias.

## Not a page

- `для похудения`, `набор массы`, and other goals.
- `онлайн`, `в группе`, `индивидуально`.
- `бесплатный тренер`. The free thing is the listing, and that query belongs on `/join/trainer`.
- `проверенный тренер`. The product does not verify qualifications.
- A district of Minsk, until Wordstat shows the district plus the sport as its own intent.
- Belarusian spellings. Do not create `be-BY` URLs.
