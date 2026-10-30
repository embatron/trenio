import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const PAGES = [
  { to: "/about", label: "О сервисе" },
  { to: "/contacts", label: "Контакты" },
  { to: "/offer", label: "Договор оферты" },
  { to: "/privacy", label: "Политика конфиденциальности" },
] as const;

export function InfoPage({
  title,
  lead,
  updated,
  children,
}: {
  title: string;
  lead?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <div className="info-page">
      <style>{INFO_CSS}</style>
      <SiteHeader />
      <main className="info-main">
        <article className="layout-container layout-container--prose">
          <nav className="info-crumbs" aria-label="Хлебные крошки">
            <Link to="/">Главная</Link>
            <span aria-hidden="true">/</span>
            <span className="is-current" aria-current="page">{title}</span>
          </nav>
          <header className="info-header">
            <h1>{title}</h1>
            {updated ? <p className="info-updated">{updated}</p> : null}
            {lead ? <p className="info-lead">{lead}</p> : null}
          </header>
          <div className="info-body">{children}</div>
          <nav className="info-related" aria-label="Другие страницы сервиса">
            {PAGES.filter((page) => page.label !== title).map((page) => (
              <Link key={page.to} to={page.to}>{page.label}</Link>
            ))}
          </nav>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

const INFO_CSS = `
.info-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--white); color: var(--text); }
.info-main { flex: 1; padding-block: var(--layout-section-y) clamp(40px, 6vw, 72px); }
.info-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 28px; font-size: 14px; font-weight: var(--fw-title); }
.info-crumbs a { color: var(--muted); text-decoration: none; }
.info-crumbs a:hover { color: var(--primary); }
.info-crumbs span[aria-hidden] { color: var(--line); }
.info-header { margin-bottom: 32px; }
.info-header h1 { margin: 0 0 12px; letter-spacing: -0.04em; color: var(--dark); }
.info-updated { margin: 0 0 14px; color: var(--muted); font-size: 14px; font-weight: var(--fw-title); }
.info-lead { margin: 0; font-size: 17px; line-height: 1.6; }
.info-body { display: grid; gap: 28px; font-size: 16px; line-height: 1.7; }
.info-body section { display: grid; gap: 12px; }
.info-body h2 { margin: 0; font-size: 18px; letter-spacing: -0.02em; font-weight: var(--fw-title); color: var(--dark); }
.info-body p, .info-body li { margin: 0; }
.info-body ul, .info-body ol { margin: 0; padding-left: 22px; display: grid; gap: 8px; }
.info-body a { color: var(--primary-dark); font-weight: var(--fw-title); text-decoration: none; }
.info-body a:hover { text-decoration: underline; }
.info-mail {
  display: inline-flex; align-items: center; min-height: 44px;
  color: var(--primary-dark); font-size: 18px; font-weight: var(--fw-title); text-decoration: none;
}
.info-mail:hover { text-decoration: underline; }
.info-related {
  display: flex; flex-wrap: wrap; gap: 4px 20px;
  margin-top: 36px; padding-top: 8px; border-top: 1px solid var(--line);
}
.info-related a {
  display: inline-flex; align-items: center; min-height: 44px;
  color: var(--muted); font-size: 15px; font-weight: var(--fw-title); text-decoration: none;
}
.info-related a:hover { color: var(--primary); }
@media (max-width: 640px) {
  .info-lead { font-size: 16px; }
  .info-body { font-size: 15px; line-height: 1.65; }
}
`;
