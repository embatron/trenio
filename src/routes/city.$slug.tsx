import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CategoryLink } from "@/lib/catalog/category-routes";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

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
  component: CityPage,
});

type City = {
  slug: string;
  title: string;
  titleLoc: string;
  titleGen: string;
  eyebrow: string;
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
  { slug: "fitnes", parentSlug: "fitnes-i-trenirovki-v-zale", label: "Фитнес" },
  { slug: "yoga", parentSlug: "yoga-pilates-i-rastyazhka", childSlug: "yoga", label: "Йога" },
  { slug: "plavanie", parentSlug: "plavanie-i-vodnye-trenirovki", childSlug: "plavanie", label: "Плавание" },
  { slug: "mma", parentSlug: "edinoborstva", childSlug: "mma", label: "MMA" },
  { slug: "tennis", parentSlug: "tennis-i-igry-s-raketkoy", childSlug: "bolshoj-tennis", label: "Теннис" },
  { slug: "futbol", parentSlug: "futbol-i-komandnye-igry", childSlug: "futbol", label: "Футбол" },
  { slug: "edinoborstva", parentSlug: "edinoborstva", label: "Единоборства" },
];

const CITIES: Record<string, City> = {
  minsk: {
    slug: "minsk",
    title: "Минск",
    titleLoc: "Минске",
    titleGen: "Минска",
    eyebrow: "Город · Столица",
    lead: "Минск — крупнейший центр персональных тренировок в Беларуси: больше 400 тренеров и десятки клубов в каждом районе.",
    districts: ["Центр", "Уручье", "Малиновка", "Серебрянка", "Каменная Горка", "Чижовка", "Юг", "Восток", "Запад"],
    metro: ["Площадь Победы", "Восток", "Каменная Горка", "Малиновка", "Пушкинская", "Спортивная", "Грушевка"],
    neighbors: [
      { slug: "gomel", label: "Гомель" },
      { slug: "brest", label: "Брест" },
      { slug: "grodno", label: "Гродно" },
      { slug: "vitebsk", label: "Витебск" },
      { slug: "mogilev", label: "Могилёв" },
    ],
    about: [
      { h: "Спортивная жизнь Минска", p: "В городе работают сотни клубов — от классических тренажёрных залов до студий йоги и боксёрских школ. Большинство тренеров принимают в собственном зале или приезжают в один из больших фитнес-центров: SilkWay, World Class, Adrenalin." },
      { h: "Как выбрать район", p: "Если вы из спальника — фильтруйте по своей станции метро или району, чтобы не тратить час на дорогу. В центре больше выбора, но и цены чуть выше: 45–60 BYN за персональное занятие против 30–45 BYN на периферии." },
      { h: "Средние цены и форматы", p: "Персональная тренировка в Минске — в среднем 45 BYN, групповая — 20 BYN. У большинства тренеров есть пакеты на 8–10 занятий со скидкой 10–20%." },
    ],
    faq: [
      { q: "Где удобнее всего заниматься?", a: "Зависит от вашего района. На trenio.by можно отфильтровать тренеров по станции метро или району — в среднем 15 минут пешком от дома до зала." },
      { q: "Можно ли заниматься на улице или дома?", a: "Да, многие тренеры приезжают на дом или работают на спортплощадках в парках (Лошица, Дрозды, Слепянка, Победителей)." },
      { q: "Есть ли тренеры с английским?", a: "Да, в фильтре можно выбрать язык. В Минске работают тренеры с английским, польским и арабским." },
    ],
    stats: { trainers: 420, clubs: 86, sports: 38, avgPrice: 45 },
  },
  gomel: {
    slug: "gomel",
    title: "Гомель",
    titleLoc: "Гомеле",
    titleGen: "Гомеля",
    eyebrow: "Город · Областной центр",
    lead: "В Гомеле представлены все основные направления — бокс, фитнес, плавание, единоборства. Цены ниже минских, выбор клубов растёт.",
    districts: ["Центральный", "Советский", "Новобелицкий", "Железнодорожный"],
    neighbors: [
      { slug: "minsk", label: "Минск" },
      { slug: "mogilev", label: "Могилёв" },
      { slug: "brest", label: "Брест" },
    ],
    about: [
      { h: "Где заниматься в Гомеле", p: "Большинство залов — в Центральном и Советском районах. Бассейны: Дворец водных видов спорта, СОК «Лидер». В пригороде популярны воркаут-площадки." },
      { h: "Цены", p: "Персональная тренировка — 25–40 BYN, групповая — 10–18 BYN. Многие тренеры дают пробное занятие бесплатно." },
    ],
    faq: [
      { q: "Сколько тренеров уже в Гомеле?", a: "Около 60 активных профилей по основным направлениям." },
      { q: "Можно ли найти детского тренера?", a: "Да, есть отдельный фильтр аудитории — около 20 тренеров работают с детьми." },
    ],
    stats: { trainers: 62, clubs: 18, sports: 22, avgPrice: 32 },
  },
};

function fallbackCity(slug: string): City {
  const title = slug.charAt(0).toUpperCase() + slug.slice(1);
  return {
    slug,
    title,
    titleLoc: title + "е",
    titleGen: title + "а",
    eyebrow: "Город",
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
  audience: "adult" | "kid" | "teen";
  format: "individual" | "group";
  sportSlug: string;
};

function generateTrainers(c: City): TrainerCard[] {
  if (c.isEmpty) return [];
  const first = ["Фархад", "Дмитрий", "Сергей", "Артем", "Владимир", "Анна", "Ольга", "Игорь", "Павел", "Никита", "Юлия", "Михаил"];
  const last = ["Ахмеджанов", "Хотин", "Овсяников", "Романович", "Антипенко", "Ковалёва", "Сидорова", "Зайцев", "Левин", "Гомель", "Дроздова", "Беленький"];
  return Array.from({ length: 12 }).map((_, i) => {
    const f = first[i % first.length];
    const l = last[(i * 3) % last.length];
    const sp = POPULAR_SPORTS[i % POPULAR_SPORTS.length];
    const aud: TrainerCard["audience"] = i % 4 === 0 ? "kid" : i % 5 === 0 ? "teen" : "adult";
    const fmt: TrainerCard["format"] = i % 3 === 0 ? "group" : "individual";
    return {
      slug: `${c.slug}-trainer-${i + 1}`,
      name: `${f} ${l}`,
      sport: sp.label,
      sportSlug: sp.slug,
      desc: `${sp.label} в ${c.titleLoc} — постановка техники, индивидуальный план, безопасный темп.`,
      tags: [fmt === "group" ? "Группа" : "Индивидуально", aud === "kid" ? "Дети" : aud === "teen" ? "Подростки" : "Взрослые", i % 2 === 0 ? "С нуля" : "Опытные"],
      rating: (4.5 + (i % 6) * 0.08).toFixed(1),
      reviews: 6 + ((i * 7) % 60),
      price: 25 + ((i * 9) % 38),
      district: c.districts[i % c.districts.length],
      metro: c.metro?.[i % (c.metro?.length || 1)],
      badge: i === 0 ? "Топ" : i === 3 ? "Новый" : undefined,
      experience: 1 + ((i * 3) % 14),
      audience: aud,
      format: fmt,
    };
  });
}

function placeholder(seed: string) {
  return `https://placehold.co/480x600/fff5f5/c9343a?text=${encodeURIComponent(seed)}`;
}

const PAGE_CSS = `
.city-hero { background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%); padding: 36px 0 28px; border-bottom: 1px solid var(--line); }
.city-hero__inner { max-width: var(--layout-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.city-breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; color: var(--muted); margin-bottom: 18px; }
.city-breadcrumbs a { color: var(--muted); text-decoration: none; }
.city-breadcrumbs a:hover { color: var(--primary); }
.city-breadcrumbs span { color: var(--dark); font-weight: 700; }
.city-hero__grid { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 40px; align-items: center; }
.city-hero__eyebrow { display: inline-block; padding: 5px 11px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.12); color: var(--primary-dark); font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px; }
.city-hero__title { margin: 0; font-size: clamp(34px, 5vw, 56px); line-height: 1.02; letter-spacing: -0.035em; font-weight: 900; color: var(--dark); }
.city-hero__lead { margin: 14px 0 22px; font-size: 17px; line-height: 1.5; color: var(--muted); max-width: 60ch; font-weight: 550; }
.city-hero__stats { display: flex; flex-wrap: wrap; gap: 10px; }
.city-hero__stat { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--white); border: 1px solid var(--line); border-radius: 14px; font-size: 13px; font-weight: 700; color: var(--dark); }
.city-hero__stat b { color: var(--primary); font-weight: 900; font-size: 16px; }
.city-hero__map { aspect-ratio: 4/3; border-radius: 24px; background: linear-gradient(135deg, #1f2937 0%, #111827 100%); position: relative; overflow: hidden; color: #fff; box-shadow: 0 30px 60px -30px rgba(0,0,0,0.5); }
.city-hero__map::before { content: ""; position: absolute; inset: 0; background-image:
  linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 32px 32px; }
.city-hero__map-pin { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); width: 18px; height: 18px; background: var(--primary); border-radius: 50%; box-shadow: 0 0 0 8px rgba(var(--primary-rgb), 0.25), 0 0 0 18px rgba(var(--primary-rgb), 0.12); }
.city-hero__map-label { position: absolute; left: 22px; bottom: 22px; padding: 8px 14px; background: rgba(0,0,0,0.55); backdrop-filter: blur(8px); border-radius: 999px; font-size: 13px; font-weight: 700; }

.city-quickrow { max-width: var(--layout-max); margin: 24px auto 0; padding-inline: var(--layout-gutter); }
.city-quickrow__title { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.city-quickrow__chips { display: flex; flex-wrap: wrap; gap: 8px; }
.city-quickrow__chip { padding: 9px 14px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); color: var(--dark); font-size: 13px; font-weight: 700; text-decoration: none; cursor: pointer; transition: all 0.16s ease; }
.city-quickrow__chip:hover { border-color: var(--primary); color: var(--primary); }
.city-quickrow__chip.is-active { background: var(--primary); border-color: var(--primary); color: #fff; }

.city-body { max-width: var(--layout-max); margin: 0 auto; padding: var(--layout-section-y) var(--layout-gutter) clamp(40px, 6vw, 60px); display: grid; grid-template-columns: var(--layout-sidebar-w) minmax(0, 1fr); gap: var(--layout-sidebar-gap); }
.city-filters { position: sticky; top: calc(var(--header-clearance, 80px) + 16px); align-self: start; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 22px; max-height: calc(100vh - var(--header-clearance, 80px) - 32px); overflow-y: auto; }
.city-filters h3 { margin: 0 0 16px; font-size: 17px; letter-spacing: -0.02em; font-weight: 850; }
.city-filter { border-top: 1px solid var(--line); padding: 16px 0; }
.city-filter:first-of-type { border-top: 0; padding-top: 0; }
.city-filter__title { font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.city-filter__opts { display: flex; flex-wrap: wrap; gap: 6px; }
.city-pill { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); border: 1px solid transparent; color: var(--dark); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.16s ease; }
.city-pill:hover { background: rgba(var(--primary-rgb), 0.08); }
.city-pill.is-active { background: var(--primary); color: #fff; }
.city-filter__range { display: flex; gap: 8px; }
.city-filter__range input { width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; font: inherit; font-size: 13px; }
.city-filter__reset { width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--white); color: var(--dark); font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 8px; }
.city-filter__reset:hover { border-color: var(--primary); color: var(--primary); }

.city-results__head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.city-results__count { font-size: 15px; color: var(--muted); font-weight: 600; }
.city-results__count b { color: var(--dark); font-weight: 850; }
.city-results__sort { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.city-results__sort select { padding: 9px 14px; border: 1px solid var(--line); border-radius: 10px; font: inherit; font-size: 13px; background: var(--white); cursor: pointer; font-weight: 700; color: var(--dark); }
.city-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
@media (max-width: 1100px) { .city-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }

.city-empty { padding: 56px 36px; text-align: center; border-radius: var(--radius-md); background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%); border: 1px solid rgba(var(--primary-rgb), 0.16); display: grid; gap: 18px; justify-items: center; }
.city-empty__icon { width: 96px; height: 96px; border-radius: 50%; background: #fff; box-shadow: 0 12px 30px -12px rgba(var(--dark-rgb), 0.18); display: grid; place-items: center; color: var(--primary); }
.city-empty__icon svg { width: 44px; height: 44px; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.city-empty h3 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.025em; color: var(--dark); }
.city-empty p { margin: 0; max-width: 540px; color: var(--muted); font-size: 15px; line-height: 1.55; }
.city-empty__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 4px; }
.city-empty__btn { padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 800; text-decoration: none; cursor: pointer; border: 0; }
.city-empty__btn--primary { background: var(--primary); color: #fff; }
.city-empty__btn--ghost { background: #fff; color: var(--dark); border: 1.5px solid var(--line); }

.city-districts { margin-top: 28px; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 900px) { .city-districts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.city-district { display: flex; justify-content: space-between; align-items: center; padding: 16px 18px; border: 1px solid var(--line); border-radius: 14px; background: var(--white); text-decoration: none; color: var(--dark); transition: all 0.16s ease; }
.city-district:hover { border-color: var(--primary); transform: translateY(-2px); }
.city-district b { font-size: 15px; font-weight: 850; letter-spacing: -0.01em; }
.city-district span { color: var(--muted); font-size: 13px; font-weight: 700; }

.city-extra { max-width: var(--layout-max); margin: 0 auto; padding: 0 var(--layout-gutter) clamp(40px, 6vw, 60px); display: grid; gap: 48px; }
.city-block { display: grid; gap: 18px; }
.city-block h2 { margin: 0; font-size: clamp(24px, 3vw, 32px); letter-spacing: -0.03em; font-weight: 900; color: var(--dark); }

.city-article { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 40px; align-items: start; }
.city-article__body { display: grid; gap: 22px; }
.city-article__body h3 { margin: 0 0 6px; font-size: 20px; letter-spacing: -0.02em; font-weight: 850; }
.city-article__body p { margin: 0; color: #4a4a4f; font-size: 15px; line-height: 1.65; }
.city-article__aside { background: var(--light-bg); border-radius: var(--radius-md); padding: 26px; display: grid; gap: 18px; }
.city-article__aside h4 { margin: 0 0 8px; font-size: 16px; font-weight: 850; letter-spacing: -0.02em; }
.city-related { display: flex; flex-wrap: wrap; gap: 8px; }
.city-related a { padding: 9px 14px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--dark); text-decoration: none; transition: all 0.16s ease; }
.city-related a:hover { border-color: var(--primary); color: var(--primary); }

.city-faq { display: grid; gap: 8px; max-width: 820px; }
.city-faq details { background: var(--white); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.city-faq summary { padding: 18px 22px; font-weight: 800; cursor: pointer; font-size: 15px; letter-spacing: -0.01em; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.city-faq summary::after { content: "+"; font-size: 22px; color: var(--primary); font-weight: 700; }
.city-faq details[open] summary::after { content: "−"; }
.city-faq details > div { padding: 0 22px 20px; color: var(--muted); font-size: 14px; line-height: 1.6; }

.city-cta { background: linear-gradient(135deg, var(--primary) 0%, #e63946 60%, #ad2030 100%); border-radius: 28px; padding: 44px 48px; color: #fff; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; }
.city-cta h2 { margin: 0 0 6px; font-size: clamp(22px, 2.6vw, 30px); font-weight: 900; letter-spacing: -0.025em; }
.city-cta p { margin: 0; color: rgba(255,255,255,0.85); font-size: 15px; max-width: 56ch; }
.city-cta a { padding: 14px 24px; border-radius: 14px; background: #fff; color: var(--primary-dark); font-weight: 850; text-decoration: none; white-space: nowrap; }

@media (max-width: 960px) {
  .city-hero__grid { grid-template-columns: 1fr; }
  .city-hero__map { max-width: 420px; }
  .city-body { grid-template-columns: 1fr; padding-block: clamp(20px, 4vw, 28px) clamp(32px, 5vw, 40px); }
  .city-filters { position: static; max-height: none; }
  .city-article { grid-template-columns: 1fr; }
  .city-cta { grid-template-columns: 1fr; padding: 32px 26px; }
  .city-extra { padding-inline: var(--layout-gutter); gap: 36px; }
}
@media (max-width: 620px) {
  .city-grid { grid-template-columns: 1fr; }
}
`;

function CityPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const city = CITIES[slug] ?? fallbackCity(slug);
  const allTrainers = useMemo(() => generateTrainers(city), [city]);

  const [district, setDistrict] = useState<string | null>(null);
  const [sportSlug, setSportSlug] = useState<string | null>(null);
  const [audience, setAudience] = useState<"all" | "adult" | "kid" | "teen">("all");
  const [format, setFormat] = useState<"all" | "individual" | "group">("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState("popular");

  const filtered = useMemo(() => {
    let list = allTrainers.filter((t) => {
      if (district && t.district !== district) return false;
      if (sportSlug && t.sportSlug !== sportSlug) return false;
      if (audience !== "all" && t.audience !== audience) return false;
      if (format !== "all" && t.format !== format) return false;
      if (priceMin && t.price < Number(priceMin)) return false;
      if (priceMax && t.price > Number(priceMax)) return false;
      if (minRating && Number(t.rating) < minRating) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "rating") list = [...list].sort((a, b) => Number(b.rating) - Number(a.rating));
    else if (sort === "reviews") list = [...list].sort((a, b) => b.reviews - a.reviews);
    return list;
  }, [allTrainers, district, sportSlug, audience, format, priceMin, priceMax, minRating, sort]);

  const reset = () => {
    setDistrict(null); setSportSlug(null); setAudience("all"); setFormat("all"); setPriceMin(""); setPriceMax(""); setMinRating(0);
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
              <span>/</span>
              <Link to="/city/$slug" params={{ slug: "minsk" }}>Города</Link>
              <span>/</span>
              <span>{city.title}</span>
            </nav>
            <div className="city-hero__grid">
              <div>
                <span className="city-hero__eyebrow">{city.eyebrow}</span>
                <h1 className="city-hero__title">Тренеры в {city.titleLoc}</h1>
                <p className="city-hero__lead">{city.lead}</p>
                <div className="city-hero__stats">
                  <span className="city-hero__stat"><b>{city.stats.trainers}</b> тренеров</span>
                  <span className="city-hero__stat"><b>{city.stats.clubs}</b> клубов</span>
                  <span className="city-hero__stat"><b>{city.stats.sports}</b> видов спорта</span>
                  <span className="city-hero__stat"><b>{city.stats.avgPrice}</b> BYN средн.</span>
                </div>
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

        <div className="city-body">
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
              <div className="city-filter__title">Рейтинг</div>
              <div className="city-filter__opts">
                {[0, 4, 4.5, 4.8].map((r) => (
                  <button key={r} className={`city-pill${minRating === r ? " is-active" : ""}`} onClick={() => setMinRating(r)}>{r === 0 ? "Любой" : `${r}+`}</button>
                ))}
              </div>
            </div>
            <button className="city-filter__reset" onClick={reset}>Сбросить</button>
          </aside>

          <div>
            <div className="city-results__head">
              <div className="city-results__count">
                <b>{filtered.length}</b> тренеров{district ? ` · ${district}` : ""}{sportSlug ? ` · ${POPULAR_SPORTS.find(s => s.slug === sportSlug)?.label}` : ""}
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
                <h3>{city.isEmpty ? `Тренеров в ${city.titleLoc} пока нет` : "По вашим фильтрам ничего не нашлось"}</h3>
                <p>
                  {city.isEmpty
                    ? `Город ${city.title} только открылся на trenio.by. Будьте первым тренером или подпишитесь — напишем, когда кто-то появится.`
                    : "Попробуйте сбросить часть фильтров или расширить район поиска."}
                </p>
                <div className="city-empty__actions">
                  {city.isEmpty ? (
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
                  <Link key={t.slug} className="trainer-card" to="/trainers/$slug" params={{ slug: "farkhad-akhmedjanov" }}>
                    <div className="trainer-card__media">
                      <img className="trainer-card__photo" src={placeholder(t.name)} alt={t.name} width={480} height={600} loading="lazy" />
                      {t.badge && <span className="trainer-card__badge">{t.badge}</span>}
                      <button className="trainer-card__save" type="button" aria-label="Сохранить" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z" /></svg>
                      </button>
                    </div>
                    <div className="trainer-card__body">
                      <div className="trainer-card__head">
                        <h3 className="trainer-card__name">{t.name}</h3>
                        <span className="trainer-card__rating">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
                          {t.rating} <span>({t.reviews})</span>
                        </span>
                      </div>
                      <p className="trainer-card__sport">{t.sport} · опыт {t.experience} {t.experience === 1 ? "год" : t.experience < 5 ? "года" : "лет"}</p>
                      <p className="trainer-card__desc">{t.desc}</p>
                      <div className="trainer-card__tags">
                        {t.tags.map((tag, i) => (
                          <span key={tag} className={`trainer-card__tag${i === 0 ? " trainer-card__tag--accent" : ""}`}>{tag}</span>
                        ))}
                      </div>
                      <div className="trainer-card__footer">
                        <span className="trainer-card__location">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                          <span>{city.title}, {t.district}{t.metro ? ` · м. ${t.metro}` : ""}</span>
                        </span>
                        <span className="trainer-card__price"><small>от </small>{t.price} BYN</span>
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
                      <span>{4 + ((i * 7) % 30)} тренеров</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="city-extra">
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
