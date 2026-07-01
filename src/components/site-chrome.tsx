import { Link } from "@tanstack/react-router";
import { CategoryLink } from "@/lib/catalog/category-routes";
import { useEffect, useRef, useState, type ReactNode } from "react";

const CHROME_CSS = `
.site-header {
  position: sticky; top: 0; z-index: 300;
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
body.is-search-docked .site-header__inner { padding: 12px var(--layout-gutter); column-gap: 20px; }
.site-header__search {
  min-width: 0; overflow: hidden; opacity: 0; max-height: 0; pointer-events: none;
  display: flex; align-items: center; justify-content: center;
  transition: opacity 0.35s ease, max-height 0.4s ease;
}
body.is-search-docked .site-header__search {
  opacity: 1; max-height: 80px; overflow: visible; pointer-events: auto;
}
.logo {
  font-size: 32px; line-height: 1; font-weight: 900; letter-spacing: -0.045em;
  color: var(--dark); text-decoration: none; flex: 0 0 auto;
  display: inline-flex; align-items: baseline; gap: 1px;
}
.logo__mark { color: var(--primary); }
.logo__tld { color: var(--muted); font-weight: 700; letter-spacing: -0.03em; font-size: 0.7em; margin-left: 1px; }
.site-header .logo { font-size: 26px; }

.site-header__nav { display: flex; align-items: center; gap: 6px; }
.icon-btn {
  width: 42px; height: 42px; border-radius: 999px; border: 0;
  background: transparent; display: inline-grid; place-items: center;
  color: var(--dark); cursor: pointer;
  transition: color 0.18s ease, transform 0.18s ease;
  text-decoration: none;
}
.icon-btn:hover { background: transparent; color: var(--primary); transform: none; }
.icon-btn svg { width: 20px; height: 20px; stroke: currentColor; fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.icon-btn--help { font-size: 15px; font-weight: 800; letter-spacing: 0; }
.burger-btn { width: 42px; padding: 0; min-width: 0; }
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
  background: #fff; border-radius: 24px;
  box-shadow: 0 30px 80px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15,23,42,0.06);
  padding: 28px 32px 24px; opacity: 0; pointer-events: none;
  border: 1px solid rgba(var(--dark-rgb), 0.06);
  transition: opacity 0.28s cubic-bezier(0.4, 0, 0.2, 1), transform 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}
body.is-search-docked .mega-panel { top: 64px; }
.mega-panel.is-open { opacity: 1; transform: translate3d(-50%, 0, 0); pointer-events: auto; }
.mega-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr 1fr 1fr; gap: 28px; }
.mega-col h5 { margin: 0 0 12px; font-size: 11px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted); }
.mega-col ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
.mega-col a {
  color: var(--text); text-decoration: none; font-size: 14.5px; font-weight: 650;
  display: inline-flex; align-items: center; gap: 6px; transition: color 0.15s ease;
}
.mega-col a:hover { color: var(--primary); }
.mega-col__hero {
  grid-row: span 1; background: linear-gradient(135deg, rgba(var(--primary-rgb), 0.12), rgba(var(--primary-rgb), 0.04));
  border-radius: 18px; padding: 20px; border: 1px solid rgba(var(--primary-rgb), 0.18);
}
.mega-col__hero h4 { margin: 0 0 8px; font-size: 18px; font-weight: 900; letter-spacing: -0.02em; color: var(--dark); }
.mega-col__hero p { margin: 0 0 14px; font-size: 13px; line-height: 1.5; color: var(--text); }
.mega-col__hero a.cta { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 800; color: var(--primary); text-decoration: none; }
.mega-footer {
  margin-top: 22px; padding-top: 18px; border-top: 1px solid rgba(var(--dark-rgb), 0.07);
  display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
  font-size: 13px; color: var(--muted); font-weight: 600;
}
.mega-footer a { color: var(--text); text-decoration: none; font-weight: 700; margin-right: 16px; }
.mega-footer a:hover { color: var(--primary); }

.site-footer { background: var(--dark); color: #f2f2f2; padding: var(--layout-section-y) var(--layout-gutter) 28px; }
.site-footer__inner { max-width: var(--layout-max); margin: 0 auto; }
.site-footer__grid { display: grid; grid-template-columns: 1.4fr repeat(3, minmax(0, 1fr)); gap: 36px; padding-bottom: 40px; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
.site-footer__brand .logo { color: var(--primary); display: inline-block; margin-bottom: 14px; }
.site-footer__brand .logo__tld { color: rgba(255,255,255,0.55); }
.site-footer__tagline { margin: 0; max-width: 280px; color: rgba(255, 255, 255, 0.58); font-size: 14px; line-height: 1.55; font-weight: 500; }
.site-footer__col h4 { margin: 0 0 16px; font-size: 13px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: #fff; }
.site-footer__links { display: grid; gap: 10px; }
.site-footer__links a { color: rgba(255, 255, 255, 0.58); font-size: 14px; font-weight: 600; text-decoration: none; transition: color 0.2s ease; }
.site-footer__links a:hover { color: #fff; }
.site-footer__bottom { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding-top: 24px; color: rgba(255, 255, 255, 0.5); font-size: 13px; font-weight: 600; }
.site-footer__bottom a { color: rgba(255, 255, 255, 0.58); text-decoration: none; }
.site-footer__bottom a:hover { color: #fff; }

@media (max-width: 960px) {
  .site-header__inner { padding: 20px var(--layout-gutter); column-gap: 14px; }
  body.is-search-docked .site-header__inner { padding: 10px var(--layout-gutter); }
  .burger-btn__label { display: none; }
  .burger-btn { min-width: 0; width: 40px; padding: 0; }
  .mega-panel { top: 72px; padding: 22px; }
  .mega-grid { grid-template-columns: 1fr 1fr; gap: 22px; }
  .mega-col__hero { grid-column: 1 / -1; }
  .site-footer { padding: clamp(36px, 6vw, 44px) var(--layout-gutter) 24px; }
  .site-footer__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 28px; }
  .site-footer__brand { grid-column: 1 / -1; }
}
@media (max-width: 620px) {
  .logo, .site-header .logo { font-size: 24px; }
  .mega-grid { grid-template-columns: 1fr; }
  .site-footer__grid { grid-template-columns: 1fr; }
  .site-footer__bottom { flex-direction: column; align-items: flex-start; }
}
`;

function ChromeStyles() {
  return <style data-trenio-chrome dangerouslySetInnerHTML={{ __html: CHROME_CSS }} />;
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={className ?? "logo"} aria-label="trenio.by">
      <span className="logo__mark">tren</span>io<span className="logo__tld">.by</span>
    </Link>
  );
}

function MegaMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
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
              <li><CategoryLink route={{ parentSlug: "yoga-pilates-i-rastyazhka", childSlug: "yoga" }} onClick={onClose}>Йога</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "fitnes-i-trenirovki-v-zale" }} onClick={onClose}>Фитнес</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "plavanie-i-vodnye-trenirovki", childSlug: "plavanie" }} onClick={onClose}>Плавание</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "tennis-i-igry-s-raketkoy", childSlug: "bolshoj-tennis" }} onClick={onClose}>Теннис</CategoryLink></li>
              <li><CategoryLink route={{ parentSlug: "futbol-i-komandnye-igry", childSlug: "futbol" }} onClick={onClose}>Футбол</CategoryLink></li>
            </ul>
          </div>
          <div className="mega-col">
            <h5>Города</h5>
            <ul>
              <li><Link to="/" onClick={onClose}>Минск</Link></li>
              <li><Link to="/" onClick={onClose}>Гомель</Link></li>
              <li><Link to="/" onClick={onClose}>Брест</Link></li>
              <li><Link to="/" onClick={onClose}>Гродно</Link></li>
              <li><Link to="/" onClick={onClose}>Витебск</Link></li>
              <li><Link to="/" onClick={onClose}>Могилёв</Link></li>
            </ul>
          </div>
          <div className="mega-col">
            <h5>Клиентам</h5>
            <ul>
              <li><Link to="/" onClick={onClose}>Найти тренера</Link></li>
              <li><Link to="/clubs" onClick={onClose}>Клубы и залы</Link></li>
              <li><Link to="/blog/$slug" params={{ slug: "kak-vybrat-trenera" }} onClick={onClose}>Как выбрать тренера</Link></li>
              <li><Link to="/auth/signup" onClick={onClose}>Создать аккаунт</Link></li>
              <li><Link to="/auth/login" onClick={onClose}>Войти</Link></li>
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
            <Link to="/privacy" onClick={onClose}>Политика конфиденциальности</Link>
          </div>
          <span>© 2026 trenio.by</span>
        </div>
      </div>
    </>
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
    const onScroll = () => {
      el.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <ChromeStyles />
      <header className="site-header" id="site-header" ref={headerRef}>

        <div className="site-header__inner">
          <Logo />
          <div className="site-header__search">{middleSlot}</div>
          <nav className="site-header__nav" aria-label="Основное меню">
            <Link to="/" className="icon-btn icon-btn--help" aria-label="Помощь" title="Помощь">?</Link>
            <Link to="/auth/login" className="icon-btn" aria-label="Войти" title="Войти">
              <svg viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>
            </Link>
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
