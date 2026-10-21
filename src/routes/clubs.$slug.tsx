import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FavoriteButton } from "@/components/favorite-button";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { pluralRu } from "@/lib/ru-plural";

type Club = {
  slug: string;
  name: string;
  logo: string;
  city: { slug: string; label: string };
  address: string;
  hours: string;
  phone: string;
  telegram: string;
  mapUrl: string;
  rating: { value: string; ratingCount: number; reviewCount: number; fillPct: number };
  badge: string;
  stats: Array<{ label: string; accent?: boolean }>;
  about: string[];
  formats: Array<{ label: string; accent?: boolean }>;
  amenities: string[];
  note: string;
  prices: {
    single: Array<{ name: string; price: string }>;
    packs: Array<{ name: string; price: string }>;
  };
  directions: Array<{ slug: string; label: string; meta: string }>;
  trainers: Array<{ slug: string; name: string; sport: string; meta: string; price: string }>;
  reviews: Array<{ author: string; date: string; rating: number; text: string }>;
};

const CLUBS: Record<string, Club> = {};

function getClub(slug: string): Club | undefined {
  return CLUBS[slug];
}

export const Route = createFileRoute("/clubs/$slug")({
  loader: ({ params }) => {
    const club = params.slug ? getClub(params.slug) : undefined;
    if (!club) throw notFound();
    return { club };
  },
  head: ({ loaderData }) => {
    const c = loaderData?.club;
    if (!c) return { meta: [{ title: "Клуб · trenio.by" }] };
    const title = `${c.name} — клуб в ${c.city.label} · trenio`;
    const desc = `${c.name}: направления, тренеры, цены и контакты. ${c.address}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: `https://trenio.by/clubs/${c.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://trenio.by/clubs/${c.slug}` }],
    };
  },
  component: ClubPage,
});

function placeholder(seed: string, w = 1200, h = 514) {
  return `https://placehold.co/${w}x${h}/fff5f5/c9343a?text=${encodeURIComponent(seed)}`;
}

const CSS = `
.trenio-club-root *, .trenio-club-root *::before, .trenio-club-root *::after { box-sizing: border-box; }
.trenio-club-root {
  --primary: #f04b50; --primary-dark: #c9343a; --dark: #111827; --light-bg: #fff5f5;
  --neutral-bg: #f9fafb; --text: #1f2937; --muted: #6b7280; --line: #e5e7eb; --white: #ffffff;
  --primary-rgb: 240,75,80; --dark-rgb: 17,24,39;
  --content-max: var(--layout-max); --club-sidebar-w: var(--layout-sidebar-w);
  font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text); background: var(--neutral-bg); min-height: 100vh;
}

.page-shell { max-width: var(--layout-max); margin: 0 auto; padding: var(--layout-section-y) var(--layout-gutter) clamp(40px, 6vw, 72px); }

.breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 24px; padding: 0; list-style: none; font-size: 13px; font-weight: var(--fw-title); color: var(--muted); }
.breadcrumbs a { color: var(--muted); text-decoration: none; }
.breadcrumbs a:hover { color: var(--primary-dark); }
.breadcrumbs li + li::before { content: "›"; margin-right: 8px; color: var(--line); }

.club-hero { margin-bottom: 28px; }
.club-gallery { position: relative; }
.gallery-frame { position: relative; aspect-ratio: 21/9; border-radius: var(--card-radius); overflow: hidden; background: linear-gradient(160deg, var(--neutral-bg), var(--line)); }
.gallery-track { display: flex; height: 100%; transition: transform 0.4s cubic-bezier(0.4,0,0.2,1); }
.gallery-slide { flex: 0 0 100%; height: 100%; }
.gallery-slide img { width: 100%; height: 100%; object-fit: cover; display: block; user-select: none; }
.gallery-badge { position: absolute; top: 14px; left: 14px; z-index: 2; padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.94); color: var(--primary-dark); font-size: 11px; font-weight: var(--fw-title); letter-spacing: 0.02em; text-transform: uppercase; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); }
.gallery-nav { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.92); color: var(--dark); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.12); z-index: 2; }
.gallery-nav--prev { left: 12px; } .gallery-nav--next { right: 12px; }
.gallery-nav svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.gallery-save { position: absolute; top: 12px; right: 12px; z-index: 2; width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(255,255,255,0.92); color: var(--muted); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); }
.gallery-save.is-saved { color: var(--primary); }
.gallery-save svg { width: 20px; height: 20px; fill: currentColor; }
.gallery-thumbs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.gallery-thumb { width: 70px; height: 70px; padding: 0; border: 2px solid transparent; border-radius: var(--radius-tile); overflow: hidden; cursor: pointer; background: var(--line); opacity: 0.75; transition: opacity 0.16s, border-color 0.16s, transform 0.16s; }
.gallery-thumb:hover { opacity: 0.95; }
.gallery-thumb.is-active { border-color: var(--primary); opacity: 1; transform: translateY(-1px); }
.gallery-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }

.club-hero__sheet { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 18px 22px; align-items: center; margin-top: -32px; padding: 20px 22px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 16px 48px rgba(var(--dark-rgb),0.08); position: relative; z-index: 2; }
.club-hero__logo { width: 72px; height: 72px; border-radius: var(--radius-tile); background: var(--dark); color: var(--white); display: grid; place-items: center; font-size: 22px; font-weight: var(--fw-heading); letter-spacing: -0.04em; }
.club-hero__title { margin: 0 0 10px; font-size: var(--fs-page); line-height: 1.15; letter-spacing: var(--tracking-heading); font-weight: var(--fw-heading); color: var(--dark); }
.club-hero__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 16px; }
.club-hero__location { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; font-weight: var(--fw-title); }
.club-hero__location svg { width: 15px; height: 15px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.club-rating { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; font-size: 14px; font-weight: var(--fw-title); color: var(--dark); }
.club-rating__stars { position: relative; display: inline-flex; flex-shrink: 0; }
.club-rating__stars-empty, .club-rating__stars-fill { display: inline-flex; gap: 2px; }
.club-rating__stars-empty svg, .club-rating__stars-fill svg { width: 15px; height: 15px; }
.club-rating__stars-empty svg { fill: var(--line); }
.club-rating__stars-filled { position: absolute; inset: 0 auto 0 0; overflow: hidden; }
.club-rating__stars-fill svg { fill: #ffb400; }
.club-rating__counts { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.club-rating__link { color: var(--primary-dark); font-weight: var(--fw-ui); text-decoration: none; cursor: pointer; background: none; border: 0; padding: 0; }
.club-rating__link:hover { text-decoration: underline; }
.club-hero__save { width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--neutral-bg); color: var(--muted); cursor: pointer; display: grid; place-items: center; justify-self: end; align-self: start; }
.club-hero__save.is-saved { color: var(--primary); }
.club-hero__save svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.club-hero__save.is-saved svg { fill: currentColor; }
.club-hero__stats { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.club-stat { padding: 7px 12px; border-radius: 999px; background: var(--neutral-bg); color: var(--dark); font-size: 13px; font-weight: var(--fw-ui); }
.club-stat--accent { background: rgba(var(--primary-rgb),0.1); color: var(--primary-dark); }

.club-layout { display: grid; grid-template-columns: minmax(0,1fr) var(--club-sidebar-w); gap: 32px; align-items: start; }
.club-main { min-width: 0; }

.club-panel { border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 14px 42px rgba(var(--dark-rgb),0.07); overflow: hidden; min-width: 0; }
.club-tabs { display: flex; flex-wrap: nowrap; gap: 6px; padding: 8px; background: var(--neutral-bg); border-bottom: 1px solid var(--line); overflow-x: auto; scrollbar-width: none; }
.club-tabs::-webkit-scrollbar { display: none; }
.club-tabs__btn { flex: 0 0 auto; padding: 10px 14px; border: 0; border-radius: 999px; background: transparent; color: var(--muted); font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; white-space: nowrap; transition: background 0.16s, color 0.16s, box-shadow 0.16s; }
.club-tabs__btn:hover { color: var(--dark); }
.club-tabs__btn[aria-selected="true"] { background: var(--white); color: var(--dark); box-shadow: 0 2px 10px rgba(var(--dark-rgb),0.08); }
.club-panel__body { padding: 22px; }
.club-tab-panel { display: grid; gap: 14px; }

.club-section__title { margin: 0; font-size: 14px; font-weight: var(--fw-title); letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.club-text { margin: 0; font-size: 15px; line-height: 1.65; font-weight: 500; color: var(--text); }
.club-text + .club-text { margin-top: 4px; }
.club-note { margin: 0; font-size: 13px; line-height: 1.55; font-weight: 500; color: var(--muted); }

.taxonomy-row { display: flex; flex-wrap: wrap; gap: 8px; }
.taxonomy-tag { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); }
.taxonomy-tag--accent { background: rgba(var(--primary-rgb),0.1); color: var(--primary-dark); }

.amenity-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 10px; margin: 0; padding: 0; list-style: none; }
.amenity-tile { padding: 14px 12px; border-radius: var(--radius-tile); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); text-align: center; font-size: 13px; font-weight: var(--fw-ui); color: var(--dark); }

.club-price-groups { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 20px 24px; }
.club-price-list { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.club-price-list__row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 10px 12px; border-radius: var(--radius-control); background: var(--neutral-bg); }
.club-price-list__name { font-size: 14px; font-weight: var(--fw-heading); color: var(--dark); }
.club-price-list__amount { flex: 0 0 auto; font-size: 14px; font-weight: var(--fw-title); color: var(--dark); white-space: nowrap; }

.direction-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
.direction-card { display: grid; gap: 6px; padding: 16px 18px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 8px 28px rgba(var(--dark-rgb),0.04); text-decoration: none; color: inherit; transition: border-color 0.16s, box-shadow 0.16s; }
.direction-card:hover { border-color: rgba(var(--primary-rgb),0.22); box-shadow: 0 12px 34px rgba(var(--dark-rgb),0.07); }
.direction-card__label { font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; color: var(--dark); }
.direction-card__meta { font-size: 13px; font-weight: var(--fw-body); color: var(--muted); line-height: 1.4; }

.club-trainer-grid { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; }
.club-trainer-card { display: flex; flex-direction: column; min-width: 0; border: 1px solid rgba(var(--dark-rgb),0.06); border-radius: var(--card-radius); background: var(--white); color: inherit; text-decoration: none; overflow: hidden; box-shadow: 0 8px 28px rgba(var(--dark-rgb),0.04); transition: border-color 0.16s, transform 0.16s; }
.club-trainer-card:hover { border-color: rgba(var(--primary-rgb),0.22); transform: translateY(-1px); }
.club-trainer-card__photo-wrap { aspect-ratio: 4/3; overflow: hidden; background: linear-gradient(160deg, var(--neutral-bg), var(--line)); }
.club-trainer-card__photo { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.club-trainer-card__body { display: grid; gap: 4px; padding: 12px 14px 14px; }
.club-trainer-card__name { margin: 0; font-size: 15px; font-weight: var(--fw-title); color: var(--dark); letter-spacing: -0.02em; }
.club-trainer-card__sport { margin: 0; font-size: 13px; font-weight: var(--fw-title); color: var(--primary-dark); }
.club-trainer-card__meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; font-size: 13px; font-weight: var(--fw-ui); color: var(--muted); }
.club-trainer-card__price { color: var(--dark); white-space: nowrap; }

.review-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.review-item { display: grid; gap: 8px; padding: 16px 18px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); }
.review-item__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.review-item__author { font-size: 14px; font-weight: var(--fw-title); color: var(--dark); }
.review-item__date { color: var(--muted); font-size: 12px; font-weight: var(--fw-title); }
.review-item__stars { display: inline-flex; gap: 2px; }
.review-item__stars svg { width: 13px; height: 13px; fill: #ffb400; }
.review-item__stars svg.is-empty { fill: var(--line); }
.review-item__text { margin: 0; font-size: 14px; line-height: 1.55; font-weight: 500; }
.reviews-more { margin-top: 4px; align-self: start; padding: 11px 18px; border-radius: 999px; border: 1px solid var(--line); background: var(--white); color: var(--dark); font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; }
.reviews-more:hover { background: var(--light-bg); border-color: rgba(var(--primary-rgb),0.3); color: var(--primary-dark); }

.club-sidebar { position: sticky; top: 96px; min-width: 0; }
.club-contact { padding: 20px 18px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 14px 42px rgba(var(--dark-rgb),0.07); }
.club-contact__title { margin: 0 0 16px; font-size: 14px; font-weight: var(--fw-title); letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.club-contact__block + .club-contact__block { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.club-contact__label { margin: 0 0 6px; font-size: 11px; font-weight: var(--fw-title); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.club-contact__text { margin: 0; font-size: 14px; line-height: 1.55; font-weight: var(--fw-body); color: var(--dark); }
.club-contact__link { display: inline-block; margin-top: 6px; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-ui); text-decoration: none; }
.club-contact__link:hover { text-decoration: underline; }
.contact-actions { display: grid; gap: 8px; margin-top: 18px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 20px; border: 0; border-radius: 999px; font-size: 15px; font-weight: var(--fw-title); cursor: pointer; text-decoration: none; transition: transform 0.16s, background 0.16s; width: 100%; }
.btn:hover { transform: translateY(-1px); }
.btn--primary { background: var(--primary); color: #fff; }
.btn--primary:hover { background: var(--primary-dark); }
.btn--secondary { background: var(--neutral-bg); color: var(--dark); border: 1px solid var(--line); }
.btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
.contact-reveal { display: none; margin-top: 12px; padding: 12px; border-radius: var(--radius-control); background: var(--light-bg); text-align: center; }
.contact-reveal.is-visible { display: block; }
.contact-reveal__phone { display: block; margin-bottom: 4px; font-size: 18px; font-weight: var(--fw-heading); color: var(--dark); text-decoration: none; }
.contact-reveal__hint { margin: 0; font-size: 12px; color: var(--muted); }

.mobile-contact-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 200; padding: 10px 14px; background: rgba(255,255,255,0.96); backdrop-filter: blur(12px); border-top: 1px solid var(--line); display: none; }
.mobile-contact-bar__inner { max-width: 600px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

@media (max-width: 1100px) {
  .club-layout { grid-template-columns: 1fr; }
  .club-sidebar { position: static; max-width: 480px; }
  .direction-grid { grid-template-columns: 1fr; }
  .amenity-grid { grid-template-columns: repeat(2, minmax(0,1fr)); }
}
@media (max-width: 960px) {
  .page-shell { padding-block: clamp(16px, 3vw, 20px) clamp(72px, 12vw, 110px); }
  .gallery-frame { aspect-ratio: 16/10; }
  .club-hero__sheet { grid-template-columns: auto minmax(0,1fr); margin-top: 14px; }
  .club-hero__save { grid-column: 2; grid-row: 1; }
  .club-trainer-grid { grid-template-columns: 1fr; }
  .club-price-groups { grid-template-columns: 1fr; }
  .mobile-contact-bar { display: block; }
  .club-sidebar .contact-actions, .club-sidebar .contact-reveal { display: none; }
}
`;

type TabKey = "about" | "prices" | "directions" | "trainers" | "reviews";
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "about", label: "О клубе" },
  { key: "prices", label: "Цены и абонементы" },
  { key: "directions", label: "Направления" },
  { key: "trainers", label: "Тренеры" },
  { key: "reviews", label: "Отзывы" },
];

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="review-item__stars" aria-label={`Оценка ${rating} из 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={i < rating ? "" : "is-empty"}><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
      ))}
    </span>
  );
}

function ClubPage() {
  const { club: c } = Route.useLoaderData() as { club: Club };
  const [tab, setTab] = useState<TabKey>("about");
  const [photoIdx, setPhotoIdx] = useState(0);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [reviewsShown, setReviewsShown] = useState(5);

  const photos = [
    placeholder(`${c.name} — ринг`),
    placeholder("Зал · мешки"),
    placeholder("Групповая тренировка"),
    placeholder("ОФП-зона"),
  ];

  useEffect(() => {
    document.body.classList.add("page-club");
    return () => document.body.classList.remove("page-club");
  }, []);

  const openReviews = () => {
    setTab("reviews");
    setTimeout(() => document.getElementById("club-reviews-anchor")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="trenio-club-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SiteHeader />

      <main className="page-shell">
        <nav aria-label="Хлебные крошки">
          <ol className="breadcrumbs">
            <li><Link to="/">Главная</Link></li>
            <li><a href={`/clubs/${c.city.slug}`}>Клубы в {c.city.label === "Минск" ? "Минске" : c.city.label}</a></li>
            <li aria-current="page">{c.name}</li>
          </ol>
        </nav>

        <article className="club-page">
          <header className="club-hero">
            <div className="club-gallery">
              <div className="gallery-frame">
                <div className="gallery-track" style={{ transform: `translateX(-${photoIdx * 100}%)` }}>
                  {photos.map((src, i) => (
                    <div key={i} className="gallery-slide">
                      <img src={src} alt={`${c.name} — фото ${i + 1}`} width={1200} height={514} draggable={false} loading={i === 0 ? "eager" : "lazy"} />
                    </div>
                  ))}
                </div>
                {c.badge && <span className="gallery-badge">{c.badge}</span>}
                <FavoriteButton target={{ type: "club", slug: c.slug }} className="gallery-save" />
                <button className="gallery-nav gallery-nav--prev" type="button" aria-label="Предыдущее фото" onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}>
                  <svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6" /></svg>
                </button>
                <button className="gallery-nav gallery-nav--next" type="button" aria-label="Следующее фото" onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}>
                  <svg viewBox="0 0 24 24"><path d="M10 6l6 6-6 6" /></svg>
                </button>
              </div>
            </div>

            <div className="club-hero__sheet">
              <span className="club-hero__logo" aria-hidden="true">{c.logo}</span>
              <div>
                <h1 className="club-hero__title">{c.name}</h1>
                <div className="club-hero__meta">
                  <span className="club-hero__location">
                    <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                    {c.address.split(",").slice(0, 2).join(",")}
                  </span>
                  <div className="club-rating" aria-label={`Рейтинг ${c.rating.value} из 5, ${c.rating.ratingCount} ${pluralRu(c.rating.ratingCount, "оценка", "оценки", "оценок")}, ${c.rating.reviewCount} ${pluralRu(c.rating.reviewCount, "отзыв", "отзыва", "отзывов")}`}>
                    <span className="club-rating__stars" aria-hidden="true">
                      <span className="club-rating__stars-empty">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <svg key={i} viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
                        ))}
                      </span>
                      <span className="club-rating__stars-filled" style={{ width: `${c.rating.fillPct}%` }}>
                        <span className="club-rating__stars-fill">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <svg key={i} viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
                          ))}
                        </span>
                      </span>
                    </span>
                    <span>{c.rating.value}</span>
                    <span className="club-rating__counts">
                      ({c.rating.ratingCount} {pluralRu(c.rating.ratingCount, "оценка", "оценки", "оценок")} · <button type="button" className="club-rating__link" onClick={openReviews}>{c.rating.reviewCount} {pluralRu(c.rating.reviewCount, "отзыв", "отзыва", "отзывов")}</button>)
                    </span>
                  </div>
                </div>
              </div>
              <FavoriteButton target={{ type: "club", slug: c.slug }} className="club-hero__save" />
              <ul className="club-hero__stats">
                {c.stats.map((s) => (
                  <li key={s.label} className={`club-stat${s.accent ? " club-stat--accent" : ""}`}>{s.label}</li>
                ))}
              </ul>
            </div>

            <div className="gallery-thumbs" role="tablist" aria-label="Выбор фото">
              {photos.map((src, i) => (
                <button key={i} type="button" className={`gallery-thumb${i === photoIdx ? " is-active" : ""}`} aria-label={`Фото ${i + 1}`} aria-selected={i === photoIdx} onClick={() => setPhotoIdx(i)}>
                  <img src={src} alt="" loading="lazy" />
                </button>
              ))}
            </div>
          </header>

          <div className="club-layout">
            <div className="club-main">
              <div className="club-panel">
                <div className="club-tabs" role="tablist" aria-label="Разделы клуба">
                  {TABS.map((t) => (
                    <button key={t.key} className="club-tabs__btn" type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <div className="club-panel__body">
                  {tab === "about" && (
                    <div className="club-tab-panel">
                      <h2 className="club-section__title">О клубе</h2>
                      {c.about.map((p, i) => <p key={i} className="club-text">{p}</p>)}
                      <div className="taxonomy-row" aria-label="Форматы">
                        {c.formats.map((f) => (
                          <span key={f.label} className={`taxonomy-tag${f.accent ? " taxonomy-tag--accent" : ""}`}>{f.label}</span>
                        ))}
                      </div>
                      <h2 className="club-section__title">Зал и инфраструктура</h2>
                      <ul className="amenity-grid">
                        {c.amenities.map((a) => <li key={a} className="amenity-tile">{a}</li>)}
                      </ul>
                      <p className="club-note">{c.note}</p>
                    </div>
                  )}

                  {tab === "prices" && (
                    <div className="club-tab-panel">
                      <h2 className="club-section__title">Цены и абонементы</h2>
                      <p className="club-text">Тарифы зависят от направления и формата. Ниже — ориентиры по групповым занятиям; персональные — в профиле тренера.</p>
                      <div className="club-price-groups">
                        <div>
                          <p className="club-section__title">Разово</p>
                          <ul className="club-price-list">
                            {c.prices.single.map((p) => (
                              <li key={p.name} className="club-price-list__row">
                                <span className="club-price-list__name">{p.name}</span>
                                <span className="club-price-list__amount">{p.price}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="club-section__title">Абонементы</p>
                          <ul className="club-price-list">
                            {c.prices.packs.map((p) => (
                              <li key={p.name} className="club-price-list__row">
                                <span className="club-price-list__name">{p.name}</span>
                                <span className="club-price-list__amount">{p.price}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <p className="club-note">Точную стоимость уточняйте по телефону или в Telegram — она может отличаться по направлению и расписанию.</p>
                    </div>
                  )}

                  {tab === "directions" && (
                    <div className="club-tab-panel">
                      <h2 className="club-section__title">Все направления</h2>
                      <p className="club-text">В {c.name} можно заниматься в группе, индивидуально или самостоятельно в зале.</p>
                      <div className="direction-grid">
                        {c.directions.map((d) => (
                          <a key={d.slug} className="direction-card" href={`/trainers/${c.city.slug}/${d.slug}`}>
                            <span className="direction-card__label">{d.label}</span>
                            <span className="direction-card__meta">{d.meta}</span>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {tab === "trainers" && (
                    <div className="club-tab-panel">
                      <h2 className="club-section__title">Тренеры клуба · {c.trainers.length}</h2>
                      <div className="club-trainer-grid">
                        {c.trainers.map((t) => (
                          <Link key={t.slug} className="club-trainer-card" to="/trainers/$slug" params={{ slug: t.slug }}>
                            <div className="club-trainer-card__photo-wrap">
                              <img className="club-trainer-card__photo" src={placeholder(t.name, 420, 315)} alt={t.name} loading="lazy" />
                            </div>
                            <div className="club-trainer-card__body">
                              <h3 className="club-trainer-card__name">{t.name}</h3>
                              <p className="club-trainer-card__sport">{t.sport}</p>
                              <div className="club-trainer-card__meta">
                                <span>{t.meta}</span>
                                <span className="club-trainer-card__price">{t.price}</span>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                      <p className="club-note">Цены — от разового занятия у тренера. Актуальные тарифы смотрите в профиле.</p>
                    </div>
                  )}

                  {tab === "reviews" && (
                    <div className="club-tab-panel" id="club-reviews-anchor">
                      <h2 className="club-section__title">Отзывы о клубе · {c.reviews.length}</h2>
                      <ul className="review-list">
                        {c.reviews.slice(0, reviewsShown).map((r, i) => (
                          <li key={`${r.author}-${i}`} className="review-item">
                            <div className="review-item__head">
                              <span className="review-item__author">{r.author}</span>
                              <span className="review-item__date">{r.date}</span>
                            </div>
                            <ReviewStars rating={r.rating} />
                            <p className="review-item__text">{r.text}</p>
                          </li>
                        ))}
                      </ul>
                      {reviewsShown < c.reviews.length && (
                        <button type="button" className="reviews-more" onClick={() => setReviewsShown((n) => Math.min(n + 5, c.reviews.length))}>
                          Показать ещё {Math.min(5, c.reviews.length - reviewsShown)} из {c.reviews.length - reviewsShown}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <aside className="club-sidebar" aria-label="Контакты и запись">
              <div className="club-contact">
                <h2 className="club-contact__title">Контакты</h2>
                <div className="club-contact__block">
                  <p className="club-contact__label">Адрес</p>
                  <p className="club-contact__text">{c.address}</p>
                  <a className="club-contact__link" href={c.mapUrl} target="_blank" rel="noopener noreferrer">Маршрут в картах</a>
                </div>
                <div className="club-contact__block">
                  <p className="club-contact__label">Режим работы</p>
                  <p className="club-contact__text">{c.hours}</p>
                </div>
                <div className="contact-actions">
                  <button className="btn btn--primary" type="button" onClick={() => setPhoneVisible(true)}>
                    <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z" /></svg>
                    {phoneVisible ? c.phone : "Показать телефон"}
                  </button>
                  <a className="btn btn--secondary" href={c.telegram} target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    Telegram
                  </a>
                </div>
                <div className={`contact-reveal${phoneVisible ? " is-visible" : ""}`}>
                  <a className="contact-reveal__phone" href={`tel:${c.phone.replace(/\s|\(|\)|-/g, "")}`}>{c.phone}</a>
                  <p className="contact-reveal__hint">Нажмите, чтобы позвонить</p>
                </div>
              </div>
            </aside>
          </div>
        </article>
      </main>

      <div className="mobile-contact-bar" aria-label="Быстрая связь">
        <div className="mobile-contact-bar__inner">
          <a className="btn btn--secondary" href={c.telegram} target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            Telegram
          </a>
          <button className="btn btn--primary" type="button" onClick={() => setPhoneVisible(true)}>
            {phoneVisible ? c.phone : "Показать телефон"}
          </button>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
