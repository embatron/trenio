import { Link, useRouteContext } from "@tanstack/react-router";
import { useFavorites } from "@/components/favorites-store";
import { getCabinetPath } from "@/lib/auth/roles";
import { pluralRu } from "@/lib/ru-plural";
import { CategoryLink } from "@/lib/catalog/category-routes";
import { BELARUS_OBLAST_CENTERS } from "@/lib/catalog/city-taxonomy";
import { CatalogSearchForm } from "@/components/catalog-search-form";
import { useEffect, useRef, useState, type ReactNode } from "react";

const CHROME_CSS = `
.site-header {
  position: sticky; top: 0; z-index: 300;
  --form-audience-w: 131px;
  --form-format-w: 157px;
  --form-sport-w-header: 211px;
  --form-location-w-header: 147px;
  background: transparent;
  backdrop-filter: none; -webkit-backdrop-filter: none;
  transition: background-color 0.45s cubic-bezier(0.4, 0, 0.2, 1), backdrop-filter 0.45s ease, box-shadow 0.45s ease, border-color 0.45s ease;
  border-bottom: 1px solid transparent;
}
body.is-search-docked .site-header,
.site-header.is-scrolled {
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(18px) saturate(160%); -webkit-backdrop-filter: blur(18px) saturate(160%);
  box-shadow: 0 1px 0 rgba(var(--dark-rgb), 0.04), 0 8px 28px rgba(var(--dark-rgb), 0.05);
  border-bottom-color: rgba(var(--dark-rgb), 0.06);
}

.site-header__inner {
  width: 100%; max-width: var(--layout-max); margin: 0 auto; padding: 24px var(--layout-gutter);
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; column-gap: 28px;
  transition: padding 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
body.is-search-docked .site-header__inner { padding: 12px var(--layout-gutter); column-gap: 10px; }
.site-header__search {
  min-width: 0; overflow: hidden; opacity: 0; max-height: 0; pointer-events: none;
  display: flex; align-items: center; justify-content: flex-start;
  transition: opacity 0.35s ease, max-height 0.4s ease;
}
body.is-search-docked .site-header__search {
  opacity: 1; max-height: 80px; overflow: visible; pointer-events: auto;
}
.search-block--header { width: min(100%, 700px); max-width: 100%; min-width: 0; }
.search-block--header .search-shell {
  width: 100%; max-width: 100%; min-width: 0; min-height: 52px; padding: 4px 5px;
  background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.08); border-radius: 999px;
  box-shadow: 0 4px 18px rgba(var(--dark-rgb), 0.06);
  display: grid; grid-template-columns: minmax(0, 131fr) minmax(0, 157fr) minmax(0, 211fr) minmax(0, 147fr) 44px;
  align-items: center; gap: 0; text-align: left;
}
.search-block--header .search-field { min-width: 0; height: 44px; display: flex; align-items: center; gap: 7px; padding: 0 11px; }
.search-block--header .search-field.intent-select { position: relative; }
.search-block--header .search-field + .search-field { border-left: 1px solid var(--line); }
.search-block--header .search-icon { flex: 0 0 auto; display: grid; place-items: center; color: var(--muted); }
.search-block--header .search-icon svg,
.search-block--header .intent-dropdown__trigger svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.search-block--header .intent-dropdown__trigger {
  display: inline-flex; align-items: center; justify-content: space-between; gap: 7px;
  width: 100%; min-width: 0; min-height: 37px; padding: 0; border: 0; background: transparent;
  color: var(--text); font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; overflow: hidden;
}
.search-block--header .intent-dropdown__value { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.search-block--header .intent-dropdown__trigger svg { color: var(--muted); flex: 0 0 auto; }
.search-block--header .field-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.search-block--header .combo-select { position: relative; min-width: 0; }
.search-block--header .combo-input {
  width: 100%; min-width: 0; border: 0; outline: 0; padding: 0; background: transparent;
  color: var(--text); font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.search-block--header .combo-input::placeholder { color: var(--muted); }
.search-block--header .combo-menu {
  position: absolute; z-index: 5; top: calc(100% + 11px); left: 7px; right: 7px;
  min-width: 219px; padding: 6px; border: 1px solid rgba(var(--dark-rgb), 0.08);
  border-radius: var(--card-radius); background: var(--white); box-shadow: 0 18px 46px rgba(var(--dark-rgb), 0.13); display: none;
}
.search-block--header .combo-select.is-open .combo-menu { display: grid; gap: 1px; }
.search-block--header .combo-select[data-combo="location"] .combo-menu { max-height: 320px; overflow-y: auto; }
.search-block--header .combo-option {
  border: 0; width: 100%; min-height: 44px; padding: 0 12px; border-radius: var(--radius-control);
  background: transparent; color: var(--text); cursor: pointer; font-size: 14px; font-weight: var(--fw-title); text-align: left;
}
.search-block--header .combo-option:hover,
.search-block--header .combo-option.is-active { background: var(--light-bg); color: var(--primary-dark); }
.search-block--header .search-submit {
  width: 44px; height: 44px; border: 0; border-radius: 50%; background: var(--primary); color: #fff;
  cursor: pointer; display: grid; place-items: center;
}
.search-block--header .search-submit svg { width: 17px; height: 17px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.logo {
  display: inline-flex; align-items: center; justify-content: flex-start;
  min-height: 44px; flex: 0 0 auto; line-height: 0; text-decoration: none;
}
.logo__img { display: block; height: 28px; width: auto; }
.logo__img--on-dark, .logo__img--knockout { display: none; }
.site-header .logo__img { height: 26px; }
.site-footer__brand .logo__img--color,
.site-footer__brand .logo__img--knockout { display: none; }
.site-footer__brand .logo__img--on-dark { display: block; }
.site-header__nav { display: flex; align-items: center; gap: 6px; }
.icon-btn {
  width: 44px; height: 44px; border-radius: 999px; border: 0;
  background: transparent; display: inline-grid; place-items: center;
  color: var(--dark); cursor: pointer;
  transition: color 0.18s ease, transform 0.18s ease;
  text-decoration: none;
}
.icon-btn:hover { background: transparent; color: var(--primary); transform: none; }
.icon-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.favorite-count { position: relative; width: 44px; height: 44px; }
.favorite-count__n {
  position: absolute; top: 2px; right: 0; min-width: 16px; height: 16px; padding: 0 4px;
  border-radius: 999px; background: var(--primary); color: #fff;
  font-size: 10px; font-weight: var(--fw-title); line-height: 16px; text-align: center;
}
.favorite-count.has-items { color: var(--primary); }
.favorite-count.has-items svg { fill: currentColor; }
.icon-btn--help { font-size: 15px; font-weight: var(--fw-title); letter-spacing: 0; }
.burger-btn { width: 44px; padding: 0; min-width: 0; }
.burger-btn__bars { display: inline-flex; flex-direction: column; gap: 5px; }
.burger-btn__bars span { width: 20px; height: 2px; background: currentColor; border-radius: 2px; transition: transform 0.2s ease, opacity 0.2s ease; }
.burger-btn[aria-expanded="true"] .burger-btn__bars span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.burger-btn[aria-expanded="true"] .burger-btn__bars span:nth-child(2) { opacity: 0; }
.burger-btn[aria-expanded="true"] .burger-btn__bars span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
.burger-btn__label { display: none; }


.mega-overlay {
  position: fixed; inset: 0; z-index: 290; background: rgba(15, 23, 42, 0.32);
  backdrop-filter: blur(2px); opacity: 0; pointer-events: none;
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.mega-overlay.is-open { opacity: 1; pointer-events: auto; }
.mega-panel {
  position: fixed; left: 50%; top: 84px; z-index: 295;
  width: min(var(--layout-max), calc(100vw - 2 * var(--layout-gutter)));
  transform: translate3d(-50%, -6px, 0);
  transform-origin: top center;
  background: #fff; border-radius: var(--card-radius);
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15,23,42,0.06);
  padding: 28px 32px 24px; opacity: 0; pointer-events: none;
  border: 1px solid rgba(var(--dark-rgb), 0.06);
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}
body.is-search-docked .mega-panel { top: 64px; }
.mega-panel.is-open { opacity: 1; transform: translate3d(-50%, 0, 0); pointer-events: auto; }
.mega-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr; gap: 28px; }
.mega-col h5 { margin: 0 0 12px; font-size: 11px; font-weight: var(--fw-title); letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.mega-col ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.mega-col a {
  color: var(--text); text-decoration: none; font-size: 14.5px; font-weight: var(--fw-title);
  display: inline-flex; align-items: center; gap: 6px; transition: color 0.15s ease;
}
.mega-col a:hover { color: var(--primary); }
.mega-col__hero {
  grid-row: span 1; background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.12), rgba(var(--primary-rgb), 0.04));
  border-radius: var(--card-radius); padding: 20px; border: 1px solid rgba(var(--primary-rgb), 0.18);
}
.mega-col__hero h4 { margin: 0 0 8px; font-size: 18px; font-weight: var(--fw-heading); letter-spacing: -0.02em; color: var(--dark); }
.mega-col__hero p { margin: 0 0 14px; font-size: 13px; line-height: 1.5; color: var(--text); }
.mega-col__hero a.cta { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: var(--fw-title); color: var(--primary); text-decoration: none; }
.mega-footer {
  margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(var(--dark-rgb), 0.07);
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  font-size: 13px; color: var(--muted); font-weight: var(--fw-ui);
}
.mega-footer a { color: var(--text); text-decoration: none; font-weight: var(--fw-heading); margin-right: 16px; }
.mega-footer a:hover { color: var(--primary); }

.site-footer { background: var(--dark); color: #f2f2f2; padding: var(--layout-section-y) 0 28px; }
.site-footer__inner { max-width: var(--layout-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.site-footer__grid { display: grid; grid-template-columns: minmax(0, 1.4fr) repeat(3, minmax(0, 1fr)); gap: var(--layout-gap); padding-bottom: 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.site-footer__brand .logo { display: inline-flex; margin-bottom: 14px; min-height: 0; }
.site-footer__brand .logo__img { height: 30px; }
.site-footer__tagline { margin: 0; max-width: 280px; color: rgba(255, 255, 255, 0.58); font-size: 14px; line-height: 1.55; font-weight: 500; }
.site-footer__col h4 { margin: 0 0 16px; font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.06em; text-transform: uppercase; color: #fff; }
.site-footer__links { display: grid; gap: 10px; }
.site-footer__links a { color: rgba(255, 255, 255, 0.58); font-size: 14px; font-weight: var(--fw-ui); text-decoration: none; transition: color 0.2s ease; }
.site-footer__links a:hover { color: #fff; }
.site-footer__bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 24px; color: rgba(255, 255, 255, 0.5); font-size: 13px; font-weight: var(--fw-ui); }
.site-footer__bottom a { color: rgba(255, 255, 255, 0.58); text-decoration: none; }
.site-footer__bottom a:hover { color: #fff; }

@media (max-width: 1000px) {
  body.is-search-docked .site-header__inner {
    grid-template-columns: auto minmax(0, 1fr);
    row-gap: 8px;
  }
  body.is-search-docked .site-header__inner > .logo { grid-column: 1; grid-row: 1; }
  body.is-search-docked .site-header__nav { grid-column: 2; grid-row: 1; justify-self: end; }
  body.is-search-docked .site-header__search {
    grid-column: 1 / -1;
    grid-row: 2;
    max-height: 64px;
  }
  .search-block--header { width: min(100%, 700px); }
  body.is-search-docked .mega-panel { top: 112px; }
}
@media (max-width: 960px) {
  .site-header__inner { padding: 20px var(--layout-gutter); column-gap: 10px; }
  body.is-search-docked .site-header__inner { padding: 10px var(--layout-gutter); column-gap: 8px; }
  .burger-btn__label { display: none; }
  .burger-btn { min-width: 0; width: 44px; padding: 0; }
  .mega-panel { top: 72px; padding: 22px; }
  .mega-grid { grid-template-columns: 1fr 1fr; gap: 22px; }
  .mega-col__hero { grid-column: 1 / -1; }
  .site-footer { padding-block: clamp(36px, 6vw, 44px) 24px; }
  .site-footer__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
  .site-footer__brand { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  body.is-search-docked .site-header__search { max-height: 108px; }
  .search-block--header, .search-block--header .search-shell { width: 100%; }
  .search-block--header .search-shell {
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.4fr) 37px;
    grid-template-rows: 37px 37px;
    min-height: 0;
    row-gap: 0;
  }
  .search-block--header .search-field[data-intent-dropdown="audience"] { grid-column: 1; grid-row: 1; border-left: 0; }
  .search-block--header .search-field[data-intent-dropdown="format"] { grid-column: 2; grid-row: 1; }
  .search-block--header .search-field[data-combo="sport"] { grid-column: 1; grid-row: 2; border-left: 0; border-top: 1px solid var(--line); }
  .search-block--header .search-field[data-combo="location"] { grid-column: 2; grid-row: 2; border-top: 1px solid var(--line); }
  .search-block--header .search-submit { grid-column: 3; grid-row: 1 / span 2; align-self: center; }
  body.is-search-docked .mega-panel { top: 148px; }
}
@media (max-width: 767px) {
  .site-header__inner,
  body.is-search-docked .site-header__inner {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
  }
  .site-header__nav,
  body.is-search-docked .site-header__nav {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }
  .site-header__search,
  body.is-search-docked .site-header__search { display: none; }
  body.is-search-docked .mega-panel { top: 72px; }
}
@media (max-width: 620px) {
  .search-block--header .search-field { padding-inline: 7px; }
  .logo__img, .site-header .logo__img { height: 22px; }
  .site-footer__brand .logo__img { height: 26px; }
  .mega-grid { grid-template-columns: 1fr; }
  .site-footer__grid { grid-template-columns: 1fr; }
  .site-footer__bottom { flex-direction: column; align-items: flex-start; }
}
`;

function ChromeStyles() {
  return <style data-trenio-chrome dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />;
}

export function Logo({ className }: { className?: string }) {
  const frame = { width: 503, height: 128, alt: "", decoding: "async" as const };
  return (
    <Link to="/" className={className ?? "logo"} aria-label="trenio.by">
      <img {...frame} className="logo__img logo__img--color" src="/logo.webp" />
      <img {...frame} className="logo__img logo__img--on-dark" src="/logo-on-dark.webp" />
      <img {...frame} className="logo__img logo__img--knockout" src="/logo-knockout.webp" />
    </Link>
  );
}

function AccountButton() {
  const { user } = useRouteContext({ from: "__root__" });
  if (!user) {
    return (
      <Link to="/auth/login" className="icon-btn" aria-label="Войти" title="Войти">
        <svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
      </Link>
    );
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return (
    <Link to={getCabinetPath(user.roles)} className="icon-btn" aria-label={`${name}, вы вошли`} title={name}>
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.2"/><path d="M5.5 19.2c1.2-2.6 3.5-3.8 6.5-3.8s5.3 1.2 6.5 3.8"/></svg>
    </Link>
  );
}

function MegaMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useRouteContext({ from: "__root__" });
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`mega-overlay${open ? " is-open" : ""}`} onClick={onClose} aria-hidden={!open} />
      <div className={`mega-panel${open ? " is-open" : ""}`} role="dialog" aria-modal="true" aria-label="Меню">
        <div className="mega-grid">
          <div className="mega-col mega-col__hero">
            <h4>Стать тренером на trenio.by</h4>
            <p>Бесплатный профиль, заявки от клиентов и расписание — всё в одном месте.</p>
            <Link to="/auth/signup" className="cta" onClick={onClose}>Создать профиль →</Link>
          </div>
          <div className="mega-col">
            <h5>Виды спорта</h5>
            <ul>
              <li><CategoryLink route={{ parentSlug: "edinoborstva", childSlug: "boks" }} onClick={onClose}>Бокс</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "edinoborstva" }} onClick={onClose}>Единоборства</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "yoga", childSlug: "yoga" }} onClick={onClose}>Йога</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "fitnes" }} onClick={onClose}>Фитнес</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "plavanie", childSlug: "plavanie" }} onClick={onClose}>Плавание</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "raketki", childSlug: "bolshoj-tennis" }} onClick={onClose}>Теннис</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "komandnye", childSlug: "futbol" }} onClick={onClose}>Футбол</CategoryLink></li>
            </ul>
          </div>
          <div className="mega-col">
            <h5>Города</h5>
            <ul>
              {BELARUS_OBLAST_CENTERS.map((city) => (
                <li key={city}><Link to="/" onClick={onClose}>{city}</Link></li>
              ))}
            </ul>
          </div>
          <div className="mega-col">
            <h5>Клиентам</h5>
            <ul>
              <li><Link to="/" onClick={onClose}>Найти тренера</Link></li>
              <li><Link to="/clubs" onClick={onClose}>Клубы и залы</Link></li>
              <li><Link to="/blog/$slug" params={{ slug: "kak-vybrat-trenera" }} onClick={onClose}>Как выбрать тренера</Link></li>
              <li><Link to="/auth/signup" onClick={onClose}>Создать аккаунт</Link></li>
              {user ? (
                <li><Link to={getCabinetPath(user.roles)} onClick={onClose}>{user.firstName}</Link></li>
              ) : (
                <li><Link to="/auth/login" onClick={onClose}>Войти</Link></li>
              )}
            </ul>
          </div>
          <div className="mega-col">
            <h5>Тренерам и клубам</h5>
            <ul>
              <li><Link to="/trainer-admin" onClick={onClose}>Кабинет тренера</Link></li>
              <li><Link to="/auth/signup" onClick={onClose}>Разместить профиль</Link></li>
              <li><Link to="/" onClick={onClose}>Тарифы и продвижение</Link></li>
              <li><Link to="/" onClick={onClose}>Помощь и FAQ</Link></li>
            </ul>
          </div>
        </div>
        <div className="mega-footer">
          <div>
            <Link to="/" onClick={onClose}>О сервисе</Link>
            <Link to="/" onClick={onClose}>Контакты</Link>
            <Link to="/offer" onClick={onClose}>Договор оферты</Link>
            <Link to="/privacy" onClick={onClose}>Политика конфиденциальности</Link>
          </div>
          <span>© 2026 trenio.by</span>
        </div>
      </div>
    </>
  );
}

function FavoriteCount() {
  const { user } = useRouteContext({ from: "__root__" });
  const { keys, ready } = useFavorites();
  if (!user) return null;
  const count = keys.length;
  const label = ready
    ? `Избранное, ${count} ${pluralRu(count, "карточка", "карточки", "карточек")}`
    : "Избранное";
  return (
    <Link
      to="/account/favorites"
      className={`icon-btn favorite-count${ready && count > 0 ? " has-items" : ""}`}
      aria-label={label}
      title="Избранное"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z" />
      </svg>
      {ready ? <span className="favorite-count__n">{count}</span> : null}
    </Link>
  );
}

export function SiteHeader({ middleSlot }: { middleSlot?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const sentinel = document.getElementById("search-dock-sentinel");
    let observer: IntersectionObserver | null = null;

    const onScroll = () => {
      const scrolled = window.scrollY > 8;
      el.classList.toggle("is-scrolled", scrolled);
      if (!sentinel) document.body.classList.toggle("is-search-docked", scrolled);
    };

    if (sentinel) {
      observer = new IntersectionObserver(
        ([entry]) => {
          document.body.classList.toggle("is-search-docked", !entry.isIntersecting);
        },
        { root: null, rootMargin: `-${el.getBoundingClientRect().height}px 0px 0px 0px`, threshold: 0 },
      );
      observer.observe(sentinel);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer?.disconnect();
      if (!sentinel) document.body.classList.remove("is-search-docked");
    };
  }, []);

  return (
    <>
      <ChromeStyles />
      <header className="site-header" id="site-header" ref={headerRef}>

        <div className="site-header__inner">
          <Logo />
          <div className="site-header__search">{middleSlot ?? <CatalogSearchForm variant="header" />}</div>
          <nav className="site-header__nav" aria-label="Основное меню">
            <Link to="/" className="icon-btn icon-btn--help" aria-label="Помощь" title="Помощь">?</Link>
            <FavoriteCount />
            <AccountButton />
            <button
              ref={btnRef}
              type="button"
              className="icon-btn burger-btn"
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              aria-label="Открыть меню"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className="burger-btn__bars" aria-hidden="true"><span/><span/><span/></span>
            </button>

          </nav>
        </div>
      </header>
      <MegaMenu open={menuOpen} onClose={close} />
    </>
  );
}

export function SiteFooter() {
  return (
    <>
      <ChromeStyles />
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__grid">
            <div className="site-footer__brand">
              <Logo />
              <p className="site-footer__tagline">Поиск тренеров и спортивных занятий в Беларуси — индивидуально и в группе.</p>
            </div>
            <div className="site-footer__col">
              <h4>Поиск</h4>
              <div className="site-footer__links">
                <Link to="/">Тренеры</Link>
                <Link to="/clubs">Клубы</Link>
                <Link to="/categories/">Категории</Link>
              </div>
            </div>
            <div className="site-footer__col">
              <h4>Тренерам</h4>
              <div className="site-footer__links">
                <Link to="/auth/signup">Добавить профиль</Link>
                <Link to="/trainer-admin">Кабинет тренера</Link>
                <a href="#">Помощь</a>
              </div>
            </div>
            <div className="site-footer__col">
              <h4>Компания</h4>
              <div className="site-footer__links">
                <a href="#">О сервисе</a>
                <a href="#">Контакты</a>
                <Link to="/offer">Договор оферты</Link>
                <Link to="/privacy">Политика конфиденциальности</Link>
              </div>
            </div>
          </div>
          <div className="site-footer__bottom">
            <span>© 2026 trenio.by</span>
            <a href="mailto:hello@trenio.by">hello@trenio.by</a>
          </div>
        </div>
      </footer>
    </>
  );
}
