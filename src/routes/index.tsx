import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CatalogSearchForm } from "@/components/catalog-search-form";
import { SportIcon } from "@/components/sport-icon";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { listPublishedSportCategories } from "@/lib/catalog/sport-taxonomy";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";
import { compareByPopularity, ratingFor } from "@/lib/catalog/trainer-popularity";
import { getHomeStatsFn } from "@/lib/catalog/home-stats";
import { listTrainerPricesFn, priceForCard } from "@/lib/catalog/trainer-price";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { CatalogTrainerCard } from "@/components/catalog-trainer-card";
import { SiteFaq } from "@/components/site-faq";
import { HOME_FAQ } from "@/lib/catalog/site-faq";
import { homePageHead } from "@/lib/seo/pages";
import { TRAINER_INVITE_LINE } from "@/lib/catalog/trainer-welcome";

const HOMEPAGE_CATEGORIES = listPublishedSportCategories();

function CategoryStrip() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  useEffect(() => {
    update();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.max(220, el.clientWidth * 0.55);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
  };

  return (
    <div className="category-slider">
      <button
        className={`category-slider-nav category-slider-prev${canPrev ? " is-visible" : ""}`}
        type="button"
        aria-label="Назад"
        hidden={!canPrev}
        onClick={() => scrollBy(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 6l-6 6 6 6" />
        </svg>
      </button>
      <div className="category-slider-viewport">
        <div className="category-slider-track" ref={trackRef}>
          {HOMEPAGE_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              className="category-chip"
              to="/categories/$slug"
              params={{ slug: category.slug }}
            >
              <span className="category-chip-icon" aria-hidden="true">
                {category.featuredImage ? (
                  <img src={category.featuredImage} alt="" width={64} height={64} />
                ) : (
                  <SportIcon iconKey={category.iconKey} />
                )}
              </span>
              <span className="category-chip-label">{category.label}</span>
            </Link>
          ))}
        </div>
      </div>
      <button
        className={`category-slider-nav category-slider-next${canNext ? " is-visible" : ""}`}
        type="button"
        aria-label="Вперёд"
        hidden={!canNext}
        onClick={() => scrollBy(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

function perView(el: HTMLElement) {
  const n = Number(getComputedStyle(el).getPropertyValue("--popular-per"));
  return n === 2 || n === 3 || n === 4 ? n : 2;
}

function pageStarts(count: number, per: number) {
  const maxStart = Math.max(0, count - per);
  const starts: number[] = [];
  for (let i = 0; i <= maxStart; i += per) starts.push(i);
  if (starts[starts.length - 1] !== maxStart) starts.push(maxStart);
  return starts;
}

function cardScrollLeft(track: HTMLElement, card: HTMLElement) {
  return card.getBoundingClientRect().left - track.getBoundingClientRect().left + track.scrollLeft;
}

function PopularSlider() {
  const trackRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(true);

  const update = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 8);
    setCanNext(el.scrollLeft < el.scrollWidth - el.clientWidth - 8);
  };

  const animateTo = (el: HTMLElement, to: number) => {
    if (animRef.current != null) cancelAnimationFrame(animRef.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = el.scrollLeft;
    const delta = to - from;
    if (reduce || Math.abs(delta) < 1) {
      el.style.scrollSnapType = "";
      el.scrollLeft = to;
      animRef.current = null;
      return;
    }
    const duration = Math.min(760, Math.max(520, Math.abs(delta) * 0.55));
    const start = performance.now();
    el.style.scrollSnapType = "none";
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2;
      el.scrollLeft = from + delta * eased;
      if (t < 1) {
        animRef.current = requestAnimationFrame(tick);
        return;
      }
      el.scrollLeft = to;
      el.style.scrollSnapType = "";
      animRef.current = null;
    };
    animRef.current = requestAnimationFrame(tick);
  };

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    update();

    const cardsOf = () => [...el.querySelectorAll<HTMLElement>(".popular-card")];

    const syncSnaps = () => {
      const cards = cardsOf();
      const starts = new Set(pageStarts(cards.length, perView(el)));
      cards.forEach((card, index) => card.classList.toggle("is-page-start", starts.has(index)));
    };

    let lastPer = perView(el);
    syncSnaps();

    const onResize = () => {
      const per = perView(el);
      syncSnaps();
      if (per !== lastPer) {
        lastPer = per;
        if (animRef.current != null) cancelAnimationFrame(animRef.current);
        animRef.current = null;
        el.style.scrollSnapType = "";
        const cards = cardsOf();
        const starts = pageStarts(cards.length, per);
        const current = starts.reduce((best, start) => {
          const card = cards[start];
          if (!card) return best;
          const dist = Math.abs(cardScrollLeft(el, card) - el.scrollLeft);
          return dist < best.dist ? { start, dist } : best;
        }, { start: 0, dist: Infinity });
        pageRef.current = current.start;
        const card = cards[current.start];
        if (card) el.scrollLeft = cardScrollLeft(el, card);
      }
      update();
    };

    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(el);

    let startX = 0;
    let suppressClick = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      animRef.current = null;
      el.style.scrollSnapType = "";
      startX = e.touches[0].clientX;
      suppressClick = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      if (Math.abs(startX - e.touches[0].clientX) > 8) suppressClick = true;
    };

    const onClickCapture = (e: Event) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    };

    el.addEventListener("scroll", update, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("click", onClickCapture, true);

    return () => {
      if (animRef.current != null) cancelAnimationFrame(animRef.current);
      resizeObserver.disconnect();
      el.removeEventListener("scroll", update);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    const cards = [...el.querySelectorAll<HTMLElement>(".popular-card")];
    if (!cards.length) return;
    const starts = pageStarts(cards.length, perView(el));
    const current = animRef.current != null
      ? pageRef.current
      : starts.reduce((best, start) => {
          const card = cards[start];
          if (!card) return best;
          const dist = Math.abs(cardScrollLeft(el, card) - el.scrollLeft);
          return dist < best.dist ? { start, dist } : best;
        }, { start: starts[0] ?? 0, dist: Infinity }).start;
    const pos = Math.max(0, starts.indexOf(current));
    const next = starts[Math.max(0, Math.min(starts.length - 1, pos + dir))] ?? current;
    pageRef.current = next;
    const card = cards[next];
    if (!card) return;
    animateTo(el, cardScrollLeft(el, card));
  };

  return (
    <div className="popular">
      <button
        type="button"
        className={`popular__edge popular__edge--prev${canPrev ? " is-visible" : ""}`}
        aria-label="Назад"
        hidden={!canPrev}
        onClick={() => scrollBy(-1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M14 6l-6 6 6 6" />
        </svg>
      </button>
      <div className="popular__viewport">
        <div className="popular__track" ref={trackRef}>
          {HOMEPAGE_CATEGORIES.map((category) => (
            <Link
              key={category.slug}
              className="popular-card"
              to="/categories/$slug"
              params={{ slug: category.slug }}
              draggable={false}
            >
              <div className="popular-card__media">
                <span
                  className="popular-card__bg"
                  aria-hidden="true"
                  style={
                    category.featuredImage ?? category.image
                      ? { backgroundImage: `url(${category.featuredImage ?? category.image})` }
                      : { background: category.bg }
                  }
                />
              </div>
              <div className="popular-card__content">
                <h3>{category.label}</h3>
                <p>{category.description}</p>
                <span className="popular-card__meta">
                  {category.count ? category.count : null}
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
      <button
        type="button"
        className={`popular__edge popular__edge--next${canNext ? " is-visible" : ""}`}
        aria-label="Вперёд"
        hidden={!canNext}
        onClick={() => scrollBy(1)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 6l6 6-6 6" />
        </svg>
      </button>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => homePageHead(HOME_FAQ),
  loader: async () => {
    const [ratings, prices, stats] = await Promise.all([listTrainerRatingSummariesFn(), listTrainerPricesFn(), getHomeStatsFn()]);
    return { ratings, prices, stats };
  },
  component: Index,
});

const CSS = `
:root {
  --primary: #f04b50;
  --primary-dark: #c9343a;
  --dark: #111827;
  --light-bg: #fff5f5;
  --neutral-bg: #f9fafb;
  --text: #1f2937;
  --accent-cyan: #4bf0eb;
  --primary-rgb: 240, 75, 80;
  --dark-rgb: 17, 24, 39;
  --muted: #6b7280;
  --line: #e5e7eb;
  --white: #ffffff;
  --shadow: 0 24px 70px rgba(var(--primary-rgb), 0.18);
  --form-audience-w: 131px;
  --form-format-w: 157px;
  --form-sport-w-header: 211px;
  --form-location-w-header: 147px;
  --header-clearance: 88px;
}
.trenio-root *, .trenio-root *::before, .trenio-root *::after { box-sizing: border-box; }
.trenio-root {
  font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--light-bg);
  min-height: 100vh;
}
.trenio-root > .site-header {
  position: sticky; top: 0; z-index: 300;
  background: transparent;
  backdrop-filter: none; -webkit-backdrop-filter: none;
  box-shadow: none;
  transition: background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s ease, backdrop-filter 0.4s ease;
  border-bottom: 1px solid transparent;
}
body.is-search-docked .trenio-root > .site-header,
.trenio-root > .site-header.is-scrolled {
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(16px) saturate(160%); -webkit-backdrop-filter: blur(16px) saturate(160%);
  box-shadow: 0 1px 0 rgba(var(--dark-rgb), 0.06), 0 10px 36px rgba(var(--dark-rgb), 0.05);
  border-bottom-color: rgba(var(--primary-rgb), 0.12);
}
.site-header__inner {
  width: 100%; max-width: var(--layout-max); margin: 0 auto; padding: 28px var(--layout-gutter);
  display: flex; align-items: center; justify-content: space-between; gap: 20px;
  transition: padding 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
body.is-search-docked .site-header__inner { padding: 12px var(--layout-gutter); gap: 10px; }
.site-header__search {
  flex: 1; min-width: 0; max-width: 0; opacity: 0; overflow: hidden; pointer-events: none;
  transition: opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
body.is-search-docked .site-header__search {
  max-width: 100%; opacity: 1; overflow: visible; pointer-events: auto;
  display: flex; align-items: center; justify-content: flex-start;
}
.hero-top {
  min-height: 60vh;
  margin-top: calc(var(--header-clearance) * -1);
  padding: var(--header-clearance) 0 0;
  display: flex; flex-direction: column;
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.96) 0, rgba(255, 255, 255, 0.78) 28%, rgba(255, 245, 245, 0.72) 52%, rgba(var(--primary-rgb), 0.16) 100%),
    linear-gradient(180deg, var(--light-bg) 0%, var(--light-bg) 46%, #ffe8e8 100%);
}
.hero-top-inner { width: 100%; max-width: var(--layout-max); margin: 0 auto; flex: 1; display: flex; flex-direction: column; padding: 0 var(--layout-gutter) 40px; }
.category-strip { padding-block: 8px 28px; background: transparent; }

.nav-links { display: flex; align-items: center; gap: 36px; font-size: 15px; font-weight: var(--fw-ui); }
.nav-links a { color: var(--text); text-decoration: none; }
.nav-links__static { color: var(--muted); cursor: default; }
.help { width: 24px; height: 24px; border: 2px solid var(--dark); border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: var(--fw-title); }
.hero-stack { position: relative; width: 100%; max-width: 920px; margin: auto; padding-top: clamp(24px, 5vh, 48px); text-align: center; }
.hero-search-zone { width: 100%; max-width: 800px; margin: 0 auto; }
.search-block { width: 100%; }
.search-block--hero { max-width: 800px; margin: 0 auto; }
.search-block--header { width: min(100%, 700px); max-width: 100%; min-width: 0; }
.search-block--hero .search-intent__compact { display: none; }
.intent-dropdown__trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 7px;
  width: 100%; min-height: 37px; padding: 0; border: 0; border-radius: 0;
  background: transparent; color: var(--text); font-size: 14px; font-weight: 500; letter-spacing: -0.01em; cursor: pointer; white-space: nowrap;
}
.intent-dropdown__trigger svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; color: var(--muted); flex: 0 0 auto; }
.search-block--header .search-shell {
  width: 100%; max-width: 100%; min-width: 0; min-height: 40px; padding: 2px 3px;
  box-shadow: 0 4px 18px rgba(var(--dark-rgb), 0.06);
  grid-template-columns: minmax(0, 160fr) minmax(0, 240fr) minmax(0, 180fr) 36px;
}
.search-block--header .search-field.intent-select { position: relative; display: flex; align-items: center; }
.search-block--header .search-field { height: 36px; padding: 0 8px; gap: 5px; }
.search-block--header .combo-input { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-block--header .search-icon svg, .search-block--header .chevron-icon svg { width: 16px; height: 16px; }
.search-block--header .search-submit { width: 36px; height: 36px; }
.search-block--header .search-submit svg { width: 17px; height: 17px; }
.hero-title { margin: 0 0 36px; font-size: var(--fs-display); line-height: 1.12; letter-spacing: -0.04em; font-weight: var(--fw-heading); color: var(--dark); }
.search-block--hero .search-intent { margin-bottom: 16px; }
.search-dock-sentinel { width: 100%; height: 1px; margin: 0; pointer-events: none; }
.site-header__nav { flex: 0 0 auto; }
.search-intent { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; margin: 0 auto 18px; color: var(--muted); font-size: 16px; font-weight: var(--fw-title); }
.intent-group { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: 7px; }
.intent-label { color: var(--muted); font-weight: var(--fw-heading); }
.audience-tab {
  border: 0; background: rgba(255, 255, 255, 0.7); border-radius: 999px; padding: 7px 12px;
  font-size: 15px; font-weight: var(--fw-title); color: var(--muted); opacity: 0.5; cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
}
.audience-tab:hover { transform: translateY(-1px); }
.audience-tab.is-active { background: var(--primary); color: #fff; opacity: 1; box-shadow: 0 10px 24px rgba(var(--primary-rgb), 0.22); }
.search-shell {
  min-height: 62px; padding: 7px 8px; background: var(--white);
  border: 1px solid rgba(var(--dark-rgb), 0.08); border-radius: 999px;
  box-shadow: 0 12px 36px rgba(var(--dark-rgb), 0.08);
  display: grid; grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) auto;
  align-items: center; gap: 0; text-align: left;
}
.search-field { min-width: 0; height: 48px; display: flex; align-items: center; gap: 12px; padding: 0 20px; }
.search-field:focus-within .search-icon { color: var(--accent-cyan); }
.search-field + .search-field { border-left: 1px solid var(--line); }
.search-icon, .chevron-icon { flex: 0 0 auto; display: grid; place-items: center; color: var(--muted); }
.search-icon svg, .chevron-icon svg { width: 21px; height: 21px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.field-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.combo-select { position: relative; min-width: 0; }
.combo-input { width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent; color: var(--text); font-size: 18px; font-weight: 500; letter-spacing: -0.01em; }
.combo-input::placeholder { color: var(--muted); }
.combo-menu {
  position: absolute; z-index: 3; top: calc(100% + 12px); left: 8px; right: 8px;
  min-width: 260px; padding: 7px; border: 1px solid rgba(var(--dark-rgb), 0.08);
  border-radius: var(--card-radius); background: var(--white); box-shadow: 0 18px 46px rgba(var(--dark-rgb), 0.13); display: none;
}
.combo-menu::before { content: ""; position: absolute; top: -6px; left: 24px; width: 12px; height: 12px; background: var(--white); border-left: 1px solid rgba(var(--dark-rgb), 0.08); border-top: 1px solid rgba(var(--dark-rgb), 0.08); transform: rotate(45deg); }
.combo-select.is-open .combo-menu { display: grid; gap: 1px; }
.combo-select[data-combo="location"] .combo-menu { max-height: 320px; overflow-y: auto; }
.combo-option { border: 0; width: 100%; min-height: 42px; padding: 0 13px; border-radius: var(--radius-control); background: transparent; color: var(--text); cursor: pointer; font-size: 15px; font-weight: var(--fw-title); text-align: left; }
.combo-option:hover, .combo-option.is-active { background: var(--light-bg); color: var(--primary-dark); }
.search-submit { width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--primary); color: #fff; cursor: pointer; transition: transform 0.18s ease, background 0.18s ease; display: grid; place-items: center; }
.search-submit svg { width: 24px; height: 24px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.search-submit:hover { transform: translateY(-1px); background: var(--primary-dark); }
.category-slider { position: relative; width: 100%; margin: 0 auto; display: flex; align-items: center; }
.category-slider-nav { position: absolute; top: 18px; z-index: 2; width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--white); color: var(--text); cursor: pointer; display: none; place-items: center; flex-shrink: 0; box-shadow: 0 4px 14px rgba(var(--dark-rgb), 0.08); }
.category-slider-prev { left: 0; }
.category-slider-next { right: 0; }
.category-slider-nav.is-visible { display: grid; }
.category-slider-nav:hover { box-shadow: 0 8px 20px rgba(var(--dark-rgb), 0.1); }
.category-slider-nav svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.category-slider-viewport { flex: 1; min-width: 0; overflow: hidden; }
.category-slider-track { display: flex; align-items: flex-start; gap: 14px; padding: 6px 0 8px; overflow-x: auto; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; touch-action: pan-x; overscroll-behavior-x: contain; }
.category-slider-track::-webkit-scrollbar { display: none; }
.category-chip { flex: 0 0 96px; min-width: 96px; max-width: 96px; min-height: 88px; border: 0; background: transparent; padding: 0; cursor: pointer; display: grid; justify-items: center; align-content: start; gap: 8px; color: var(--text); text-decoration: none; transition: color 0.18s ease, transform 0.18s ease; }
.category-chip:hover { transform: translateY(-2px); }
.category-chip:hover .category-chip-icon { color: var(--accent-cyan); }
.category-chip-icon { width: 64px; height: 64px; display: grid; place-items: center; color: var(--dark); transition: color 0.18s ease; }
.category-chip-icon img { width: 100%; height: 100%; object-fit: contain; display: block; }
.category-chip-icon svg { width: 24px; height: 24px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.category-chip-label { font-size: 11px; line-height: 1.25; font-weight: var(--fw-title); letter-spacing: -0.01em; text-align: center; text-wrap: balance; }
.page-main { background: transparent; }
.page-inner { width: 100%; max-width: var(--layout-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.category-card { padding: 20px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); text-decoration: none; color: inherit; display: block; }
.category-card h3 { margin: 0 0 8px; font-size: 18px; letter-spacing: -0.03em; }
.category-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.45; }
.category-card__meta { margin-top: 14px; color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }

/* Popular destinations slider. One page is a full row: 2, then 3, then 4. */
.popular { position: relative; width: 100%; container: popular / inline-size; }
.popular__viewport { min-width: 0; overflow: hidden; }
.popular__track {
  --popular-per: 2;
  --popular-gap: var(--layout-gap);
  display: flex; gap: var(--popular-gap); padding: 8px 0 12px; overflow-x: auto;
  scroll-snap-type: x mandatory;
  scrollbar-width: none; -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
}
.popular__track::-webkit-scrollbar { display: none; }
.popular-card {
  flex: 0 0 calc((100% - (var(--popular-per) - 1) * var(--popular-gap)) / var(--popular-per));
  min-width: 0;
  position: relative; overflow: hidden;
  border-radius: var(--card-radius); padding: 0;
  text-decoration: none; color: var(--text);
  background: var(--white);
  border: 1px solid rgba(var(--dark-rgb), 0.08);
  display: flex; flex-direction: column;
  scroll-snap-align: none;
  transition: transform 0.28s ease, border-color 0.28s ease;
  -webkit-user-drag: none;
  user-select: none;
}
.popular-card.is-page-start { scroll-snap-align: start; scroll-snap-stop: always; }
@media (min-width: 800px) {
  .popular__track { --popular-per: 3; }
}
@media (min-width: 1100px) {
  .popular__track { --popular-per: 4; }
}
@container popular (min-width: 740px) {
  .popular__track { --popular-per: 3; }
}
@container popular (min-width: 1000px) {
  .popular__track { --popular-per: 4; }
}
.popular-card__media {
  position: relative;
  flex: 0 0 auto;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}
.popular-card__bg {
  position: absolute; inset: 0;
  background-color: var(--light-bg);
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  transition: transform 0.45s ease;
}
.popular-card__content {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px 16px;
  background: var(--white);
}
.popular-card:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--primary-rgb), 0.22);
}
.popular-card:hover .popular-card__bg { transform: scale(1.05); }
.popular-card h3 { margin: 0; font-size: 19px; letter-spacing: -0.035em; font-weight: var(--fw-heading); line-height: 1.12; color: var(--dark); }
.popular-card p {
  margin: 0; color: rgba(var(--dark-rgb), 0.68); font-size: 13px; line-height: 1.45; font-weight: var(--fw-body);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.popular-card__meta {
  margin-top: auto; padding-top: 4px; display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: var(--fw-title); color: var(--primary-dark);
}
.popular-card__meta svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s ease; }
.popular-card:hover .popular-card__meta svg { transform: translateX(3px); }

.popular__edge {
  position: absolute; top: 50%; z-index: 2;
  width: 44px; height: 44px; border-radius: 999px;
  border: 1px solid rgba(var(--dark-rgb), 0.08);
  background: var(--white); color: var(--dark); cursor: pointer;
  display: none; place-items: center;
  box-shadow: 0 10px 28px rgba(var(--dark-rgb), 0.14);
  transition: border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}
.popular__edge--prev { left: 0; transform: translate(-50%, -50%); }
.popular__edge--next { right: 0; transform: translate(50%, -50%); }
.popular__edge.is-visible { display: grid; }
.popular__edge--prev:hover { border-color: var(--primary); color: var(--primary); transform: translate(-50%, calc(-50% - 1px)); }
.popular__edge--next:hover { border-color: var(--primary); color: var(--primary); transform: translate(50%, calc(-50% - 1px)); }
.popular__edge svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }

.content-section + .content-section { margin-top: 48px; }

@media (max-width: 1000px) {
  body.is-search-docked .site-header__inner { flex-wrap: wrap; row-gap: 8px; }
  body.is-search-docked .site-header .logo { order: 1; }
  body.is-search-docked .site-header__nav { order: 2; }
  body.is-search-docked .site-header__search { order: 3; flex: 1 0 100%; max-height: 64px; }
  .search-block--header { width: min(100%, 700px); }
}
@media (max-width: 960px) {
  .site-header__inner { padding: 24px var(--layout-gutter); }
  body.is-search-docked .site-header__inner { padding: 10px var(--layout-gutter); gap: 8px; }
  .hero-top { min-height: 60vh; padding: var(--header-clearance) 0 32px; }
  .nav-links { gap: 24px; font-size: 14px; }
  .search-block { max-width: 100%; }
  .search-shell { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) auto; padding: 8px 9px; }
  .category-slider-nav { display: none !important; }
}
@media (max-width: 720px) {
  body.is-search-docked .site-header__search { max-height: 48px; }
  .search-block--header, .search-block--header .search-shell { width: 100%; }
}
@media (max-width: 767px) {
  body.is-search-docked .site-header__search { display: none; }
}
@media (max-width: 620px) {
  .search-intent { font-size: 14px; justify-content: center; }
  .hero-title { margin-bottom: 22px; font-size: clamp(30px, 8vw, 40px); letter-spacing: -0.05em; }
  .search-field { padding-inline: 12px; }
  .combo-input { font-size: 17px; }
  .combo-menu { left: 6px; right: 6px; min-width: 220px; }
  .category-chip { flex-basis: 88px; min-width: 88px; max-width: 88px; min-height: 80px; }
  .category-chip-icon { width: 56px; height: 56px; }
  .category-chip-label { font-size: 10px; }
  .popular__edge { display: none !important; }
}

/* === Extended sections === */
.section-sub { margin: 6px 0 0; color: var(--muted); font-size: 15px; font-weight: var(--fw-ui); max-width: 620px; }

/* How it works */
.steps-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--layout-gap); }
.step-card { position: relative; padding: 26px 22px 24px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.06); overflow: hidden; transition: transform 0.2s ease, box-shadow 0.2s ease; }
.step-card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px rgba(var(--dark-rgb), 0.08); }
.step-card__num { position: absolute; top: 14px; right: 18px; font-size: 56px; line-height: 1; font-weight: var(--fw-heading); letter-spacing: -0.06em; color: var(--light-bg); }
.step-card__icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: var(--radius-tile); background: rgba(var(--primary-rgb), 0.1); color: var(--primary); margin-bottom: 16px; }
.step-card__icon svg { width: 24px; height: 24px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.step-card h3 { margin: 0 0 6px; font-size: 17px; font-weight: var(--fw-title); letter-spacing: -0.025em; color: var(--dark); position: relative; }
.step-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.5; position: relative; }

/* Stats band */
.section-title--logo { display: flex; align-items: center; gap: 0.4em; flex-wrap: wrap; }
.section-title__logo { display: block; height: 1em; width: auto; }
.stats-band { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 34px 28px; border-radius: var(--card-radius); background: linear-gradient(135deg, var(--dark) 0%, #1f2937 60%, #2a1416 100%); color: #fff; position: relative; overflow: hidden; }
.stats-band::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 85% 15%, rgba(var(--primary-rgb), 0.35), transparent 55%), radial-gradient(circle at 10% 90%, rgba(75, 240, 235, 0.18), transparent 50%); pointer-events: none; }
.stat-item { position: relative; text-align: center; padding: 4px 8px; }
.stat-item + .stat-item { border-left: 1px solid rgba(255, 255, 255, 0.08); }
.stat-item__num { display: block; font-size: clamp(28px, 3.2vw, 36px); font-weight: var(--fw-heading); letter-spacing: -0.05em; line-height: 1; background: linear-gradient(180deg, #fff 0%, #ffd9da 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.stat-item__label { display: block; margin-top: 8px; color: rgba(255, 255, 255, 0.66); font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.02em; }

/* Reviews */
.reviews-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--layout-gap); }
.review-card { padding: 24px 22px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.06); display: flex; flex-direction: column; gap: 14px; }
.review-card__stars { display: inline-flex; gap: 2px; color: #ffb400; }
.review-card__stars svg { width: 16px; height: 16px; fill: currentColor; stroke: none; }
.review-card__text { margin: 0; font-size: 15px; line-height: 1.55; color: var(--text); font-weight: 500; }
.review-card__author { display: flex; align-items: center; gap: 12px; margin-top: auto; }
.review-card__avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--light-bg); object-fit: cover; flex: 0 0 auto; }
.review-card__meta { display: flex; flex-direction: column; gap: 2px; }
.review-card__name { font-size: 14px; font-weight: var(--fw-title); color: var(--dark); letter-spacing: -0.02em; }
.review-card__role { font-size: 12px; font-weight: var(--fw-ui); color: var(--muted); }

/* CTA: become a trainer */
.cta-banner { position: relative; padding: 44px 48px; border-radius: var(--card-radius); background: linear-gradient(120deg, var(--primary) 0%, #ff7a5c 55%, var(--primary-dark) 100%); color: #fff; overflow: hidden; display: grid; grid-template-columns: 1.4fr 1fr; gap: 28px; align-items: center; box-shadow: var(--shadow); }
.cta-banner::before { content: ""; position: absolute; right: -80px; top: -80px; width: 320px; height: 320px; border-radius: 50%; background: rgba(255, 255, 255, 0.12); }
.cta-banner::after { content: ""; position: absolute; left: -60px; bottom: -120px; width: 260px; height: 260px; border-radius: 50%; background: rgba(0, 0, 0, 0.08); }
.cta-banner__content { position: relative; z-index: 1; }
.cta-banner h2 { margin: 0 0 10px; font-size: var(--fs-section); font-weight: var(--fw-heading); letter-spacing: -0.04em; line-height: 1.08; }
.cta-banner p { margin: 0; color: rgba(255, 255, 255, 0.86); font-size: 15px; line-height: 1.55; max-width: 460px; font-weight: 500; }
.cta-banner__perks { position: relative; z-index: 1; display: grid; gap: 10px; }
.cta-banner__perk { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 14px; font-weight: var(--fw-title); }
.cta-banner__perk svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; padding: 4px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); box-sizing: content-box; }
.cta-banner__actions { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
.cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 22px; border-radius: 999px; font-size: 15px; font-weight: var(--fw-title); text-decoration: none; cursor: pointer; border: 0; transition: transform 0.18s ease, box-shadow 0.18s ease; }
.cta-btn--primary { background: #fff; color: var(--primary-dark); }
.cta-btn--ghost { background: rgba(255, 255, 255, 0.14); color: #fff; border: 1px solid rgba(255, 255, 255, 0.35); }
.cta-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18); }

@media (max-width: 960px) {
  .steps-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .stats-band { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 10px; padding: 28px 18px; }
  .stat-item:nth-child(3) { border-left: 0; }
  .reviews-grid { grid-template-columns: 1fr; }
  .cta-banner { grid-template-columns: 1fr; padding: 32px 26px; }
}
@media (max-width: 620px) {
  .steps-grid { grid-template-columns: 1fr; }
  .stats-band { grid-template-columns: 1fr; }
  .stat-item + .stat-item { border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 18px; }
}
`;

function experienceLabel(years: number | null): string {
  if (years == null) return "средний стаж";
  const mod10 = years % 10;
  const mod100 = years % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "год" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "года" : "лет";
  return `средний стаж, ${word}`;
}

function Index() {
  const { ratings, prices, stats } = Route.useLoaderData();
  const trainers = PUBLISHED_TRAINERS.map((trainer) => {
    const rating = ratingFor(trainer.slug, ratings);
    return {
      slug: trainer.slug,
      name: trainer.name,
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      photo: trainer.photo,
      desc: trainer.bio,
      tags: trainer.sports.map((sport) => sport.label),
      rating: rating.rating,
      reviews: rating.reviews,
      views: rating.views,
      saves: rating.saves,
      price: priceForCard(trainer.slug, trainer.priceFrom, prices),
      city: trainer.city.label,
      district: trainer.district,
      experience: trainer.experience,
    };
  }).sort(compareByPopularity);
  useEffect(() => {
    const siteHeader = document.querySelector<HTMLElement>("#site-header");
    const sentinel = document.querySelector<HTMLElement>("#search-dock-sentinel");
    if (!siteHeader || !sentinel) return;

    const syncHeaderClearance = () => {
      document.documentElement.style.setProperty(
        "--header-clearance",
        `${siteHeader.offsetHeight}px`,
      );
    };
    syncHeaderClearance();

    const getHeaderOffset = () => siteHeader.getBoundingClientRect().height;

    let dockObserver: IntersectionObserver | null = null;
    const bindDockObserver = () => {
      if (dockObserver) dockObserver.disconnect();
      dockObserver = new IntersectionObserver(
        ([entry]) => {
          document.body.classList.toggle("is-search-docked", !entry.isIntersecting);
        },
        { root: null, rootMargin: `-${getHeaderOffset()}px 0px 0px 0px`, threshold: 0 },
      );
      dockObserver.observe(sentinel);
    };
    bindDockObserver();
    const onResize = () => {
      syncHeaderClearance();
      bindDockObserver();
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      dockObserver?.disconnect();
      document.body.classList.remove("is-search-docked");
    };
  }, []);

  return (
    <div className="trenio-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <SiteHeader middleSlot={<CatalogSearchForm variant="header" />} />

      <section className="hero-top">
        <div className="hero-top-inner">
          <main className="hero-stack">
            <h1 className="hero-title">Я ищу тренера</h1>
            <div className="hero-search-zone">
              <CatalogSearchForm variant="hero" />
              <div className="search-dock-sentinel" id="search-dock-sentinel" aria-hidden="true" />
            </div>
          </main>
        </div>
        <section className="category-strip layout-rail" aria-label="Категории спорта">
          <CategoryStrip />
        </section>
      </section>

      <section className="page-main layout-section--main">
        <div className="page-inner">
          <section className="content-section" aria-labelledby="trainers-heading">
            <div className="section-head">
              <h2 className="section-title" id="trainers-heading">
                Тренеры в Минске
              </h2>
              <Link className="section-link" to="/city/$slug" params={{ slug: "minsk" }}>
                Смотреть всех
              </Link>
            </div>

            <div className="trainer-grid">
              {trainers.length === 0 ? (
                <p className="section-sub">Тренеров пока нет. Раздел заполнится, когда появятся опубликованные профили.</p>
              ) : trainers.map((t) => (
                <CatalogTrainerCard key={t.slug} trainer={t} />
              ))}
            </div>
          </section>

          <section className="content-section" aria-labelledby="popular-heading">
            <div className="section-head">
              <h2 className="section-title" id="popular-heading">
                Категории спорта
              </h2>
              <Link className="section-link" to="/categories/">
                Все категории
              </Link>
            </div>
            <PopularSlider />
          </section>

          <section className="content-section" aria-labelledby="how-heading">
            <div className="section-head section-head--stacked">
              <div>
                <h2 className="section-title" id="how-heading">
                  Найти тренера — за 4 шага
                </h2>
                <p className="section-sub">
                  Всё прозрачно: вы выбираете специалиста, договариваетесь о времени и тренируетесь.
                </p>
              </div>
            </div>
            <div className="steps-grid">
              {[
                {
                  n: "01",
                  t: "Выберите категорию",
                  d: "Категории первого уровня и десятки направлений — от единоборств до йоги и плавания.",
                  icon: (
                    <>
                      <circle cx="11" cy="11" r="6.5" />
                      <path d="M16 16l4 4" />
                    </>
                  ),
                },
                {
                  n: "02",
                  t: "Посмотрите тренеров",
                  d: "Реальные отзывы, рейтинги, цены и условия занятий.",
                  icon: (
                    <>
                      <path d="M4 6h16M4 12h16M4 18h10" />
                    </>
                  ),
                },
                {
                  n: "03",
                  t: "Свяжитесь и забронируйте",
                  d: "Напишите в один клик и согласуйте удобное время.",
                  icon: (
                    <>
                      <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
                    </>
                  ),
                },
                {
                  n: "04",
                  t: "Тренируйтесь и развивайтесь",
                  d: "Оставьте отзыв и помогите другим выбрать тренера.",
                  icon: (
                    <>
                      <path d="M20 6L9 17l-5-5" />
                    </>
                  ),
                },
              ].map((s) => (
                <div key={s.n} className="step-card">
                  <span className="step-card__num">{s.n}</span>
                  <span className="step-card__icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      {s.icon}
                    </svg>
                  </span>
                  <h3>{s.t}</h3>
                  <p>{s.d}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="content-section" aria-labelledby="stats-heading">
            <div className="section-head section-head--stacked">
              <h2 className="section-title section-title--logo" id="stats-heading">
                <img className="section-title__logo" src="/logo.webp" width={503} height={128} alt="trenio" />
                <span>в цифрах</span>
              </h2>
            </div>
            <div className="stats-band">
              {[
                { n: String(stats.trainers), l: "тренеров на платформе" },
                { n: String(stats.sports), l: "видов спорта" },
                { n: String(stats.cities), l: "городов Беларуси" },
                { n: stats.experience == null ? "—" : String(stats.experience), l: experienceLabel(stats.experience) },
              ].map((s) => (
                <div key={s.l} className="stat-item">
                  <span className="stat-item__num">{s.n}</span>
                  <span className="stat-item__label">{s.l}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="content-section" aria-labelledby="reviews-heading">
            <div className="section-head section-head--stacked">
              <div>
                <h2 className="section-title" id="reviews-heading">
                  Что говорят клиенты
                </h2>
                <p className="section-sub">Отзывы появятся, когда клиенты оценят тренеров.</p>
              </div>
            </div>
            <p className="section-sub">Отзывов пока нет.</p>
          </section>

          <section className="content-section" aria-labelledby="cta-heading">
            <div className="cta-banner">
              <div className="cta-banner__content">
                <h2 id="cta-heading">Вы тренер? Принимайте клиентов через trenio</h2>
                <p>{TRAINER_INVITE_LINE}</p>
                <div className="cta-banner__actions">
                  <Link className="cta-btn cta-btn--primary" to="/join/trainer">
                    Стать тренером
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="var(--icon-stroke)"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </Link>
                  <Link className="cta-btn cta-btn--ghost" to="/about" hash="razmeschenie">
                    Узнать о тарифах
                  </Link>
                </div>
              </div>
              <div className="cta-banner__perks">
                {[
                  "Фото, цены и текст возьмём из Instagram",
                  "Заявки от учеников напрямую — без посредников",
                  "Отзывы и рейтинг повышают доверие клиентов",
                  "Поддержка платформы 7 дней в неделю",
                ].map((p) => (
                  <span key={p} className="cta-banner__perk">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    {p}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <section className="content-section" aria-labelledby="faq-heading">
            <div className="section-head section-head--stacked">
              <div>
                <h2 className="section-title" id="faq-heading">
                  Частые вопросы
                </h2>
                <p className="section-sub">
                  Если не нашли ответ — напишите нам, поможем разобраться.
                </p>
              </div>
            </div>
            <SiteFaq narrow items={HOME_FAQ} />
          </section>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
