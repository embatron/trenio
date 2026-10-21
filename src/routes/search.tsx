import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { CatalogSearchForm } from "@/components/catalog-search-form";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";
import { compareByPopularity, compareByRating, compareByReviews, ratingFor } from "@/lib/catalog/trainer-popularity";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { TrainerRating } from "@/components/trainer-rating";
import { pluralRu } from "@/lib/ru-plural";

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
  loader: () => listTrainerRatingSummariesFn(),
  component: SearchPage,
});

type Result = {
  slug: string; name: string; photo: string; sport: string; sportSlugs: string[]; city: string;
  district: string; formats: Array<"individual" | "group">; audiences: Array<"adult" | "teen" | "kid">;
  rating: number; reviews: number; price: number; desc: string; tags: string[]; badge?: string;
};

function buildResults(ratings: Record<string, { rating: string; reviews: number }>): Result[] {
  return PUBLISHED_TRAINERS.map((trainer) => {
    const rating = ratingFor(trainer.slug, ratings);
    return {
      slug: trainer.slug,
      name: trainer.name,
      photo: trainer.photo,
      sport: trainer.sports.map((sport) => sport.label).join(", "),
      sportSlugs: trainer.sports.flatMap((sport) => [sport.slug, sport.label.toLowerCase()]),
      city: trainer.city.label,
      district: trainer.district,
      formats: trainer.formats,
      audiences: trainer.audiences,
      rating: Number(rating.rating) || 0,
      reviews: rating.reviews,
      price: 0,
      desc: trainer.bio,
      tags: trainer.sports.map((sport) => sport.label),
    };
  });
}

const CSS = `
.sr-page { min-height: 100vh; background: var(--bg); }
.sr-hero { background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06), transparent); padding: var(--layout-section-y) 0 28px; border-bottom: 1px solid rgba(var(--dark-rgb), 0.06); }
.sr-hero__inner { max-width: var(--layout-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.sr-crumbs { font-size: 13px; color: var(--muted); margin-bottom: 14px; font-weight: var(--fw-title); }
.sr-crumbs a { color: var(--muted); text-decoration: none; }
.sr-crumbs a:hover { color: var(--primary); }
.sr-title { margin: 0 0 6px; font-size: var(--fs-page); font-weight: var(--fw-heading); letter-spacing: -0.035em; color: var(--dark); }
.sr-title em { font-style: normal; color: var(--primary); }
.sr-sub { margin: 0 0 22px; color: var(--muted); font-size: 15px; font-weight: var(--fw-ui); }
.sr-search { width: 100%; margin-top: 8px; }

.sr-body { max-width: var(--layout-max); margin: 0 auto; padding: var(--layout-section-y) var(--layout-gutter) clamp(40px, 6vw, 60px); display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 16px; }
.sr-count b { color: var(--dark); }
.sr-sort { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); font-weight: var(--fw-title); }
.sr-sort select { padding: 9px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); font: inherit; font-size: 13px; background: #fff; font-weight: var(--fw-heading); color: var(--dark); cursor: pointer; }

.sr-grid { grid-column: 1 / -1; margin-top: 4px; }
.sr-card {
  background: #fff; border-radius: var(--card-radius); padding: 18px; border: 1px solid rgba(var(--dark-rgb), 0.05);
  display: grid; gap: 10px; text-decoration: none; color: inherit; transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}
.sr-card:hover { transform: translateY(-3px); border-color: rgba(var(--primary-rgb), 0.3); box-shadow: 0 14px 36px -18px rgba(var(--dark-rgb), 0.18); }
.sr-card__head { display: flex; gap: 12px; align-items: flex-start; }
.sr-card__avatar { width: 52px; height: 52px; border-radius: var(--radius-tile); object-fit: cover; background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.18), rgba(var(--primary-rgb), 0.06)); display: block; flex: 0 0 auto; }
.sr-card__title { flex: 1; min-width: 0; }
.sr-card__name { margin: 0 0 2px; font-size: 17px; font-weight: var(--fw-heading); letter-spacing: -0.02em; color: var(--dark); }
.sr-card__sport { margin: 0; font-size: 13px; color: var(--muted); font-weight: var(--fw-heading); }
.sr-card__rating { font-size: 14px; font-weight: var(--fw-title); color: var(--dark); display: inline-flex; gap: 4px; align-items: center; }
.sr-card__rating .star { color: #f5a524; }
.sr-card__rating small { color: var(--muted); font-weight: var(--fw-ui); font-size: 12px; }
.sr-card__desc { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--text); }
.sr-card__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.sr-card__tags span { font-size: 12px; font-weight: var(--fw-heading); padding: 4px 10px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.08); color: var(--primary); }
.sr-card__foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(var(--dark-rgb), 0.06); padding-top: 10px; margin-top: 2px; font-size: 13px; color: var(--muted); font-weight: var(--fw-title); }
.sr-card__price strong { color: var(--dark); font-size: 16px; font-weight: var(--fw-heading); margin-left: 2px; }
.sr-card__badge { font-size: 11px; font-weight: var(--fw-title); padding: 3px 8px; border-radius: 999px; background: var(--primary); color: #fff; margin-left: 8px; vertical-align: middle; }

.sr-empty {
  grid-column: 1 / -1;
  background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06), transparent);
  border: 1px solid rgba(var(--primary-rgb), 0.16); border-radius: var(--card-radius); padding: 56px 32px; text-align: center;
  display: grid; gap: 16px; justify-items: center; margin-top: 8px;
}
.sr-empty__icon { width: 88px; height: 88px; border-radius: 50%; background: #fff; display: grid; place-items: center; color: var(--primary); box-shadow: 0 12px 30px -12px rgba(var(--dark-rgb), 0.18); }
.sr-empty__icon svg { width: 40px; height: 40px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.sr-empty h2 { margin: 0; font-size: 26px; font-weight: var(--fw-heading); letter-spacing: -0.03em; color: var(--dark); }
.sr-empty p { margin: 0; max-width: 520px; color: var(--muted); font-size: 15px; line-height: 1.55; }
.sr-empty .catalog-search { width: 100%; margin-top: 8px; }
`;

function SearchPage() {
  const search = Route.useSearch();
  const ratings = Route.useLoaderData();
  const results = useMemo(() => buildResults(ratings), [ratings]);
  const [sort, setSort] = useState("popular");

  const filtered = useMemo(() => {
    const q = (search.sport || "").trim().toLowerCase();
    const loc = (search.location || "").toLowerCase();
    let list = results.filter((r) => {
      const matchesSport = (sport: string) => {
        if (q === "бокс") return sport === "бокс" || sport === "boks";
        return sport === q || sport.split(/[\s,/]+/).some((word) => word.startsWith(q));
      };
      if (q && !r.sportSlugs.some(matchesSport) && !r.name.toLowerCase().includes(q)) return false;
      if (loc && !r.city.toLowerCase().includes(loc.replace(/^в\s+/i, "")) && !loc.includes(r.city.toLowerCase())) return false;
      if (search.format && r.formats.length > 0 && !r.formats.includes(search.format)) return false;
      if (search.audience === "child" && r.audiences.length > 0 && !r.audiences.includes("kid")) return false;
      if (search.audience === "adult" && r.audiences.length > 0 && !r.audiences.includes("adult")) return false;
      return true;
    });
    const rated = (item: Result) => ({ name: item.name, rating: String(item.rating), reviews: item.reviews });
    if (sort === "rating") list = [...list].sort((a, b) => compareByRating(rated(a), rated(b)));
    else if (sort === "reviews") list = [...list].sort((a, b) => compareByReviews(rated(a), rated(b)));
    else if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else list = [...list].sort((a, b) => compareByPopularity(rated(a), rated(b)));
    return list;
  }, [results, search, sort]);

  const queryLabel = [search.sport, search.location].filter(Boolean).join(" · ");
  const searchForm = (
    <CatalogSearchForm
      key={`${search.sport}|${search.location}|${search.audience}|${search.format}`}
      variant="hero"
      sport={search.sport}
      location={search.location || undefined}
      audience={search.audience}
      format={search.format}
    />
  );

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
          {filtered.length > 0 ? <div className="sr-search">{searchForm}</div> : null}
        </div>
      </section>

      <section className="sr-body">
        <div className="sr-count">Найдено: <b>{filtered.length}</b> {pluralRu(filtered.length, "тренер", "тренера", "тренеров")}</div>
        <label className="sr-sort">
          Сортировка:
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="popular">По популярности</option>
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
            <h2>{results.length === 0 && !queryLabel ? "Тренеров пока нет" : "Ничего не нашлось"}</h2>
            <p>
              {results.length === 0 && !queryLabel
                ? "Каталог ещё не заполнен. Профили появятся, когда тренеры их опубликуют."
                : queryLabel
                ? <>По запросу <b>«{queryLabel}»</b> сейчас нет подходящих тренеров. Попробуйте изменить вид спорта или город — или подпишитесь, и мы сообщим, когда появится подходящий тренер.</>
                : "Уточните вид спорта или город — и мы покажем подходящих тренеров."}
            </p>
            <div className="sr-search">{searchForm}</div>
          </div>
        ) : (
          <div className="sr-grid">
            {filtered.map((r) => (
              <Link key={r.slug} to="/trainers/$slug" params={{ slug: r.slug }} className="sr-card">
                <div className="sr-card__head">
                  <img className="sr-card__avatar" src={r.photo} alt="" width={52} height={52} />
                  <div className="sr-card__title">
                    <h3 className="sr-card__name">
                      {r.name}
                      {r.badge && <span className="sr-card__badge">{r.badge}</span>}
                    </h3>
                    <p className="sr-card__sport">{r.sport} · {r.district ? `${r.city}, ${r.district}` : r.city}</p>
                  </div>
                  <TrainerRating rating={r.reviews > 0 ? r.rating.toFixed(1) : "0"} reviews={r.reviews} />
                </div>
                <p className="sr-card__desc">{r.desc}</p>
                <div className="sr-card__tags">{r.tags.map((t) => <span key={t}>{t}</span>)}</div>
                <div className="sr-card__foot">
                  <span>{r.city}</span>
                  {r.price > 0 ? <span className="sr-card__price">от <strong>{r.price} BYN</strong></span> : null}
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
