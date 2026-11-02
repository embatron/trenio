import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { infoPageCopy, infoPageHead } from "@/lib/seo/pages";

const page = infoPageCopy("about");

export const Route = createFileRoute("/about")({
  head: () => infoPageHead("about"),
  component: AboutPage,
});

const RELATED = [
  { to: "/contacts", label: "Контакты" },
  { to: "/offer", label: "Договор оферты" },
  { to: "/privacy", label: "Политика конфиденциальности" },
] as const;

function Cover({ src, alt }: { src: string; alt: string }) {
  return (
    <figure className="about-frame">
      <img src={src} alt={alt} width={864} height={1152} />
    </figure>
  );
}

function AboutPage() {
  return (
    <div className="about-page">
      <style>{CSS}</style>
      <SiteHeader />
      <main>
        <section className="about-hero" aria-labelledby="about-title">
          <div className="layout-container">
            <nav className="about-crumbs" aria-label="Хлебные крошки">
              <Link to="/">Главная</Link>
              <span aria-hidden="true">/</span>
              <span className="is-current" aria-current="page">
                {page.crumb}
              </span>
            </nav>
            <h1 id="about-title">{page.crumb}</h1>
            <p className="about-lead">
              Каталог тренеров со всей Беларуси. Город, вид спорта — и видно, кто занимается.
            </p>
          </div>
        </section>

        <section className="about-chapter" aria-labelledby="about-who">
          <div className="layout-container about-split">
            <Cover src="/about/who-we-are.png" alt="Ищешь тренера в Беларуси?" />
            <div className="about-copy">
              <h2 id="about-who">Кто мы</h2>
              <p>
                Мы — Trenio, каталог тренеров со всей Беларуси. Собираем их в одном месте, чтобы
                искать было просто: город, вид спорта — и вот уже видно, кто занимается и сколько
                стоит занятие.
              </p>
              <p>
                Никаких посредников и процентов: выбираешь тренера и пишешь ему напрямую — в
                Instagram, Telegram или звонком. Размещение бесплатное. И для тренера, и для клиента.
              </p>
              <p className="about-copy__links">
                <Link className="about-btn about-btn--primary" to="/">
                  Найти тренера
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="about-chapter about-chapter--soft" aria-labelledby="about-work">
          <div className="layout-container about-split about-split--flip">
            <Cover src="/about/what-we-do.png" alt="Профиль уже собран" />
            <div className="about-copy">
              <h2 id="about-work">Что мы делаем</h2>
              <p>
                Мы находим открытые Instagram-профили тренеров и собираем из них черновик страницы:
                фото, направление, город и цену, если она указана. Только то, что и так видно любому.
              </p>
              <p>
                В каталог страница не встаёт сама. Черновик ждёт владельца, и только он решает —
                опубликовать или нет. Пока не нажмёт «Опубликовать», в поиске её нет.
              </p>
            </div>
          </div>
        </section>

        <section className="about-chapter" aria-labelledby="about-next">
          <div className="layout-container about-split">
            <Cover src="/about/how-it-works.png" alt="Дальше — ты" />
            <div className="about-copy">
              <h2 id="about-next">Как это работает</h2>
              <p>
                Мы пишем тренеру в директ и присылаем короткую ссылку. По ней видно, как страница
                выглядит для клиента.
              </p>
              <ol className="about-flow">
                <li>
                  <span>1</span>
                  <p>Открываешь ссылку: фото, город, цена и способы связи — всё, что увидит клиент.</p>
                </li>
                <li>
                  <span>2</span>
                  <p>Не так имя, город или цена — правишь за минуту.</p>
                </li>
                <li>
                  <span>3</span>
                  <p>Нажимаешь «Опубликовать». До этого в поиске страницы нет.</p>
                </li>
                <li>
                  <span>4</span>
                  <p>Страница в каталоге, клиенты могут тебя найти. Бесплатно — и сейчас, и потом.</p>
                </li>
              </ol>
              <p className="about-copy__links">
                <Link className="about-btn about-btn--primary" to="/join/trainer">
                  Оставить Instagram
                </Link>
              </p>
            </div>
          </div>
        </section>

        <section className="about-end">
          <div className="layout-container">
            <nav className="about-related" aria-label="Другие страницы сервиса">
              {RELATED.map((item) => (
                <Link key={item.to} to={item.to}>
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

const CSS = `
.about-page { min-height: 100vh; display: flex; flex-direction: column; background: var(--white); color: var(--text); }
.about-page main { flex: 1; }
.about-hero {
  padding-block: clamp(28px, 5vw, 56px) clamp(8px, 2vw, 16px);
  background:
    radial-gradient(circle at 100% 0%, rgba(var(--primary-rgb), 0.16), transparent 36%),
    linear-gradient(180deg, #fff 0%, var(--light-bg) 100%);
}
.about-crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 22px; font-size: 14px; font-weight: var(--fw-title); }
.about-crumbs a { color: var(--muted); text-decoration: none; }
.about-crumbs a:hover { color: var(--primary); }
.about-crumbs span[aria-hidden] { color: var(--line); }
.about-hero h1 { margin: 0 0 12px; font-size: var(--fs-display); letter-spacing: -0.04em; color: var(--dark); }
.about-lead { margin: 0; max-width: 36rem; font-size: 18px; line-height: 1.5; }
.about-chapter { padding-block: clamp(28px, 5vw, 64px); }
.about-chapter--soft { background: var(--light-bg); }
.about-split {
  display: grid;
  grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.18fr);
  gap: clamp(20px, 4vw, 56px);
  align-items: center;
}
.about-split--flip { grid-template-columns: minmax(0, 1.18fr) minmax(0, 0.82fr); }
.about-split--flip .about-frame { order: 2; }
.about-frame {
  margin: 0;
  border-radius: calc(var(--card-radius) + 6px);
  overflow: hidden;
  background: #f6f1e8;
}
.about-frame img {
  display: block;
  width: 100%;
  height: auto;
}
.about-copy h2 {
  margin: 0 0 14px;
  font-size: var(--fs-section);
  letter-spacing: var(--tracking-heading);
  font-weight: var(--fw-heading);
  color: var(--dark);
}
.about-copy p { margin: 0 0 14px; max-width: 42rem; font-size: 17px; line-height: 1.6; }
.about-copy p:last-child { margin-bottom: 0; }
.about-copy__links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; }
.about-btn {
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 48px; padding: 10px 22px; border-radius: 999px;
  font-size: 16px; font-weight: var(--fw-title); text-decoration: none;
}
.about-btn--primary { background: var(--primary); color: #fff; box-shadow: 0 12px 26px rgba(var(--primary-rgb), 0.28); }
.about-btn--primary:hover { background: var(--primary-dark); }
.about-btn:focus-visible { outline: 3px solid rgba(var(--primary-rgb), 0.45); outline-offset: 3px; }
.about-flow { list-style: none; margin: 6px 0 18px; padding: 0; display: grid; }
.about-flow li { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 12px; }
.about-flow li span {
  display: grid; place-items: center;
  width: 36px; height: 36px; margin-top: 2px;
  border-radius: 50%;
  background: var(--light-bg); color: var(--primary-dark);
  font-size: 14px; font-weight: var(--fw-title);
}
.about-flow li p { margin: 0; padding-bottom: 16px; font-size: 16px; line-height: 1.5; }
.about-flow li:last-child p { padding-bottom: 0; }
.about-end { padding-bottom: clamp(12px, 3vw, 28px); }
.about-related {
  display: flex; flex-wrap: wrap; gap: 4px 20px;
  padding-top: 8px; border-top: 1px solid var(--line);
}
.about-related a {
  display: inline-flex; align-items: center; min-height: 44px;
  color: var(--muted); font-size: 15px; font-weight: var(--fw-title); text-decoration: none;
}
.about-related a:hover { color: var(--primary); }
@media (max-width: 960px) {
  .about-split, .about-split--flip { grid-template-columns: 1fr; }
  .about-split--flip .about-frame { order: 0; }
}
@media (max-width: 640px) {
  .about-lead { font-size: 16px; }
  .about-copy p { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .about-btn--primary:hover { transform: none; }
}
`;
