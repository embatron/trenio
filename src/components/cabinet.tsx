import { Link } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TrainerName } from "@/components/trainer-name";
import { UserAvatar } from "@/components/user-avatar";
import { joinTrainerName } from "@/lib/catalog/trainer-name";

const ICONS = {
  overview: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  trainers: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  reviews: "M5 6h14v9H8l-3 3V6z",
  accounts: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
  profile: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  favorites: "M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z",
  bookings: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  finance: "M4 5h16v14H4zM4 9h16M8 13h5",
  messages: "M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM4 6l8 6 8-6",
} as const;

export type CabinetIcon = keyof typeof ICONS;

export const REVIEW_STATUS_LABEL = {
  pending: "На модерации",
  published: "Опубликован",
  rejected: "Отклонён",
} as const;

export function ReviewStatus({
  status,
  onClick,
}: {
  status: keyof typeof REVIEW_STATUS_LABEL;
  onClick?: () => void;
}) {
  const className = `cabinet-status cabinet-status--${status}`;
  if (!onClick) return <span className={className}>{REVIEW_STATUS_LABEL[status]}</span>;
  return (
    <button type="button" className={className} onClick={onClick} aria-haspopup="dialog">
      {REVIEW_STATUS_LABEL[status]}
    </button>
  );
}

export function CabinetNotice({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cabinet-modal" onClick={onClose}>
      <div className="cabinet-modal__card" role="dialog" aria-modal="true" aria-labelledby="cabinet-notice-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="cabinet-notice-title">{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </div>
  );
}

export type AccountSectionPath = "/account/reviews" | "/account/bookings" | "/account/favorites" | "/account/settings" | "/account/messages";

export type AdminSectionPath =
  | "/admin"
  | "/admin/trainers"
  | "/admin/reviews"
  | "/admin/messages"
  | "/admin/accounts"
  | "/admin/finance"
  | "/admin/settings";

export type TrainerSectionPath = "/trainer-admin" | "/trainer-admin/messages";

export type MeSectionPath =
  | "/me"
  | "/me/messages"
  | "/me/reviews"
  | "/me/favorites"
  | "/me/profile"
  | "/me/settings";

export type CabinetSectionLink = {
  id: string;
  label: string;
};

export type CabinetNavItem = {
  id: string;
  label: string;
  icon: CabinetIcon;
  badge?: number;
  to?: AccountSectionPath | AdminSectionPath | TrainerSectionPath | MeSectionPath;
  search?: { tab: "overview" | "settings" | "card" | "reviews" };
  sections?: readonly CabinetSectionLink[];
};

export function CabinetShell({
  title,
  lede,
  firstName,
  lastName,
  role,
  items,
  active,
  onSelect,
  avatarUrl,
  profileSlug,
  onLogout,
  logoutPending,
  children,
}: {
  title: string;
  lede?: string;
  firstName: string;
  lastName?: string | null;
  role: string;
  avatarUrl?: string | null;
  profileSlug?: string | null;
  items: CabinetNavItem[];
  active: string;
  onSelect?: (id: string) => void;
  onLogout: () => void;
  logoutPending: boolean;
  children: ReactNode;
}) {
  const name = joinTrainerName(firstName, lastName) || "Без имени";
  const publicSlug = profileSlug?.trim() || "";
  const identity = <TrainerName firstName={firstName} lastName={lastName} empty="Без имени" />;
  const navRef = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const header = document.getElementById("site-header");
    const side = sideRef.current;
    if (!header || !side) return;
    const root = document.documentElement;
    const apply = () => {
      const headerH = Math.ceil(header.getBoundingClientRect().height);
      root.style.setProperty("--cabinet-sticky-top", `${headerH}px`);
      root.style.setProperty("--cabinet-side-h", `${Math.ceil(side.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    observer.observe(side);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--cabinet-sticky-top");
      root.style.removeProperty("--cabinet-side-h");
    };
  }, []);
  const sectionKey = items.find((item) => item.id === active)?.sections?.map((section) => section.id).join("|") ?? "";
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const subRef = useRef<HTMLDivElement>(null);
  const spyPause = useRef(0);
  useEffect(() => {
    navRef.current?.querySelector(".is-active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);
  useEffect(() => {
    const ids = sectionKey ? sectionKey.split("|") : [];
    setCurrentSection(ids[0] ?? null);
    const nodes = ids
      .map((id) => document.getElementById(id))
      .filter((node): node is HTMLElement => node != null);
    if (nodes.length === 0) return;
    const seen = new Set<string>();
    const observer = new IntersectionObserver((entries) => {
      if (spyPause.current) return;
      for (const entry of entries) {
        if (entry.isIntersecting) seen.add(entry.target.id);
        else seen.delete(entry.target.id);
      }
      const next = ids.find((id) => seen.has(id));
      if (next) setCurrentSection(next);
    }, { rootMargin: "-18% 0px -55% 0px", threshold: [0, 0.25] });
    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, [sectionKey]);
  useLayoutEffect(() => {
    const root = subRef.current;
    const mark = root?.querySelector<HTMLElement>(".cabinet-nav__mark");
    const link = root?.querySelector<HTMLElement>(".is-current");
    if (!root || !mark || !link) return;
    mark.style.width = `${link.offsetWidth}px`;
    mark.style.height = `${link.offsetHeight}px`;
    mark.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
  }, [currentSection, sectionKey]);
  function moveToSection(id: string) {
    const target = document.getElementById(id);
    if (!target) return;
    setCurrentSection(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const narrow = window.matchMedia("(max-width: 960px)").matches;
    const header = document.getElementById("site-header");
    const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 96;
    const sideH = narrow && sideRef.current ? Math.ceil(sideRef.current.getBoundingClientRect().height) : 0;
    const top = Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerH - sideH - 16);
    const token = ++spyPause.current;
    const release = () => {
      window.setTimeout(() => {
        if (spyPause.current === token) spyPause.current = 0;
      }, 80);
    };
    if (header && top > 8) {
      header.classList.add("is-scrolled");
      if (!document.getElementById("search-dock-sentinel")) document.body.classList.add("is-search-docked");
    }
    if (reduce || Math.abs(top - window.scrollY) < 2) {
      window.scrollTo(0, top);
      release();
      return;
    }
    window.scrollTo({ top, behavior: "smooth" });
    let timer = 0;
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        window.removeEventListener("scroll", onScroll);
        release();
      }, 120);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  return (
    <>
      <SiteHeader />
      <main>
        <div className="layout-with-sidebar">
          <header className="cabinet-head">
            <h1>{title}</h1>
            {lede ? <p>{lede}</p> : null}
          </header>
          <aside className="cabinet-side" ref={sideRef}>
            <div className="cabinet-id">
              <UserAvatar name={name} src={avatarUrl} size={44} />
              <div>
                <strong>
                  {publicSlug ? (
                    <Link className="cabinet-id__name" to="/trainers/$slug" params={{ slug: publicSlug }}>
                      {identity}
                    </Link>
                  ) : identity}
                </strong>
                <span>{role}</span>
              </div>
            </div>
            <nav
              className="cabinet-nav"
              aria-label="Разделы кабинета"
              style={sectionKey ? { ["--nav-sub-row" as string]: String(items.findIndex((item) => item.id === active) + 2) } : undefined}
            >
              <div className="cabinet-nav__items" ref={navRef}>
                {items.map((item) => {
                  const className = item.id === active ? "is-active" : undefined;
                  const icon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[item.icon]} /></svg>;
                  const badge = typeof item.badge === "number" ? (
                    <span className={`cabinet-nav__badge${item.badge > 0 ? " is-hot" : ""}`}>{item.badge > 99 ? "99+" : item.badge}</span>
                  ) : null;
                  if (item.to === "/trainer-admin") {
                    return (
                      <Link key={item.id} to="/trainer-admin" search={item.search ?? {}} className={className} aria-current={item.id === active ? "page" : undefined}>
                        {icon}
                        <span className="cabinet-nav__label">{item.label}</span>
                        {badge}
                      </Link>
                    );
                  }
                  if (item.to) {
                    return (
                      <Link key={item.id} to={item.to} activeOptions={item.to === "/me" || item.to === "/admin" ? { exact: true } : undefined} className={className} aria-current={item.id === active ? "page" : undefined}>
                        {icon}
                        <span className="cabinet-nav__label">{item.label}</span>
                        {badge}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={className}
                      aria-current={item.id === active ? "page" : undefined}
                      onClick={() => onSelect?.(item.id)}
                    >
                      {icon}
                      <span className="cabinet-nav__label">{item.label}</span>
                      {badge}
                    </button>
                  );
                })}
              </div>
              {sectionKey ? (
                <div className="cabinet-nav__sub" aria-label="Разделы профиля" ref={subRef}>
                  <span className="cabinet-nav__mark" aria-hidden="true" />
                  {items.find((item) => item.id === active)?.sections?.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      className={section.id === currentSection ? "is-current" : undefined}
                      aria-current={section.id === currentSection ? "location" : undefined}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={(event) => {
                        event.preventDefault();
                        event.currentTarget.focus({ preventScroll: true });
                        moveToSection(section.id);
                      }}
                    >
                      {section.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </nav>
            <button type="button" className="cabinet-logout" onClick={onLogout} disabled={logoutPending}>
              {logoutPending ? "Выход…" : "Выйти"}
            </button>
          </aside>
          <section className="cabinet-main">{children}</section>
        </div>
      </main>
      <SiteFooter />
      <style>{CABINET_CSS}</style>
    </>
  );
}

const CABINET_CSS = `
.cabinet-head { grid-column: 1 / -1; }
.cabinet-head h1 { margin: 0 0 6px; font-size: var(--fs-page); letter-spacing: var(--tracking-heading); font-weight: var(--fw-heading); color: var(--dark); }
.cabinet-head p { margin: 0; color: var(--muted); font-size: 15px; }
.cabinet-side {
  display: grid; gap: 14px; align-content: start; align-self: start;
  position: sticky; top: var(--cabinet-sticky-top, 96px); z-index: 20;
  max-height: calc(100dvh - var(--cabinet-sticky-top, 96px) - 16px); overflow: auto;
  padding: 16px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white);
}
.cabinet-id { display: flex; align-items: center; gap: 12px; }
.cabinet-id > div { min-width: 0; }
.cabinet-id__mark { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); font-weight: var(--fw-title); object-fit: cover; }
.cabinet-id strong { display: block; min-width: 0; color: var(--dark); }
.cabinet-id strong .trainer-name { flex-wrap: nowrap; }
.cabinet-id strong .trainer-name__line { color: var(--dark); font-size: inherit; margin: 0; }
.cabinet-id__name { display: block; margin: 0; padding: 0; color: inherit; line-height: 1.15; text-decoration: none; }
.cabinet-id__name:hover .trainer-name__line { color: var(--primary); }
.cabinet-id span { color: var(--muted); font-size: 13px; }
.cabinet-nav { display: flex; flex-direction: column; gap: 4px; }
.cabinet-nav__items { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cabinet-nav__sub { position: relative; display: grid; gap: 2px; margin: 0 0 4px 18px; padding-left: 10px; border-left: 2px solid rgba(var(--primary-rgb), 0.35); }
.cabinet-nav__mark { position: absolute; left: 0; top: 0; border-radius: var(--radius-control); background: rgba(var(--primary-rgb), 0.1); pointer-events: none; z-index: 0; transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), width 0.42s cubic-bezier(0.22, 1, 0.36, 1), height 0.42s cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .cabinet-nav__mark { transition: none; }
}
@media (min-width: 961px) {
  .cabinet-nav:has(.cabinet-nav__sub) { display: grid; }
  .cabinet-nav:has(.cabinet-nav__sub) .cabinet-nav__items { display: contents; }
  .cabinet-nav__sub { grid-row: var(--nav-sub-row); margin-left: 18px; }
}
.cabinet-nav__sub a { position: relative; z-index: 1; color: var(--muted); font-size: 14px; font-weight: var(--fw-ui); transition: color 0.28s ease; }
.cabinet-nav__sub a.is-current { background: transparent; color: var(--primary); }
.cabinet-nav button, .cabinet-nav a, .cabinet-logout {
  min-height: 44px; border: 0; border-radius: var(--radius-control); background: transparent;
  display: flex; align-items: center; gap: 10px; padding: 0 12px; color: var(--text);
  font: inherit; font-weight: var(--fw-title); text-align: left; text-decoration: none; cursor: pointer;
}
.cabinet-nav button svg, .cabinet-nav a svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
.cabinet-nav__label { min-width: 0; }
.cabinet-nav__badge { margin-left: auto; min-width: 1.5em; color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); font-variant-numeric: tabular-nums; line-height: 1; text-align: right; }
.cabinet-nav__badge.is-hot { color: var(--primary); }
.cabinet-nav button.is-active, .cabinet-nav a.is-active { background: rgba(var(--primary-rgb), 0.1); color: var(--primary-dark); }
.cabinet-nav button:hover, .cabinet-nav a:hover, .cabinet-logout:hover { background: rgba(var(--dark-rgb), 0.04); }
.cabinet-nav__sub a { color: var(--muted); font-weight: var(--fw-ui); }
.cabinet-nav__sub a.is-current { background: transparent; color: var(--primary); }
.cabinet-logout { color: var(--muted); justify-content: center; }
.cabinet-main { display: grid; gap: 16px; min-width: 0; overflow-x: clip; }
@keyframes profile-card-in {
  from { opacity: 0; transform: translateX(64px); }
  to { opacity: 1; transform: none; }
}
.profile-card-enter { animation: profile-card-in 640ms cubic-bezier(0.16, 1, 0.3, 1) both; }
@media (prefers-reduced-motion: reduce) {
  .profile-card-enter { animation: none; }
}
.cabinet-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--layout-gap); }
.cabinet-stat, .cabinet-card { border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); }
.cabinet-stat { padding: 16px 18px; }
.cabinet-stat strong { display: block; font-size: 28px; letter-spacing: var(--tracking-heading); color: var(--dark); }
.cabinet-stat span { color: var(--muted); font-size: 13px; }
.cabinet-stat__delta { display: block; margin-top: 6px; font-size: 13px; font-weight: var(--fw-title); }
.cabinet-stat__delta.is-up { color: #15803d; }
.cabinet-stat__delta.is-down { color: var(--primary); }
.cabinet-stat__delta.is-flat { color: var(--muted); font-weight: var(--fw-ui); }
.cabinet-contacts { display: grid; }
.cabinet-contact { display: grid; grid-template-columns: 28px minmax(0, 1fr) auto; grid-template-areas: "icon body marks" "panel panel panel"; column-gap: 12px; row-gap: 8px; align-items: center; padding: 12px 18px; border-bottom: 1px solid var(--line); }
.cabinet-contact:last-child { border-bottom: 0; }
.cabinet-contact__icon { grid-area: icon; display: grid; place-items: center; width: 28px; height: 28px; color: var(--dark); }
.cabinet-contact__icon svg { width: 20px; height: 20px; }
.cabinet-contact__icon .cabinet-line { fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-contact__body { grid-area: body; display: grid; gap: 2px; min-width: 0; }
.cabinet-contact__name { color: var(--dark); font-size: 15px; font-weight: var(--fw-title); }
.cabinet-contact__value { min-width: 0; color: var(--muted); font-size: 13px; line-height: 1.35; overflow-wrap: anywhere; }
.cabinet-contact__value:empty { display: none; }
.cabinet-contact__marks { grid-area: marks; display: flex; justify-content: flex-end; align-items: center; }
.cabinet-contact__panel { grid-area: panel; display: grid; gap: 8px; }
.cabinet-contact__panel label { display: grid; gap: 6px; }
.cabinet-contact__panel label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-contact__panel:empty { display: none; }
.cabinet-contact__field { display: grid; gap: 6px; min-width: 0; }
.cabinet-contact__field span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-contact__panel input, .cabinet-contact__field input { width: 100%; min-width: 0; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--white); color: var(--dark); font: inherit; font-size: 16px; }
.cabinet-contact__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cabinet-contact .cabinet-form__ghost { min-height: 44px; }
.cabinet-mark { display: inline-grid; place-items: center; height: 28px; padding: 0 12px; border-radius: 999px; border: 1px solid transparent; font-size: 12px; font-weight: var(--fw-title); line-height: 1; white-space: nowrap; }
.cabinet-mark--sign { width: 28px; padding: 0; border-radius: 50%; }
.cabinet-mark--sign svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-mark--added { background: var(--white); border-color: var(--line); color: var(--dark); }
.cabinet-mark--on { background: #16a34a; color: #fff; }
.cabinet-mark--wait { background: #f59e0b; color: #fff; }
.cabinet-mark--off { background: var(--light-bg); color: var(--muted); }
.cabinet-faq { display: grid; gap: 12px; }
.cabinet-faq > h2 { margin: 0; font-size: 16px; font-weight: var(--fw-heading); color: var(--dark); }
.cabinet-card h2 { margin: 0; padding: 16px 18px; border-bottom: 1px solid var(--line); font-size: 16px; color: var(--dark); }
.cabinet-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; }
.cabinet-row:last-child { border-bottom: 0; }
.cabinet-row strong { display: block; color: var(--dark); }
.cabinet-row > div { min-width: 0; }
.cabinet-row span, .cabinet-empty { display: block; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.cabinet-status { display: inline-grid; place-items: center; width: fit-content; height: 28px; padding: 0 12px; border: 0; border-radius: 999px; font: inherit; font-size: 12px; font-weight: var(--fw-title); line-height: 1; text-align: center; white-space: nowrap; color: #fff; }
.cabinet-row .cabinet-status { display: inline-flex; align-items: center; justify-content: center; }
.cabinet-status--pending, .cabinet-status--draft { background: #f59e0b; color: #fff; }
.cabinet-status--published { background: #16a34a; color: #fff; }
.cabinet-status--rejected, .cabinet-status--hidden, .cabinet-status--archived { background: #9ca3af; color: #fff; }
.cabinet-status-stack { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; flex: 0 0 auto; align-self: center; width: 10.5rem; }
.cabinet-status-line { position: relative; display: flex; align-items: center; justify-content: center; }
.cabinet-status-stack time { color: var(--muted); font-size: 12px; font-weight: var(--fw-title); line-height: 1.2; text-align: center; white-space: nowrap; }
.cabinet-status-help { position: absolute; left: calc(100% - 6px); top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; color: var(--muted); cursor: pointer; display: grid; place-items: center; }
.cabinet-status-help svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-status-help:hover { color: var(--dark); }
.cabinet-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: flex-end; }
.cabinet-actions button { min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-row .cabinet-status,
.cabinet-actions .cabinet-status,
.cabinet-table .cabinet-status,
.cabinet-actions button.cabinet-status { color: #fff; }
.cabinet-row .cabinet-status--pending,
.cabinet-actions .cabinet-status--pending,
.cabinet-table .cabinet-status--pending { background: #f59e0b; color: #fff; }
.cabinet-row .cabinet-status--published,
.cabinet-actions .cabinet-status--published,
.cabinet-table .cabinet-status--published { background: #16a34a; color: #fff; }
.cabinet-row .cabinet-status--rejected,
.cabinet-actions .cabinet-status--rejected,
.cabinet-table .cabinet-status--rejected { background: #9ca3af; color: #fff; }
.cabinet-actions button.cabinet-status { border: 0; cursor: pointer; color: #fff; }
.cabinet-actions button.cabinet-status:hover { filter: brightness(0.95); }
.cabinet-actions button:disabled { opacity: 0.6; cursor: default; }
a.cabinet-row__link { color: inherit; text-decoration: none; }
a.cabinet-row__link:hover strong { color: var(--primary); }
.cabinet-inline-link { display: inline-block; margin-top: 6px; color: var(--primary); font-size: 13px; font-weight: var(--fw-title); text-decoration: none; }
.cabinet-table .cabinet-inline-link { display: inline-flex; align-items: center; min-height: 44px; margin-top: 0; }
.cabinet-inline-link:hover { text-decoration: underline; }
.cabinet-card { min-width: 0; }
.cabinet-pager {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  margin: 0;
  padding: 14px 18px 16px;
  border-top: 1px solid var(--line);
}
.cabinet-pager__summary { margin: 0; flex: 1 1 12rem; min-width: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
.cabinet-pager__nav { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; margin-left: auto; }
.cabinet-pager__nav span { color: var(--text); font-size: 13px; font-weight: var(--fw-title); white-space: nowrap; }
.cabinet-pager button { min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-pager button:disabled { opacity: 0.45; cursor: default; }
.cabinet-card > .cabinet-pager { margin-top: 0; }
.cabinet-name-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--primary); font-weight: var(--fw-title); text-decoration: none; }
.cabinet-name-link:hover { text-decoration: underline; }
.cabinet-table-wrap { min-width: 0; max-width: 100%; overflow-x: auto; }
.cabinet-table { width: 100%; min-width: 760px; border-collapse: collapse; }
.cabinet-table th, .cabinet-table td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.cabinet-table--trainers th, .cabinet-table--trainers td { text-align: center; vertical-align: middle; }
.cabinet-table--trainers th:first-child, .cabinet-table--trainers td:first-child { text-align: left; }
.cabinet-table--trainers .cabinet-claim { justify-content: center; }
.cabinet-table--trainers .cabinet-person { width: 100%; }
.cabinet-row-actions { display: flex; align-items: center; flex: 0 0 auto; }
.cabinet-table th { color: var(--muted); font-size: 12px; font-weight: var(--fw-title); }
.cabinet-table td { font-size: 14px; color: var(--text); }
.cabinet-reject { display: grid; gap: 8px; margin-top: 8px; }
.cabinet-reject textarea { width: 100%; min-height: 88px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); font: inherit; font-size: 15px; resize: vertical; }
.cabinet-table strong { display: block; color: var(--dark); }
.cabinet-table:not(.cabinet-table--trainers) span:not(.cabinet-status):not(.cabinet-person__mark):not(.cabinet-sr):not(.user-avatar):not(.trainer-name):not(.trainer-name__line) { display: block; margin-top: 4px; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.cabinet-table--trainers { width: 100%; }
.cabinet-table--trainers th, .cabinet-table--trainers td { padding: 6px 4px; line-height: 1.25; white-space: nowrap; }
.cabinet-table--trainers th { font-size: 11px; }
.cabinet-table--trainers td { font-size: 12px; }
.cabinet-table--trainers th:first-child, .cabinet-table--trainers td:first-child { padding-left: 12px; }
.cabinet-table--trainers td.is-audience { white-space: normal; }
.cabinet-table--trainers .cabinet-person { display: grid; grid-template-columns: 44px max-content auto; align-items: center; column-gap: 8px; width: max-content; }
.cabinet-table--trainers .cabinet-row-actions { gap: 0; }
.cabinet-table--trainers .cabinet-person__text { min-width: max-content; }
.cabinet-table--trainers .cabinet-person__text strong,
.cabinet-table--trainers .cabinet-person__meta { display: block; white-space: nowrap; overflow: visible; text-overflow: clip; }
.cabinet-table--trainers .cabinet-person__meta { margin-top: 2px; color: var(--muted); font-size: 11px; }
.cabinet-table--trainers .cabinet-rating { display: inline-flex; align-items: center; justify-content: center; gap: 4px; vertical-align: middle; color: var(--dark); font-weight: var(--fw-title); }
.cabinet-table--trainers .cabinet-rating svg { width: 14px; height: 14px; fill: #ffb400; }
.cabinet-table--trainers .cabinet-rating.is-empty { color: var(--muted); font-weight: var(--fw-ui); }
.cabinet-table--trainers .cabinet-rating.is-empty svg { fill: none; stroke: var(--muted); stroke-width: var(--icon-stroke); }
.cabinet-table--trainers .cabinet-rating__count { color: var(--muted); font-weight: var(--fw-ui); }
.cabinet-table--trainers .cabinet-social { display: inline-flex; align-items: center; justify-content: center; }
.cabinet-table--trainers .cabinet-social__link { width: 44px; height: 44px; display: grid; place-items: center; color: inherit; }
.cabinet-table--trainers .cabinet-social__link svg { width: 22px; height: 22px; overflow: visible; }
.cabinet-filters { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--line); }
.cabinet-filters label { display: grid; gap: 6px; flex: 1 1 180px; min-width: min(100%, 180px); }
.cabinet-filters label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-filters label.cabinet-filters__search { flex: 1 1 100%; }
.cabinet-filters select, .cabinet-filters input { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; }
.cabinet-filters p { flex: 1 1 100%; }
.cabinet-person { display: flex; align-items: center; gap: 10px; min-width: 0; }
.cabinet-person img, .cabinet-person__mark { width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
.cabinet-person__mark { display: grid; place-items: center; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); font-weight: var(--fw-title); }
.cabinet-person > div { min-width: 0; }
.cabinet-person a { color: inherit; text-decoration: none; }
.cabinet-person a:hover strong { color: var(--primary); }
.cabinet-tabs { display: flex; gap: 4px; overflow-x: auto; padding: 8px 12px; border-bottom: 1px solid var(--line); }
.cabinet-tabs button { flex: 0 0 auto; min-height: 44px; padding: 0 14px; border: 0; border-radius: 999px; background: transparent; color: var(--text); font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-tabs button[aria-selected="true"] { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
.cabinet-facts { display: grid; gap: 14px; margin: 0; padding: 16px 18px; }
.cabinet-facts div { display: grid; gap: 2px; }
.cabinet-facts dt { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-facts dd { margin: 0; overflow-wrap: anywhere; }
.cabinet-facts dd span:not(.trainer-name):not(.trainer-name__line) { display: block; margin-top: 4px; }
.cabinet-facts .trainer-name__line { color: inherit; font-size: inherit; margin: 0; }
.cabinet-table .cabinet-status { display: inline-grid; place-items: center; height: 28px; margin: 0; }
.cabinet-table--trainers .cabinet-status { height: 22px; padding: 0 8px; font-size: 11px; }
.cabinet-table .cabinet-status-stack { width: auto; margin-inline: auto; align-items: center; }
.cabinet-table .cabinet-status-stack span, .cabinet-table .cabinet-status-stack time { text-align: center; }
.cabinet-table .cabinet-status-cell { text-align: center; vertical-align: middle; }
.cabinet-icon-btn { width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--dark); display: grid; place-items: center; cursor: pointer; }
.cabinet-actions .cabinet-icon-btn, .cabinet-form .cabinet-icon-btn, .cabinet-modal__card .cabinet-icon-btn { width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--dark); }
.cabinet-icon-btn svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-icon-btn:hover { background: rgba(var(--dark-rgb), 0.04); }
.cabinet-icon-btn--approve { color: #16a34a; }
.cabinet-icon-btn--approve:hover { background: rgba(22, 163, 74, 0.12); }
.cabinet-icon-btn--reject { color: #dc2626; }
.cabinet-icon-btn--reject:hover { background: rgba(220, 38, 38, 0.1); }
.cabinet-icon-btn:disabled { opacity: 0.6; cursor: default; }
.cabinet-modal__card label { display: grid; gap: 6px; }
.cabinet-modal__card label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-modal__card textarea { width: 100%; min-height: 120px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; resize: vertical; }
.cabinet-modal__card .cabinet-form__error { color: var(--primary-dark); }
.cabinet-save { position: static; width: 44px; height: 44px; flex: 0 0 auto; }
.cabinet-empty { margin: 0; padding: 16px 18px; }
.cabinet-note { margin: 0; color: var(--muted); max-width: 62ch; }
.cabinet-section .cabinet-note { margin: -6px 0 10px; font-size: var(--fs-caption); line-height: 1.35; font-weight: var(--fw-body); }
.cabinet-card > .cabinet-note--lede { padding: 12px 18px 0; }
.cabinet-card > .cabinet-note--lede a { color: var(--primary); font-weight: var(--fw-title); text-decoration: none; }
.cabinet-card > .cabinet-note--lede a:hover { text-decoration: underline; }
.cabinet-form { display: grid; gap: 12px; padding: 16px 18px; }
.cabinet-form:has(.cabinet-section) { gap: 18px; }
.cabinet-section { display: grid; gap: 12px; margin: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--card-radius); background: rgba(var(--dark-rgb), 0.025); scroll-margin-top: calc(var(--cabinet-sticky-top, 96px) + 16px); }
.cabinet-section h3 { margin: 0; padding-bottom: 10px; border-bottom: 1px solid var(--line); font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; color: var(--dark); }
.cabinet-section--place { background: rgba(var(--primary-rgb), 0.08); border-color: rgba(var(--primary-rgb), 0.35); }
.cabinet-section--place h3 { border-bottom-color: rgba(var(--primary-rgb), 0.22); }
.cabinet-section--contact { background: var(--white); border-color: var(--line); box-shadow: inset 3px 0 0 var(--primary); }
.cabinet-section .places-field { padding: 12px; border-radius: var(--radius-control); background: var(--white); border: 1px solid rgba(var(--primary-rgb), 0.18); }
.cabinet-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cabinet-form__row > label { min-width: 0; }
.cabinet-choices { display: flex; flex-wrap: wrap; gap: 8px; }
.cabinet-choices button { min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-choices button.is-on { border-color: transparent; background: var(--primary); color: var(--white); }
.cabinet-choices button.is-on:hover { background: var(--primary-dark); color: var(--white); }
.cabinet-review-list { padding-inline: 18px; }
.cabinet-review { display: grid; gap: 8px; padding: 16px 0; border-bottom: 1px solid var(--line); }
.cabinet-review:first-child { padding-top: 0; }
.cabinet-review:last-child { border-bottom: 0; padding-bottom: 0; }
.cabinet-review__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.cabinet-review__reply { display: grid; gap: 6px; padding: 12px; border-radius: var(--radius-control); background: rgba(var(--dark-rgb), 0.03); }
.cabinet-review__reply p { margin: 0; }
.cabinet-review form { display: grid; gap: 8px; }
.cabinet-review form label { display: grid; gap: 6px; }
.cabinet-review form label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-review textarea { width: 100%; min-height: 96px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; resize: vertical; }
.cabinet-form + .cabinet-form { border-top: 1px solid var(--line); }
.cabinet-form label { display: grid; gap: 6px; }
.cabinet-form label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-form__label-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cabinet-edit { min-height: 44px; padding: 0; border: 0; background: none; color: var(--primary); font: inherit; font-size: 13px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-avatar { position: relative; display: flex; align-items: center; gap: 14px; }
.cabinet-avatar__photo, .cabinet-avatar__mark { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); display: grid; place-items: center; font-weight: var(--fw-title); font-size: 24px; }
.cabinet-form .cabinet-avatar input { position: absolute; width: 1px; height: 1px; min-height: 0; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); }
.cabinet-form__verified { color: #16a34a; font-style: normal; }
.cabinet-form__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cabinet-form__ghost, label.cabinet-form__ghost { position: relative; display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 15px; font-weight: var(--fw-title); cursor: pointer; text-decoration: none; }
.cabinet-form__ghost:disabled { opacity: 0.6; cursor: default; }
.cabinet-form input, .cabinet-form textarea, .cabinet-form select { width: 100%; min-height: 44px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; }
.cabinet-disclose { width: 44px; height: 44px; border: 0; border-radius: 50%; background: transparent; color: var(--text); cursor: pointer; display: grid; place-items: center; }
.cabinet-disclose svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-disclose.is-open svg { transform: rotate(180deg); }
.cabinet-expand { background: rgba(var(--dark-rgb), 0.02); }
.cabinet-account { display: grid; gap: 4px; padding: 16px 18px 0; }
.cabinet-account strong { color: var(--dark); }
.cabinet-account span:not(.trainer-name):not(.trainer-name__line) { color: var(--muted); font-size: 13px; }
.cabinet-account .trainer-name__line { color: var(--dark); font-size: inherit; }
.cabinet-form input[readonly],
.cabinet-form input.is-locked { background: #eceff3; color: var(--muted); cursor: default; }
.cabinet-gender { margin: 0; padding: 12px 18px 0; color: var(--text); font-size: 14px; }
.cabinet-form textarea { min-height: 120px; resize: vertical; }
.cabinet-form input { padding-block: 0; }
.cabinet-form__submit { justify-self: start; min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-form__submit:disabled { opacity: 0.6; cursor: default; }
.cabinet-form__ok { margin: 0; color: #157a3a; font-size: 13px; font-weight: var(--fw-title); }
.cabinet-form__error { margin: 0; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-ui); }
.cabinet-modal { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: var(--layout-gutter); background: rgba(var(--dark-rgb), 0.45); }
.cabinet-modal__card { width: min(440px, 100%); display: grid; gap: 12px; padding: 20px; border-radius: var(--card-radius); background: var(--white); }
.cabinet-modal__card h2 { margin: 0; font-size: 18px; color: var(--dark); }
.cabinet-modal__card p { margin: 0; color: var(--text); }
.cabinet-modal__card button { justify-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-modal__card--form { width: min(640px, 100%); max-height: min(92vh, 920px); overflow: auto; display: grid; gap: 12px; align-content: start; }
.cabinet-modal__card--form label { display: grid; gap: 6px; }
.cabinet-modal__card--form label > span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-modal__card--form input, .cabinet-modal__card--form textarea, .cabinet-modal__card--form select { width: 100%; min-height: 44px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; }
.cabinet-modal__card--form textarea { min-height: 120px; resize: vertical; }
.cabinet-modal__card--form input { padding-block: 0; }
.cabinet-modal__card--form .cabinet-form__submit { justify-self: start; border: 0; background: var(--primary); color: #fff; }
.cabinet-modal__card--form .cabinet-form__ghost, a.cabinet-form__ghost { justify-self: start; display: inline-flex; align-items: center; min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); text-decoration: none; }
.entity-input { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 44px; padding: 4px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); }
.entity-input input, .cabinet-modal__card--form .entity-input input, .cabinet-form .entity-input input { flex: 1 1 140px; width: auto; min-width: 8ch; min-height: 36px; padding: 0 8px; border: 0; background: transparent; }
.entity-chip { min-height: 44px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border: 0; border-radius: 999px; background: rgba(var(--primary-rgb), 0.12); color: var(--dark); font: inherit; font-size: 13px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-modal__card--form .entity-chip { min-height: 44px; padding: 0 12px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.12); color: var(--dark); }
.entity-menu { position: absolute; z-index: 3; left: 0; right: 0; top: calc(100% + 4px); margin: 0; padding: 4px; list-style: none; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); max-height: 240px; overflow: auto; }
.entity-menu button, .cabinet-modal__card--form .entity-menu button { width: 100%; min-height: 44px; padding: 0 10px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--dark); font: inherit; font-weight: var(--fw-ui); text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; }
.entity-menu button span { color: var(--muted); font-size: 13px; }
.entity-menu button:hover, .cabinet-modal__card--form .entity-menu button:hover { background: rgba(var(--dark-rgb), 0.04); }
.places-field { display: grid; gap: 12px; margin: 0; padding: 0; border: 0; min-width: 0; }
.places-field legend { font-weight: var(--fw-title); }
.places-field__row { display: grid; gap: 8px; }
.places-field__parts { margin: 6px 0 0; color: var(--muted); font-size: 13px; }
.places-field__add, .places-field__remove { min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-weight: var(--fw-title); cursor: pointer; justify-self: start; }
.address-field { position: relative; }
.cabinet-form .address-field input[type="text"], .cabinet-form .address-field input:not([type="hidden"]) { padding-right: 48px; }
.address-field__clear { position: absolute; top: 0; right: 0; width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.address-field__clear svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.address-field__status { min-height: 44px; display: flex; align-items: center; padding: 0 10px; color: var(--muted); font-size: 14px; }
.address-field__menu button.address-hit {
  display: flex; flex-direction: column; align-items: stretch; justify-content: center;
  gap: 1px; min-height: 44px; height: auto; padding: 6px 12px; white-space: normal;
}
.address-field__menu button.address-hit.is-active,
.address-field__menu button.address-hit:hover { background: rgba(var(--dark-rgb), 0.04); }
.address-field__menu button .address-hit__main,
.address-field__menu button .address-hit__meta {
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.25;
}
.address-field__menu button .address-hit__main { color: var(--dark); font-size: 14px; font-weight: var(--fw-title); }
.address-field__menu button .address-hit__meta { color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); }
.geo-status { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.geo-badge { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border-radius: 999px; font-size: 13px; font-weight: var(--fw-title); }
.geo-badge--ok { background: var(--neutral-bg); color: var(--dark); }
.geo-badge--not-found { background: rgba(var(--primary-rgb), 0.12); color: var(--primary-dark); }
.geo-badge--pending { background: var(--neutral-bg); color: var(--muted); }
@media (max-width: 767px) {
  .address-field .address-field__menu { position: fixed; z-index: 40; left: max(12px, env(safe-area-inset-left)); right: max(12px, env(safe-area-inset-right)); bottom: max(12px, env(safe-area-inset-bottom)); top: auto; max-height: min(70vh, 420px); box-shadow: 0 14px 42px rgba(var(--dark-rgb), 0.16); }
}
.entity-input__error { flex: 1 1 100%; color: var(--primary-dark); font-size: 13px; }
.cabinet-brand-field { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); }
.cabinet-brand-field svg { width: 20px; height: 20px; flex: 0 0 auto; overflow: visible; }
.cabinet-form .cabinet-brand-field input { flex: 1; width: auto; min-width: 0; border: 0; min-height: 42px; padding: 0; background: transparent; }
.cabinet-certs { display: grid; gap: 12px; width: min(100%, 720px); margin: 0; padding: 0; list-style: none; }
.cabinet-cert { display: grid; grid-template-columns: minmax(0, 1fr) 44px; gap: 8px; align-items: end; }
.cabinet-cert.is-pending { opacity: 0.6; }
.cabinet-cert.is-saved .cabinet-cert__caption input { border-color: #157a3a; box-shadow: inset 0 0 0 1px #157a3a; }
.cabinet-cert__caption { display: grid; gap: 4px; grid-column: 1; grid-row: 1; }
.cabinet-cert__caption span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-cert__file { grid-column: 1 / -1; grid-row: 2; min-height: 44px; display: inline-flex; align-items: center; color: var(--primary); font-size: 14px; font-weight: var(--fw-title); text-decoration: none; overflow-wrap: anywhere; }
.cabinet-cert__file:hover { text-decoration: underline; }
.cabinet-cert .cabinet-icon-btn { grid-column: 2; grid-row: 1; }
@media (min-width: 720px) {
  .cabinet-cert { grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.2fr) 44px; }
  .cabinet-cert__file { grid-column: 1; grid-row: 1; }
  .cabinet-cert__caption { grid-column: 2; grid-row: 1; }
  .cabinet-cert .cabinet-icon-btn { grid-column: 3; grid-row: 1; }
}
.cabinet-media-block { display: grid; gap: 6px; }
.cabinet-media { display: grid; gap: 8px; justify-items: start; }
.cabinet-media__label { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-photos { display: flex; flex-wrap: wrap; gap: 10px; margin: 0; padding: 0; list-style: none; }
.cabinet-photo { position: relative; width: 128px; height: 128px; border-radius: var(--radius-control); overflow: hidden; background: var(--neutral-bg, #f3f4f6); border: 1px solid var(--line); }
.cabinet-photo.is-pending { opacity: 0.55; }
.cabinet-photo.is-draggable { cursor: grab; touch-action: none; }
.cabinet-photo.is-placeholder { background: rgba(var(--primary-rgb), 0.08); border-style: dashed; border-color: rgba(var(--primary-rgb), 0.45); pointer-events: none; }
.cabinet-photo.is-placeholder img,
.cabinet-photo.is-placeholder button,
.cabinet-photo.is-placeholder span { visibility: hidden; }
.cabinet-photo.is-ghost { position: fixed; left: 0; top: 0; z-index: 30; margin: 0; pointer-events: none; transform-origin: 0 0; box-shadow: 0 14px 32px rgba(var(--dark-rgb), 0.18); }
.cabinet-copy { min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 13px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-copy:disabled { cursor: default; opacity: 0.6; }
.cabinet-claim-bar { padding: 14px 18px; border-bottom: 1px solid var(--line); }
.cabinet-claim { display: flex; flex-wrap: wrap; align-items: center; gap: 0 4px; min-width: 0; }
.cabinet-claim__url { min-width: 0; max-width: 9.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--dark); font-size: 13px; line-height: 1.35; text-decoration: none; }
.cabinet-claim__url:hover { color: var(--primary); }
.cabinet-claim__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.cabinet-claim__state { margin: 0; font-size: 13px; color: var(--muted); }
.cabinet-claim__state.is-current { color: #15803d; }
.cabinet-claim__state.is-stale { color: #b45309; }
html.is-photo-drag, html.is-photo-drag * { cursor: grabbing !important; }
.cabinet-photo img { width: 100%; height: 100%; object-fit: cover; }
.cabinet-photo > span { position: absolute; left: 6px; bottom: 6px; padding: 2px 8px; border-radius: 999px; background: var(--white); color: var(--dark); font-size: 11px; font-weight: var(--fw-title); }
.cabinet-photo__remove { position: absolute; top: 4px; right: 4px; background: var(--white); border: 1px solid var(--line); }
label.cabinet-form__ghost input { position: absolute; width: 1px; height: 1px; min-height: 0; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); }
a.cabinet-icon-btn { text-decoration: none; }
@media (max-width: 960px) {
  .layout-with-sidebar:has(> .cabinet-side) { display: flex; flex-direction: column; align-items: stretch; }
  .cabinet-side { width: 100%; }
  .cabinet-section { scroll-margin-top: calc(var(--cabinet-sticky-top, 96px) + var(--cabinet-side-h, 0px) + 16px); }
  .cabinet-nav__items { flex-direction: row; overflow-x: auto; scroll-padding-inline: 8px; scrollbar-width: none; }
  .cabinet-nav__items::-webkit-scrollbar { display: none; }
  .cabinet-nav__items > button, .cabinet-nav__items > a { flex: 0 0 auto; }
  .cabinet-nav__sub { display: flex; margin: 4px 0 0; padding-left: 0; border-left: 0; overflow-x: auto; scrollbar-width: none; }
  .cabinet-nav__sub::-webkit-scrollbar { display: none; }
  .cabinet-nav__sub a { flex: 0 0 auto; }
}
@media (max-width: 640px) {
  .cabinet-stats { grid-template-columns: 1fr; }
  .cabinet-contact { grid-template-columns: 28px minmax(0, 1fr) auto; }
  .cabinet-row { align-items: flex-start; flex-direction: column; }
  .cabinet-status-stack { align-items: center; align-self: flex-start; }
  .cabinet-form__row { grid-template-columns: 1fr; }
}
`;
