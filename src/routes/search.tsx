import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

type SearchParams = {
  sport: string;
  location: string;
  audience: "adult" | "child";
  format: "individual" | "group";
};

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    sport: typeof s.sport === "string" ? s.sport : "",
    location: typeof s.location === "string" ? s.location : "",
    audience: s.audience === "child" ? "child" : "adult",
    format: s.format === "group" ? "group" : "individual",
  }),
  head: ({ loaderData: _l, params: _p, match }) => {
    const search = (match as { search?: SearchParams }).search ?? { sport: "", location: "" };
    const q = [search.sport, search.location].filter(Boolean).join(" · ") || "Поиск тренера";
    const title = `${q} — trenio.by`;
    return {
      meta: [
        { title },
        { name: "description", content: `Результаты поиска тренеров: ${q}.` },
        { name: "robots", content: "noindex,follow" },
      ],
    };
  },
  component: SearchPage,
});

type Result = {
  slug: string; name: string; sport: string; sportSlug: string; city: string;
  district: string; format: "individual" | "group"; audience: "adult" | "child";
  rating: number; reviews: number; price: number; desc: string; tags: string[]; badge?: string;
};

const RESULTS: Result[] = [
  { slug: "farkhad-akhmedjanov", name: "Фархад Ахмеджанов", sport: "Кикбоксинг", sportSlug: "kikboksing", city: "Минск", district: "Центр", format: "group", audience: "adult", rating: 4.9, reviews: 38, price: 45, desc: "Группы для новичков и опытных — техника, связки и темп.", tags: ["Группа", "Взрослые"], badge: "Топ" },
  { slug: "dmitriy-hotin", name: "Дмитрий Хотин", sport: "Тайский бокс", sportSlug: "tajskij-boks", city: "Минск", district: "Уручье", format: "group", audience: "child", rating: 5.0, reviews: 24, price: 50, desc: "Детские группы 7–12 лет — техника и безопасность.", tags: ["Группа", "Дети"] },
  { slug: "sergey-ovsyannikov", name: "Сергей Овсяников", sport: "Тайский бокс", sportSlug: "tajskij-boks", city: "Минск", district: "Малиновка", format: "individual", audience: "adult", rating: 4.8, reviews: 19, price: 42, desc: "Индивидуальные тренировки — лапы, мешки, спарринг.", tags: ["Индивидуально", "Взрослые"] },
  { slug: "artem-romanovich", name: "Артем Романович", sport: "Бокс", sportSlug: "boks", city: "Минск", district: "Серебрянка", format: "group", audience: "adult", rating: 4.9, reviews: 12, price: 38, desc: "Бокс для начинающих — стойка, база, работа в группе.", tags: ["Группа", "Взрослые"], badge: "Новый" },
  { slug: "vladimir-antipenko", name: "Владимир Антипенко", sport: "Кикбоксинг", sportSlug: "kikboksing", city: "Минск", district: "Каменная Горка", format: "group", audience: "child", rating: 4.7, reviews: 31, price: 35, desc: "Дети и подростки — техника, координация, нагрузка по возрасту.", tags: ["Группа", "Дети"] },
  { slug: "anna-kovaleva", name: "Анна Ковалёва", sport: "Йога", sportSlug: "yoga", city: "Минск", district: "Центр", format: "individual", audience: "adult", rating: 4.9, reviews: 47, price: 40, desc: "Хатха и виньяса — индивидуально, фокус на дыхании и осанке.", tags: ["Индивидуально", "Взрослые"] },
  { slug: "olga-sidorova", name: "Ольга Сидорова", sport: "Пилатес", sportSlug: "pilates", city: "Гомель", district: "Центр", format: "group", audience: "adult", rating: 4.8, reviews: 22, price: 30, desc: "Группы пилатеса для здоровья спины — мягко и эффективно.", tags: ["Группа", "Взрослые"] },
  { slug: "igor-zaytsev", name: "Игорь Зайцев", sport: "Фитнес", sportSlug: "fitnes", city: "Минск", district: "Восток", format: "individual", audience: "adult", rating: 4.7, reviews: 28, price: 50, desc: "Силовая база, гипертрофия и грамотные программы под цель.", tags: ["Индивидуально", "Взрослые"] },
];

const CITIES = [
  { v: "", l: "Любой" },
  { v: "Минск", l: "Минск" },
  { v: "Гомель", l: "Гомель" },
  { v: "Брест", l: "Брест" },
  { v: "Гродно", l: "Гродно" },
  { v: "Витебск", l: "Витебск" },
  { v: "Могилёв", l: "Могилёв" },
];

const POPULAR_SPORTS = ["Бокс", "Йога", "Фитнес", "Плавание", "Теннис", "Кикбоксинг"];

const CSS = `
.sr-page { min-height: 100vh; background: var(--bg); }
.sr-hero { background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06), transparent); padding: var(--layout-section-y) var(--layout-gutter) 28px; border-bottom: 1px solid rgba(var(--dark-rgb), 0.06); }
.sr-hero__inner { max-width: var(--layout-max); margin: 0 auto; }
.sr-crumbs { font-size: 13px; color: var(--muted); margin-bottom: 14px; font-weight: 650; }
.sr-crumbs a { color: var(--muted); text-decoration: none; }
.sr-crumbs a:hover { color: var(--primary); }
.sr-title { margin: 0 0 6px; font-size: clamp(28px, 3.4vw, 40px); font-weight: 900; letter-spacing: -0.035em; color: var(--dark); }
.sr-title em { font-style: normal; color: var(--primary); }
.sr-sub { margin: 0 0 22px; color: var(--muted); font-size: 15px; font-weight: 600; }
.sr-form { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr) auto auto auto; gap: 8px; padding: 10px; background: #fff; border-radius: 18px; box-shadow: 0 12px 40px -18px rgba(var(--dark-rgb), 0.18); border: 1px solid rgba(var(--dark-rgb), 0.05); align-items: center; }
.sr-form input, .sr-form select { border: 0; background: transparent; padding: 10px 14px; font: inherit; font-size: 15px; font-weight: 600; color: var(--dark); min-width: 0; }
.sr-form input { border-right: 1px solid rgba(var(--dark-rgb), 0.08); }
.sr-form select { background: rgba(var(--primary-rgb), 0.06); border-radius: 10px; font-weight: 700; cursor: pointer; }
.sr-form button { padding: 12px 22px; background: var(--primary); color: #fff; border: 0; border-radius: 12px; font: inherit; font-weight: 800; cursor: pointer; font-size: 14px; }
.sr-form button:hover { background: var(--primary-dark); }

.sr-body { max-width: var(--layout-max); margin: 0 auto; padding: var(--layout-section-y) var(--layout-gutter) clamp(40px, 6vw, 60px); display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; }
.sr-count b { color: var(--dark); }
.sr-sort { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); font-weight: 650; }
.sr-sort select { padding: 9px 14px; border: 1px solid var(--line); border-radius: 10px; font: inherit; font-size: 13px; background: #fff; font-weight: 700; color: var(--dark); cursor: pointer; }

.sr-grid { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; margin-top: 4px; }
.sr-card {
  background: #fff; border-radius: 18px; padding: 18px; border: 1px solid rgba(var(--dark-rgb), 0.05);
  display: grid; gap: 10px; text-decoration: none; color: inherit; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.sr-card:hover { transform: translateY(-3px); border-color: rgba(var(--primary-rgb), 0.3); box-shadow: 0 14px 36px -18px rgba(var(--dark-rgb), 0.18); }
.sr-card__head { display: flex; gap: 12px; align-items: flex-start; }
.sr-card__avatar { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.18), rgba(var(--primary-rgb), 0.06)); display: grid; place-items: center; font-size: 18px; font-weight: 900; color: var(--primary); flex: 0 0 auto; }
.sr-card__title { flex: 1; min-width: 0; }
.sr-card__name { margin: 0 0 2px; font-size: 17px; font-weight: 900; letter-spacing: -0.02em; color: var(--dark); }
.sr-card__sport { margin: 0; font-size: 13px; color: var(--muted); font-weight: 700; }
.sr-card__rating { font-size: 14px; font-weight: 800; color: var(--dark); display: inline-flex; gap: 4px; align-items: center; }
.sr-card__rating .star { color: #f5a524; }
.sr-card__rating small { color: var(--muted); font-weight: 600; font-size: 12px; }
.sr-card__desc { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--text); }
.sr-card__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.sr-card__tags span { font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.08); color: var(--primary); }
.sr-card__foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(var(--dark-rgb), 0.06); padding-top: 10px; margin-top: 2px; font-size: 13px; color: var(--muted); font-weight: 650; }
.sr-card__price strong { color: var(--dark); font-size: 16px; font-weight: 900; margin-left: 2px; }
.sr-card__badge { font-size: 11px; font-weight: 800; padding: 3px 8px; border-radius: 6px; background: var(--primary); color: #fff; margin-left: 8px; vertical-align: middle; }

.sr-empty {
  grid-column: 1 / -1;
  background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06), transparent);
  border: 1px solid rgba(var(--primary-rgb), 0.16); border-radius: 22px; padding: 56px 32px; text-align: center;
  display: grid; gap: 16px; justify-items: center; margin-top: 8px;
}
.sr-empty__icon { width: 88px; height: 88px; border-radius: 50%; background: #fff; display: grid; place-items: center; color: var(--primary); box-shadow: 0 12px 30px -12px rgba(var(--dark-rgb), 0.18); }
.sr-empty__icon svg { width: 40px; height: 40px; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.sr-empty h2 { margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.03em; color: var(--dark); }
.sr-empty p { margin: 0; max-width: 520px; color: var(--muted); font-size: 15px; line-height: 1.55; }
.sr-empty__chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-top: 6px; }
.sr-empty__chip { padding: 8px 14px; border-radius: 999px; background: #fff; border: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--dark); text-decoration: none; }
.sr-empty__chip:hover { border-color: var(--primary); color: var(--primary); }
.sr-empty__cta { display: inline-flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-top: 12px; }
.sr-empty__btn { padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 800; text-decoration: none; border: 0; cursor: pointer; }
.sr-empty__btn--primary { background: var(--primary); color: #fff; }
.sr-empty__btn--ghost { background: #fff; color: var(--dark); border: 1.5px solid var(--line); }

@media (max-width: 960px) {
  .sr-form { grid-template-columns: 1fr; }
  .sr-form input { border-right: 0; border-bottom: 1px solid rgba(var(--dark-rgb), 0.08); }
}
`;

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("");
}

function SearchPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  const [sport, setSport] = useState(search.sport);
  const [location, setLocation] = useState(search.location);
  const [city, setCity] = useState(search.location.replace(/^в\s+/i, "").replace(/е$/i, "") || "");
  const [sort, setSort] = useState("rating");

  const filtered = useMemo(() => {
    const q = (search.sport || "").trim().toLowerCase();
    const loc = (search.location || "").toLowerCase();
    let list = RESULTS.filter((r) => {
      if (q && !r.sport.toLowerCase().includes(q) && !r.sportSlug.includes(q)) return false;
      if (loc && !loc.includes(r.city.toLowerCase())) return false;
      if (search.format && r.format !== search.format) return false;
      if (search.audience && r.audience !== search.audience) return false;
      return true;
    });
    if (sort === "rating") list = [...list].sort((a, b) => b.rating - a.rating);
    if (sort === "reviews") list = [...list].sort((a, b) => b.reviews - a.reviews);
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    return list;
  }, [search, sort]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({
      to: "/search",
      search: {
        sport,
        location: city || location,
        audience: search.audience,
        format: search.format,
      },
    });
  };

  const queryLabel = [search.sport, search.location].filter(Boolean).join(" · ");

  return (
    <div className="sr-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SiteHeader />

      <section className="sr-hero">
        <div className="sr-hero__inner">
          <div className="sr-crumbs"><Link to="/">Главная</Link> · Поиск</div>
          <h1 className="sr-title">
            {queryLabel ? <>Результаты по запросу <em>«{queryLabel}»</em></> : "Поиск тренера"}
          </h1>
          <p className="sr-sub">
            {search.audience === "child" ? "для ребёнка" : "для себя"} · {search.format === "group" ? "в группе" : "индивидуально"}
          </p>
          <form className="sr-form" onSubmit={submit}>
            <input type="search" placeholder="Вид спорта (бокс, йога…)" value={sport} onChange={(e) => setSport(e.target.value)} />
            <input type="search" placeholder="Город или район" value={location} onChange={(e) => setLocation(e.target.value)} />
            <select value={city} onChange={(e) => setCity(e.target.value)} aria-label="Город">
              {CITIES.map((c) => <option key={c.v} value={c.v}>{c.l || "Любой город"}</option>)}
            </select>
            <select
              value={search.format}
              onChange={(e) => navigate({ to: "/search", search: { ...search, format: e.target.value as "individual" | "group" } })}
              aria-label="Формат"
            >
              <option value="individual">Индивидуально</option>
              <option value="group">В группе</option>
            </select>
            <button type="submit">Найти</button>
          </form>
        </div>
      </section>

      <section className="sr-body">
        <div className="sr-count">Найдено: <b>{filtered.length}</b></div>
        <label className="sr-sort">
          Сортировка:
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="rating">По рейтингу</option>
            <option value="reviews">По отзывам</option>
            <option value="price-asc">Сначала дешевле</option>
            <option value="price-desc">Сначала дороже</option>
          </select>
        </label>

        {filtered.length === 0 ? (
          <div className="sr-empty">
            <div className="sr-empty__icon">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /><path d="M8 11h6" /></svg>
            </div>
            <h2>Ничего не нашлось</h2>
            <p>
              {queryLabel
                ? <>По запросу <b>«{queryLabel}»</b> сейчас нет подходящих тренеров. Попробуйте изменить вид спорта или город — или подпишитесь, и мы сообщим, когда появится подходящий тренер.</>
                : "Уточните вид спорта или город — и мы покажем подходящих тренеров."}
            </p>
            <div className="sr-empty__chips">
              {POPULAR_SPORTS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="sr-empty__chip"
                  onClick={() => navigate({ to: "/search", search: { ...search, sport: s } })}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="sr-empty__cta">
              <button
                type="button"
                className="sr-empty__btn sr-empty__btn--primary"
                onClick={() => navigate({ to: "/search", search: { sport: "", location: "", audience: "adult", format: "individual" } })}
              >
                Сбросить фильтры
              </button>
              <Link to="/" className="sr-empty__btn sr-empty__btn--ghost">На главную</Link>
            </div>
          </div>
        ) : (
          <div className="sr-grid">
            {filtered.map((r) => (
              <Link key={r.slug} to="/trainers/$slug" params={{ slug: r.slug }} className="sr-card">
                <div className="sr-card__head">
                  <div className="sr-card__avatar">{initials(r.name)}</div>
                  <div className="sr-card__title">
                    <h3 className="sr-card__name">
                      {r.name}
                      {r.badge && <span className="sr-card__badge">{r.badge}</span>}
                    </h3>
                    <p className="sr-card__sport">{r.sport} · {r.city}, {r.district}</p>
                  </div>
                  <div className="sr-card__rating"><span className="star">★</span>{r.rating.toFixed(1)} <small>({r.reviews})</small></div>
                </div>
                <p className="sr-card__desc">{r.desc}</p>
                <div className="sr-card__tags">{r.tags.map((t) => <span key={t}>{t}</span>)}</div>
                <div className="sr-card__foot">
                  <span>{r.format === "group" ? "Групповой формат" : "Индивидуально"} · {r.audience === "child" ? "Дети" : "Взрослые"}</span>
                  <span className="sr-card__price">от <strong>{r.price} BYN</strong></span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <SiteFooter />
    </div>
  );
}
