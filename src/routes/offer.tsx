import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { OFFER_VERSION } from "@/lib/catalog/offer";

export const Route = createFileRoute("/offer")({
  head: () => ({
    meta: [
      { title: "Договор оферты · trenio.by" },
      { name: "description", content: "Публичная оферта на размещение профиля тренера в каталоге trenio.by." },
      { property: "og:title", content: "Договор оферты · trenio.by" },
      { property: "og:description", content: "Публичная оферта на размещение профиля тренера в каталоге trenio.by." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/offer" }],
  }),
  component: OfferPage,
});

function OfferPage() {
  return (
    <div className="privacy-root">
      <style>{OFFER_CSS}</style>
      <SiteHeader />
      <main className="privacy-main">
        <div className="privacy-inner">
          <nav className="privacy-breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span className="is-current" aria-current="page">Договор оферты</span>
          </nav>
          <header className="privacy-header">
            <h1 className="privacy-title">Договор оферты</h1>
            <p className="privacy-updated">Редакция {OFFER_VERSION}</p>
          </header>
          <div className="privacy-body">
            <section className="privacy-section">
              <h2>1. О чём договор</h2>
              <p>
                trenio.by предлагает тренеру бесплатно разместить карточку в каталоге: имя, фото, город, описание занятий и контакты, которые тренер сам укажет.
                Карточка, собранная из открытого профиля, не публикуется, пока тренер не примет эту оферту и не привяжет аккаунт.
              </p>
            </section>
            <section className="privacy-section">
              <h2>2. Как принять</h2>
              <p>
                Оферта принята, когда тренер открывает персональную ссылку, отмечает согласие и задаёт логин с паролем.
                С этого момента карточка принадлежит этому аккаунту. Публикация в каталоге остаётся на модерации, пока сотрудник её не откроет.
              </p>
            </section>
            <section className="privacy-section">
              <h2>3. Что можно и чего нельзя</h2>
              <ul>
                <li>Тренер сам правит текст, фото, цену и контакты.</li>
                <li>Нельзя выдавать чужой профиль за свой и размещать данные другого человека без его согласия.</li>
                <li>Телефон, почта и Telegram подтверждаются отдельно и до подтверждения не считаются проверенными.</li>
                <li>trenio.by может скрыть карточку, если в ней чужие данные или она нарушает закон.</li>
              </ul>
            </section>
            <section className="privacy-section">
              <h2>4. Данные</h2>
              <p>
                Имя, фото и текст занятий обрабатываются, чтобы показать карточку в каталоге. Подробности — в{" "}
                <Link to="/privacy">политике конфиденциальности</Link>.
                Согласие на обработку отмечается отдельно при привязке аккаунта.
              </p>
            </section>
            <section className="privacy-section">
              <h2>5. Срок</h2>
              <p>
                Договор действует, пока карточка размещена. Тренер может попросить скрыть её. Новая редакция оферты публикуется на этой странице;
                для уже привязанной карточки действует редакция, которую тренер принял.
              </p>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

const OFFER_CSS = `
.privacy-root { background: var(--white); min-height: 100vh; color: var(--text); }
.privacy-main { padding: var(--layout-section-y) 0 clamp(40px, 6vw, 72px); }
.privacy-inner { max-width: var(--layout-prose-max); margin: 0 auto; padding-inline: var(--layout-gutter); }
.privacy-breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 28px; font-size: 13px; font-weight: var(--fw-title); color: var(--muted); }
.privacy-breadcrumbs a { color: var(--muted); text-decoration: none; }
.privacy-title { margin: 0 0 10px; font-size: var(--fs-page); line-height: 1.08; letter-spacing: -0.04em; font-weight: var(--fw-heading); color: var(--dark); }
.privacy-updated { margin: 0; font-size: 14px; font-weight: var(--fw-title); color: var(--muted); }
.privacy-header { margin-bottom: 36px; }
.privacy-body { font-size: 16px; line-height: 1.7; }
.privacy-section + .privacy-section { margin-top: 32px; }
.privacy-section h2 { margin: 0 0 12px; font-size: 18px; letter-spacing: -0.02em; font-weight: var(--fw-title); color: var(--dark); }
.privacy-section p { margin: 0 0 14px; }
.privacy-section ul { margin: 0 0 14px; padding-left: 22px; }
.privacy-section li { margin-bottom: 8px; }
.privacy-section a { color: var(--primary-dark); font-weight: var(--fw-title); }
`;
