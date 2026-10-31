import { Link } from "@tanstack/react-router";

import { TRAINER_INVITE_LINE } from "@/lib/catalog/trainer-welcome";

const CSS = `
.catalog-empty {
  width: 100%; box-sizing: border-box;
  padding: 56px 36px; text-align: center; border-radius: var(--card-radius);
  background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%);
  border: 1px solid rgba(var(--primary-rgb), 0.16); color: var(--text);
  display: grid; gap: 18px; justify-items: center;
}
.catalog-empty__icon { width: 96px; height: 96px; border-radius: 50%; background: #fff; box-shadow: 0 12px 30px -12px rgba(var(--dark-rgb), 0.18); display: grid; place-items: center; color: var(--primary); }
.catalog-empty__icon svg { width: 44px; height: 44px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.catalog-empty h3 { margin: 0; font-size: 24px; font-weight: var(--fw-heading); letter-spacing: -0.025em; color: var(--dark); }
.catalog-empty p { margin: 0; max-width: 540px; color: var(--muted); font-size: 15px; line-height: 1.55; }
.catalog-empty__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 4px; }
.catalog-empty__btn {
  min-height: 44px; padding: 12px 22px; border-radius: var(--radius-control);
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: var(--fw-title); text-decoration: none; cursor: pointer; border: 0;
}
.catalog-empty__btn--primary { background: var(--primary); color: #fff; }
.catalog-empty__btn:hover { color: #fff; }
.catalog-empty__btn:focus-visible { outline: 2px solid var(--primary-dark); outline-offset: 3px; }
@media (max-width: 640px) {
  .catalog-empty { padding: 32px 16px; }
  .catalog-empty h3 { font-size: 22px; }
}
`;

/** Same empty catalog block as a search with no trainers: invite line and the join button. */
export function CatalogEmpty({ title }: { title: string }) {
  return (
    <div className="catalog-empty">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="catalog-empty__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="7" />
          <path d="M16 16l5 5" />
          <path d="M8 11h6" />
        </svg>
      </div>
      <h3>{title}</h3>
      <p>{TRAINER_INVITE_LINE}</p>
      <div className="catalog-empty__actions">
        <Link to="/join/trainer" className="catalog-empty__btn catalog-empty__btn--primary">
          Стать первым тренером
        </Link>
      </div>
    </div>
  );
}
