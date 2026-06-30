import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/clubs/")({
  head: () => ({
    meta: [
      { title: "Спортивные клубы и залы Беларуси — trenio.by" },
      { name: "description", content: "Каталог спортивных клубов, залов и студий Беларуси: бокс, единоборства, фитнес, йога. Адреса, цены, расписание и тренеры." },
      { property: "og:title", content: "Клубы и залы Беларуси — trenio.by" },
      { property: "og:description", content: "Каталог спортивных клубов и студий: адреса, цены, тренеры и направления." },
    ],
  }),
  component: ClubsListPage,
});

type ClubItem = {
  slug: string;
  name: string;
  city: string;
  area: string;
  directions: string[];
  rating: number;
  reviews: number;
  priceFrom: number;
  badge?: string;
  cover: string;
  logo: string;
  amenities: string[];
};

const CLUBS_LIST: ClubItem[] = [
  { slug: "bronxgym", name: "BronxGym", city: "Минск", area: "пр-т Пушкина", directions: ["Кикбоксинг", "Бокс", "Тайский бокс"], rating: 4.8, reviews: 52, priceFrom: 45, badge: "Топ месяца", cover: "https://placehold.co/640x420/png?text=BronxGym", logo: "BG", amenities: ["Ринг", "Душевые", "Парковка"] },
  { slug: "iron-yard", name: "Iron Yard", city: "Минск", area: "Немига", directions: ["Кроссфит", "Силовая", "ОФП"], rating: 4.9, reviews: 71, priceFrom: 35, badge: "Новый", cover: "https://placehold.co/640x420/png?text=Iron+Yard", logo: "IY", amenities: ["Штанги", "Душевые"] },
  { slug: "lotus-studio", name: "Lotus Studio", city: "Минск", area: "Каменная Горка", directions: ["Йога", "Пилатес", "Стретчинг"], rating: 4.7, reviews: 38, priceFrom: 25, cover: "https://placehold.co/640x420/png?text=Lotus+Studio", logo: "LS", amenities: ["Душевые", "Чай"] },
  { slug: "akva-arena", name: "Аква Арена", city: "Гомель", area: "ул. Советская", directions: ["Плавание", "Аквааэробика"], rating: 4.6, reviews: 24, priceFrom: 30, cover: "https://placehold.co/640x420/png?text=Aqua+Arena", logo: "AA", amenities: ["Бассейн 25 м", "Сауна"] },
  { slug: "grand-court", name: "Grand Court", city: "Брест", area: "ул. Ленина", directions: ["Теннис", "Сквош"], rating: 4.5, reviews: 18, priceFrom: 50, cover: "https://placehold.co/640x420/png?text=Grand+Court", logo: "GC", amenities: ["4 корта", "Прокат"] },
  { slug: "energy-club", name: "Energy Club", city: "Гродно", area: "ул. Горького", directions: ["Фитнес", "Силовая", "Групповые"], rating: 4.4, reviews: 29, priceFrom: 28, cover: "https://placehold.co/640x420/png?text=Energy+Club", logo: "EC", amenities: ["Зал 600 м²", "Душевые", "Парковка"] },
  { slug: "spartak-arena", name: "Спартак Арена", city: "Витебск", area: "пр-т Фрунзе", directions: ["Бокс", "Борьба", "ОФП"], rating: 4.6, reviews: 34, priceFrom: 32, cover: "https://placehold.co/640x420/png?text=Spartak+Arena", logo: "SA", amenities: ["Ринг", "Татами", "Душевые"] },
  { slug: "moonrise-yoga", name: "Moonrise Yoga", city: "Минск", area: "Зыбицкая", directions: ["Йога", "Медитация"], rating: 5.0, reviews: 41, priceFrom: 30, badge: "Премиум", cover: "https://placehold.co/640x420/png?text=Moonrise+Yoga", logo: "MR", amenities: ["Чайная", "Душевые"] },
  { slug: "city-runners", name: "City Runners", city: "Могилёв", area: "пл. Ленина", directions: ["Бег", "ОФП"], rating: 4.3, reviews: 12, priceFrom: 18, cover: "https://placehold.co/640x420/png?text=City+Runners", logo: "CR", amenities: ["Раздевалка"] },
];

const CITIES = ["Все города", "Минск", "Гомель", "Брест", "Гродно", "Витебск", "Могилёв"];
const DIRECTIONS = ["Все направления", "Бокс", "Единоборства", "Фитнес", "Йога", "Плавание", "Теннис", "Бег"];

const CSS = `
.clubs-page { min-height: 100vh; background: var(--bg); }
.clubs-hero { padding: 56px 36px 36px; max-width: 1360px; margin: 0 auto; }
.clubs-hero__crumbs { font-size: 13px; color: var(--muted); font-weight: 650; margin-bottom: 14px; }
.clubs-hero__crumbs a { color: var(--muted); text-decoration: none; }
.clubs-hero__crumbs a:hover { color: var(--primary); }
.clubs-hero h1 { margin: 0 0 14px; font-size: clamp(34px, 4.4vw, 56px); line-height: 1.04; letter-spacing: -0.045em; font-weight: 900; color: var(--dark); max-width: 880px; }
.clubs-hero p { margin: 0 0 26px; font-size: 17px; line-height: 1.55; color: var(--text); max-width: 720px; }
.clubs-hero__stats { display: flex; flex-wrap: wrap; gap: 28px 36px; padding: 22px 26px; background: #fff; border-radius: 20px; box-shadow: 0 6px 26px rgba(var(--dark-rgb), 0.06); border: 1px solid rgba(var(--dark-rgb), 0.04); }
.clubs-hero__stat strong { display: block; font-size: 28px; font-weight: 900; letter-spacing: -0.03em; color: var(--dark); }
.clubs-hero__stat span { font-size: 13px; color: var(--muted); font-weight: 650; }

.clubs-toolbar { position: sticky; top: 72px; z-index: 80; background: rgba(255,245,245,0.85); backdrop-filter: blur(10px); border-bottom: 1px solid rgba(var(--dark-rgb), 0.06); padding: 14px 36px; }
.clubs-toolbar__inner { max-width: 1360px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; }
.chip-select { position: relative; display: inline-flex; align-items: center; gap: 8px; padding: 9px 14px; border-radius: 999px; border: 1.5px solid rgba(var(--dark-rgb), 0.12); background: #fff; font-size: 14px; font-weight: 700; color: var(--dark); cursor: pointer; }
.chip-select select { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.chip-select svg { width: 14px; height: 14px; stroke: var(--muted); fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
.toolbar-spacer { flex: 1; }
.toolbar-count { font-size: 14px; color: var(--muted); font-weight: 650; }

.clubs-grid-wrap { max-width: 1360px; margin: 0 auto; padding: 32px 36px 64px; }
.clubs-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 22px; }
.club-card {
  background: #fff; border-radius: 22px; overflow: hidden; text-decoration: none; color: inherit;
  border: 1px solid rgba(var(--dark-rgb), 0.05); box-shadow: 0 6px 24px rgba(var(--dark-rgb), 0.04);
  display: flex; flex-direction: column; transition: transform 0.25s ease, box-shadow 0.25s ease;
}
.club-card:hover { transform: translateY(-4px); box-shadow: 0 18px 40px rgba(var(--dark-rgb), 0.10); }
.club-card__cover { aspect-ratio: 16/10; position: relative; background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.12), rgba(var(--primary-rgb), 0.04)); display: grid; place-items: center; }
.club-card__cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.club-card__badge { position: absolute; top: 14px; left: 14px; padding: 6px 12px; border-radius: 999px; background: #fff; font-size: 12px; font-weight: 800; color: var(--primary); box-shadow: 0 4px 12px rgba(var(--dark-rgb), 0.08); }
.club-card__logo { position: absolute; bottom: -22px; left: 18px; width: 56px; height: 56px; border-radius: 16px; background: var(--dark); color: #fff; display: grid; place-items: center; font-size: 18px; font-weight: 900; letter-spacing: -0.02em; border: 3px solid #fff; box-shadow: 0 6px 18px rgba(var(--dark-rgb), 0.18); }
.club-card__body { padding: 30px 20px 20px; display: flex; flex-direction: column; gap: 12px; flex: 1; }
.club-card__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.club-card__name { margin: 0; font-size: 19px; font-weight: 900; letter-spacing: -0.025em; color: var(--dark); }
.club-card__rating { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; font-weight: 800; color: var(--dark); }
.club-card__rating .star { color: #f5a524; }
.club-card__rating span { color: var(--muted); font-weight: 600; font-size: 13px; }
.club-card__loc { font-size: 14px; color: var(--muted); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.club-card__loc svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2; }
.club-card__dirs { display: flex; flex-wrap: wrap; gap: 6px; }
.club-card__dirs span { font-size: 12px; font-weight: 700; padding: 5px 10px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.08); color: var(--primary); }
.club-card__foot { margin-top: auto; padding-top: 14px; border-top: 1px solid rgba(var(--dark-rgb), 0.06); display: flex; justify-content: space-between; align-items: center; }
.club-card__price { font-size: 13px; color: var(--muted); font-weight: 650; }
.club-card__price strong { color: var(--dark); font-size: 16px; font-weight: 900; margin-left: 2px; }
.club-card__cta { font-size: 13px; font-weight: 800; color: var(--primary); display: inline-flex; align-items: center; gap: 4px; }

.clubs-empty { text-align: center; padding: 60px 20px; color: var(--muted); font-size: 16px; }

.clubs-cta {
  max-width: 1360px; margin: 0 auto 64px; padding: 0 36px;
}
.clubs-cta__inner {
  background: linear-gradient(135deg, var(--dark) 0%, #1f1f2e 100%); color: #fff;
  border-radius: 28px; padding: 44px 48px; display: flex; align-items: center; justify-content: space-between; gap: 24px; flex-wrap: wrap;
}
.clubs-cta__inner h3 { margin: 0 0 8px; font-size: 28px; font-weight: 900; letter-spacing: -0.03em; }
.clubs-cta__inner p { margin: 0; color: rgba(255,255,255,0.7); font-size: 15px; max-width: 480px; }
.clubs-cta__btn { background: var(--primary); color: #fff; padding: 14px 26px; border-radius: 14px; font-size: 15px; font-weight: 800; text-decoration: none; }

@media (max-width: 720px) {
  .clubs-hero, .clubs-toolbar, .clubs-grid-wrap, .clubs-cta { padding-left: 18px; padding-right: 18px; }
  .clubs-cta__inner { padding: 32px 24px; }
}
`;

function ClubsListPage() {
  const [city, setCity] = useState("Все города");
  const [direction, setDirection] = useState("Все направления");
  const [sort, setSort] = useState("rating");

  const list = useMemo(() => {
    let arr = [...CLUBS_LIST];
    if (city !== "Все города") arr = arr.filter((c) => c.city === city);
    if (direction !== "Все направления") arr = arr.filter((c) => c.directions.some((d) => d.toLowerCase().includes(direction.toLowerCase())));
    if (sort === "rating") arr.sort((a, b) => b.rating - a.rating);
    if (sort === "reviews") arr.sort((a, b) => b.reviews - a.reviews);
    if (sort === "price") arr.sort((a, b) => a.priceFrom - b.priceFrom);
    return arr;
  }, [city, direction, sort]);

  return (
    <div className="clubs-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SiteHeader />

      <section className="clubs-hero">
        <div className="clubs-hero__crumbs">
          <Link to="/">Главная</Link> · Клубы
        </div>
        <h1>Спортивные клубы и залы Беларуси</h1>
        <p>Каталог проверенных клубов, студий и залов. Адреса, цены, направления и тренеры — в одном месте.</p>
        <div className="clubs-hero__stats">
          <div className="clubs-hero__stat"><strong>{CLUBS_LIST.length * 18}+</strong><span>клубов и студий</span></div>
          <div className="clubs-hero__stat"><strong>7</strong><span>городов</span></div>
          <div className="clubs-hero__stat"><strong>30+</strong><span>направлений</span></div>
          <div className="clubs-hero__stat"><strong>4.7</strong><span>средний рейтинг</span></div>
        </div>
      </section>

      <div className="clubs-toolbar">
        <div className="clubs-toolbar__inner">
          <label className="chip-select">
            {city}
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Город">
              {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="chip-select">
            {direction}
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            <select value={direction} onChange={(e) => setDirection(e.target.value)} aria-label="Направление">
              {DIRECTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="chip-select">
            {sort === "rating" ? "По рейтингу" : sort === "reviews" ? "По отзывам" : "По цене"}
            <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"/></svg>
            <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Сортировка">
              <option value="rating">По рейтингу</option>
              <option value="reviews">По отзывам</option>
              <option value="price">По цене</option>
            </select>
          </label>
          <div className="toolbar-spacer" />
          <div className="toolbar-count">Найдено: <strong>{list.length}</strong></div>
        </div>
      </div>

      <section className="clubs-grid-wrap">
        {list.length === 0 ? (
          <div className="clubs-empty">По заданным фильтрам ничего не нашлось. Попробуйте другие настройки.</div>
        ) : (
          <div className="clubs-grid">
            {list.map((club) => (
              <Link key={club.slug} to="/clubs/$slug" params={{ slug: club.slug }} className="club-card">
                <div className="club-card__cover">
                  <img src={club.cover} alt={club.name} loading="lazy" />
                  {club.badge && <span className="club-card__badge">{club.badge}</span>}
                  <span className="club-card__logo">{club.logo}</span>
                </div>
                <div className="club-card__body">
                  <div className="club-card__head">
                    <h3 className="club-card__name">{club.name}</h3>
                    <div className="club-card__rating">
                      <span className="star">★</span>{club.rating.toFixed(1)}<span>({club.reviews})</span>
                    </div>
                  </div>
                  <div className="club-card__loc">
                    <svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {club.city} · {club.area}
                  </div>
                  <div className="club-card__dirs">
                    {club.directions.map((d) => <span key={d}>{d}</span>)}
                  </div>
                  <div className="club-card__foot">
                    <div className="club-card__price">от <strong>{club.priceFrom} BYN</strong></div>
                    <span className="club-card__cta">Подробнее →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="clubs-cta">
        <div className="clubs-cta__inner">
          <div>
            <h3>Ваш клуб ещё не на trenio.by?</h3>
            <p>Разместите страницу клуба бесплатно — добавьте направления, цены, тренеров и принимайте заявки от клиентов.</p>
          </div>
          <Link to="/auth/signup" className="clubs-cta__btn">Добавить клуб</Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
