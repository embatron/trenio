import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { listPublishedSportCategories } from "@/lib/catalog/sport-taxonomy";

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
  font-weight: var(--fw-title);
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
.categories-grid { align-items: stretch; }
.category-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--card-radius);
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
            <span className="is-current" aria-current="page">Категории спорта</span>
          </nav>
          <h1>Категории спорта</h1>
          <p>
            Выберите категорию — от единоборств и фитнеса до плавания, танцев и зимних видов. В
            каждой собраны тренеры, клубы и направления по всей Беларуси.
          </p>
        </section>

        <div className="categories-grid-wrap">
          <div className="categories-grid">
            {listPublishedSportCategories().map((category) => (
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
            ))}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
