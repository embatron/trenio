import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

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

/**
 * Cover slots. `image` stays empty until a file is in `public/`.
 * The poster line is the cover until that photo is set.
 */
const COVERS = {
  who: "",
  work: "",
  next: "",
} as const;

function Cover({
  tone,
  index,
  line,
  image,
}: {
  tone: "rose" | "coral" | "ink";
  index: string;
  line: ReactNode;
  image: string;
}) {
  return (
    <figure className={`about-frame about-frame--${tone}`}>
      {image ? <img src={image} alt="" /> : null}
      <div className="about-frame__poster">
        <span>{index}</span>
        <p>{line}</p>
      </div>
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
            <Cover
              tone="rose"
              index="01"
              image={COVERS.who}
              line={
                <>
                  Ищешь тренера
                  <br />
                  в Беларуси?
                </>
              }
            />
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
            <Cover
              tone="coral"
              index="02"
              image={COVERS.work}
              line={
                <>
                  Профиль
                  <br />
                  уже собран
                </>
              }
            />
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
            <Cover
              tone="ink"
              index="03"
              image={COVERS.next}
              line={
                <>
                  Дальше —
                  <br />
                  ты
                </>
              }
            />
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
  position: relative;
  display: flex;
  margin: 0;
  min-height: 280px;
  aspect-ratio: 4 / 5;
  border-radius: calc(var(--card-radius) + 6px);
  overflow: hidden;
}
.about-frame img {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  object-fit: cover; display: block;
}
.about-frame__poster {
  position: relative;
  z-index: 1;
  display: flex; flex: 1; flex-direction: column; justify-content: space-between;
  min-height: 0;
  padding: clamp(18px, 3vw, 28px);
}
.about-frame--rose {
  background:
    radial-gradient(circle at 12% 0%, #fff 0%, transparent 42%),
    linear-gradient(160deg, #ffe8e6 0%, #ffd0cc 48%, #f6b2ad 100%);
  color: var(--dark);
}
.about-frame--coral {
  background:
    radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.45), transparent 36%),
    linear-gradient(165deg, #ff8d86 0%, var(--primary) 58%, var(--primary-dark) 100%);
  color: #fff;
}
.about-frame--ink {
  background:
    radial-gradient(circle at 0% 100%, rgba(var(--primary-rgb), 0.55), transparent 46%),
    linear-gradient(165deg, #1f2937 0%, #111827 70%);
  color: #fff;
}
.about-frame__poster span {
  font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.08em;
}
.about-frame__poster p {
  margin: 0;
  max-width: 11ch;
  font-size: clamp(32px, 4vw, 52px);
  line-height: 0.98;
  letter-spacing: -0.045em;
  font-weight: var(--fw-heading);
}
.about-frame img + .about-frame__poster {
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.05), rgba(17, 24, 39, 0.55));
  color: #fff;
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
  .about-frame { aspect-ratio: 16 / 10; min-height: 0; }
  .about-frame__poster p { font-size: clamp(28px, 8vw, 40px); }
}
@media (max-width: 640px) {
  .about-lead { font-size: 16px; }
  .about-copy p { font-size: 16px; }
}
@media (prefers-reduced-motion: reduce) {
  .about-btn--primary:hover { transform: none; }
}
`;
