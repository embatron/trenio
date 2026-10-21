import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategoryLink } from "@/lib/catalog/category-routes";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { trainersForCity, type PublishedTrainer } from "@/lib/catalog/published-trainers";
import { compareByPopularity, compareByRating, compareByReviews, ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { FavoriteButton } from "@/components/favorite-button";
import { PhotoImage } from "@/components/photo-image";
import { TrainerRating } from "@/components/trainer-rating";
import { countRu, pluralRu } from "@/lib/ru-plural";

export const Route = createFileRoute("/city/$slug")({
  head: ({ params }) => {
    const c = CITIES[params.slug] ?? fallbackCity(params.slug);
    const title = `Тренеры в ${c.titleLoc} — ${c.title} | trenio.by`;
    const desc = `Личные тренеры в ${c.titleLoc}: ${c.lead} Поиск по району, виду спорта, цене и формату.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  loader: () => listTrainerRatingSummariesFn(),
  component: CityPage,
});

type City = {
  slug: string;
  title: string;
  titleLoc: string;
  titleGen: string;
  lead: string;
  districts: string[];
  metro?: string[];
  neighbors: { slug: string; label: string }[];
  about: { h: string; p: string }[];
  faq: { q: string; a: string }[];
  stats: { trainers: number; clubs: number; sports: number; avgPrice: number };
  isEmpty?: boolean;
};

const POPULAR_SPORTS = [
  { slug: "boks", parentSlug: "edinoborstva", childSlug: "boks", label: "Бокс" },
  { slug: "fitnes", parentSlug: "fitnes", label: "Фитнес" },
  { slug: "yoga", parentSlug: "yoga", childSlug: "yoga", label: "Йога" },
  { slug: "plavanie", parentSlug: "plavanie", childSlug: "plavanie", label: "Плавание" },
  { slug: "mma", parentSlug: "edinoborstva", childSlug: "mma", label: "MMA" },
  { slug: "tennis", parentSlug: "raketki", childSlug: "bolshoj-tennis", label: "Теннис" },
  { slug: "futbol", parentSlug: "komandnye", childSlug: "futbol", label: "Футбол" },
  { slug: "edinoborstva", parentSlug: "edinoborstva", label: "Единоборства" },
];

const CITIES: Record<string, City> = {
  minsk: {
    slug: "minsk",
    title: "Минск",
    titleLoc: "Минске",
    titleGen: "Минска",
    lead: "Опубликованные тренеры в Минске.",
    districts: ["Центр", "Уручье", "Малиновка", "Серебрянка", "Каменная Горка", "Чижовка", "Юг", "Восток", "Запад"],
    metro: ["Площадь Победы", "Восток", "Каменная Горка", "Малиновка", "Пушкинская", "Спортивная", "Грушевка"],
    neighbors: [
      { slug: "gomel", label: "Гомель" },
      { slug: "brest", label: "Брест" },
      { slug: "grodno", label: "Гродно" },
      { slug: "vitebsk", label: "Витебск" },
      { slug: "mogilev", label: "Могилёв" },
    ],
    about: [{ h: "О городе", p: "Описание и список клубов появятся, когда в городе будут опубликованные профили." }],
    faq: [{ q: "Когда появятся тренеры?", a: "Раздел откроется, как только тренеры опубликуют профили." }],
    stats: { trainers: 0, clubs: 0, sports: 0, avgPrice: 0 },
    isEmpty: false,
  },
  gomel: {
    slug: "gomel",
    title: "Гомель",
    titleLoc: "Гомеле",
    titleGen: "Гомеля",
    lead: "Тренеры и клубы в Гомеле. Раздел пока не заполнен.",
    districts: ["Центральный", "Советский", "Новобелицкий", "Железнодорожный"],
    neighbors: [
      { slug: "minsk", label: "Минск" },
      { slug: "mogilev", label: "Могилёв" },
      { slug: "brest", label: "Брест" },
    ],
    about: [{ h: "О городе", p: "Описание и список клубов появятся, когда в городе будут опубликованные профили." }],
    faq: [{ q: "Когда появятся тренеры?", a: "Раздел откроется, как только тренеры опубликуют профили." }],
    stats: { trainers: 0, clubs: 0, sports: 0, avgPrice: 0 },
    isEmpty: true,
  },
};

function fallbackCity(slug: string): City {
  const title = slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    slug,
    title,
    titleLoc: title + "е",
    titleGen: title + "а",
    lead: `Тренеры и клубы в городе ${title}. Раздел только наполняется — будьте первыми.`,
    districts: ["Центр", "Север", "Юг"],
    neighbors: [
      { slug: "minsk", label: "Минск" },
      { slug: "gomel", label: "Гомель" },
    ],
    about: [{ h: "О городе", p: "Скоро здесь появится описание спортивной жизни города и список лучших клубов." }],
    faq: [{ q: "Когда появятся тренеры?", a: "Мы открываем регистрацию для тренеров постепенно. Подпишитесь — сообщим первым." }],
    stats: { trainers: 0, clubs: 0, sports: 0, avgPrice: 0 },
    isEmpty: true,
  };
}

type TrainerCard = {
  slug: string;
  name: string;
  photo: string;
  sport: string;
  desc: string;
  tags: string[];
  rating: string;
  reviews: number;
  price: number;
  district: string;
  metro?: string;
  badge?: string;
  experience: number;
  audiences: Array<"adult" | "kid" | "teen">;
  formats: Array<"individual" | "group">;
  sportSlugs: string[];
};

function toCityCard(trainer: PublishedTrainer, ratings: Record<string, TrainerRatingSnapshot>): TrainerCard {
  const rating = ratingFor(trainer.slug, ratings);
  return {
    slug: trainer.slug,
    name: trainer.name,
    photo: trainer.photo,
    sport: trainer.sports.map((sport) => sport.label).join(", "),
    desc: trainer.bio,
    tags: trainer.sports.map((sport) => sport.label),
    rating: rating.rating,
    reviews: rating.reviews,
    price: 0,
    district: trainer.district,
    experience: trainer.experience,
    audiences: trainer.audiences,
    formats: trainer.formats,
    sportSlugs: trainer.sports.flatMap((sport) => [sport.slug, sport.parentSlug]),
  };
}

function generateTrainers(city: City, ratings: Record<string, TrainerRatingSnapshot>): TrainerCard[] {
  return trainersForCity(city.slug).map((trainer) => toCityCard(trainer, ratings));
}

const PAGE_CSS = `
.city-hero { background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%); padding: 36px 0 28px; border-bottom: 1px solid var(--line); }
.city-hero__inner { max-width: var(--layout-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.city-breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; color: var(--muted); margin-bottom: 18px; }
.city-breadcrumbs a { color: var(--muted); text-decoration: none; }
.city-breadcrumbs a:hover { color: var(--primary); }
.city-breadcrumbs [aria-hidden] { color: var(--muted); }
.city-hero__grid { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: var(--layout-gap); align-items: center; }
.city-hero__title { margin: 0; font-size: var(--fs-page); line-height: 1.15; letter-spacing: var(--tracking-heading); font-weight: var(--fw-heading); color: var(--dark); }
.city-hero__lead { margin: 14px 0 22px; font-size: 17px; line-height: 1.5; color: var(--muted); max-width: 60ch; font-weight: var(--fw-body); }
.city-hero__stats { display: flex; flex-wrap: wrap; gap: 10px; }
.city-hero__stat { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-tile); font-size: 13px; font-weight: var(--fw-heading); color: var(--dark); }
.city-hero__stat b { color: var(--primary); font-weight: var(--fw-heading); font-size: 16px; }
.city-hero__map { aspect-ratio: 4/3; border-radius: var(--card-radius); background: linear-gradient(135deg, #1f2937 0%, #111827 100%); position: relative; overflow: hidden; color: #fff; box-shadow: 0 30px 60px -30px rgba(0,0,0,0.5); }
.city-hero__map::before { content: ""; position: absolute; inset: 0; background-image:
  linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 32px 32px; }
.city-hero__map-pin { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0.25), 0 0 0 18px rgba(var(--primary-rgb), 0.12); }
.city-hero__map-label { position: absolute; left: 22px; bottom: 22px; padding: 8px 14px; background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); border-radius: 999px; font-size: 13px; font-weight: var(--fw-heading); }

.city-quickrow { max-width: var(--layout-max); margin: 24px auto 0; padding-inline: var(--layout-gutter); }
.city-quickrow__title { font-size: 12px; font-weight: var(--fw-title); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.city-quickrow__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.city-quickrow__chip { padding: 9px 14px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); color: var(--dark); font-size: 13px; font-weight: var(--fw-heading); text-decoration: none; cursor: pointer; transition: all 0.16s ease; }
.city-quickrow__chip:hover { border-color: var(--primary); color: var(--primary); }
.city-quickrow__chip.is-active { background: var(--primary); border-color: var(--primary); color: #fff; }

.city-body { align-items: start; }
.city-filters { position: sticky; top: calc(var(--header-clearance, 80px) + 16px); align-self: start; background: var(--white); border: 1px solid var(--line); border-radius: var(--card-radius); padding: 22px; max-height: calc(100vh - var(--header-clearance, 80px) - 32px); overflow-y: auto; }
.city-filters h3 { margin: 0 0 16px; font-size: 17px; letter-spacing: -0.02em; font-weight: var(--fw-title); }
.city-filter { border-top: 1px solid var(--line); padding: 16px 0; }
.city-filter:first-of-type { border-top: 0; padding-top: 0; }
.city-filter__title { font-size: 12px; font-weight: var(--fw-title); letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.city-filter__opts { display: flex; flex-wrap: wrap; gap: 6px; }
.city-pill { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); border: 1px solid transparent; color: var(--dark); font-size: 12px; font-weight: var(--fw-heading); cursor: pointer; transition: all 0.16s ease; }
.city-pill:hover { background: rgba(var(--primary-rgb), 0.08); }
.city-pill.is-active { background: var(--primary); color: #fff; }
.city-filter__range { display: flex; gap: 8px; }
.city-filter__range input { width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: var(--radius-control); font: inherit; font-size: 13px; }
.city-filter__reset { width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--dark); font-weight: var(--fw-heading); font-size: 13px; cursor: pointer; margin-top: 8px; }
.city-filter__reset:hover { border-color: var(--primary); color: var(--primary); }

.city-results__head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.city-results__count { font-size: 15px; color: var(--muted); font-weight: var(--fw-ui); }
.city-results__count b { color: var(--dark); font-weight: var(--fw-title); }
.city-results__sort { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.city-results__sort select { padding: 9px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); font: inherit; font-size: 13px; background: var(--white); cursor: pointer; font-weight: var(--fw-heading); color: var(--dark); }
.city-grid { align-items: stretch; }

.city-empty { padding: 56px 36px; text-align: center; border-radius: var(--card-radius); background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%); border: 1px solid rgba(var(--primary-rgb), 0.16); display: grid; gap: 18px; justify-items: center; }
.city-empty__icon { width: 96px; height: 96px; border-radius: 50%; background: #fff; box-shadow: 0 12px 30px -12px rgba(var(--dark-rgb), 0.18); display: grid; place-items: center; color: var(--primary); }
.city-empty__icon svg { width: 44px; height: 44px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.city-empty h3 { margin: 0; font-size: 24px; font-weight: var(--fw-heading); letter-spacing: -0.025em; color: var(--dark); }
.city-empty p { margin: 0; max-width: 540px; color: var(--muted); font-size: 15px; line-height: 1.55; }
.city-empty__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 4px; }
.city-empty__btn { padding: 12px 22px; border-radius: var(--radius-control); font-size: 14px; font-weight: var(--fw-title); text-decoration: none; cursor: pointer; border: 0; }
.city-empty__btn--primary { background: var(--primary); color: #fff; }
.city-empty__btn--ghost { background: #fff; color: var(--dark); border: 1.5px solid var(--line); }

.city-districts { margin-top: 28px; }
.city-district { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); text-decoration: none; color: var(--dark); transition: all 0.16s ease; }
.city-district:hover { border-color: var(--primary); transform: translateY(-2px); }
.city-district b { font-size: 15px; font-weight: var(--fw-title); letter-spacing: -0.01em; }
.city-district span { color: var(--muted); font-size: 13px; font-weight: var(--fw-heading); }

.city-extra { display: grid; gap: var(--layout-section-y); padding-bottom: clamp(40px, 6vw, 60px); }
.city-block { display: grid; gap: 18px; }
.city-block h2 { margin: 0; font-size: var(--fs-section); letter-spacing: -0.03em; font-weight: var(--fw-heading); color: var(--dark); }

.city-article { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: var(--layout-gap); align-items: start; }
.city-article__body { display: grid; gap: 22px; }
.city-article__body h3 { margin: 0 0 6px; font-size: 20px; letter-spacing: -0.02em; font-weight: var(--fw-title); }
.city-article__body p { margin: 0; color: #4a4a4f; font-size: 15px; line-height: 1.65; }
.city-article__aside { background: var(--light-bg); border-radius: var(--card-radius); padding: 26px; display: grid; gap: 18px; }
.city-article__aside h4 { margin: 0 0 8px; font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; }
.city-related { display: flex; flex-wrap: wrap; gap: 8px; }
.city-related a { padding: 9px 14px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); font-size: 13px; font-weight: var(--fw-heading); color: var(--dark); text-decoration: none; transition: all 0.16s ease; }
.city-related a:hover { border-color: var(--primary); color: var(--primary); }

.city-faq { display: grid; gap: 8px; }
.city-faq details { background: var(--white); border: 1px solid var(--line); border-radius: var(--card-radius); overflow: hidden; }
.city-faq summary { padding: 18px 22px; font-weight: var(--fw-title); cursor: pointer; font-size: 15px; letter-spacing: -0.01em; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.city-faq summary::after { content: "+"; font-size: 22px; color: var(--primary); font-weight: var(--fw-heading); }
.city-faq details[open] summary::after { content: "−"; }
.city-faq details > div { padding: 0 22px 20px; color: var(--muted); font-size: 14px; line-height: 1.6; }

.city-cta { background: linear-gradient(135deg, var(--primary) 0%, #e63946 60%, #ad2030 100%); border-radius: var(--card-radius); padding: 44px 48px; color: #fff; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; }
.city-cta h2 { margin: 0 0 6px; font-size: var(--fs-section); font-weight: var(--fw-heading); letter-spacing: -0.025em; }
.city-cta p { margin: 0; color: rgba(255,255,255,0.85); font-size: 15px; max-width: 56ch; }
.city-cta a { display: inline-flex; align-items: center; min-height: 44px; padding: 12px 22px; border-radius: 999px; background: #fff; color: var(--primary-dark); font-weight: var(--fw-title); text-decoration: none; white-space: nowrap; }

@media (max-width: 960px) {
  .city-hero__grid { grid-template-columns: 1fr; }
  .city-hero__map { max-width: 420px; }
  .city-filters { position: static; max-height: none; }
  .city-article { grid-template-columns: 1fr; }
  .city-cta { grid-template-columns: 1fr; padding: 32px 26px; }
  .city-extra { gap: 36px; }
}
`;

function CityPage() {
  const { slug } = Route.useParams();
  const ratings = Route.useLoaderData();
  const navigate = useNavigate();
  const city = CITIES[slug] ?? fallbackCity(slug);
  const allTrainers = useMemo(() => generateTrainers(city, ratings), [city, ratings]);

  const [district, setDistrict] = useState<string | null>(null);
  const [sportSlug, setSportSlug] = useState<string | null>(null);
  const [audience, setAudience] = useState<"all" | "adult" | "kid" | "teen">("all");
  const [format, setFormat] = useState<"all" | "individual" | "group">("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [minExperience, setMinExperience] = useState<number | null>(null);
  const [sort, setSort] = useState("popular");

  const filtered = useMemo(() => {
    let list = allTrainers.filter((t) => {
      if (district && t.district !== district) return false;
      if (sportSlug && !t.sportSlugs.includes(sportSlug)) return false;
      if (audience !== "all" && t.audiences.length > 0 && !t.audiences.includes(audience)) return false;
      if (format !== "all" && t.formats.length > 0 && !t.formats.includes(format)) return false;
      if (priceMin && t.price < Number(priceMin)) return false;
      if (priceMax && t.price > Number(priceMax)) return false;
      if (minExperience != null && t.experience < minExperience) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "rating") list = [...list].sort(compareByRating);
    else if (sort === "reviews") list = [...list].sort(compareByReviews);
    else list = [...list].sort(compareByPopularity);
    return list;
  }, [allTrainers, district, sportSlug, audience, format, priceMin, priceMax, minExperience, sort]);

  const reset = () => {
    setDistrict(null); setSportSlug(null); setAudience("all"); setFormat("all"); setPriceMin(""); setPriceMax(""); setMinExperience(null);
  };

  return (
    <div className="page-shell">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <SiteHeader />

      <main>
        <section className="city-hero">
          <div className="city-hero__inner">
            <nav className="city-breadcrumbs" aria-label="breadcrumbs">
              <Link to="/">Главная</Link>
              <span aria-hidden="true">/</span>
              <Link to="/city/$slug" params={{ slug: "minsk" }}>Города</Link>
              <span aria-hidden="true">/</span>
              <span className="is-current" aria-current="page">{city.title}</span>
            </nav>
            <div className="city-hero__grid">
              <div>
                <h1 className="city-hero__title">Тренеры в {city.titleLoc}</h1>
                <p className="city-hero__lead">{city.lead}</p>
                {(city.stats.trainers || city.stats.clubs || city.stats.sports || city.stats.avgPrice) ? (
                <div className="city-hero__stats">
                  <span className="city-hero__stat"><b>{city.stats.trainers}</b> {pluralRu(city.stats.trainers, "тренер", "тренера", "тренеров")}</span>
                  <span className="city-hero__stat"><b>{city.stats.clubs}</b> {pluralRu(city.stats.clubs, "клуб", "клуба", "клубов")}</span>
                  <span className="city-hero__stat"><b>{city.stats.sports}</b> {pluralRu(city.stats.sports, "вид", "вида", "видов")} спорта</span>
                  <span className="city-hero__stat"><b>{city.stats.avgPrice}</b> BYN средн.</span>
                </div>
                ) : null}
              </div>
              <div className="city-hero__map" aria-hidden="true">
                <div className="city-hero__map-pin" />
                <div className="city-hero__map-label">📍 {city.title}, Беларусь</div>
              </div>
            </div>
          </div>

          <div className="city-quickrow">
            <div className="city-quickrow__title">Популярные виды спорта в {city.titleLoc}</div>
            <div className="city-quickrow__chips">
              <button className={`city-quickrow__chip${sportSlug === null ? " is-active" : ""}`} onClick={() => setSportSlug(null)}>Все направления</button>
              {POPULAR_SPORTS.map((s) => (
                <button key={s.slug} className={`city-quickrow__chip${sportSlug === s.slug ? " is-active" : ""}`} onClick={() => setSportSlug(s.slug === sportSlug ? null : s.slug)}>{s.label}</button>
              ))}
            </div>
          </div>
        </section>

        <div className="layout-with-sidebar city-body">
          <aside className="city-filters">
            <h3>Фильтры</h3>
            <div className="city-filter">
              <div className="city-filter__title">Район</div>
              <div className="city-filter__opts">
                <button className={`city-pill${district === null ? " is-active" : ""}`} onClick={() => setDistrict(null)}>Все</button>
                {city.districts.map((d) => (
                  <button key={d} className={`city-pill${district === d ? " is-active" : ""}`} onClick={() => setDistrict(d === district ? null : d)}>{d}</button>
                ))}
              </div>
            </div>
            {city.metro && city.metro.length > 0 && (
              <div className="city-filter">
                <div className="city-filter__title">Метро</div>
                <div className="city-filter__opts">
                  {city.metro.map((m) => (
                    <button key={m} className="city-pill" onClick={() => alert(`Фильтр по станции «${m}»`)}>{m}</button>
                  ))}
                </div>
              </div>
            )}
            <div className="city-filter">
              <div className="city-filter__title">Аудитория</div>
              <div className="city-filter__opts">
                {[{ v: "all", l: "Любая" }, { v: "adult", l: "Взрослые" }, { v: "teen", l: "Подростки" }, { v: "kid", l: "Дети" }].map((o) => (
                  <button key={o.v} className={`city-pill${audience === o.v ? " is-active" : ""}`} onClick={() => setAudience(o.v as typeof audience)}>{o.l}</button>
                ))}
              </div>
            </div>
            <div className="city-filter">
              <div className="city-filter__title">Формат</div>
              <div className="city-filter__opts">
                {[{ v: "all", l: "Любой" }, { v: "individual", l: "Индивидуально" }, { v: "group", l: "Группа" }].map((o) => (
                  <button key={o.v} className={`city-pill${format === o.v ? " is-active" : ""}`} onClick={() => setFormat(o.v as typeof format)}>{o.l}</button>
                ))}
              </div>
            </div>
            <div className="city-filter">
              <div className="city-filter__title">Цена, BYN</div>
              <div className="city-filter__range">
                <input type="number" placeholder="от" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                <input type="number" placeholder="до" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
              </div>
            </div>
            <div className="city-filter">
              <div className="city-filter__title">Опыт</div>
              <div className="city-filter__opts">
                {[
                  { years: 1, label: "от 1 года" },
                  { years: 3, label: "от 3 лет" },
                  { years: 5, label: "от 5 лет" },
                  { years: 10, label: "от 10 лет" },
                ].map((option) => (
                  <button
                    key={option.years}
                    type="button"
                    className={`city-pill${minExperience === option.years ? " is-active" : ""}`}
                    aria-pressed={minExperience === option.years}
                    onClick={() => setMinExperience((prev) => (prev === option.years ? null : option.years))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="city-filter__reset" onClick={reset}>Сбросить</button>
          </aside>

          <div>
            <div className="city-results__head">
              <div className="city-results__count">
                <b>{filtered.length}</b> {pluralRu(filtered.length, "тренер", "тренера", "тренеров")}{district ? ` · ${district}` : ""}{sportSlug ? ` · ${POPULAR_SPORTS.find(s => s.slug === sportSlug)?.label}` : ""}
              </div>
              <label className="city-results__sort">
                Сортировка:
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="popular">По популярности</option>
                  <option value="rating">По рейтингу</option>
                  <option value="reviews">По отзывам</option>
                  <option value="price-asc">Сначала дешевле</option>
                  <option value="price-desc">Сначала дороже</option>
                </select>
              </label>
            </div>

            {filtered.length === 0 ? (
              <div className="city-empty">
                <div className="city-empty__icon">
                  <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                </div>
                <h3>{allTrainers.length === 0 ? `Тренеров в ${city.titleLoc} пока нет` : "По вашим фильтрам ничего не нашлось"}</h3>
                <p>
                  {allTrainers.length === 0
                    ? `Город ${city.title} только открылся на trenio.by. Будьте первым тренером или подпишитесь — напишем, когда кто-то появится.`
                    : "Попробуйте сбросить часть фильтров или расширить район поиска."}
                </p>
                <div className="city-empty__actions">
                  {allTrainers.length === 0 ? (
                    <>
                      <Link to="/auth/signup" className="city-empty__btn city-empty__btn--primary">Стать первым тренером</Link>
                      <button type="button" className="city-empty__btn city-empty__btn--ghost" onClick={() => alert("Подписка оформлена.")}>Сообщить, когда появятся</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="city-empty__btn city-empty__btn--primary" onClick={reset}>Сбросить фильтры</button>
                      <Link to="/" className="city-empty__btn city-empty__btn--ghost">На главную</Link>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="city-grid">
                {filtered.map((t) => (
                  <Link key={t.slug} className="trainer-card" to="/trainers/$slug" params={{ slug: t.slug }}>
                    <div className="trainer-card__media">
                      <PhotoImage className="trainer-card__photo" src={t.photo} alt={t.name} preset="card" width={480} height={600} loading="lazy" />
                      {t.badge && <span className="trainer-card__badge">{t.badge}</span>}
                      <FavoriteButton target={{ type: "trainer", slug: t.slug }} className="trainer-card__save" />
                    </div>
                    <div className="trainer-card__body">
                      <div className="trainer-card__head">
                        <h3 className="trainer-card__name">{t.name}</h3>
                        <TrainerRating rating={t.rating} reviews={t.reviews} />
                      </div>
                      <p className="trainer-card__sport">{t.sport}{t.experience > 0 ? ` · опыт ${t.experience} ${pluralRu(t.experience, "год", "года", "лет")}` : ""}</p>
                      <p className="trainer-card__desc">{t.desc}</p>
                      <div className="trainer-card__tags">
                        {t.tags.map((tag, i) => (
                          <span key={tag} className={`trainer-card__tag${i === 0 ? " trainer-card__tag--accent" : ""}`}>{tag}</span>
                        ))}
                      </div>
                      <div className="trainer-card__footer">
                        <span className="trainer-card__location">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                          <span>{t.district ? `${city.title}, ${t.district}` : city.title}{t.metro ? ` · м. ${t.metro}` : ""}</span>
                        </span>
                        {t.price > 0 ? <span className="trainer-card__price"><small>от </small>{t.price} BYN</span> : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {!city.isEmpty && city.districts.length > 0 && (
              <>
                <h2 style={{ margin: "36px 0 14px", fontSize: 22, letterSpacing: "-0.02em", fontWeight: 850 }}>Тренеры по районам {city.titleGen}</h2>
                <div className="city-districts">
                  {city.districts.map((d, i) => (
                    <button key={d} className="city-district" onClick={() => setDistrict(d)}>
                      <b>{d}</b>
                      <span>{countRu(4 + ((i * 7) % 30), "тренер", "тренера", "тренеров")}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="layout-container city-extra">
          <section className="city-block">
            <h2>О спорте в {city.titleLoc}</h2>
            <div className="city-article">
              <div className="city-article__body">
                {city.about.map((b) => (
                  <div key={b.h}>
                    <h3>{b.h}</h3>
                    <p>{b.p}</p>
                  </div>
                ))}
              </div>
              <aside className="city-article__aside">
                <div>
                  <h4>Соседние города</h4>
                  <div className="city-related">
                    {city.neighbors.map((n) => (
                      <Link key={n.slug} to="/city/$slug" params={{ slug: n.slug }}>{n.label}</Link>
                    ))}
                  </div>
                </div>
                <div>
                  <h4>Популярные направления</h4>
                  <div className="city-related">
                    {POPULAR_SPORTS.slice(0, 6).map((s) => (
                      <CategoryLink key={s.slug} route={{ parentSlug: s.parentSlug, childSlug: s.childSlug }}>
                        {s.label}
                      </CategoryLink>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <section className="city-block">
            <h2>Частые вопросы</h2>
            <div className="city-faq">
              {city.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <div>{f.a}</div>
                </details>
              ))}
            </div>
          </section>

          <section className="city-cta">
            <div>
              <h2>Вы тренер из {city.titleGen}?</h2>
              <p>Разместите анкету бесплатно — добавьте свой район, цены и расписание, чтобы клиенты находили вас рядом с домом.</p>
            </div>
            <a href="/auth/signup" onClick={(e) => { e.preventDefault(); navigate({ to: "/auth/signup" }); }}>Стать тренером</a>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
