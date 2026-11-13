import { Link, useRouteContext, useRouterState } from "@tanstack/react-router";
import { Fragment, useEffect, useLayoutEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { CredentialsRequiredDialog } from "@/components/auth/credentials-required-dialog";
import { DoorPasswordDialog } from "@/components/auth/door-password-dialog";
import { CabinetMark, type CabinetIcon } from "@/components/cabinet-mark";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { TrainerName } from "@/components/trainer-name";
import { UserAvatar } from "@/components/user-avatar";
import { joinTrainerName } from "@/lib/catalog/trainer-name";

export { CabinetMark, type CabinetIcon };

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

export function CabinetOpenMark() {
  return (
    <span className="cabinet-id__open" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M14 5h5v5" />
        <path d="M13 11l6-6" />
        <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </svg>
    </span>
  );
}

export function CabinetModal({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
}) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className={className ? `cabinet-modal ${className}` : "cabinet-modal"} onClick={onClick}>
      {children}
    </div>,
    document.body,
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
    <CabinetModal onClick={onClose}>
      <div className="cabinet-modal__card" role="dialog" aria-modal="true" aria-labelledby="cabinet-notice-title" onClick={(event) => event.stopPropagation()}>
        <h2 id="cabinet-notice-title">{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onClose}>Закрыть</button>
      </div>
    </CabinetModal>
  );
}

export type AccountSectionPath = "/account" | "/account/reviews" | "/account/bookings" | "/account/favorites" | "/account/settings" | "/account/messages";

export type AdminSectionPath =
  | "/admin"
  | "/admin/trainers"
  | "/admin/trainers/drafts"
  | "/admin/trainers/active"
  | "/admin/trainers/unclear"
  | "/admin/welcomes"
  | "/admin/reviews"
  | "/admin/messages"
  | "/admin/accounts"
  | "/admin/finance"
  | "/admin/settings"
  | "/admin/site";

export type TrainerSectionPath = "/trainer-admin" | "/trainer-admin/messages";

export type MeSectionPath =
  | "/me"
  | "/me/stats"
  | "/me/messages"
  | "/me/reviews"
  | "/me/likes"
  | "/me/favorites"
  | "/me/profile"
  | "/me/contacts"
  | "/me/settings";

export type CabinetSectionLink = {
  id: string;
  label: string;
};

export type CabinetNavPage = {
  id: string;
  label: string;
  to: AccountSectionPath | AdminSectionPath | TrainerSectionPath | MeSectionPath;
  badge?: number;
};

export function cabinetPathMatches(pathname: string, to: string) {
  if (to === "/admin" || to === "/me" || to === "/account") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function currentCabinetPage(pathname: string, pages: readonly CabinetNavPage[]) {
  return pages
    .filter((page) => cabinetPathMatches(pathname, page.to))
    .sort((a, b) => b.to.length - a.to.length)[0] ?? null;
}

export type CabinetNavItem = {
  id: string;
  label: string;
  icon: CabinetIcon;
  badge?: number;
  to?: AccountSectionPath | AdminSectionPath | TrainerSectionPath | MeSectionPath;
  search?: { tab: "overview" | "settings" | "card" | "reviews" };
  sections?: readonly CabinetSectionLink[];
  /** In-page sections stay in the wide menu and stay off the phone menu. */
  sectionsMobile?: boolean;
  pages?: readonly CabinetNavPage[];
};

export function CabinetStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CABINET_CSS }} />;
}

/** Admin table filters start closed, the same way the map and a category do. */
export function CabinetFilterBar({ children, active = 0 }: { children: ReactNode; active?: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="cabinet-filter-bar">
      <button
        type="button"
        className={open ? "is-open" : undefined}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        Фильтры
        {active > 0 ? <span className="cabinet-filter-bar__count">{active}</span> : null}
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
      </button>
      {open ? <div className="cabinet-filters">{children}</div> : null}
    </div>
  );
}

/** Unread messages use the brand color. Other cabinet counts stay muted. */
function navBadgeClass(id: string, count: number) {
  return `cabinet-nav__badge${id === "messages" && count > 0 ? " is-hot" : ""}`;
}

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
  const { user } = useRouteContext({ from: "__root__" });
  const name = joinTrainerName(firstName, lastName) || "Без имени";
  const publicSlug = profileSlug?.trim() || "";
  const identity = <TrainerName firstName={firstName} lastName={lastName} empty="Без имени" />;
  const navRef = useRef<HTMLDivElement>(null);
  const navEl = useRef<HTMLElement>(null);
  const sideRef = useRef<HTMLElement>(null);
  const pathname = useRouterState({ select: (state) => state.location.pathname });
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
    window.addEventListener("scroll", apply, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", apply);
      root.style.removeProperty("--cabinet-sticky-top");
      root.style.removeProperty("--cabinet-side-h");
    };
  }, []);
  const sectionKey = items.find((item) => item.id === active)?.sections?.map((section) => section.id).join("|") ?? "";
  const pageHere = currentCabinetPage(pathname, items.flatMap((item) => item.pages ?? []));
  const pageSig = items.map((item) => item.pages?.map((page) => `${page.id}:${page.badge ?? ""}`).join(",") ?? "").join("|");
  const [currentSection, setCurrentSection] = useState<string | null>(null);
  const [sectionsOpen, setSectionsOpen] = useState(false);
  const spyPause = useRef(0);
  const syncSection = useRef<() => void>(() => {});
  useEffect(() => {
    navRef.current?.querySelector(".is-active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);
  useEffect(() => {
    setSectionsOpen(false);
  }, [pathname]);
  useEffect(() => {
    const ids = sectionKey ? sectionKey.split("|") : [];
    if (!ids.length) {
      setCurrentSection(null);
      syncSection.current = () => {};
      return;
    }
    let frame = 0;
    const apply = () => {
      const header = document.getElementById("site-header");
      const line = (header ? header.getBoundingClientRect().bottom : 0) + 20;
      let next = ids[0];
      for (const id of ids) {
        const node = document.getElementById(id);
        if (node && node.getBoundingClientRect().top <= line) next = id;
      }
      const atEnd = window.scrollY > 8 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      if (atEnd) {
        for (const id of ids) {
          const node = document.getElementById(id);
          if (!node) continue;
          const rect = node.getBoundingClientRect();
          if (rect.bottom > line && rect.top < window.innerHeight) next = id;
        }
      }
      setCurrentSection((current) => (current === next ? current : next));
    };
    syncSection.current = () => {
      if (spyPause.current) return;
      apply();
    };
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        syncSection.current();
      });
    };
    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      syncSection.current = () => {};
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [sectionKey]);
  useLayoutEffect(() => {
    const root = navEl.current;
    if (!root) return;
    for (const sub of root.querySelectorAll<HTMLElement>(".cabinet-nav__sub")) {
      const mark = sub.querySelector<HTMLElement>(".cabinet-nav__mark");
      const link = sub.querySelector<HTMLElement>(".is-current");
      if (!mark) continue;
      if (!link) {
        mark.style.width = "0px";
        mark.style.height = "0px";
        continue;
      }
      mark.style.width = `${link.offsetWidth}px`;
      mark.style.height = `${link.offsetHeight}px`;
      mark.style.transform = `translate(${link.offsetLeft}px, ${link.offsetTop}px)`;
    }
  }, [currentSection, sectionKey, pathname, pageSig, sectionsOpen]);
  function moveToSection(id: string) {
    navEl.current?.classList.remove("is-open");
    setSectionsOpen(false);
    const target = document.getElementById(id);
    if (!target) return;
    setCurrentSection(id);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const stackedSticky = window.matchMedia("(max-width: 960px) and (min-width: 768px)").matches;
    const header = document.getElementById("site-header");
    const destination = () => {
      const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 96;
      const sideH = stackedSticky && sideRef.current ? Math.ceil(sideRef.current.getBoundingClientRect().height) : 0;
      return Math.max(0, window.scrollY + target.getBoundingClientRect().top - headerH - sideH - 16);
    };
    const top = destination();
    const token = ++spyPause.current;
    const release = () => {
      window.setTimeout(() => {
        if (spyPause.current !== token) return;
        spyPause.current = 0;
        syncSection.current();
      }, 80);
    };
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

  const currentItem = items.find((item) => item.id === active);
  const toggleLabel = pageHere?.label ?? currentItem?.label ?? "Разделы";
  const toggleBadge = pageHere?.badge ?? currentItem?.badge;
  const toggleBadgeId = pageHere?.id ?? currentItem?.id ?? "";

  return (
    <>
      <SiteHeader />
      <main>
        <div className="layout-with-sidebar">
          <aside className="cabinet-side" ref={sideRef}>
            <div className="cabinet-title">
              <h1>{title}</h1>
              {lede ? <p>{lede}</p> : null}
            </div>
            <div className="cabinet-id">
              <UserAvatar name={name} src={avatarUrl} size={36} />
              <div>
                {publicSlug ? (
                  <a className="cabinet-id__line" href={`/trainers/${publicSlug}`} target="_blank" rel="noopener noreferrer" title="Открыть публичный профиль">
                    <strong>{identity}</strong>
                    <span className="cabinet-id__open" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="M14 5h5v5" />
                        <path d="M13 11l6-6" />
                        <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
                      </svg>
                    </span>
                  </a>
                ) : (
                  <div className="cabinet-id__line"><strong>{identity}</strong></div>
                )}
                <span>{role}</span>
              </div>
            </div>
            <nav
              ref={navEl}
              className={sectionsOpen ? "cabinet-nav is-open" : "cabinet-nav"}
              aria-label="Разделы кабинета"
              style={sectionKey ? { ["--nav-sub-row" as string]: String(items.findIndex((item) => item.id === active) + 2) } : undefined}
            >
              <button
                type="button"
                className="cabinet-nav__toggle"
                aria-expanded={sectionsOpen}
                aria-controls="cabinet-sections"
                onClick={() => setSectionsOpen((value) => !value)}
              >
                <span className="cabinet-nav__toggle-main">
                  {currentItem ? <CabinetMark icon={currentItem.icon} /> : null}
                  <span className="cabinet-nav__label">{toggleLabel}</span>
                  {typeof toggleBadge === "number" ? (
                    <span className={navBadgeClass(toggleBadgeId, toggleBadge)}>{toggleBadge > 99 ? "99+" : toggleBadge}</span>
                  ) : null}
                </span>
                <svg className="cabinet-nav__chevron" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 6l6 6-6 6" /></svg>
              </button>
              <div
                className="cabinet-nav__body"
                id="cabinet-sections"
                onClick={(event) => {
                  const node = event.target;
                  if (node instanceof Element && node.closest("a, button")) setSectionsOpen(false);
                }}
              >
              <div className="cabinet-nav__items" ref={navRef}>
                {items.map((item) => {
                  const className = item.id === active ? "is-active" : undefined;
                  const onChild = Boolean(pageHere && item.pages?.some((page) => page.id === pageHere.id));
                  const current = item.id === active && !onChild ? "page" as const : undefined;
                  const icon = <CabinetMark icon={item.icon} />;
                  const badge = typeof item.badge === "number" ? (
                    <span className={navBadgeClass(item.id, item.badge)}>{item.badge > 99 ? "99+" : item.badge}</span>
                  ) : null;
                  const pages = item.id === active && item.pages?.length ? (
                    <div className="cabinet-nav__sub" aria-label={item.label}>
                      <span className="cabinet-nav__mark" aria-hidden="true" />
                      {item.pages.map((page) => {
                        const here = page.id === pageHere?.id;
                        return (
                          <Link
                            key={page.id}
                            to={page.to}
                            className={here ? "is-current" : undefined}
                            aria-current={here ? "page" : undefined}
                          >
                            <span className="cabinet-nav__label">{page.label}</span>
                            {typeof page.badge === "number" ? (
                              <span className={navBadgeClass(page.id, page.badge)}>{page.badge > 99 ? "99+" : page.badge}</span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null;
                  if (item.to === "/trainer-admin") {
                    return (
                      <Fragment key={item.id}>
                        <Link to="/trainer-admin" search={item.search ?? {}} className={className} aria-current={current}>
                          {icon}
                          <span className="cabinet-nav__label">{item.label}</span>
                          {badge}
                        </Link>
                        {pages}
                      </Fragment>
                    );
                  }
                  if (item.to) {
                    return (
                      <Fragment key={item.id}>
                        <Link to={item.to} activeOptions={item.to === "/me" || item.to === "/admin" ? { exact: true } : undefined} className={className} aria-current={current}>
                          {icon}
                          <span className="cabinet-nav__label">{item.label}</span>
                          {badge}
                        </Link>
                        {pages}
                      </Fragment>
                    );
                  }
                  return (
                    <Fragment key={item.id}>
                      <button
                        type="button"
                        className={className}
                        aria-current={current}
                        onClick={() => onSelect?.(item.id)}
                      >
                        {icon}
                        <span className="cabinet-nav__label">{item.label}</span>
                        {badge}
                      </button>
                      {pages}
                    </Fragment>
                  );
                })}
              </div>
              {sectionKey ? (
                <div className={items.find((item) => item.id === active)?.sectionsMobile === false ? "cabinet-nav__sub cabinet-nav__sub--sections" : "cabinet-nav__sub"} aria-label="Разделы профиля">
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
              </div>
            </nav>
            <button type="button" className="cabinet-logout" onClick={onLogout} disabled={logoutPending}>
              {logoutPending ? "Выход…" : "Выйти"}
            </button>
          </aside>
          <section className="cabinet-main">{children}</section>
        </div>
      </main>
      <SiteFooter />
      {user?.needsCredentials ? <CredentialsRequiredDialog /> : null}
      {user?.needsDoorPassword && !user.needsCredentials ? <DoorPasswordDialog /> : null}
      <style>{CABINET_CSS}</style>
    </>
  );
}

const CABINET_CSS = `
.cabinet-title { display: grid; gap: 4px; }
.cabinet-title h1 { margin: 0; font-size: 16px; letter-spacing: var(--tracking-heading); font-weight: var(--fw-heading); color: color-mix(in srgb, var(--dark) 35%, var(--muted)); line-height: 1.25; }
.cabinet-title p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.35; }
.cabinet-side {
  display: grid; gap: 14px; align-content: start; align-self: start;
  position: sticky; top: var(--cabinet-sticky-top, 96px); z-index: 20;
  max-height: calc(100dvh - var(--cabinet-sticky-top, 96px) - 16px); overflow: auto;
  padding: 16px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white);
}
.cabinet-id { display: flex; align-items: center; gap: 10px; }
.cabinet-id > div { display: grid; gap: 2px; min-width: 0; }
.cabinet-id__mark { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); font-weight: var(--fw-title); object-fit: cover; }
.cabinet-id__line { display: flex; align-items: center; gap: 0; min-width: 0; color: inherit; text-decoration: none; }
a.cabinet-id__line:hover strong,
a.cabinet-id__line:hover .cabinet-id__open { color: var(--primary); }
a.cabinet-id__line:hover .trainer-name__line { color: var(--primary); }
.cabinet-id strong { display: block; min-width: 0; color: var(--dark); font-size: 14px; font-weight: var(--fw-title); line-height: 1.2; }
.cabinet-id > div > span { margin: 0; line-height: 1.3; }
.cabinet-id__open { position: relative; width: 28px; height: 28px; flex: 0 0 28px; margin-left: 2px; display: grid; place-items: center; border-radius: 50%; color: var(--dark); text-decoration: none; }
.cabinet-id__open::after { content: ""; position: absolute; inset: -8px; }
.cabinet-id__open:hover { color: var(--primary); }
.cabinet-id__open svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-id strong .trainer-name { flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 0.35em; font-size: inherit; color: inherit; }
.cabinet-id strong .trainer-name__line { color: var(--dark); font-size: inherit; margin: 0; line-height: 1.2; }
.cabinet-id__name { display: block; margin: 0; padding: 0; color: inherit; line-height: 1.15; text-decoration: none; }
.cabinet-id__name:hover .trainer-name__line { color: var(--primary); }
.cabinet-id span { color: var(--muted); font-size: 13px; }
.cabinet-id span.cabinet-id__open { color: var(--dark); font-size: 0; }
.cabinet-nav { display: flex; flex-direction: column; gap: 4px; }
.cabinet-nav__body { min-width: 0; }
.cabinet-nav__toggle-main { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1 1 auto; }
.cabinet-nav__chevron { margin-left: 8px; transform: rotate(90deg); transition: transform 0.2s ease; }
.cabinet-nav.is-open .cabinet-nav__chevron { transform: rotate(-90deg); }
.cabinet-nav .cabinet-nav__toggle { display: none; width: 100%; justify-content: space-between; border: 1px solid var(--line); background: var(--white); }
.cabinet-nav .cabinet-nav__toggle:focus-visible { outline: 2px solid var(--primary); outline-offset: 2px; }
.cabinet-nav__items { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.cabinet-nav__sub { position: relative; display: grid; gap: 2px; margin: 0 0 4px 12px; padding-left: 8px; border-left: 2px solid rgba(var(--primary-rgb), 0.35); }
.cabinet-nav__mark { position: absolute; left: 0; top: 0; border-radius: var(--radius-control); background: rgba(var(--primary-rgb), 0.1); pointer-events: none; z-index: 0; transition: transform 0.42s cubic-bezier(0.22, 1, 0.36, 1), width 0.42s cubic-bezier(0.22, 1, 0.36, 1), height 0.42s cubic-bezier(0.22, 1, 0.36, 1); }
@media (prefers-reduced-motion: reduce) {
  .cabinet-nav__mark, .cabinet-nav__chevron { transition: none; }
}
.cabinet-nav__body:has(> .cabinet-nav__sub) { display: grid; }
.cabinet-nav__body:has(> .cabinet-nav__sub) .cabinet-nav__items { display: contents; }
.cabinet-nav__body > .cabinet-nav__sub { grid-row: var(--nav-sub-row); margin-left: 12px; }
.cabinet-nav__sub a { position: relative; z-index: 1; color: var(--muted); font-size: 14px; font-weight: var(--fw-ui); transition: color 0.28s ease; }
.cabinet-nav__sub a.is-current { background: transparent; color: var(--primary); }
.cabinet-nav button, .cabinet-nav a, .cabinet-logout {
  min-height: 44px; border: 0; border-radius: var(--radius-control); background: transparent;
  display: flex; align-items: center; gap: 10px; padding: 0 12px; color: var(--text);
  font: inherit; font-weight: var(--fw-title); text-align: left; text-decoration: none; cursor: pointer;
}
.cabinet-nav button svg, .cabinet-nav a svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
.cabinet-nav__label { min-width: 0; }
.cabinet-nav__badge { margin-left: auto; min-width: 1.5em; color: var(--muted); font-size: 11px; font-weight: var(--fw-ui); font-variant-numeric: tabular-nums; line-height: 1; text-align: right; }
.cabinet-nav__badge.is-hot { color: var(--primary); }
.cabinet-nav button.is-active, .cabinet-nav a.is-active { background: rgba(var(--primary-rgb), 0.1); color: var(--primary-dark); }
.cabinet-nav button:hover, .cabinet-nav a:hover, .cabinet-logout:hover { background: rgba(var(--dark-rgb), 0.04); }
.cabinet-nav__sub a { padding: 0 8px; color: var(--muted); font-weight: var(--fw-ui); }
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
.cabinet-card > .cabinet-online { padding: 16px 18px; }
.cabinet-stat, .cabinet-card { border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); }
.cabinet-stat { position: relative; padding: 16px 18px; }
a.cabinet-stat { display: block; color: inherit; text-decoration: none; }
a.cabinet-stat:hover { border-color: var(--primary); }
.cabinet-stat strong { display: block; font-size: 28px; letter-spacing: var(--tracking-heading); color: var(--dark); }
.cabinet-stat span { color: var(--muted); font-size: 13px; }
.cabinet-stat__mark { position: absolute; top: 14px; right: 14px; width: 28px; height: 28px; display: grid; place-items: center; color: var(--primary); }
.cabinet-stat .cabinet-stat__mark { color: var(--primary); font-size: 0; }
.cabinet-stat__mark svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-stat__delta { display: block; margin-top: 6px; font-size: 13px; font-weight: var(--fw-title); }
.cabinet-stat__delta.is-up { color: #15803d; }
.cabinet-stat__delta.is-down { color: var(--primary); }
.cabinet-stat__delta.is-flat { color: var(--muted); font-weight: var(--fw-ui); }
.cabinet-stat__switch { display: flex; flex-wrap: wrap; align-items: center; gap: 0 14px; margin: 0 36px 4px 0; }
.cabinet-stat__switch button { min-width: 44px; min-height: 44px; padding: 0 4px; border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 13px; line-height: 1; cursor: pointer; }
.cabinet-stat__switch button.is-current { color: var(--primary); font-weight: var(--fw-title); }
.cabinet-stat__switch button:hover { color: var(--primary-dark); }
.cabinet-stat__figure + .cabinet-stat__figure { margin-top: 12px; }
.cabinet-stat__note { display: block; margin-top: 2px; }
.cabinet-stat__leaders { list-style: none; margin: 2px 0 0; padding: 0; }
.cabinet-stat__leaders li { margin: 0; }
.cabinet-stat .cabinet-stat__who { display: flex; align-items: center; gap: 2px; width: fit-content; max-width: 100%; min-height: 44px; margin-top: 0; color: var(--dark); font-size: 15px; font-weight: var(--fw-title); line-height: 1.3; text-decoration: none; overflow-wrap: anywhere; }
.cabinet-stat a.cabinet-stat__who:hover,
.cabinet-stat a.cabinet-stat__who:hover .cabinet-id__open { color: var(--primary); }
.cabinet-stat .cabinet-stat__who .cabinet-id__open { color: var(--dark); font-size: 0; }
.cabinet-stat--brand { background: var(--primary); border-color: transparent; }
.cabinet-stat--brand strong,
.cabinet-stat--brand span,
.cabinet-stat--brand .cabinet-stat__mark { color: #fff; }
.cabinet-stat--brand .cabinet-stat__delta.is-up,
.cabinet-stat--brand .cabinet-stat__delta.is-down,
.cabinet-stat--brand .cabinet-stat__delta.is-flat { color: rgba(255, 255, 255, 0.88); }
.cabinet-contacts { display: grid; }
.cabinet-contacts > .cabinet-form { border-bottom: 1px solid var(--line); }
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
.cabinet-contact__marks .cabinet-mark--off { height: auto; min-height: 28px; max-width: 11rem; padding: 6px 10px; white-space: normal; text-align: right; line-height: 1.25; }
.cabinet-contact__panel { grid-area: panel; display: grid; gap: 8px; }
.cabinet-contact__panel label { display: grid; gap: 6px; }
.cabinet-contact__panel label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-contact__panel:empty { display: none; }
.cabinet-contact__phone { display: flex; align-items: center; gap: 8px; min-width: 0; }
.cabinet-contact__phone > input { flex: 1 1 auto; width: auto; min-width: 0; height: 44px; min-height: 44px; }
.cabinet-contact__phone .cabinet-contact__actions { flex: 0 0 auto; flex-wrap: nowrap; align-items: center; }
.cabinet-contact__phone .cabinet-form__ghost,
.cabinet-contact__phone .cabinet-form__cta { height: 44px; min-height: 44px; white-space: nowrap; }
.cabinet-contact__field { display: grid; gap: 6px; min-width: 0; }
.cabinet-contact__field span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-contact__panel input, .cabinet-contact__field input { width: 100%; min-width: 0; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--white); color: var(--dark); font: inherit; font-size: 16px; }
.cabinet-contact__panel .cabinet-contact__phone > input { width: auto; flex: 1 1 auto; height: 44px; }
.cabinet-contact__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cabinet-contact .cabinet-form__ghost,
.cabinet-contact .cabinet-form__cta { min-height: 44px; }
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
.cabinet-page-status { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 52px; padding: 12px 18px; }
.cabinet-card .cabinet-page-status h2 { margin: 0; padding: 0; border: 0; }
.cabinet-row { display: flex; justify-content: space-between; gap: 12px; align-items: center; padding: 14px 18px; border-bottom: 1px solid var(--line); color: inherit; text-decoration: none; }
.cabinet-row:last-child { border-bottom: 0; }
.cabinet-row strong { display: block; color: var(--dark); }
.cabinet-row > div { min-width: 0; }
.cabinet-row span, .cabinet-empty { display: block; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.cabinet-row__who { display: flex; align-items: center; gap: 12px; min-width: 0; }
.cabinet-row .cabinet-like-mark { display: grid; place-items: center; width: 24px; height: 24px; flex: 0 0 auto; color: var(--primary); font-size: 0; }
.cabinet-row .cabinet-like-mark svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-row .user-avatar { font-size: 0; color: inherit; }
.cabinet-row a.cabinet-id__line { min-height: 44px; color: inherit; text-decoration: none; }
.cabinet-row .cabinet-id__open { display: grid; color: var(--dark); font-size: 0; }
.cabinet-row a.cabinet-id__line:hover strong,
.cabinet-row a.cabinet-id__line:hover .cabinet-id__open { color: var(--primary); }
.cabinet-tabs button { display: inline-flex; align-items: center; gap: 8px; }
.cabinet-tab__count { min-width: 1.5em; color: var(--muted); font-size: 11px; font-weight: var(--fw-ui); font-variant-numeric: tabular-nums; text-align: right; }
.cabinet-tabs button[aria-selected="true"] .cabinet-tab__count { color: var(--primary); }
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
button.cabinet-name-link { border: 0; background: transparent; padding: 0; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-name-link:hover { text-decoration: underline; }
.cabinet-table-wrap { min-width: 0; max-width: 100%; overflow-x: auto; }
.cabinet-table { width: 100%; min-width: 760px; border-collapse: collapse; }
.cabinet-table th, .cabinet-table td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.cabinet-table--trainers th, .cabinet-table--trainers td { text-align: center; vertical-align: middle; }
.cabinet-table--trainers th.is-person, .cabinet-table--trainers td.is-person { text-align: left; }
.cabinet-table--trainers th.is-index, .cabinet-table--trainers td.is-index { width: 1%; padding-right: 2px; text-align: right; color: color-mix(in srgb, var(--muted) 48%, transparent); font-size: 11px; font-weight: 400; font-variant-numeric: tabular-nums; }
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
.cabinet-table--trainers th.is-index, .cabinet-table--trainers td.is-index { padding-left: 12px; }
.cabinet-table--trainers th.is-person, .cabinet-table--trainers td.is-person { padding-left: 8px; }
.cabinet-table--trainers td.is-audience { white-space: normal; }
.cabinet-table--trainers td.is-actions,
.cabinet-table--trainers td.is-publish { text-align: center; }
.cabinet-table--trainers th.is-contacts,
.cabinet-table--trainers td.is-contacts { text-align: left; }
.cabinet-table--trainers .is-publish.is-published { color: #16a34a; }
.cabinet-table--trainers .is-publish.is-draft { color: #f59e0b; }
.cabinet-table--trainers .is-publish.is-hidden,
.cabinet-table--trainers .is-publish.is-archived { color: #9ca3af; }
.cabinet-modal--trainer { z-index: 360; overflow: hidden; }
.trainer-edit-dialog { position: relative; width: min(960px, 100%); height: 100%; max-height: 100%; display: flex; flex-direction: column; overflow: hidden; border-radius: var(--card-radius); background: var(--white); color: var(--text); }
.trainer-edit-dialog__close { position: absolute; top: 8px; right: 8px; z-index: 3; }
.trainer-edit-card { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.trainer-edit-dialog .cabinet-card > h2 { padding-right: 56px; }
.trainer-edit-card > .trainer-edit-form,
.trainer-edit-card > .trainer-edit-scroll,
.trainer-edit-dialog > .cabinet-empty { flex: 1; min-height: 0; }
.trainer-edit-dialog .trainer-edit-form { display: flex; flex-direction: column; overflow: hidden; gap: 0; padding: 0; }
.trainer-edit-scroll { overflow: auto; overscroll-behavior: contain; }
.trainer-edit-form .trainer-edit-scroll { display: grid; gap: 12px; align-content: start; padding: 16px 18px; }
.trainer-edit-dialog .cabinet-form__actions { flex-shrink: 0; position: sticky; bottom: 0; z-index: 2; margin: 0; padding: 12px 18px calc(12px + env(safe-area-inset-bottom)); border-top: 1px solid var(--line); background: var(--white); }
.trainer-edit-dialog .address-field__menu,
.trainer-edit-dialog .entity-menu { position: fixed; z-index: 5; left: max(12px, env(safe-area-inset-left)); right: max(12px, env(safe-area-inset-right)); top: auto; bottom: max(72px, calc(12px + env(safe-area-inset-bottom))); width: auto; max-height: min(50vh, 320px); }
.trainer-edit-dialog .entity-menu.entity-menu--tall { max-height: min(52vh, 440px); }
.cabinet-table .trainer-name,
.cabinet-facts .trainer-name,
.cabinet-account .trainer-name,
.cabinet-card h2 .trainer-name { flex-direction: row; align-items: baseline; flex-wrap: wrap; gap: 0.35em; }
.cabinet-table--trainers .cabinet-mark { display: inline-grid; place-items: center; width: 44px; height: 44px; }
.cabinet-table--trainers .cabinet-mark svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-table--trainers .is-sent { color: #16a34a; }
.cabinet-table--trainers .is-unsent { color: #d97706; }
.cabinet-icon-btn.is-inactive,
.cabinet-icon-btn.is-inactive:disabled { color: var(--muted); opacity: 0.45; cursor: default; }
.cabinet-icon-btn.is-inactive:hover { background: transparent; }
.cabinet-table--trainers .cabinet-person { display: grid; grid-template-columns: 44px minmax(0, 240px); align-items: center; column-gap: 8px; width: max-content; }
.cabinet-table--trainers .cabinet-row-actions { justify-content: center; gap: 0; }
.cabinet-table--trainers .cabinet-person__text { min-width: 0; max-width: 240px; }
.cabinet-table--trainers .cabinet-person__text strong { display: block; white-space: normal; overflow: visible; overflow-wrap: anywhere; }
.cabinet-table--trainers .cabinet-person__meta { display: block; max-width: 240px; white-space: normal; overflow-wrap: anywhere; }
.cabinet-table--trainers .cabinet-person__text { display: flex; flex-direction: column; justify-content: center; gap: 1px; line-height: 1.15; }
.cabinet-table--trainers .cabinet-person__text strong { line-height: 1.15; }
.cabinet-table--trainers a.cabinet-trainer-name { display: inline; min-height: 0; line-height: 1.15; color: var(--primary); text-decoration: none; }
.cabinet-table--trainers a.cabinet-trainer-name:hover { text-decoration: underline; }
.cabinet-table--trainers a.cabinet-trainer-name .trainer-name__line { color: inherit; line-height: 1.15; }
.cabinet-table--trainers .cabinet-person__meta { margin-top: 0; color: var(--muted); font-size: 11px; line-height: 1.15; }
.cabinet-table--trainers .cabinet-rating { display: inline-flex; align-items: center; justify-content: center; gap: 4px; vertical-align: middle; color: var(--dark); font-weight: var(--fw-title); }
.cabinet-table--trainers .cabinet-rating svg { width: 14px; height: 14px; fill: #ffb400; }
.cabinet-table--trainers .cabinet-rating.is-empty { color: var(--muted); font-weight: var(--fw-ui); }
.cabinet-table--trainers .cabinet-rating.is-empty svg { fill: none; stroke: var(--muted); stroke-width: var(--icon-stroke); }
.cabinet-table--trainers .cabinet-rating__count { color: var(--muted); font-weight: var(--fw-ui); }
.cabinet-table--trainers .cabinet-account { display: grid; gap: 2px; justify-items: start; max-width: 220px; font-size: 13px; line-height: 1.25; overflow-wrap: anywhere; }
.cabinet-table--trainers .cabinet-social { display: inline-flex; align-items: center; justify-content: flex-start; }
.cabinet-table--trainers .cabinet-social__link { width: 44px; height: 44px; display: grid; place-items: center; color: inherit; }
.cabinet-table--trainers .cabinet-social__link svg { width: 22px; height: 22px; overflow: visible; }
.cabinet-table--trainers .cabinet-social__link--line svg { fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-filter-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 18px; border-bottom: 1px solid var(--line); }
.cabinet-filter-bar > button { min-height: 44px; display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; }
.cabinet-filter-bar > button:hover, .cabinet-filter-bar > button.is-open { border-color: var(--primary); color: var(--primary); }
.cabinet-filter-bar > button svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; transition: transform 0.16s ease; }
.cabinet-filter-bar > button.is-open svg { transform: rotate(180deg); }
.cabinet-filter-bar__count { min-width: 22px; height: 22px; padding: 0 6px; border-radius: 999px; background: var(--primary); color: #fff; font-size: 12px; font-weight: var(--fw-title); line-height: 22px; text-align: center; }
.cabinet-filters { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--line); }
.cabinet-filter-bar .cabinet-filters { flex: 1 1 100%; padding: 4px 0 0; border-bottom: 0; }
.cabinet-filters label { display: grid; gap: 6px; flex: 1 1 180px; min-width: min(100%, 180px); }
.cabinet-filters label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-filters label.cabinet-filters__search { flex: 1 1 100%; }
.cabinet-filters select, .cabinet-filters input { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; }
.cabinet-filters p { flex: 1 1 100%; }
@media (max-width: 767px) {
  .cabinet-filters select, .cabinet-filters input { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .cabinet-filter-bar > button svg { transition: none; }
}
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
.cabinet-note { margin: 6px 0 0; max-width: 62ch; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.cabinet-note--oneline { max-width: none; }
@media (min-width: 960px) {
  .cabinet-note--oneline { white-space: nowrap; }
}
.cabinet-form > .cabinet-note,
.cabinet-section > .cabinet-note,
.cabinet-form label > .cabinet-note,
.cabinet-card > .cabinet-note { margin-top: 0; }
.cabinet-card > .cabinet-note--lede { padding: 12px 18px 0; }
.cabinet-card > .cabinet-note--lede a { color: var(--primary); font-weight: var(--fw-title); text-decoration: none; }
.cabinet-card > .cabinet-note--lede a:hover { text-decoration: underline; }
.cabinet-facts { display: grid; gap: 8px; margin: 0; padding: 4px 18px 16px; list-style: none; color: var(--muted); font-size: 14px; line-height: 1.45; }
.cabinet-facts a { color: var(--primary); font-weight: var(--fw-title); text-decoration: none; }
.cabinet-facts a:hover { text-decoration: underline; }
.cabinet-form { display: grid; gap: 12px; padding: 16px 18px; }
.cabinet-form > h3 { margin: 0; font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; color: var(--dark); }
.cabinet-form:has(.cabinet-section) { gap: 18px; }
.cabinet-section { display: grid; gap: 12px; margin: 0; padding: 16px; border: 1px solid var(--line); border-radius: var(--card-radius); background: rgba(var(--dark-rgb), 0.025); scroll-margin-top: calc(var(--cabinet-sticky-top, 96px) + 16px); }
#trainer-page-status, #trainer-contact-block { scroll-margin-top: calc(var(--cabinet-sticky-top, 96px) + 16px); }
.cabinet-section h3 { margin: 0; padding-bottom: 10px; border-bottom: 1px solid var(--line); font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; color: var(--dark); }
.mail-pref { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.mail-pref > div { min-width: 0; flex: 1; }
.mail-pref__label { margin: 0; color: var(--dark); font-size: 15px; font-weight: var(--fw-title); }
.mail-switch { flex: 0 0 auto; width: 52px; height: 44px; padding: 0; border: 0; background: transparent; display: inline-flex; align-items: center; justify-content: flex-start; cursor: pointer; }
.mail-switch__thumb { width: 44px; height: 26px; border-radius: 999px; background: #d1d5db; position: relative; }
.mail-switch__thumb::after { content: ""; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; transition: transform 0.15s ease; }
.mail-switch.is-on .mail-switch__thumb { background: var(--primary); }
.mail-switch.is-on .mail-switch__thumb::after { transform: translateX(18px); }
.mail-switch:disabled { opacity: 0.6; cursor: default; }
.mail-switch.is-locked:disabled { opacity: 1; cursor: default; }
.mail-switch.is-locked .mail-switch__thumb { background: #c9a8aa; }
.mail-switch.is-locked .mail-switch__thumb::after { background: #f3f4f6; }
.cabinet-section--place { background: rgba(var(--primary-rgb), 0.08); border-color: rgba(var(--primary-rgb), 0.35); }
.cabinet-section--place h3 { border-bottom-color: rgba(var(--primary-rgb), 0.22); }
.cabinet-section .places-field { padding: 12px; border-radius: var(--radius-control); background: var(--white); border: 1px solid rgba(var(--primary-rgb), 0.18); }
.cabinet-form__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.cabinet-form__row > label { min-width: 0; }
.cabinet-choices { display: flex; flex-wrap: wrap; gap: 8px; }
.cabinet-choices button { min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-choices button.is-on { border-color: transparent; background: var(--primary); color: var(--white); }
.cabinet-choices button.is-on:hover { background: var(--primary-dark); color: var(--white); }
.cabinet-row .cabinet-review__pair { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; min-height: 0; line-height: 1; }
.cabinet-row .cabinet-review__pair strong { display: inline; line-height: 1; }
.cabinet-row .cabinet-review__pair a.cabinet-id__line { min-height: 0; }
.cabinet-row .cabinet-review__pair + span { margin-top: 2px; line-height: 1.2; }
.cabinet-row .review-item__stars { display: inline-flex; align-items: center; justify-content: center; gap: 1px; height: auto; flex: 0 0 auto; line-height: 0; }
.cabinet-row .review-item__stars svg { width: 14px; height: 14px; display: block; fill: #ffb400; }
.cabinet-row .review-item__stars svg.is-empty { fill: var(--line); }
.cabinet-review-list { padding-inline: 0; }
.cabinet-review { display: grid; gap: 0; padding: 0; border-bottom: 1px solid var(--line); }
.cabinet-review .cabinet-row { border-bottom: 0; }
.cabinet-review:last-child { border-bottom: 0; }
.cabinet-review__body { display: grid; gap: 8px; padding: 0 18px 16px; }
.cabinet-row > time { flex: 0 0 auto; color: var(--muted); font-size: 12px; font-weight: var(--fw-title); line-height: 1.3; }
.cabinet-review__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.cabinet-review__reply { display: grid; gap: 6px; padding: 12px; border-radius: var(--radius-control); background: rgba(var(--dark-rgb), 0.03); }
.cabinet-review__reply p { margin: 0; }
.cabinet-review__open { justify-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; color: var(--primary-dark); font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-review__open:hover { color: var(--primary); }
.cabinet-review form { display: grid; gap: 8px; }
.cabinet-review form label { display: grid; gap: 6px; }
.cabinet-review form label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-review textarea { width: 100%; min-height: 96px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 16px; resize: vertical; }
.cabinet-review__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cabinet-review__cancel { min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--line); background: var(--white); color: var(--dark); font: inherit; font-size: 14px; cursor: pointer; }
.cabinet-form + .cabinet-form { border-top: 1px solid var(--line); }
.cabinet-form label { display: grid; gap: 6px; }
.cabinet-form label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-form__label-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.cabinet-form__label-end { display: flex; align-items: center; justify-content: flex-end; gap: 8px; min-width: 0; margin-left: auto; }
.cabinet-form__label-row .cabinet-mark--off { height: auto; min-height: 28px; max-width: 11rem; padding: 6px 10px; white-space: normal; text-align: right; line-height: 1.25; }
.cabinet-edit { min-height: 44px; padding: 0; border: 0; background: none; color: var(--primary); font: inherit; font-size: 13px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-avatar { position: relative; display: flex; align-items: center; gap: 14px; }
.cabinet-avatar__photo, .cabinet-avatar__mark { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); display: grid; place-items: center; font-weight: var(--fw-title); font-size: 24px; }
.cabinet-form .cabinet-avatar input { position: absolute; width: 1px; height: 1px; min-height: 0; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); }
.cabinet-form__verified { color: #16a34a; font-style: normal; }
.cabinet-form__actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.cabinet-sessions > summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; margin: 0; padding: 0; list-style: none; cursor: pointer; color: var(--dark); font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; }
.cabinet-sessions > summary::-webkit-details-marker { display: none; }
.cabinet-sessions > summary::marker { content: ""; }
.cabinet-sessions__chevron { width: 18px; height: 18px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-sessions[open] > summary .cabinet-sessions__chevron { transform: rotate(180deg); }
.cabinet-session { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 8px 0; border-top: 1px solid var(--line); }
.cabinet-session p { margin: 0; }
.cabinet-session__face { color: var(--dark); font-weight: var(--fw-title); }
.cabinet-form__ghost, label.cabinet-form__ghost { position: relative; display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 15px; font-weight: var(--fw-title); cursor: pointer; text-decoration: none; }
.cabinet-form__ghost:disabled { opacity: 0.6; cursor: default; }
.cabinet-form__cta { display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-size: 15px; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-form__cta:disabled { opacity: 0.6; cursor: default; }
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
.cabinet-form textarea { min-height: 120px; resize: vertical; }
.cabinet-form input { padding-block: 0; }
.publish-pick { display: grid; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
.publish-pick legend { padding: 0; color: var(--muted); font-size: 13px; font-weight: var(--fw-title); line-height: 1.45; }
.publish-pick__row { display: grid; gap: 6px; }
label.publish-pick__option {
  position: relative; display: flex; align-items: center; gap: 6px; min-width: 0; min-height: 44px; margin: 0; padding: 2px 8px;
  border: 1px solid transparent; border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: var(--fw-title); line-height: 1.2;
  box-shadow: none;
}
.publish-pick__option span { color: inherit; font-size: inherit; font-weight: inherit; }
.publish-pick__option input {
  position: absolute; width: 1px; height: 1px; min-height: 0; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0);
}
.publish-pick__box {
  width: 18px; height: 18px; flex: 0 0 auto; border-radius: 5px; border: 1.5px solid currentColor;
  display: grid; place-items: center; background: #fff;
}
.publish-pick__option.is-on .publish-pick__box { border-color: currentColor; background: #fff; }
.publish-pick__option.is-on .publish-pick__box::after {
  content: ""; width: 5px; height: 9px; margin-top: -1px; border: solid currentColor; border-width: 0 2px 2px 0; transform: rotate(45deg);
}
label.publish-pick__option.is-published { background: #e7f3ec; color: #3d6b52; border-color: #c5dfd0; }
label.publish-pick__option.is-published.is-on { background: #d5eadf; color: #245c40; border-color: #b7d4c4; }
label.publish-pick__option.is-hidden { background: #f8f1e4; color: #7a5a28; border-color: #e6d7bc; }
label.publish-pick__option.is-hidden.is-on { background: #f0e4cc; color: #6a4a18; border-color: #dcc9a4; }
label.publish-pick__option.is-archived { background: #f8eeee; color: #8a4a4e; border-color: #ead4d6; }
label.publish-pick__option.is-archived.is-on { background: #f0e0e2; color: #7a3a3e; border-color: #e0c4c8; }
.cabinet-card > .publish-pick { padding: 2px 14px 12px; }
.cabinet-page-status .cabinet-status--published { background: #39b165; }
.cabinet-page-status__side { display: flex; align-items: center; gap: 4px; }
.publish-pick__option:focus-within { outline: 2px solid rgba(var(--dark-rgb), 0.45); outline-offset: 2px; }
a.cabinet-text-link, button.cabinet-text-link {
  display: inline; position: relative; min-height: 0; margin: 0; padding: 0; border: 0; background: none;
  color: var(--primary); font: inherit; font-size: inherit; font-weight: var(--fw-title); line-height: inherit; vertical-align: baseline;
  text-decoration: underline; text-underline-offset: 3px; cursor: pointer;
}
a.cabinet-text-link::after, button.cabinet-text-link::after { content: ""; position: absolute; left: -4px; right: -4px; top: 50%; height: 44px; transform: translateY(-50%); }
a.cabinet-text-link:hover, button.cabinet-text-link:hover { color: var(--primary-dark); }
@media (min-width: 720px) {
  .publish-pick__row { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.cabinet-form__submit { justify-self: start; min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-form__submit:disabled { opacity: 0.6; cursor: default; }
.cabinet-form__ok { margin: 0; color: #157a3a; font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.cabinet-form__error { margin: 0; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.cabinet-modal { position: fixed; inset: 0; z-index: 420; display: grid; place-items: center; overflow: auto; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(var(--dark-rgb), 0.45); }
.cabinet-modal--lock { z-index: 500; }
html.is-credentials-locked body > *:not(.cabinet-modal--lock) { pointer-events: none !important; }
html.is-credentials-locked .cabinet-modal--lock { pointer-events: auto; }
.cabinet-modal--lock .auth-field__toggle { background: transparent; color: var(--muted); border-radius: 0; min-height: 44px; padding: 0 10px; justify-self: auto; width: auto; }
.cabinet-modal--lock .auth-submit { width: 100%; justify-self: stretch; height: 50px; border-radius: var(--radius-control); }
.cabinet-modal__card { width: min(440px, 100%); max-height: 100%; overflow: auto; display: grid; gap: 12px; padding: 20px; border-radius: var(--card-radius); background: var(--white); }
.cabinet-modal__card h2 { margin: 0; font-size: 18px; color: var(--dark); }
.cabinet-modal__card p { margin: 0; color: var(--text); }
.cabinet-modal__card button { justify-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
.cabinet-modal__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cabinet-modal__card input { width: 100%; min-height: 44px; padding: 0 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 16px; }
.cabinet-modal__card form { display: grid; gap: 12px; }
.cabinet-modal__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.cabinet-modal__card .cabinet-form__ghost { border: 1px solid var(--line); background: var(--white); color: var(--dark); }
.cabinet-modal__card .cabinet-form__ghost:disabled, .cabinet-modal__card button:disabled { opacity: 0.6; cursor: default; }
.cabinet-delete { margin: 0; }
.cabinet-delete__link { justify-self: start; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--muted); font: inherit; font-size: 13px; text-decoration: underline; text-underline-offset: 3px; cursor: pointer; }
.cabinet-delete__link:hover { color: var(--primary-dark); }
.cabinet-modal__card--form { width: min(640px, 100%); max-height: 100%; overflow: auto; display: grid; gap: 12px; align-content: start; }
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
.entity-menu--tall { max-height: min(52vh, 440px); }
.entity-menu__hint { display: grid; gap: 4px; padding: 8px 10px; }
.entity-menu__hint p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.4; }
.entity-menu__hint button, .cabinet-modal__card--form .entity-menu__hint button { width: auto; min-height: 44px; padding: 0; border: 0; background: transparent; color: var(--primary); font: inherit; font-weight: var(--fw-title); text-align: left; cursor: pointer; }
.entity-menu button, .cabinet-modal__card--form .entity-menu button { width: 100%; min-height: 44px; padding: 0 10px; border: 0; border-radius: var(--radius-control); background: transparent; color: var(--dark); font: inherit; font-weight: var(--fw-ui); text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; }
.entity-menu button span { color: var(--muted); font-size: 13px; }
.entity-menu button:hover, .cabinet-modal__card--form .entity-menu button:hover { background: rgba(var(--dark-rgb), 0.04); }
.places-field { display: grid; gap: 12px; margin: 0; padding: 0; border: 0; min-width: 0; }
.places-field legend { font-weight: var(--fw-title); }
.places-field__row { display: grid; gap: 6px; min-width: 0; }
.places-field__line { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; align-items: start; }
.places-field__line.has-remove { grid-template-columns: minmax(0, 1fr) 44px; }
.places-field__line > .address-field { min-width: 0; }
.places-field__parts { margin: 6px 0 0; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.places-field__add { min-height: 44px; padding: 0 16px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-weight: var(--fw-title); cursor: pointer; justify-self: start; }
.address-field { position: relative; }
.cabinet-form .address-field input[type="text"], .cabinet-form .address-field input:not([type="hidden"]) { padding-right: 48px; }
.address-field__clear { position: absolute; top: 0; right: 0; width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: transparent; color: var(--muted); cursor: pointer; }
.address-field__clear svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.address-field__status { min-height: 44px; display: flex; align-items: center; padding: 0 10px; color: var(--muted); font-size: 14px; }
.address-field__notice { margin: 6px 0 0; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
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
.entity-input__error { flex: 1 1 100%; margin: 0; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.cabinet-brand-field { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); }
.cabinet-brand-field svg { width: 20px; height: 20px; flex: 0 0 auto; overflow: visible; }
.cabinet-brand-field svg.line-icon { color: var(--muted); stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-form .cabinet-brand-field input { flex: 1; width: auto; min-width: 0; border: 0; min-height: 42px; padding: 0; background: transparent; }
.cabinet-brand-field.is-locked { background: #eceff3; }
.cabinet-form .cabinet-brand-field.is-locked input,
.cabinet-form .cabinet-brand-field input[readonly],
.cabinet-form .cabinet-brand-field input.is-locked { background: transparent; color: var(--muted); cursor: default; }
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
.cabinet-media { display: grid; gap: 8px; justify-items: stretch; width: 100%; min-width: 0; }
.cabinet-media__label { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-photos { display: flex; flex-wrap: nowrap; gap: 10px; width: 100%; max-width: 100%; margin: 0; padding: 0 0 8px; list-style: none; overflow-x: auto; overscroll-behavior-x: contain; }
.cabinet-photo { position: relative; flex: 0 0 auto; width: 128px; height: 128px; border-radius: var(--radius-control); overflow: hidden; background: var(--neutral-bg, #f3f4f6); border: 1px solid var(--line); }
.cabinet-photo.is-pending { opacity: 0.55; }
.cabinet-photo.is-draggable { cursor: grab; touch-action: pan-x; }
.cabinet-photo.is-placeholder { background: rgba(var(--primary-rgb), 0.08); border-style: dashed; border-color: rgba(var(--primary-rgb), 0.45); pointer-events: none; }
.cabinet-photo.is-placeholder img,
.cabinet-photo.is-placeholder button,
.cabinet-photo.is-placeholder span { visibility: hidden; }
.cabinet-photo.is-ghost { position: fixed; left: 0; top: 0; z-index: 30; margin: 0; pointer-events: none; transform-origin: 0 0; box-shadow: 0 14px 32px rgba(var(--dark-rgb), 0.18); }
html.is-photo-drag, html.is-photo-drag * { cursor: grabbing !important; }
.cabinet-photo img { width: 100%; height: 100%; object-fit: cover; }
.cabinet-photo > span { position: absolute; left: 6px; bottom: 6px; padding: 2px 8px; border-radius: 999px; background: var(--white); color: var(--dark); font-size: 11px; font-weight: var(--fw-title); }
.cabinet-form .cabinet-photo__remove.cabinet-icon-btn {
  position: absolute; top: 0; right: 0; z-index: 2;
  width: 32px; height: 32px; min-height: 32px;
  background: var(--white); color: var(--dark);
  border: 1px solid var(--line);
  box-shadow: 0 1px 4px rgba(var(--dark-rgb), 0.28);
}
.cabinet-form .cabinet-photo__remove.cabinet-icon-btn:hover { background: var(--white); }
label.cabinet-form__ghost input { position: absolute; width: 1px; height: 1px; min-height: 0; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); }
a.cabinet-icon-btn { text-decoration: none; }
@media (max-width: 960px) {
  .layout-with-sidebar:has(> .cabinet-side) { display: flex; flex-direction: column; align-items: stretch; }
  .cabinet-side { width: 100%; }
  .cabinet-section, #trainer-page-status, #trainer-contact-block { scroll-margin-top: calc(var(--cabinet-sticky-top, 96px) + var(--cabinet-side-h, 0px) + 16px); }
  .cabinet-nav .cabinet-nav__toggle { display: flex; font-size: 16px; }
  .cabinet-nav__toggle .cabinet-nav__label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .cabinet-nav__body,
  .cabinet-nav__body:has(> .cabinet-nav__sub) { display: none; }
  .cabinet-nav.is-open .cabinet-nav__body { display: block; }
  .cabinet-nav.is-open .cabinet-nav__body:has(> .cabinet-nav__sub) { display: grid; }
  .cabinet-nav__sub--sections { display: none; }
}
.site-text { display: grid; gap: 8px; min-width: 0; }
.site-text > p, .site-tokens p, .site-parts { margin: 6px 0 0; max-width: 62ch; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.site-text > p:first-child, .site-tokens p:first-child { margin-top: 0; }
.site-tokens { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.site-tokens li { display: grid; gap: 4px; min-width: 0; }
.site-tokens button { justify-self: start; max-width: 100%; min-height: 44px; padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-title); text-align: left; cursor: pointer; }
.site-tokens button:hover { border-color: var(--primary); color: var(--primary); }
.site-tokens code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; font-weight: var(--fw-title); }
.site-parts { display: grid; gap: 4px; padding-left: 1.2em; }
@media (max-width: 767px) {
  .cabinet-form input, .cabinet-form textarea, .cabinet-form select, .entity-input input { font-size: 16px; }
  .cabinet-side {
    position: static;
    top: auto;
    z-index: auto;
    max-height: none;
    overflow: visible;
  }
  .cabinet-logout { display: none; }
  .layout-with-sidebar:has(> .cabinet-side) .cabinet-section,
  .layout-with-sidebar:has(> .cabinet-side) #trainer-page-status,
  .layout-with-sidebar:has(> .cabinet-side) #trainer-contact-block {
    scroll-margin-top: calc(var(--cabinet-sticky-top, 96px) + 16px);
  }
}
.cabinet-overview { display: grid; gap: var(--layout-gap); min-width: 0; }
.cabinet-overview-rating {
  position: relative; isolation: isolate; min-width: 0; min-height: 300px; overflow: hidden;
  display: grid; grid-template-columns: minmax(0, 1fr); align-content: start; gap: 10px;
  padding: 22px; border-radius: var(--card-radius);
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%); color: #fff;
  box-shadow: 0 18px 44px rgba(var(--primary-rgb), 0.2);
}
.cabinet-overview-rating::before,
.cabinet-overview-rating::after { content: ""; position: absolute; z-index: -1; border-radius: 50%; background: rgba(255, 255, 255, 0.1); pointer-events: none; }
.cabinet-overview-rating::before { width: 240px; height: 240px; top: -150px; right: -70px; }
.cabinet-overview-rating::after { width: 180px; height: 180px; right: 90px; bottom: -145px; }
.cabinet-overview-rating__mark {
  position: absolute; top: 18px; right: 18px; width: 48px; height: 48px;
  display: grid; place-items: center; border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 16px; background: rgba(255, 255, 255, 0.14);
}
.cabinet-overview-rating__mark svg { width: 24px; height: 24px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-overview-rating__eyebrow { padding-right: 60px; color: rgba(255, 255, 255, 0.82); font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.04em; text-transform: uppercase; }
.cabinet-overview-rating__score { display: flex; align-items: flex-end; gap: 10px; width: fit-content; min-height: 72px; color: #fff; text-decoration: none; }
.cabinet-overview-rating__score strong { font-size: clamp(72px, 16vw, 112px); line-height: 0.78; letter-spacing: -0.065em; font-variant-numeric: tabular-nums; text-shadow: 0 8px 22px rgba(var(--dark-rgb), 0.16); }
.cabinet-overview-rating__score > span { margin-bottom: 3px; padding: 5px 9px; border-radius: 999px; background: rgba(255, 255, 255, 0.14); color: #fff; font-size: 13px; font-weight: var(--fw-title); white-space: nowrap; }
.cabinet-overview-rating__score:hover strong { transform: translateY(-1px); }
.cabinet-overview-rating__score:focus-visible { outline: 2px solid #fff; outline-offset: 5px; border-radius: 8px; }
.cabinet-overview-rating__level { min-width: 0; display: grid; gap: 5px; }
.cabinet-overview-rating__level strong { color: #fff; font-size: 18px; }
.cabinet-overview-rating__level span { color: rgba(255, 255, 255, 0.82); font-size: 13px; }
.cabinet-overview-rating__level .cabinet-overview-rating__step { color: rgba(255, 255, 255, 0.7); font-size: 11px; font-weight: var(--fw-title); letter-spacing: 0.04em; text-transform: uppercase; }
.cabinet-overview-rating__level .cabinet-overview-rating__level-text { max-width: 32ch; line-height: 1.4; }
.cabinet-overview-rating__level .cabinet-overview-rating__next { margin-top: 3px; color: #fff; font-weight: var(--fw-title); line-height: 1.35; }
.cabinet-overview-rating__progress { width: 100%; height: 8px; margin-top: 2px; overflow: hidden; border-radius: 999px; background: rgba(255, 255, 255, 0.2); }
.cabinet-overview-rating__progress > span { display: block; height: 100%; border-radius: inherit; background: #fff; box-shadow: 0 0 16px rgba(255, 255, 255, 0.48); }
.cabinet-overview-rating__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 18px; margin-top: auto; padding-top: 8px; }
.cabinet-overview-rating__actions a,
.cabinet-overview-rating__actions button {
  position: relative; display: inline-flex; align-items: center; min-height: 44px; margin: 0; padding: 0;
  border: 0; background: transparent; color: #fff; font: inherit; font-size: 14px; font-weight: var(--fw-title);
  text-decoration: underline; text-underline-offset: 4px; cursor: pointer;
}
.cabinet-overview-rating__actions a:hover,
.cabinet-overview-rating__actions button:hover { text-decoration-thickness: 2px; }
.cabinet-overview-rating__actions a:focus-visible,
.cabinet-overview-rating__actions button:focus-visible { outline: 2px solid #fff; outline-offset: 3px; border-radius: 3px; }
.cabinet-overview-tiles { display: grid; grid-template-columns: minmax(0, 1fr); grid-auto-rows: 1fr; gap: 16px; }
.cabinet-overview-tile {
  --tile-bg: var(--white); --tile-accent: var(--dark); --tile-border: var(--line);
  min-width: 0; min-height: 190px; display: flex; flex-direction: column; gap: 8px;
  padding: 18px; border: 1px solid var(--tile-border); border-radius: var(--card-radius);
  background: var(--tile-bg); color: var(--dark); text-decoration: none;
  transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
}
.cabinet-overview-tile:hover { transform: translateY(-2px); border-color: var(--tile-accent); box-shadow: 0 12px 28px rgba(var(--dark-rgb), 0.08); }
.cabinet-overview-tile:focus-visible { outline: 2px solid var(--tile-accent); outline-offset: 3px; }
.cabinet-overview-tile__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--tile-accent); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-overview-tile__top svg { width: 24px; height: 24px; flex: 0 0 auto; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-overview-tile > strong { color: var(--tile-accent); font-size: clamp(46px, 8vw, 64px); line-height: 0.95; letter-spacing: -0.045em; font-variant-numeric: tabular-nums; }
.cabinet-overview-tile__detail { max-width: 24ch; color: var(--text); font-size: 14px; line-height: 1.4; }
.cabinet-overview-tile__action { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 44px; margin-top: auto; color: var(--tile-accent); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-overview-tile__action span { font-size: 20px; transition: transform 160ms ease; }
.cabinet-overview-tile:hover .cabinet-overview-tile__action span { transform: translateX(3px); }
.cabinet-overview-tile.is-coral { --tile-bg: rgba(var(--primary-rgb), 0.11); --tile-accent: var(--primary-dark); --tile-border: rgba(var(--primary-rgb), 0.24); }
.cabinet-overview-tile.is-aqua { --tile-bg: #e8f7f6; --tile-accent: #176f74; --tile-border: #c5e8e6; }
.cabinet-overview-tile.is-gold { --tile-bg: #fff7df; --tile-accent: #8a6310; --tile-border: #f0dfae; }
.cabinet-overview-tile.is-violet { --tile-bg: #f2efff; --tile-accent: #654ea3; --tile-border: #dcd5f5; }
.cabinet-overview-tile.is-green { --tile-bg: #edf8ef; --tile-accent: #34734a; --tile-border: #cfe8d5; }
.cabinet-overview-tile.is-blue { --tile-bg: #edf5ff; --tile-accent: #376b9b; --tile-border: #cfdfef; }
.cabinet-modal__card--rating { width: min(600px, 100%); }
.cabinet-rating-total { display: flex; align-items: baseline; gap: 8px; color: var(--dark); font-size: 16px; font-weight: var(--fw-title); }
.cabinet-rating-total strong { font-size: 40px; line-height: 1; letter-spacing: -0.03em; }
.cabinet-rating-total b, .cabinet-rating-parts__score b { color: var(--primary); font-weight: inherit; }
.cabinet-rating-parts { width: 100%; margin: 0; border-collapse: collapse; table-layout: fixed; }
.cabinet-rating-parts tr { border-top: 1px solid var(--line); }
.cabinet-rating-parts th, .cabinet-rating-parts td { padding: 10px 0; vertical-align: top; }
.cabinet-rating-parts th { display: grid; grid-template-columns: 24px minmax(0, 1fr); gap: 8px; padding-right: 12px; color: var(--dark); text-align: left; }
.cabinet-rating-parts th svg { width: 20px; height: 20px; margin-top: 1px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-rating-parts th strong { display: block; font-size: 15px; font-weight: var(--fw-title); }
.cabinet-rating-parts th small { display: block; margin-top: 2px; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.35; }
.cabinet-rating-parts td { width: 132px; color: var(--dark); font-size: 14px; font-weight: var(--fw-title); text-align: right; white-space: nowrap; }
.cabinet-rating-parts__score { display: block; }
.cabinet-rating-parts__progress { display: block; width: 100%; height: 6px; margin-top: 8px; overflow: hidden; border-radius: 999px; background: rgba(var(--primary-rgb), 0.14); }
.cabinet-rating-parts__progress > span { display: block; height: 100%; border-radius: inherit; background: var(--primary); transform-origin: left; animation: cabinet-rating-progress-in 0.45s ease-out both; }
@keyframes cabinet-rating-progress-in {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
.cabinet-modal__card--rating button { justify-self: stretch; }
@media (min-width: 768px) {
  .cabinet-overview-rating { min-height: 320px; grid-template-columns: minmax(0, 1.3fr) minmax(220px, 0.7fr); column-gap: 28px; padding: 28px; }
  .cabinet-overview-rating__eyebrow,
  .cabinet-overview-rating__score,
  .cabinet-overview-rating__progress,
  .cabinet-overview-rating__actions { grid-column: 1; }
  .cabinet-overview-rating__level { grid-column: 2; grid-row: 1 / span 4; align-self: stretch; align-content: center; margin-top: 58px; padding: 18px; border: 1px solid rgba(255, 255, 255, 0.18); border-radius: var(--card-radius); background: rgba(255, 255, 255, 0.1); }
  .cabinet-overview-tiles { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .cabinet-stats--pulse { grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr) minmax(0, 1fr); }
  .cabinet-stats--pulse .cabinet-stat--visits { grid-column: 1; grid-row: 1 / span 2; }
  .cabinet-stats--pulse .cabinet-stat--shows { grid-column: 2; grid-row: 1; }
  .cabinet-stats--pulse .cabinet-stat--likes { grid-column: 3; grid-row: 1; }
  .cabinet-stats--pulse .cabinet-stat--contacts { grid-column: 2 / span 2; grid-row: 2; }
}
@media (max-width: 767px) {
  .cabinet-stats--pulse { grid-template-columns: 1fr; }
  .cabinet-rating-total strong { font-size: 36px; }
}
@media (min-width: 480px) and (max-width: 767px) {
  .cabinet-overview-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 560px) {
  .cabinet-rating-parts tr { display: grid; grid-template-columns: minmax(0, 1fr); padding: 10px 0; }
  .cabinet-rating-parts th, .cabinet-rating-parts td { width: auto; padding-block: 0; }
  .cabinet-rating-parts th { padding-right: 0; }
  .cabinet-rating-parts td { padding-top: 5px; padding-left: 32px; text-align: left; }
  .cabinet-rating-parts__progress { width: min(220px, 100%); }
}
@media (prefers-reduced-motion: reduce) {
  .cabinet-rating-parts__progress > span { animation: none; }
}
@media (max-width: 640px) {
  .cabinet-stats { grid-template-columns: 1fr; }
  .cabinet-contact { grid-template-columns: 28px minmax(0, 1fr) auto; }
  .cabinet-contact__phone { flex-direction: column; align-items: stretch; }
  .cabinet-contact__phone > input { width: 100%; flex: 1 1 auto; }
  .cabinet-contact__phone .cabinet-contact__actions { flex: 1 1 auto; flex-wrap: wrap; width: 100%; }
  .cabinet-contact__actions { flex-direction: column; align-items: stretch; }
  .cabinet-contact__phone .cabinet-form__ghost,
  .cabinet-contact__phone .cabinet-form__cta,
  .cabinet-contact__actions .cabinet-form__cta,
  #trainer-contacts .cabinet-form__actions .cabinet-form__cta { width: 100%; white-space: normal; }
  .cabinet-row { align-items: flex-start; flex-direction: column; }
  .cabinet-status-stack { align-items: center; align-self: flex-start; }
  .cabinet-form__row { grid-template-columns: 1fr; }
  .cabinet-section { padding: 14px; }
  .mail-pref { align-items: flex-start; gap: 12px; }
}
`;
