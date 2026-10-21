import { Link } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const ICONS = {
  overview: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  trainers: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  reviews: "M5 6h14v9H8l-3 3V6z",
  accounts: "M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01",
  profile: "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  favorites: "M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z",
  bookings: "M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  finance: "M4 5h16v14H4zM4 9h16M8 13h5",
} as const;

export type CabinetIcon = keyof typeof ICONS;

export const REVIEW_STATUS_LABEL = {
  pending: "На модерации",
  published: "Опубликовано",
  rejected: "Отклонено",
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

export type AccountSectionPath = "/account/reviews" | "/account/bookings" | "/account/favorites" | "/account/settings";

export type AdminSectionPath =
  | "/admin"
  | "/admin/trainers"
  | "/admin/reviews"
  | "/admin/accounts"
  | "/admin/finance"
  | "/admin/settings";

export type CabinetNavItem = {
  id: string;
  label: string;
  icon: CabinetIcon;
  to?: AccountSectionPath | AdminSectionPath;
};

export function CabinetShell({
  title,
  lede,
  name,
  role,
  items,
  active,
  onSelect,
  avatarUrl,
  onLogout,
  logoutPending,
  children,
}: {
  title: string;
  lede?: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
  items: CabinetNavItem[];
  active: string;
  onSelect?: (id: string) => void;
  onLogout: () => void;
  logoutPending: boolean;
  children: ReactNode;
}) {
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current?.querySelector(".is-active")?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [active]);

  return (
    <>
      <SiteHeader />
      <main>
        <div className="layout-with-sidebar">
          <header className="cabinet-head">
            <h1>{title}</h1>
            {lede ? <p>{lede}</p> : null}
          </header>
          <aside className="cabinet-side">
            <div className="cabinet-id">
              {avatarUrl ? (
                <img className="cabinet-id__mark" src={avatarUrl} alt="" />
              ) : (
                <span className="cabinet-id__mark" aria-hidden="true">{name.slice(0, 1)}</span>
              )}
              <div>
                <strong>{name}</strong>
                <span>{role}</span>
              </div>
            </div>
            <nav className="cabinet-nav" aria-label="Разделы кабинета" ref={navRef}>
              {items.map((item) => {
                const className = item.id === active ? "is-active" : undefined;
                const icon = <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONS[item.icon]} /></svg>;
                if (item.to) {
                  return (
                    <Link key={item.id} to={item.to} className={className} aria-current={item.id === active ? "page" : undefined}>
                      {icon}
                      {item.label}
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
                    {item.label}
                  </button>
                );
              })}
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
.cabinet-side { display: grid; gap: 14px; align-content: start; padding: 16px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); }
.cabinet-id { display: flex; align-items: center; gap: 12px; }
.cabinet-id__mark { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; background: rgba(var(--primary-rgb), 0.12); color: var(--primary); font-weight: var(--fw-title); object-fit: cover; }
.cabinet-id strong { display: block; color: var(--dark); }
.cabinet-id span { color: var(--muted); font-size: 13px; }
.cabinet-nav { display: flex; flex-direction: column; gap: 4px; }
.cabinet-nav button, .cabinet-nav a, .cabinet-logout {
  min-height: 44px; border: 0; border-radius: var(--radius-control); background: transparent;
  display: flex; align-items: center; gap: 10px; padding: 0 12px; color: var(--text);
  font: inherit; font-weight: var(--fw-title); text-align: left; text-decoration: none; cursor: pointer;
}
.cabinet-nav button svg, .cabinet-nav a svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
.cabinet-nav button.is-active, .cabinet-nav a.is-active { background: rgba(var(--primary-rgb), 0.1); color: var(--primary-dark); }
.cabinet-nav button:hover, .cabinet-nav a:hover, .cabinet-logout:hover { background: rgba(var(--dark-rgb), 0.04); }
.cabinet-logout { color: var(--muted); justify-content: center; }
.cabinet-main { display: grid; gap: 16px; min-width: 0; }
.cabinet-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--layout-gap); }
.cabinet-stat, .cabinet-card { border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); }
.cabinet-stat { padding: 16px 18px; }
.cabinet-stat strong { display: block; font-size: 28px; letter-spacing: var(--tracking-heading); color: var(--dark); }
.cabinet-stat span { color: var(--muted); font-size: 13px; }
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
.cabinet-inline-link:hover { text-decoration: underline; }
.cabinet-card { min-width: 0; }
.cabinet-table-wrap { min-width: 0; max-width: 100%; overflow-x: auto; }
.cabinet-table { width: 100%; min-width: 760px; border-collapse: collapse; }
.cabinet-table th, .cabinet-table td { padding: 12px 14px; border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; }
.cabinet-table th { color: var(--muted); font-size: 12px; font-weight: var(--fw-title); }
.cabinet-table td { font-size: 14px; color: var(--text); }
.cabinet-reject { display: grid; gap: 8px; margin-top: 8px; }
.cabinet-reject textarea { width: 100%; min-height: 88px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); font: inherit; font-size: 15px; resize: vertical; }
.cabinet-table strong { display: block; color: var(--dark); }
.cabinet-table span:not(.cabinet-status):not(.cabinet-person__mark) { display: block; margin-top: 4px; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.cabinet-filters { display: flex; flex-wrap: wrap; gap: 12px; padding: 16px 18px; border-bottom: 1px solid var(--line); }
.cabinet-filters label { display: grid; gap: 6px; flex: 1 1 180px; min-width: min(100%, 180px); }
.cabinet-filters label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-filters select { width: 100%; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; }
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
.cabinet-facts dd span { display: block; margin-top: 4px; }
.cabinet-table .cabinet-status { display: inline-grid; place-items: center; height: 28px; margin: 0; }
.cabinet-table .cabinet-status-stack { width: auto; margin-inline: auto; align-items: center; }
.cabinet-table .cabinet-status-stack span, .cabinet-table .cabinet-status-stack time { text-align: center; }
.cabinet-table .cabinet-status-cell { text-align: center; vertical-align: middle; }
.cabinet-icon-btn { width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--dark); display: grid; place-items: center; cursor: pointer; }
.cabinet-actions .cabinet-icon-btn, .cabinet-form .cabinet-icon-btn, .cabinet-modal__card .cabinet-icon-btn { width: 44px; height: 44px; min-height: 44px; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--dark); }
.cabinet-icon-btn svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.cabinet-icon-btn:hover { background: rgba(var(--dark-rgb), 0.04); }
.cabinet-icon-btn:disabled { opacity: 0.6; cursor: default; }
.cabinet-modal__card label { display: grid; gap: 6px; }
.cabinet-modal__card label span { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-modal__card textarea { width: 100%; min-height: 120px; padding: 12px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--text); font: inherit; font-size: 15px; resize: vertical; }
.cabinet-modal__card .cabinet-form__error { color: var(--primary-dark); }
.cabinet-save { position: static; width: 44px; height: 44px; flex: 0 0 auto; }
.cabinet-empty { margin: 0; padding: 16px 18px; }
.cabinet-note { margin: 0; color: var(--muted); max-width: 62ch; }
.cabinet-form { display: grid; gap: 12px; padding: 16px 18px; }
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
.cabinet-account span { color: var(--muted); font-size: 13px; }
.cabinet-form input[readonly] { background: #f3f4f6; }
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
.entity-input__error { flex: 1 1 100%; color: var(--primary-dark); font-size: 13px; }
.cabinet-brand-field { display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); }
.cabinet-brand-field svg { width: 20px; height: 20px; flex: 0 0 auto; }
.cabinet-form .cabinet-brand-field input { flex: 1; width: auto; min-width: 0; border: 0; min-height: 42px; padding: 0; background: transparent; }
.cabinet-media-block { display: grid; gap: 6px; }
.cabinet-media { display: grid; gap: 8px; justify-items: start; }
.cabinet-media__label { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.cabinet-photos { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
.cabinet-photo { position: relative; width: 96px; height: 96px; border-radius: var(--radius-control); overflow: hidden; background: var(--neutral-bg, #f3f4f6); border: 1px solid var(--line); }
.cabinet-photo.is-pending { opacity: 0.55; }
.cabinet-photo img { width: 100%; height: 100%; object-fit: cover; }
.cabinet-photo > span { position: absolute; left: 6px; bottom: 6px; padding: 2px 8px; border-radius: 999px; background: var(--white); color: var(--dark); font-size: 11px; font-weight: var(--fw-title); }
.cabinet-photo__remove { position: absolute; top: 4px; right: 4px; background: var(--white); border: 1px solid var(--line); }
label.cabinet-form__ghost input { position: absolute; width: 1px; height: 1px; min-height: 0; padding: 0; border: 0; overflow: hidden; clip: rect(0 0 0 0); }
a.cabinet-icon-btn { text-decoration: none; }
@media (max-width: 960px) {
  .cabinet-nav { flex-direction: row; min-width: 0; overflow-x: auto; scroll-padding-inline: 8px; scrollbar-width: none; }
  .cabinet-nav::-webkit-scrollbar { display: none; }
  .cabinet-nav button, .cabinet-nav a { flex: 0 0 auto; }
}
@media (max-width: 640px) {
  .cabinet-stats { grid-template-columns: 1fr; }
  .cabinet-row { align-items: flex-start; flex-direction: column; }
  .cabinet-status-stack { align-items: center; align-self: flex-start; }
}
`;
