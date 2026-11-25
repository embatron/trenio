import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { listPublishedSportCategories } from "@/lib/catalog/sport-taxonomy";
import { CATEGORIES_CRUMB, categoriesIndexHead } from "@/lib/seo/pages";

export const Route = createFileRoute("/categories/")({
  head: () => categoriesIndexHead(),
  component: CategoriesIndexPage,
});

const CSS = `
.categories-page { min-height: 100vh; background: var(--white); }
.categories-hero {
  padding: var(--layout-section-y) var(--layout-gutter) 32px;
  max-width: var(--layout-max);
  margin: 0 auto;
}
.categories-hero__crumbs {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.categories-hero__crumbs a { color: var(--muted); text-decoration: none; }
.categories-hero__crumbs a:hover { color: var(--primary); }
.categories-hero h1 {
  margin: 0 0 14px;
  font-size: var(--fs-page);
  line-height: 1.04;
  letter-spacing: -0.045em;
  font-weight: var(--fw-heading);
  color: var(--dark);
  max-width: 880px;
}
.categories-hero p {
  margin: 0;
  font-size: 17px;
  line-height: 1.55;
  color: var(--text);
  max-width: 720px;
  font-weight: var(--fw-body);
}
.categories-grid-wrap {
  max-width: var(--layout-max);
  margin: 0 auto;
  padding: 8px var(--layout-gutter) clamp(40px, 6vw, 72px);
}
.categories-grid { align-items: start; }
.category-row {
  display: grid;
  grid-template-columns: minmax(140px, 210px) minmax(0, 1fr);
  gap: 12px 14px;
  align-items: start;
  min-width: 0;
  padding: 12px;
  border: 1px solid rgba(var(--dark-rgb), 0.08);
  border-radius: var(--card-radius);
  background: var(--light-bg);
}
.category-row__tags {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: calc(8px * 0.9);
  min-width: 0;
}
.cat-child-nav__tile {
  min-width: 0;
  width: auto;
  min-height: 32px;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--white);
  border: 1.5px solid var(--line);
  color: var(--dark);
  font-size: calc(13px * 0.9);
  font-weight: var(--fw-ui);
  letter-spacing: -0.01em;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.25;
  white-space: nowrap;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}
.cat-child-nav__tile:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.cat-child-nav__tile:focus-visible {
  outline: 3px solid rgba(var(--primary-rgb), 0.35);
  outline-offset: 2px;
}
.category-card {
  position: relative;
  overflow: hidden;
  border-radius: calc(var(--card-radius) - 4px);
  border: 0;
  background: transparent;
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
}
.category-card__media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}
.category-card__bg {
  position: absolute;
  inset: 0;
  background-color: var(--light-bg);
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
  transition: transform 0.45s ease;
}
.category-card:hover .category-card__bg { transform: scale(1.05); }
.category-card__body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 14px 16px 16px;
}
.category-card h2 {
  margin: 0;
  font-size: 19px;
  letter-spacing: -0.035em;
  font-weight: var(--fw-heading);
  line-height: 1.12;
  color: var(--dark);
}
.category-card p {
  margin: 0;
  color: rgba(var(--dark-rgb), 0.68);
  font-size: 13px;
  line-height: 1.45;
  font-weight: var(--fw-body);
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}
.category-card__meta {
  margin-top: 4px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: var(--fw-title);
  color: var(--primary-dark);
}
.category-card__meta svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: var(--icon-stroke);
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (max-width: 960px) {
  .category-row { grid-template-columns: minmax(118px, 140px) minmax(0, 1fr); gap: 10px 8px; }
  .category-card h2 { font-size: 15px; letter-spacing: -0.03em; }
  .category-card__body { padding: 8px 8px 10px; }
}
@media (max-width: 767px) {
  .category-row__tags { gap: 6px; }
  .cat-child-nav__tile { min-height: 32px; padding: 3px 10px; font-size: 13px; line-height: 1.2; }
}
@media (max-width: 640px) {
  .category-row { grid-template-columns: minmax(132px, 168px) minmax(0, 1fr); gap: 10px; }
  .category-card h2 { font-size: 15px; }
}
@media (max-width: 400px) {
  .category-row { grid-template-columns: minmax(124px, 136px) minmax(0, 1fr); gap: 8px; }
  .category-card h2 { font-size: 14px; }
  .cat-child-nav__tile { white-space: normal; }
}
`;

function CategoriesIndexPage() {
  return (
    <div className="categories-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SiteHeader />

      <main>
        <section className="categories-hero">
          <nav className="categories-hero__crumbs" aria-label="Хлебные крошки">
            <Link to="/">Главная</Link>
            <span aria-hidden="true">/</span>
            <span className="is-current" aria-current="page">{CATEGORIES_CRUMB}</span>
          </nav>
          <h1>{CATEGORIES_CRUMB}</h1>
          <p>
            Выберите категорию — от единоборств и фитнеса до плавания, танцев и зимних видов. В
            каждой собраны тренеры, клубы и направления по всей Беларуси.
          </p>
        </section>

        <div className="categories-grid-wrap">
          <div className="categories-grid">
            {listPublishedSportCategories().map((category) => (
              <div className="category-row" key={category.slug}>
                <Link
                  className="category-card"
                  to="/categories/$slug"
                  params={{ slug: category.slug }}
                >
                  <div className="category-card__media">
                    <span
                      className="category-card__bg"
                      aria-hidden="true"
                      style={
                        category.featuredImage ?? category.image
                          ? { backgroundImage: `url(${category.featuredImage ?? category.image})` }
                          : { background: category.bg }
                      }
                    />
                  </div>
                  <div className="category-card__body">
                    <h2>{category.label}</h2>
                    <p>{category.description}</p>
                    <span className="category-card__meta">
                      {category.count ? category.count : null}
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  </div>
                </Link>
                {category.children.length > 0 ? (
                  <nav className="category-row__tags" aria-label={`Направления: ${category.label}`}>
                    {category.children.map((child) => (
                      <Link
                        key={child.slug}
                        className="cat-child-nav__tile"
                        to="/categories/$parentSlug/$childSlug"
                        params={{ parentSlug: category.slug, childSlug: child.slug }}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </nav>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
