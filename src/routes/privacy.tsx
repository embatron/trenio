import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Политика конфиденциальности · trenio.by" },
      { name: "description", content: "Политика обработки персональных данных пользователей сервиса trenio.by." },
      { property: "og:title", content: "Политика конфиденциальности · trenio.by" },
      { property: "og:description", content: "Политика обработки персональных данных пользователей сервиса trenio.by." },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="privacy-root">
      <style>{PRIVACY_CSS}</style>
      <SiteHeader />

      <main className="privacy-main">
        <div className="privacy-inner">
          <nav className="privacy-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span className="is-current">Политика конфиденциальности</span>
          </nav>

          <header className="privacy-header">
            <h1 className="privacy-title">Политика конфиденциальности</h1>
            <p className="privacy-updated">Последнее обновление: 15 июня 2026</p>
          </header>

          <div className="privacy-body">
            <section className="privacy-section">
              <h2>1. Общие положения</h2>
              <p>
                Настоящая Политика конфиденциальности описывает, как trenio.by собирает, использует и защищает персональные данные пользователей сервиса.
                Используя сайт, вы соглашаетесь с условиями данной политики.
              </p>
            </section>

            <section className="privacy-section">
              <h2>2. Какие данные мы собираем</h2>
              <p>Мы можем собирать следующие категории данных:</p>
              <ul>
                <li>Имя, контактный телефон и адрес электронной почты — при регистрации или оформлении заявки.</li>
                <li>Информация о предпочтениях по занятиям — вид спорта, город, формат занятий.</li>
                <li>Технические данные — IP-адрес, тип устройства, браузер, файлы cookie.</li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>3. Цели обработки данных</h2>
              <p>Мы используем собранные данные для:</p>
              <ul>
                <li>предоставления доступа к функциям сервиса (поиск, бронирование, сохранение избранного);</li>
                <li>связи с пользователем по вопросам записи и уточнения деталей занятий;</li>
                <li>улучшения работы сайта и персонализации рекомендаций;</li>
                <li>отправки информационных сообщений (при наличии согласия).</li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>4. Хранение и защита</h2>
              <p>
                Персональные данные хранятся на защищённых серверах. Доступ к информации имеют только уполномоченные сотрудники.
                Мы применяем технические и организационные меры для предотвращения несанкционированного доступа, изменения или удаления данных.
              </p>
            </section>

            <section className="privacy-section">
              <h2>5. Передача третьим лицам</h2>
              <p>
                Мы не продаём персональные данные. Данные могут быть переданы партнёрам (тренерам, клубам) только в рамках оформленной заявки пользователя
                и только в объёме, необходимом для проведения занятия.
              </p>
            </section>

            <section className="privacy-section">
              <h2>6. Файлы cookie</h2>
              <p>
                Сайт использует cookie для корректной работы, аналитики и персонализации. Продолжая использовать сервис, вы соглашаетесь с использованием cookie.
                Вы можете отключить cookie в настройках браузера, однако это может повлиять на функциональность сайта.
              </p>
            </section>

            <section className="privacy-section">
              <h2>7. Права пользователя</h2>
              <p>Пользователь имеет право:</p>
              <ul>
                <li>получить информацию о своих персональных данных, обрабатываемых сервисом;</li>
                <li>требовать исправления неточных или неактуальных данных;</li>
                <li>требовать удаления данных в случаях, предусмотренных законодательством;</li>
                <li>отозвать согласие на обработку данных для маркетинговых целей.</li>
              </ul>
            </section>

            <section className="privacy-section">
              <h2>8. Изменения политики</h2>
              <p>
                Мы можем обновлять настоящую Политику конфиденциальности. Актуальная версия всегда доступна на этой странице.
                Значительные изменения мы будем доводить до сведения пользователей через сайт или по электронной почте.
              </p>
            </section>

            <section className="privacy-section">
              <h2>9. Контакты</h2>
              <p>
                По вопросам, связанным с обработкой персональных данных, обращайтесь:
                <br />
                Email: <a href="mailto:privacy@trenio.by">privacy@trenio.by</a>
              </p>
            </section>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

const PRIVACY_CSS = `
.privacy-root {
  --primary: #f04b50;
  --primary-dark: #c9343a;
  --dark: #111827;
  --light-bg: #fff5f5;
  --neutral-bg: #f9fafb;
  --text: #1f2937;
  --muted: #6b7280;
  --line: #e5e7eb;
  --dark-rgb: 17,24,39;
  --primary-rgb: 240,75,80;
  font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--neutral-bg);
  min-height: 100vh;
}

.privacy-main { padding: var(--layout-section-y) var(--layout-gutter) clamp(40px, 6vw, 72px); }
.privacy-inner { max-width: var(--layout-prose-max); margin: 0 auto; }

.privacy-breadcrumbs {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin: 0 0 28px; font-size: 13px; font-weight: 650; color: var(--muted);
}
.privacy-breadcrumbs a { color: var(--muted); text-decoration: none; }
.privacy-breadcrumbs a:hover { color: var(--primary-dark); }
.privacy-breadcrumbs .is-current { color: var(--text); }

.privacy-header { margin-bottom: 36px; }
.privacy-title {
  margin: 0 0 10px;
  font-size: clamp(28px, 4vw, 40px);
  line-height: 1.08;
  letter-spacing: -0.04em;
  font-weight: 900;
  color: var(--dark);
}
.privacy-updated {
  margin: 0;
  font-size: 14px;
  font-weight: 650;
  color: var(--muted);
}

.privacy-body { font-size: 16px; line-height: 1.7; }
.privacy-section + .privacy-section { margin-top: 32px; }
.privacy-section h2 {
  margin: 0 0 12px;
  font-size: 18px;
  letter-spacing: -0.02em;
  font-weight: 850;
  color: var(--dark);
}
.privacy-section p { margin: 0 0 14px; }
.privacy-section ul {
  margin: 0 0 14px; padding-left: 22px;
}
.privacy-section ul li { margin-bottom: 8px; padding-left: 4px; }
.privacy-section ul li::marker { color: var(--primary); }
.privacy-section a { color: var(--primary-dark); font-weight: 700; text-decoration: none; }
.privacy-section a:hover { text-decoration: underline; }

@media (max-width: 960px) {
  .privacy-body { font-size: 15px; line-height: 1.65; }
}
`;
