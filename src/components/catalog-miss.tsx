import { Link } from "@tanstack/react-router";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { CatalogSearchForm } from "@/components/catalog-search-form";

const MISS_CSS = `
.miss-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--light-bg); }
.miss-band {
  position: relative; overflow: hidden; color: #fff;
  background:
    radial-gradient(circle at calc(100% - 12px) 22px, #ffd166 0 36px, transparent 38px),
    linear-gradient(145deg, #ff6a4a 0%, #f04b50 46%, #9b1d3a 100%);
}
.miss-band::before {
  content: "";
  position: absolute; inset: auto -8% -30% 40%; height: 70%;
  border: 18px solid rgba(255, 255, 255, 0.16); border-radius: 50%;
  pointer-events: none;
}
.miss-band__inner {
  position: relative;
  display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
  gap: clamp(12px, 3vw, 36px); align-items: center;
  padding-block: clamp(28px, 5vw, 64px);
}
.miss-num {
  margin: 0; font-size: clamp(96px, 18vw, 220px); font-weight: var(--fw-heading);
  letter-spacing: -0.07em; line-height: 0.78; color: #fff;
  text-shadow: 0 14px 0 rgba(17, 24, 39, 0.16);
}
.miss-copy { min-width: 0; display: grid; gap: 12px; justify-items: start; }
.miss-kicker {
  margin: 0; padding: 6px 12px; border-radius: 999px;
  background: rgba(255, 255, 255, 0.16); color: #fff;
  font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.08em; text-transform: uppercase;
}
.miss-copy h1 { margin: 0; color: #fff; font-size: var(--fs-display); max-width: 14ch; }
.miss-lead { margin: 0; max-width: 38ch; color: rgba(255, 255, 255, 0.9); font-size: 16px; line-height: 1.5; }
.miss-links { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }
.miss-links a {
  min-height: 44px; padding: 0 16px; display: inline-flex; align-items: center;
  border-radius: 999px; background: #fff; color: var(--dark);
  font-size: 15px; font-weight: var(--fw-title); text-decoration: none; cursor: pointer;
}
.miss-links a:hover { color: var(--primary-dark); }
.miss-links a:focus-visible { outline: 2px solid #fff; outline-offset: 3px; }
.miss-search { padding-block: clamp(28px, 4vw, 48px) clamp(40px, 6vw, 72px); }
.miss-search h2 { margin: 0 0 18px; text-align: center; }
@media (max-width: 720px) {
  .miss-band__inner { grid-template-columns: 1fr; }
  .miss-band::before { inset: auto -46% -48% 18%; height: 70%; border-width: 14px; }
  .miss-num { font-size: clamp(88px, 28vw, 140px); }
  .miss-copy h1 { max-width: none; }
}
`;

export function CatalogMiss({
  code,
  title,
  text,
}: {
  code: "403" | "404";
  title: string;
  text: string;
}) {
  const kicker = code === "404" ? "Страница не найдена" : "Нет доступа";

  return (
    <div className="miss-page">
      <style dangerouslySetInnerHTML={{ __html: MISS_CSS }} />
      <SiteHeader />
      <main>
        <section className={`miss-band miss-band--${code}`} aria-labelledby="miss-title">
          <div className="miss-band__inner layout-container">
            <p className="miss-num" aria-hidden="true">{code}</p>
            <div className="miss-copy">
              <p className="miss-kicker">{kicker}</p>
              <h1 id="miss-title">{title}</h1>
              <p className="miss-lead">{text}</p>
              <nav className="miss-links" aria-label="Куда дальше">
                <Link to="/">Главная</Link>
                <Link to="/categories">Категории</Link>
                <Link to="/map">Карта</Link>
                <Link to="/city/$slug" params={{ slug: "minsk" }}>Минск</Link>
                {code === "404" ? <Link to="/join/trainer">Стать тренером</Link> : null}
              </nav>
            </div>
          </div>
        </section>
        <section className="miss-search layout-container" aria-labelledby="miss-search">
          <h2 id="miss-search">Найти тренера</h2>
          <CatalogSearchForm variant="hero" />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
