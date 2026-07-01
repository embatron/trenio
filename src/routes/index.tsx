import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { SportIcon } from "@/components/sport-icon";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { TOP_LEVEL_SPORT_CATEGORIES } from "@/lib/catalog/sport-taxonomy";

const HOMEPAGE_CATEGORIES = TOP_LEVEL_SPORT_CATEGORIES;

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
                <SportIcon iconKey={category.iconKey} />
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

function PopularSlider() {
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

    let startX = 0;
    let startScrollLeft = 0;
    let dragging = false;
    let suppressClick = false;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startScrollLeft = el.scrollLeft;
      dragging = true;
      suppressClick = false;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!dragging || e.touches.length !== 1) return;
      const dx = startX - e.touches[0].clientX;
      if (Math.abs(dx) > 8) {
        suppressClick = true;
        el.scrollLeft = startScrollLeft + dx;
      }
    };

    const onTouchEnd = () => {
      dragging = false;
    };

    const onClickCapture = (e: Event) => {
      if (!suppressClick) return;
      e.preventDefault();
      e.stopPropagation();
      suppressClick = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("click", onClickCapture, true);

    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("click", onClickCapture, true);
    };
  }, []);

  const scrollBy = (dir: number) => {
    const el = trackRef.current;
    if (!el) return;
    const amount = Math.min(el.clientWidth * 0.85, 600);
    el.scrollBy({ left: dir * amount, behavior: "smooth" });
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
                    category.image
                      ? { backgroundImage: `url(${category.image})` }
                      : { background: category.bg }
                  }
                />
                <span className="popular-card__icon" aria-hidden="true">
                  <SportIcon iconKey={category.iconKey} />
                </span>
              </div>
              <div className="popular-card__content">
                <h3>{category.label}</h3>
                <p>{category.description}</p>
                <span className="popular-card__meta">
                  {category.count}
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
  head: () => ({
    meta: [
      { title: "trenio.by — поиск тренеров в Беларуси" },
      {
        name: "description",
        content:
          "Trenio.by — поиск тренеров и спортивных занятий в Беларуси. Индивидуальные и групповые тренировки.",
      },
      { property: "og:title", content: "trenio.by — поиск тренеров в Беларуси" },
      {
        property: "og:description",
        content: "Поиск тренеров и спортивных занятий в Беларуси — индивидуально и в группе.",
      },
    ],
  }),
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
  --radius-xl: 44px;
  --radius-lg: 34px;
  --radius-md: 22px;
  --form-audience-w: 132px;
  --form-format-w: 158px;
  --form-sport-w-header: 212px;
  --form-location-w-header: 148px;
  --header-clearance: 88px;
}
.trenio-root *, .trenio-root *::before, .trenio-root *::after { box-sizing: border-box; }
.trenio-root {
  font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--light-bg);
  min-height: 100vh;
}
.site-header {
  position: sticky; top: 0; z-index: 300;
  background: rgba(255, 245, 245, 0.72);
  backdrop-filter: blur(10px) saturate(140%); -webkit-backdrop-filter: blur(10px) saturate(140%);
  transition: background-color 0.4s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.4s ease;
  border-bottom: 1px solid transparent;
}
body.is-search-docked .site-header {
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
body.is-search-docked .site-header__inner { padding: 12px var(--layout-gutter); gap: 14px; }
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
  padding: var(--header-clearance) var(--layout-gutter) 0;
  display: flex; flex-direction: column;
  background:
    radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.96) 0, rgba(255, 255, 255, 0.78) 28%, rgba(255, 245, 245, 0.72) 52%, rgba(var(--primary-rgb), 0.16) 100%),
    linear-gradient(180deg, var(--light-bg) 0%, var(--light-bg) 46%, #ffe8e8 100%);
}
.hero-top-inner { width: 100%; max-width: var(--layout-max); margin: 0 auto; flex: 1; display: flex; flex-direction: column; padding-bottom: 40px; }
.category-strip { width: 100%; padding: 8px 0 28px; background: transparent; }

.logo {
  font-size: 32px; line-height: 1; font-weight: 900; letter-spacing: -0.045em;
  color: var(--dark); text-decoration: none; flex: 0 0 auto;
  display: inline-flex; align-items: baseline; gap: 1px;
}
.logo__mark { color: var(--primary); }
.logo__tld { color: var(--muted); font-weight: 700; letter-spacing: -0.03em; font-size: 0.7em; margin-left: 1px; }
.site-footer__brand .logo { color: var(--white); }
.site-footer__brand .logo__tld { color: rgba(255,255,255,0.55); }
.site-header .logo { font-size: 26px; }
.nav-links { display: flex; align-items: center; gap: 36px; font-size: 15px; font-weight: 750; }
.nav-links a { color: var(--text); text-decoration: none; }
.nav-links__static { color: var(--muted); cursor: default; }
.help { width: 24px; height: 24px; border: 2px solid var(--dark); border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 800; }
.hero-stack { position: relative; width: 100%; max-width: 920px; margin: auto; padding-top: clamp(24px, 5vh, 48px); text-align: center; }
.hero-search-zone { width: 100%; max-width: 800px; margin: 0 auto; }
.search-block { width: 100%; }
.search-block--hero { max-width: 800px; margin: 0 auto; }
.search-block--header { width: fit-content; max-width: 100%; min-width: 0; }
.search-block--hero .search-intent__compact { display: none; }
.intent-dropdown__trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 8px;
  width: 100%; min-height: 38px; padding: 0; border: 0; border-radius: 0;
  background: transparent; color: var(--text); font-size: 15px; font-weight: 500; letter-spacing: -0.01em; cursor: pointer; white-space: nowrap;
}
.intent-dropdown__trigger svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; color: var(--muted); flex: 0 0 auto; }
.search-block--header .search-shell {
  width: max-content; max-width: 100%; min-width: 0; min-height: 48px; padding: 5px 6px;
  box-shadow: 0 4px 18px rgba(var(--dark-rgb), 0.06);
  grid-template-columns: var(--form-audience-w) var(--form-format-w) var(--form-sport-w-header) var(--form-location-w-header) 38px;
}
.search-block--header .search-field.intent-select { position: relative; display: flex; align-items: center; }
.search-block--header .search-field { height: 38px; padding: 0 12px; gap: 8px; }
.search-block--header .combo-input { font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-block--header .search-icon svg, .search-block--header .chevron-icon svg { width: 17px; height: 17px; }
.search-block--header .search-submit { width: 38px; height: 38px; }
.search-block--header .search-submit svg { width: 18px; height: 18px; }
.hero-title { margin: 0 0 36px; font-size: clamp(42px, 6vw, 68px); line-height: 1.04; letter-spacing: -0.055em; font-weight: 900; color: var(--dark); }
.search-block--hero .search-intent { margin-bottom: 16px; }
.search-dock-sentinel { width: 100%; height: 1px; margin: 0; pointer-events: none; }
.site-header__nav { flex: 0 0 auto; }
.search-intent { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 10px; margin: 0 auto 18px; color: var(--muted); font-size: 16px; font-weight: 650; }
.intent-group { display: inline-flex; align-items: center; flex-wrap: wrap; justify-content: center; gap: 7px; }
.intent-label { color: var(--muted); font-weight: 700; }
.audience-tab, .format-tab {
  border: 0; background: rgba(255, 255, 255, 0.7); border-radius: 999px; padding: 7px 12px;
  font-size: 15px; font-weight: 800; color: var(--muted); opacity: 0.5; cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease, opacity 0.18s ease, transform 0.18s ease;
}
.audience-tab:hover, .format-tab:hover { transform: translateY(-1px); }
.audience-tab.is-active, .format-tab.is-active { background: var(--primary); color: #fff; opacity: 1; box-shadow: 0 10px 24px rgba(var(--primary-rgb), 0.22); }
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
.search-icon svg, .chevron-icon svg { width: 21px; height: 21px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.field-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.combo-select { position: relative; min-width: 0; }
.combo-input { width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent; color: var(--text); font-size: 18px; font-weight: 500; letter-spacing: -0.01em; }
.combo-input::placeholder { color: var(--muted); }
.combo-menu {
  position: absolute; z-index: 3; top: calc(100% + 12px); left: 8px; right: 8px;
  min-width: 260px; padding: 7px; border: 1px solid rgba(var(--dark-rgb), 0.08);
  border-radius: 20px; background: var(--white); box-shadow: 0 18px 46px rgba(var(--dark-rgb), 0.13); display: none;
}
.combo-menu::before { content: ""; position: absolute; top: -6px; left: 24px; width: 12px; height: 12px; background: var(--white); border-left: 1px solid rgba(var(--dark-rgb), 0.08); border-top: 1px solid rgba(var(--dark-rgb), 0.08); transform: rotate(45deg); }
.combo-select.is-open .combo-menu { display: grid; gap: 1px; }
.combo-option { border: 0; width: 100%; min-height: 42px; padding: 0 13px; border-radius: 14px; background: transparent; color: var(--text); cursor: pointer; font-size: 15px; font-weight: 650; text-align: left; }
.combo-option:hover, .combo-option.is-active { background: var(--light-bg); color: var(--primary-dark); }
.search-submit { width: 48px; height: 48px; border: 0; border-radius: 50%; background: var(--primary); color: #fff; cursor: pointer; transition: transform 0.18s ease, background 0.18s ease; display: grid; place-items: center; }
.search-submit svg { width: 24px; height: 24px; stroke: currentColor; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.search-submit:hover { transform: translateY(-1px); background: var(--primary-dark); }
.category-slider { width: min(100%, 1120px); margin: 0 auto; padding: 0 12px; display: flex; align-items: center; gap: 8px; }
.category-slider-nav { width: 40px; height: 40px; border: 0; border-radius: 50%; background: var(--white); color: var(--text); cursor: pointer; display: none; place-items: center; flex-shrink: 0; box-shadow: 0 4px 14px rgba(var(--dark-rgb), 0.06); transition: transform 0.18s ease, box-shadow 0.18s ease; }
.category-slider-nav.is-visible { display: grid; }
.category-slider-nav:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(var(--dark-rgb), 0.1); }
.category-slider-nav svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2.2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.category-slider-viewport { flex: 1; min-width: 0; overflow: hidden; }
.category-slider-track { display: flex; align-items: flex-start; gap: 14px; padding: 4px 8px; overflow-x: auto; scroll-behavior: smooth; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; touch-action: pan-x; overscroll-behavior-x: contain; }
.category-slider-track::-webkit-scrollbar { display: none; }
.category-chip { flex: 0 0 96px; min-width: 96px; max-width: 96px; border: 0; background: transparent; padding: 0; cursor: pointer; display: grid; justify-items: center; gap: 8px; color: var(--text); text-decoration: none; transition: color 0.18s ease, transform 0.18s ease; }
.category-chip:hover { transform: translateY(-2px); }
.category-chip:hover .category-chip-icon { color: var(--accent-cyan); }
.category-chip-icon { width: 32px; height: 32px; display: grid; place-items: center; color: var(--dark); transition: color 0.18s ease; }
.category-chip-icon svg { width: 28px; height: 28px; }
.category-chip-label { font-size: 11px; line-height: 1.25; font-weight: 650; letter-spacing: -0.01em; text-align: center; text-wrap: balance; }
.page-main { background: transparent; }
.page-inner { width: 100%; max-width: var(--layout-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.trainer-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; }
.trainer-card { position: relative; display: flex; flex-direction: column; min-width: 0; border: 1px solid rgba(var(--dark-rgb), 0.06); border-radius: var(--radius-md); background: var(--white); color: inherit; text-decoration: none; overflow: hidden; cursor: pointer; }
.trainer-card__media { position: relative; aspect-ratio: 4 / 5; overflow: hidden; background: linear-gradient(160deg, var(--neutral-bg) 0%, var(--line) 100%); }
.trainer-card__photo { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.trainer-card__badge { position: absolute; top: 12px; left: 12px; padding: 5px 10px; border-radius: 999px; background: rgba(255, 255, 255, 0.94); color: var(--primary-dark); font-size: 11px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; box-shadow: 0 6px 18px rgba(var(--dark-rgb), 0.08); }
.trainer-card__save { position: absolute; top: 10px; right: 10px; width: 36px; height: 36px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.92); color: var(--muted); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb), 0.08); }
.trainer-card__save.is-saved { color: var(--primary); }
.trainer-card__save svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.trainer-card__save.is-saved svg { fill: currentColor; }
.trainer-card__body { display: flex; flex-direction: column; gap: 8px; padding: 18px 20px 20px; }
.trainer-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
.trainer-card__name { margin: 0; font-size: 18px; line-height: 1.2; letter-spacing: -0.03em; font-weight: 850; color: var(--dark); }
.trainer-card__rating { flex: 0 0 auto; display: inline-flex; align-items: center; gap: 4px; color: var(--dark); font-size: 13px; font-weight: 800; white-space: nowrap; }
.trainer-card__rating svg { width: 13px; height: 13px; fill: #ffb400; stroke: none; }
.trainer-card__rating span { color: var(--muted); font-weight: 650; }
.trainer-card__sport { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.35; font-weight: 700; }
.trainer-card__desc { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.45; font-weight: 500; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.trainer-card__tags { display: flex; flex-wrap: wrap; gap: 6px; }
.trainer-card__tag { padding: 5px 9px; border-radius: 999px; background: var(--light-bg); color: var(--muted); font-size: 11px; font-weight: 750; letter-spacing: -0.01em; }
.trainer-card__tag--accent { background: rgba(var(--primary-rgb), 0.1); color: var(--primary-dark); }
.trainer-card__footer { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 2px; padding-top: 12px; border-top: 1px solid var(--line); }
.trainer-card__location { display: inline-flex; align-items: center; gap: 5px; min-width: 0; color: var(--muted); font-size: 12px; font-weight: 650; }
.trainer-card__location svg { flex: 0 0 auto; width: 13px; height: 13px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.trainer-card__location span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.trainer-card__price { flex: 0 0 auto; color: var(--dark); font-size: 14px; font-weight: 850; letter-spacing: -0.02em; }
.trainer-card__price small { color: var(--muted); font-size: 12px; font-weight: 650; }
.category-card { padding: 20px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--white); text-decoration: none; color: inherit; display: block; }
.category-card h3 { margin: 0 0 8px; font-size: 18px; letter-spacing: -0.03em; }
.category-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.45; }
.category-card__meta { margin-top: 14px; color: var(--muted); font-size: 13px; font-weight: 650; }

/* Popular destinations slider */
.popular { display: flex; align-items: center; gap: 8px; width: 100%; }
.popular__viewport { flex: 1; min-width: 0; overflow: hidden; }
.popular__track {
  display: flex; gap: 18px; padding: 8px 4px 12px; overflow-x: auto;
  scroll-behavior: smooth;
  scrollbar-width: none; -ms-overflow-style: none;
  -webkit-overflow-scrolling: touch;
  touch-action: pan-x;
  overscroll-behavior-x: contain;
}
.popular__track::-webkit-scrollbar { display: none; }
.popular-card {
  flex: 0 0 280px;
  position: relative; overflow: hidden;
  border-radius: var(--radius-md); padding: 0;
  text-decoration: none; color: var(--text);
  background: var(--white);
  border: 1px solid rgba(var(--dark-rgb), 0.08);
  display: flex; flex-direction: column;
  transition: transform 0.28s ease, border-color 0.28s ease;
  -webkit-user-drag: none;
  user-select: none;
}
.popular-card__media {
  position: relative;
  flex: 0 0 auto;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}
.popular-card__bg {
  position: absolute; inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  transition: transform 0.45s ease;
}
.popular-card__media::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 55%, rgba(15, 23, 42, 0.1) 100%);
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
.popular-card__icon {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 1;
  width: 40px; height: 40px; border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  display: grid; place-items: center; color: var(--primary-dark);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 16px rgba(var(--dark-rgb), 0.12);
}
.popular-card__icon svg { width: 21px; height: 21px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.popular-card h3 { margin: 0; font-size: 19px; letter-spacing: -0.035em; font-weight: 900; line-height: 1.12; color: var(--dark); }
.popular-card p {
  margin: 0; color: rgba(var(--dark-rgb), 0.68); font-size: 13px; line-height: 1.45; font-weight: 550;
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden;
}
.popular-card__meta {
  margin-top: auto; padding-top: 4px; display: inline-flex; align-items: center; gap: 6px;
  font-size: 12px; font-weight: 800; color: var(--primary-dark);
}
.popular-card__meta svg { width: 14px; height: 14px; stroke: currentColor; fill: none; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; transition: transform 0.2s ease; }
.popular-card:hover .popular-card__meta svg { transform: translateX(3px); }

.popular__edge {
  width: 44px; height: 44px; border-radius: 999px;
  border: 1px solid rgba(var(--dark-rgb), 0.08);
  background: var(--white); color: var(--dark); cursor: pointer;
  display: none; place-items: center; flex-shrink: 0;
  box-shadow: 0 10px 28px rgba(var(--dark-rgb), 0.14);
  transition: border-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}
.popular__edge.is-visible { display: grid; }
.popular__edge:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-1px); }
.popular__edge svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

.content-section + .content-section { margin-top: 48px; }

@media (max-width: 960px) {
  .site-header__inner { padding: 24px var(--layout-gutter); }
  body.is-search-docked .site-header__inner { padding: 10px var(--layout-gutter); }
  .hero-top { min-height: 60vh; padding: var(--header-clearance) var(--layout-gutter) 32px; }
  .nav-links { gap: 24px; font-size: 14px; }
  .search-block { max-width: 100%; }
  .search-block--header .search-shell { grid-template-columns: minmax(0, var(--form-audience-w)) minmax(0, var(--form-format-w)) minmax(0, var(--form-sport-w-header)) minmax(0, var(--form-location-w-header)) auto; }
  .search-shell { grid-template-columns: minmax(0, 3fr) minmax(0, 2fr) auto; padding: 8px 9px; }
  .category-slider { width: 100%; padding: 0 6px; }
  .trainer-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
}
@media (max-width: 620px) {
  .logo { font-size: 28px; }
  .search-intent { font-size: 14px; justify-content: center; }
  .hero-title { margin-bottom: 22px; font-size: clamp(36px, 11vw, 52px); letter-spacing: -0.05em; }
  .search-field { padding-inline: 12px; }
  .combo-input { font-size: 17px; }
  .combo-menu { left: 6px; right: 6px; min-width: 220px; }
  .category-chip { flex-basis: 88px; min-width: 88px; max-width: 88px; }
  .category-chip-label { font-size: 10px; }
  .trainer-grid { grid-template-columns: 1fr; }
  .popular-card { flex-basis: 78vw; }
  .popular__edge { display: none !important; }
}

/* === Extended sections === */
.section-sub { margin: 6px 0 0; color: var(--muted); font-size: 15px; font-weight: 600; max-width: 620px; }

/* How it works */
.steps-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.step-card { position: relative; padding: 26px 22px 24px; border-radius: var(--radius-md); background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.06); overflow: hidden; transition: transform 0.2s ease, box-shadow 0.2s ease; }
.step-card:hover { transform: translateY(-3px); box-shadow: 0 18px 40px rgba(var(--dark-rgb), 0.08); }
.step-card__num { position: absolute; top: 14px; right: 18px; font-size: 56px; line-height: 1; font-weight: 900; letter-spacing: -0.06em; color: var(--light-bg); }
.step-card__icon { width: 46px; height: 46px; display: grid; place-items: center; border-radius: 14px; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); margin-bottom: 16px; }
.step-card__icon svg { width: 24px; height: 24px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.step-card h3 { margin: 0 0 6px; font-size: 17px; font-weight: 850; letter-spacing: -0.025em; color: var(--dark); position: relative; }
.step-card p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.5; position: relative; }

/* Stats band */
.stats-band { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding: 34px 28px; border-radius: var(--radius-md); background: linear-gradient(135deg, var(--dark) 0%, #1f2937 60%, #2a1416 100%); color: #fff; position: relative; overflow: hidden; }
.stats-band::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 85% 15%, rgba(var(--primary-rgb), 0.35), transparent 55%), radial-gradient(circle at 10% 90%, rgba(75, 240, 235, 0.18), transparent 50%); pointer-events: none; }
.stat-item { position: relative; text-align: center; padding: 4px 8px; }
.stat-item + .stat-item { border-left: 1px solid rgba(255, 255, 255, 0.08); }
.stat-item__num { display: block; font-size: clamp(32px, 4vw, 46px); font-weight: 900; letter-spacing: -0.05em; line-height: 1; background: linear-gradient(180deg, #fff 0%, #ffd9da 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.stat-item__label { display: block; margin-top: 8px; color: rgba(255, 255, 255, 0.66); font-size: 13px; font-weight: 650; letter-spacing: 0.02em; }

/* Reviews */
.reviews-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; }
.review-card { padding: 24px 22px; border-radius: var(--radius-md); background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.06); display: flex; flex-direction: column; gap: 14px; }
.review-card__stars { display: inline-flex; gap: 2px; color: #ffb400; }
.review-card__stars svg { width: 16px; height: 16px; fill: currentColor; stroke: none; }
.review-card__text { margin: 0; font-size: 15px; line-height: 1.55; color: var(--text); font-weight: 500; }
.review-card__author { display: flex; align-items: center; gap: 12px; margin-top: auto; }
.review-card__avatar { width: 44px; height: 44px; border-radius: 50%; background: var(--light-bg); object-fit: cover; flex: 0 0 auto; }
.review-card__meta { display: flex; flex-direction: column; gap: 2px; }
.review-card__name { font-size: 14px; font-weight: 800; color: var(--dark); letter-spacing: -0.02em; }
.review-card__role { font-size: 12px; font-weight: 600; color: var(--muted); }

/* CTA: become a trainer */
.cta-banner { position: relative; padding: 44px 48px; border-radius: var(--radius-lg); background: linear-gradient(120deg, var(--primary) 0%, #ff7a5c 55%, var(--primary-dark) 100%); color: #fff; overflow: hidden; display: grid; grid-template-columns: 1.4fr 1fr; gap: 28px; align-items: center; box-shadow: var(--shadow); }
.cta-banner::before { content: ""; position: absolute; right: -80px; top: -80px; width: 320px; height: 320px; border-radius: 50%; background: rgba(255, 255, 255, 0.12); }
.cta-banner::after { content: ""; position: absolute; left: -60px; bottom: -120px; width: 260px; height: 260px; border-radius: 50%; background: rgba(0, 0, 0, 0.08); }
.cta-banner__content { position: relative; z-index: 1; }
.cta-banner .section-eyebrow { background: rgba(255, 255, 255, 0.18); color: #fff; }
.cta-banner h2 { margin: 0 0 10px; font-size: clamp(26px, 3vw, 36px); font-weight: 900; letter-spacing: -0.04em; line-height: 1.08; }
.cta-banner p { margin: 0; color: rgba(255, 255, 255, 0.86); font-size: 15px; line-height: 1.55; max-width: 460px; font-weight: 500; }
.cta-banner__perks { position: relative; z-index: 1; display: grid; gap: 10px; }
.cta-banner__perk { display: flex; align-items: center; gap: 10px; color: #fff; font-size: 14px; font-weight: 650; }
.cta-banner__perk svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; padding: 4px; border-radius: 50%; background: rgba(255, 255, 255, 0.18); box-sizing: content-box; }
.cta-banner__actions { display: flex; gap: 12px; margin-top: 22px; flex-wrap: wrap; }
.cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 13px 22px; border-radius: 999px; font-size: 15px; font-weight: 800; text-decoration: none; cursor: pointer; border: 0; transition: transform 0.18s ease, box-shadow 0.18s ease; }
.cta-btn--primary { background: #fff; color: var(--primary-dark); }
.cta-btn--ghost { background: rgba(255, 255, 255, 0.14); color: #fff; border: 1px solid rgba(255, 255, 255, 0.35); }
.cta-btn:hover { transform: translateY(-1px); box-shadow: 0 12px 26px rgba(0, 0, 0, 0.18); }

/* FAQ */
.faq-grid { display: grid; gap: 12px; max-width: 880px; }
.faq-item { border: 1px solid rgba(var(--dark-rgb), 0.08); border-radius: 18px; background: var(--white); overflow: hidden; transition: box-shadow 0.2s ease, border-color 0.2s ease; }
.faq-item[open] { box-shadow: 0 14px 32px rgba(var(--dark-rgb), 0.06); border-color: rgba(var(--primary-rgb), 0.3); }
.faq-item summary { list-style: none; cursor: pointer; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between; gap: 14px; font-size: 16px; font-weight: 750; color: var(--dark); letter-spacing: -0.02em; }
.faq-item summary::-webkit-details-marker { display: none; }
.faq-item__icon { width: 28px; height: 28px; flex: 0 0 auto; border-radius: 50%; background: var(--light-bg); color: var(--primary); display: grid; place-items: center; transition: transform 0.25s ease, background 0.2s ease; font-size: 18px; font-weight: 900; line-height: 1; }
.faq-item[open] .faq-item__icon { transform: rotate(45deg); background: var(--primary); color: #fff; }
.faq-item__body { padding: 0 22px 20px; color: var(--muted); font-size: 14.5px; line-height: 1.6; font-weight: 500; }

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
  .faq-item summary { font-size: 15px; padding: 16px 18px; }
}
`;

const trainers = [
  {
    slug: "farkhad-akhmedjanov",
    name: "Фархад Ахмеджанов",
    sport: "Кикбоксинг",
    desc: "Группы для новичков и опытных — техника, связки и рабочий темп.",
    tags: ["Индивидуально", "Группа", "Взрослые"],
    rating: "4.9",
    reviews: 38,
    price: 45,
    badge: "Топ",
  },
  {
    slug: "dmitriy-hotin",
    name: "Дмитрий Хотин",
    sport: "Тайский бокс",
    desc: "Детские группы 7–12 лет — постепенный набор техники и безопасность на ринге.",
    tags: ["Группа", "Дети"],
    rating: "5.0",
    reviews: 24,
    price: 50,
  },
  {
    slug: "sergey-ovsyannikov",
    name: "Сергей Овсяников",
    sport: "Тайский бокс",
    desc: "Вечерние группы — работа на снарядах, техника и комфортный спарринг.",
    tags: ["Индивидуально", "Группа", "Взрослые"],
    rating: "4.8",
    reviews: 19,
    price: 42,
  },
  {
    slug: "artem-romanovich",
    name: "Артем Романович",
    sport: "Бокс",
    desc: "Классический бокс для начинающих — стойка, база и работа в ритме группы.",
    tags: ["Группа", "Взрослые"],
    rating: "4.9",
    reviews: 12,
    price: 38,
    badge: "Новый",
  },
  {
    slug: "vladimir-antipenko",
    name: "Владимир Антипенко",
    sport: "Кикбоксинг",
    desc: "Дети и подростки — техника, координация и нагрузка по возрасту.",
    tags: ["Группа", "Дети", "Подростки"],
    rating: "4.7",
    reviews: 31,
    price: 35,
  },
];

function placeholder(seed: string) {
  return `https://placehold.co/480x600/fff5f5/c9343a?text=${encodeURIComponent(seed)}`;
}

function Index() {
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

    const sportInputs = document.querySelectorAll<HTMLInputElement>('input[name="sport"]');
    const locationInputs = document.querySelectorAll<HTMLInputElement>('input[name="location"]');

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

    const syncPaired = (source: HTMLInputElement, targets: NodeListOf<HTMLInputElement>) => {
      targets.forEach((input) => {
        if (input === source || input.value === source.value) return;
        input.value = source.value;
      });
    };
    sportInputs.forEach((i) => i.addEventListener("input", () => syncPaired(i, sportInputs)));
    locationInputs.forEach((i) => i.addEventListener("input", () => syncPaired(i, locationInputs)));

    const audienceTabs = document.querySelectorAll<HTMLButtonElement>(
      ".search-block--hero .audience-tab",
    );
    const formatTabs = document.querySelectorAll<HTMLButtonElement>(
      ".search-block--hero .format-tab",
    );
    const intentDropdowns = document.querySelectorAll<HTMLElement>(
      ".search-block--header [data-intent-dropdown]",
    );
    const comboSelects = document.querySelectorAll<HTMLElement>(".combo-select[data-combo]");

    let activeAudience = "adult";
    let activeFormat = "individual";

    const setAudience = (v: string) => {
      activeAudience = v;
      audienceTabs.forEach((it) => it.classList.toggle("is-active", it.dataset.audience === v));
      document
        .querySelectorAll<HTMLElement>('.search-block--header [data-intent-dropdown="audience"]')
        .forEach((field) => {
          field.querySelectorAll<HTMLElement>(".combo-option").forEach((opt) => {
            const active = opt.dataset.value === v;
            opt.classList.toggle("is-active", active);
            if (active) {
              const label = field.querySelector(".intent-dropdown__value");
              if (label) label.textContent = opt.dataset.label || "";
            }
          });
        });
    };
    const setFormat = (v: string) => {
      activeFormat = v;
      formatTabs.forEach((it) => it.classList.toggle("is-active", it.dataset.format === v));
      document
        .querySelectorAll<HTMLElement>('.search-block--header [data-intent-dropdown="format"]')
        .forEach((field) => {
          field.querySelectorAll<HTMLElement>(".combo-option").forEach((opt) => {
            const active = opt.dataset.value === v;
            opt.classList.toggle("is-active", active);
            if (active) {
              const label = field.querySelector(".intent-dropdown__value");
              if (label) label.textContent = opt.dataset.label || "";
            }
          });
        });
    };

    audienceTabs.forEach((t) =>
      t.addEventListener("click", () => setAudience(t.dataset.audience!)),
    );
    formatTabs.forEach((t) => t.addEventListener("click", () => setFormat(t.dataset.format!)));

    intentDropdowns.forEach((field) => {
      const trigger = field.querySelector<HTMLButtonElement>(".intent-dropdown__trigger");
      const options = field.querySelectorAll<HTMLElement>(".combo-option");
      const kind = field.dataset.intentDropdown;
      if (!trigger) return;
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const willOpen = !field.classList.contains("is-open");
        intentDropdowns.forEach((it) => {
          it.classList.remove("is-open");
          it.querySelector(".intent-dropdown__trigger")?.setAttribute("aria-expanded", "false");
        });
        comboSelects.forEach((c) => c.classList.remove("is-open"));
        field.classList.toggle("is-open", willOpen);
        trigger.setAttribute("aria-expanded", String(willOpen));
      });
      options.forEach((opt) => {
        opt.addEventListener("click", () => {
          if (kind === "audience") setAudience(opt.dataset.value!);
          else setFormat(opt.dataset.value!);
          field.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
        });
      });
    });

    comboSelects.forEach((combo) => {
      const input = combo.querySelector<HTMLInputElement>(".combo-input");
      const options = combo.querySelectorAll<HTMLElement>(".combo-option");
      if (!input) return;
      input.addEventListener("focus", () => {
        intentDropdowns.forEach((field) => {
          field.classList.remove("is-open");
          field.querySelector(".intent-dropdown__trigger")?.setAttribute("aria-expanded", "false");
        });
        combo.classList.add("is-open");
      });
      input.addEventListener("input", () => {
        const v = input.value.trim().toLowerCase();
        options.forEach((opt) => {
          const kw = opt.dataset.keywords || opt.dataset.value || "";
          opt.hidden = Boolean(v) && !kw.toLowerCase().includes(v);
        });
        combo.classList.add("is-open");
      });
      options.forEach((opt) => {
        opt.addEventListener("click", () => {
          input.value = opt.dataset.value || "";
          options.forEach((it) => it.classList.toggle("is-active", it === opt));
          combo.classList.remove("is-open");
        });
      });
    });

    const onDocClick = (event: MouseEvent) => {
      comboSelects.forEach((combo) => {
        if (!combo.contains(event.target as Node)) combo.classList.remove("is-open");
      });
      intentDropdowns.forEach((field) => {
        if (!field.contains(event.target as Node)) {
          field.classList.remove("is-open");
          field.querySelector(".intent-dropdown__trigger")?.setAttribute("aria-expanded", "false");
        }
      });
    };
    document.addEventListener("click", onDocClick);

    const saveBtns = document.querySelectorAll<HTMLButtonElement>("[data-save]");
    const onSave = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
      const btn = event.currentTarget as HTMLButtonElement;
      btn.classList.toggle("is-saved");
    };
    saveBtns.forEach((b) => b.addEventListener("click", onSave));

    const forms = document.querySelectorAll<HTMLFormElement>("[data-search-form]");
    const onSubmit = (e: Event) => {
      e.preventDefault();
      const form = e.currentTarget as HTMLFormElement;
      const sport = form.querySelector<HTMLInputElement>('input[name="sport"]')?.value.trim() || "";
      const location =
        form.querySelector<HTMLInputElement>('input[name="location"]')?.value.trim() || "";
      const params = new URLSearchParams();
      if (sport) params.set("sport", sport);
      if (location) params.set("location", location);
      params.set("audience", activeAudience);
      params.set("format", activeFormat);
      window.location.assign(`/search?${params.toString()}`);
    };
    forms.forEach((f) => f.addEventListener("submit", onSubmit));

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("click", onDocClick);
      dockObserver?.disconnect();
      document.body.classList.remove("is-search-docked");
    };
  }, []);

  const searchFields = (variant: "hero" | "header") => (
    <>
      {variant === "header" && (
        <>
          <div className="search-field intent-select combo-select" data-intent-dropdown="audience">
            <button
              className="intent-dropdown__trigger"
              type="button"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <span className="intent-dropdown__value">для себя</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="combo-menu" role="listbox" aria-label="Для кого">
              <button
                className="combo-option is-active"
                type="button"
                data-value="adult"
                data-label="для себя"
              >
                для себя
              </button>
              <button
                className="combo-option"
                type="button"
                data-value="child"
                data-label="для ребёнка"
              >
                для ребёнка
              </button>
            </div>
          </div>
          <div className="search-field intent-select combo-select" data-intent-dropdown="format">
            <button
              className="intent-dropdown__trigger"
              type="button"
              aria-haspopup="listbox"
              aria-expanded="false"
            >
              <span className="intent-dropdown__value">индивидуально</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div className="combo-menu" role="listbox" aria-label="Формат">
              <button
                className="combo-option is-active"
                type="button"
                data-value="individual"
                data-label="индивидуально"
              >
                индивидуально
              </button>
              <button
                className="combo-option"
                type="button"
                data-value="group"
                data-label="в группе"
              >
                в группе
              </button>
            </div>
          </div>
        </>
      )}
      <label className="search-field combo-select" data-combo="sport">
        <span className="search-icon">
          <svg viewBox="0 0 24 24">
            <path d="M5 19V5h14v14" />
            <path d="M8 16h8" />
            <path d="M8 12h8" />
            <path d="M8 8h4" />
          </svg>
        </span>
        <span className="field-label">Вид спорта</span>
        <input
          className="combo-input"
          type="search"
          name="sport"
          placeholder="Вид спорта"
          autoComplete="off"
        />
        <div className="combo-menu" role="listbox">
          {["Бокс", "Плавание", "Фитнес", "Йога", "Футбол", "Теннис"].map((s) => (
            <button
              key={s}
              className="combo-option"
              type="button"
              data-value={s}
              data-keywords={s.toLowerCase()}
            >
              {s}
            </button>
          ))}
        </div>
      </label>
      <label className="search-field combo-select" data-combo="location">
        <span className="search-icon">
          <svg viewBox="0 0 24 24">
            <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
            <circle cx="12" cy="9" r="2.4" />
          </svg>
        </span>
        <span className="field-label">Локация</span>
        <input
          className="combo-input"
          type="search"
          name="location"
          placeholder="Город или район"
          defaultValue="в Минске"
          autoComplete="off"
        />
        <div className="combo-menu" role="listbox">
          {["в Минске", "в Гомеле", "в Бресте", "в Витебске", "в Гродно", "в Могилёве"].map(
            (c, i) => (
              <button
                key={c}
                className={`combo-option${i === 0 ? " is-active" : ""}`}
                type="button"
                data-value={c}
                data-keywords={c.toLowerCase()}
              >
                {c}
              </button>
            ),
          )}
        </div>
      </label>
      <button className="search-submit" type="submit" aria-label="Найти">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="6.5" />
          <path d="M16 16l4 4" />
        </svg>
      </button>
    </>
  );

  return (
    <div className="trenio-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <SiteHeader
        middleSlot={
          <div className="search-block search-block--header">
            <form className="search-shell" data-search-form="header">
              {searchFields("header")}
            </form>
          </div>
        }
      />

      <section className="hero-top">
        <div className="hero-top-inner">
          <main className="hero-stack">
            <h1 className="hero-title">Я ищу тренера</h1>
            <div className="hero-search-zone">
              <div className="search-block search-block--hero">
                <div className="search-intent" aria-label="Тип поиска">
                  <div
                    className="search-intent__tabs"
                    style={{ display: "flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}
                  >
                    <span className="intent-group">
                      <span className="intent-label">Для:</span>
                      <button
                        className="audience-tab is-active"
                        type="button"
                        data-audience="adult"
                      >
                        для себя
                      </button>
                      <button className="audience-tab" type="button" data-audience="child">
                        для ребёнка
                      </button>
                    </span>
                    <span className="intent-group">
                      <span className="intent-label">Формат:</span>
                      <button
                        className="format-tab is-active"
                        type="button"
                        data-format="individual"
                      >
                        индивидуально
                      </button>
                      <button className="format-tab" type="button" data-format="group">
                        в группе
                      </button>
                    </span>
                  </div>
                </div>
                <form className="search-shell" data-search-form="hero">
                  {searchFields("hero")}
                </form>
              </div>
              <div className="search-dock-sentinel" id="search-dock-sentinel" aria-hidden="true" />
            </div>
          </main>
        </div>
        <section className="category-strip" aria-label="Категории спорта">
          <CategoryStrip />
        </section>
      </section>

      <section className="page-main layout-section--main">
        <div className="page-inner">
          <section className="content-section" aria-labelledby="trainers-heading">
            <div className="section-head">
              <div>
                <span className="section-eyebrow">Тренеры</span>
                <h2 className="section-title" id="trainers-heading">
                  Тренеры в Минске
                </h2>
              </div>
              <a className="section-link" href="#">
                Смотреть всех
              </a>
            </div>

            <div className="trainer-grid">
              {trainers.map((t) => (
                <Link
                  key={t.slug}
                  className="trainer-card"
                  to="/trainers/$slug"
                  params={{ slug: t.slug }}
                >
                  <div className="trainer-card__media">
                    <img
                      className="trainer-card__photo"
                      src={placeholder(t.name)}
                      alt={t.name}
                      width={480}
                      height={600}
                      loading="lazy"
                    />
                    {t.badge && <span className="trainer-card__badge">{t.badge}</span>}
                    <button
                      className="trainer-card__save"
                      type="button"
                      aria-label="Сохранить"
                      data-save
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z" />
                      </svg>
                    </button>
                  </div>
                  <div className="trainer-card__body">
                    <div className="trainer-card__head">
                      <h3 className="trainer-card__name">{t.name}</h3>
                      <span className="trainer-card__rating">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" />
                        </svg>
                        {t.rating} <span>({t.reviews})</span>
                      </span>
                    </div>
                    <p className="trainer-card__sport">{t.sport}</p>
                    <p className="trainer-card__desc">{t.desc}</p>
                    <div className="trainer-card__tags">
                      {t.tags.map((tag, i) => (
                        <span
                          key={tag}
                          className={`trainer-card__tag${i === 0 ? " trainer-card__tag--accent" : ""}`}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="trainer-card__footer">
                      <span className="trainer-card__location">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
                          <circle cx="12" cy="9" r="2.4" />
                        </svg>
                        <span>Минск</span>
                      </span>
                      <span className="trainer-card__price">
                        <small>от </small>
                        {t.price} BYN
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="content-section" aria-labelledby="popular-heading">
            <div className="section-head">
              <div>
                <span className="section-eyebrow">Каталог</span>
                <h2 className="section-title" id="popular-heading">
                  Категории спорта
                </h2>
              </div>
              <Link className="section-link" to="/categories/">
                Все категории
              </Link>
            </div>
            <PopularSlider />
          </section>

          <section className="content-section" aria-labelledby="how-heading">
            <div className="section-head section-head--stacked">
              <div>
                <span className="section-eyebrow">Как это работает</span>
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
              <div>
                <span className="section-eyebrow">Платформа</span>
                <h2 className="section-title" id="stats-heading">
                  trenio в цифрах
                </h2>
              </div>
            </div>
            <div className="stats-band">
              {[
                { n: "500+", l: "тренеров на платформе" },
                { n: "30+", l: "видов спорта" },
                { n: "12", l: "городов Беларуси" },
                { n: "4.9", l: "средняя оценка тренеров" },
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
                <span className="section-eyebrow">Отзывы</span>
                <h2 className="section-title" id="reviews-heading">
                  Что говорят клиенты
                </h2>
                <p className="section-sub">
                  Реальные истории людей, которые нашли своего тренера на trenio.by.
                </p>
              </div>
            </div>
            <div className="reviews-grid">
              {[
                {
                  text: "Искала тренера по плаванию для дочки — нашла за вечер. Очень удобно, что видно отзывы и цены сразу.",
                  name: "Анна К.",
                  role: "Минск · мама ученицы",
                },
                {
                  text: "Записался на бокс, тренер связался в тот же день. Через месяц уже видны результаты — техника пошла.",
                  name: "Дмитрий П.",
                  role: "Минск · новичок",
                },
                {
                  text: "Перешла к новому тренеру по йоге через trenio. Атмосфера и подход — то, что искала.",
                  name: "Ольга М.",
                  role: "Гомель · 2 года практики",
                },
              ].map((r) => (
                <article key={r.name} className="review-card">
                  <span className="review-card__stars" aria-label="5 из 5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <svg key={i} viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" />
                      </svg>
                    ))}
                  </span>
                  <p className="review-card__text">«{r.text}»</p>
                  <div className="review-card__author">
                    <img
                      className="review-card__avatar"
                      src={`https://placehold.co/88x88/fff5f5/c9343a?text=${encodeURIComponent(r.name.charAt(0))}`}
                      alt=""
                      width={44}
                      height={44}
                      loading="lazy"
                    />
                    <div className="review-card__meta">
                      <span className="review-card__name">{r.name}</span>
                      <span className="review-card__role">{r.role}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="content-section" aria-labelledby="cta-heading">
            <div className="cta-banner">
              <div className="cta-banner__content">
                <span className="section-eyebrow">Для тренеров</span>
                <h2 id="cta-heading">Вы тренер? Принимайте клиентов через trenio</h2>
                <p>
                  Создайте профиль за 5 минут и получайте обращения от заинтересованных учеников —
                  без комиссии за первый месяц.
                </p>
                <div className="cta-banner__actions">
                  <a className="cta-btn cta-btn--primary" href="#">
                    Стать тренером
                    <svg
                      viewBox="0 0 24 24"
                      width="16"
                      height="16"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </a>
                  <a className="cta-btn cta-btn--ghost" href="#">
                    Узнать о тарифах
                  </a>
                </div>
              </div>
              <div className="cta-banner__perks">
                {[
                  "Свой профиль с фото, ценами и расписанием",
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
                <span className="section-eyebrow">Вопросы</span>
                <h2 className="section-title" id="faq-heading">
                  Частые вопросы
                </h2>
                <p className="section-sub">
                  Если не нашли ответ — напишите нам, поможем разобраться.
                </p>
              </div>
            </div>
            <div className="faq-grid">
              {[
                {
                  q: "Сколько стоит занятие с тренером?",
                  a: "Цены зависят от вида спорта, опыта тренера и формата (индивидуально или в группе). В среднем — от 30 до 70 BYN за занятие в Минске.",
                },
                {
                  q: "Как оплачивать тренировки?",
                  a: "Оплата проходит напрямую тренеру — наличными, переводом или по реквизитам. Условия каждый специалист указывает в своём профиле.",
                },
                {
                  q: "Что, если тренер не подошёл?",
                  a: "Вы можете в любой момент сменить тренера — обязательств нет. После занятия можно оставить отзыв, чтобы помочь другим.",
                },
                {
                  q: "Безопасно ли заниматься с тренерами с платформы?",
                  a: "Мы проверяем профили перед публикацией, а рейтинги и отзывы реальных учеников помогают выбрать проверенного специалиста.",
                },
                {
                  q: "Можно ли найти тренера для ребёнка?",
                  a: "Да — в поиске есть фильтр «для ребёнка», а в карточках тренеров указано, с какими возрастами они работают.",
                },
              ].map((f) => (
                <details key={f.q} className="faq-item">
                  <summary>
                    {f.q}
                    <span className="faq-item__icon" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <div className="faq-item__body">{f.a}</div>
                </details>
              ))}
            </div>
          </section>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
