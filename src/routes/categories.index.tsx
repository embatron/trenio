import { createFileRoute, Link } from "@tanstack/react-router";
import { SportIcon } from "@/components/sport-icon";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { TOP_LEVEL_SPORT_CATEGORIES } from "@/lib/catalog/sport-taxonomy";

export const Route = createFileRoute("/categories/")({
  head: () => ({
    meta: [
      { title: "Категории спорта — trenio.by" },
      {
        name: "description",
        content:
          "Все категории спорта на trenio.by: единоборства, фитнес, йога, плавание, командные игры и другие направления. Найдите тренера в Беларуси.",
      },
      { property: "og:title", content: "Категории спорта — trenio.by" },
      {
        property: "og:description",
        content: "Каталог спортивных категорий и направлений — подбор тренеров по городу, цене и формату.",
      },
    ],
  }),
  component: CategoriesIndexPage,
});

const CSS = `
.categories-page { min-height: 100vh; background: var(--light-bg); }
.categories-hero {
  padding: var(--layout-section-y) var(--layout-gutter) 32px;
  max-width: var(--layout-max);
  margin: 0 auto;
}
.categories-hero__crumbs {
  font-size: 13px;
  color: var(--muted);
  font-weight: 650;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.categories-hero__crumbs a { color: var(--muted); text-decoration: none; }
.categories-hero__crumbs a:hover { color: var(--primary); }
.categories-hero__eyebrow {
  display: inline-block;
  margin-bottom: 10px;
  padding: 5px 11px;
  border-radius: 999px;
  background: rgba(var(--primary-rgb), 0.1);
  color: var(--primary-dark);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.categories-hero h1 {
  margin: 0 0 14px;
  font-size: clamp(34px, 4.4vw, 56px);
  line-height: 1.04;
  letter-spacing: -0.045em;
  font-weight: 900;
  color: var(--dark);
  max-width: 880px;
}
.categories-hero p {
  margin: 0;
  font-size: 17px;
  line-height: 1.55;
  color: var(--text);
  max-width: 720px;
  font-weight: 550;
}
.categories-grid-wrap {
  max-width: var(--layout-max);
  margin: 0 auto;
  padding: 8px var(--layout-gutter) clamp(40px, 6vw, 72px);
}
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.category-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  border: 1px solid rgba(var(--dark-rgb), 0.08);
  background: var(--white);
  text-decoration: none;
  color: inherit;
  display: flex;
  flex-direction: column;
  transition: transform 0.24s ease, border-color 0.24s ease;
}
.category-card:hover {
  transform: translateY(-2px);
  border-color: rgba(var(--primary-rgb), 0.22);
}
.category-card__media {
  position: relative;
  aspect-ratio: 4 / 3;
  overflow: hidden;
}
.category-card__bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  transition: transform 0.45s ease;
}
.category-card:hover .category-card__bg { transform: scale(1.05); }
.category-card__media::after {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 55%, rgba(15, 23, 42, 0.1) 100%);
}
.category-card__icon {
  position: absolute;
  left: 12px;
  bottom: 12px;
  z-index: 1;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.94);
  display: grid;
  place-items: center;
  color: var(--primary-dark);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 6px 16px rgba(var(--dark-rgb), 0.12);
}
.category-card__icon svg {
  width: 21px;
  height: 21px;
  stroke: currentColor;
  fill: none;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
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
  font-weight: 900;
  line-height: 1.12;
  color: var(--dark);
}
.category-card p {
  margin: 0;
  color: rgba(var(--dark-rgb), 0.68);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 550;
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
  font-weight: 800;
  color: var(--primary-dark);
}
.category-card__meta svg {
  width: 14px;
  height: 14px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (max-width: 960px) {
  .categories-grid {
    grid-template-columns: 1fr;
  }
}
`;

function CategoriesIndexPage() {
  return (
    <div className="categories-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <SiteHeader />

      <main>
        <section className="categories-hero">
          <nav className="categories-hero__crumbs" aria-label="breadcrumbs">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span>Категории спорта</span>
          </nav>
          <span className="categories-hero__eyebrow">Каталог</span>
          <h1>Категории спорта</h1>
          <p>
            Выберите категорию — от единоборств и фитнеса до плавания, танцев и зимних видов. В
            каждой собраны тренеры, клубы и направления по всей Беларуси.
          </p>
        </section>

        <div className="categories-grid-wrap">
          <div className="categories-grid">
            {TOP_LEVEL_SPORT_CATEGORIES.map((category) => (
              <Link
                key={category.slug}
                className="category-card"
                to="/categories/$slug"
                params={{ slug: category.slug }}
              >
                <div className="category-card__media">
                  <span
                    className="category-card__bg"
                    aria-hidden="true"
                    style={
                      category.image
                        ? { backgroundImage: `url(${category.image})` }
                        : { background: category.bg }
                    }
                  />
                  <span className="category-card__icon" aria-hidden="true">
                    <SportIcon iconKey={category.iconKey} />
                  </span>
                </div>
                <div className="category-card__body">
                  <h2>{category.label}</h2>
                  <p>{category.description}</p>
                  <span className="category-card__meta">
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
      </main>

      <SiteFooter />
    </div>
  );
}
