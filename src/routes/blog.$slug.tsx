import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

type ArticleBlock =
  | { type: "p" | "h2" | "h3" | "blockquote"; text: string }
  | { type: "ul"; items: string[] };

type Article = {
  slug: string;
  title: string;
  excerpt: string;
  date: string;
  readTime: string;
  author: string;
  cover: string;
  tags: string[];
  content: ArticleBlock[];
};

const ARTICLES: Record<string, Article> = {
  "kak-vybrat-trenera": {
    slug: "kak-vybrat-trenera",
    title: "Как выбрать тренера: 6 важных критериев",
    excerpt: "На что обращать внимание при выборе тренера, чтобы занятия приносили результат и удовольствие.",
    date: "15 июня 2026",
    readTime: "6 мин",
    author: "Редакция trenio.by",
    cover: "https://placehold.co/1200x600/fff5f5/c9343a?text=Как+выбрать+тренера",
    tags: ["Советы", "Для начинающих", "Выбор тренера"],
    content: [
      { type: "p", text: "Выбор тренера — это не только про рейтинг и цену. Важно найти человека, чей подход совпадает с вашими целями, уровнем подготовки и расписанием. В этой статье разберём главные критерии, на которые стоит ориентироваться." },
      { type: "h2", text: "1. Специализация и квалификация" },
      { type: "p", text: "Убедитесь, что тренер работает именно в том направлении, которое вам нужно. Фитнес-тренер, тренер по единоборствам и йога-инструктор — это разные профессии с разной базой подготовки. Обратите внимание на сертификаты, стаж и опыт работы с клиентами вашего уровня." },
      { type: "h2", text: "2. Формат занятий" },
      { type: "p", text: "Подумайте заранее, что вам ближе: индивидуальные занятия, где всё внимание уделено только вам, или групповые тренировки с динамикой и командной атмосферой. Некоторые тренеры ведут оба формата — это даёт гибкость в выборе." },
      { type: "blockquote", text: "Групповые занятия хороши для мотивации и социализации, индивидуальные — для быстрого прогресса по технике." },
      { type: "h2", text: "3. Локация и расписание" },
      { type: "p", text: "Даже идеальный тренер может не подойти, если добираться до зала долго и неудобно. Смотрите не только на район, но и на время проведения занятий — оно должно совпадать с вашим графиком." },
      { type: "h2", text: "4. Отзывы и репутация" },
      { type: "p", text: "Читайте отзывы реальных клиентов. Обращайте внимание не только на оценки, но и на конкретику: как тренер работает с новичками, насколько пунктуален, как строит тренировочный процесс." },
      { type: "h2", text: "5. Первая встреча или пробное занятие" },
      { type: "p", text: "Многие тренеры предлагают пробное занятие или короткую консультацию перед записью. Это отличная возможность понять подход специалиста и задать вопросы по программе тренировок." },
      { type: "h2", text: "6. Цена и пакеты" },
      { type: "p", text: "Сравнивайте не только стоимость разового занятия, но и условия абонементов. Часто пакет из 8–12 занятий выгоднее по цене и мотивирует регулярно посещать тренировки." },
      { type: "ul", items: ["Уточняйте, входит ли разминка и заминка в стоимость", "Узнайте о политике переноса и отмены занятий", "Проверьте, есть ли скидки на утренние часы или малые группы"] },
      { type: "p", text: "Выбор тренера — это инвестиция в своё здоровье и комфорт. Не торопитесь, сравнивайте варианты и прислушивайтесь к своим ощущениям на первых занятиях. Хороший тренер всегда объяснит, зачем вы делаете то или иное упражнение, и поддержит на старте." },
    ],
  },
};

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }): { article: Article } => {
    const article = ARTICLES[params.slug];
    if (!article) throw notFound();
    return { article };
  },
  head: ({ loaderData }) => {
    const a = loaderData?.article;
    if (!a) return { meta: [{ title: "Статья · trenio.by" }] };
    return {
      meta: [
        { title: `${a.title} · trenio.by` },
        { name: "description", content: a.excerpt },
        { property: "og:title", content: a.title },
        { property: "og:description", content: a.excerpt },
        { property: "og:type", content: "article" },
        { property: "og:url", content: `/blog/${a.slug}` },
      ],
      links: [{ rel: "canonical", href: `/blog/${a.slug}` }],
    };
  },
  component: ArticlePage,
});

function ArticlePage() {
  const { article } = Route.useLoaderData();

  return (
    <div className="article-root">
      <style>{ARTICLE_CSS}</style>
      <SiteHeader />

      <main className="article-main">
        <div className="article-inner">
          <nav className="article-breadcrumbs" aria-label="Breadcrumb">
            <Link to="/">Главная</Link>
            <span>/</span>
            <span>Статьи</span>
            <span>/</span>
            <span className="is-current">{article.title}</span>
          </nav>

          <header className="article-header">
            <div className="article-tags">
              {article.tags.map((t: string) => (
                <span key={t} className="article-tag">{t}</span>
              ))}
            </div>
            <h1 className="article-title">{article.title}</h1>
            <div className="article-meta">
              <span className="article-meta__item">{article.date}</span>
              <span className="article-meta__sep">·</span>
              <span className="article-meta__item">{article.readTime} чтения</span>
              <span className="article-meta__sep">·</span>
              <span className="article-meta__item">{article.author}</span>
            </div>
          </header>

          <figure className="article-cover">
            <img src={article.cover} alt={article.title} />
          </figure>

          <article className="article-body">
            {article.content.map((block: ArticleBlock, i: number) => {
              switch (block.type) {
                case "h2":
                  return <h2 key={i}>{(block as Extract<ArticleBlock, { text: string }>).text}</h2>;
                case "h3":
                  return <h3 key={i}>{(block as Extract<ArticleBlock, { text: string }>).text}</h3>;
                case "blockquote":
                  return (
                    <blockquote key={i}>
                      <p>{(block as Extract<ArticleBlock, { text: string }>).text}</p>
                    </blockquote>
                  );
                case "ul":
                  return (
                    <ul key={i}>
                      {(block as Extract<ArticleBlock, { type: "ul" }>).items.map((item: string, j: number) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  );
                default:
                  return <p key={i}>{(block as Extract<ArticleBlock, { text: string }>).text}</p>;
              }
            })}
          </article>

          <footer className="article-footer">
            <div className="article-share">
              <span className="article-share__label">Поделиться:</span>
              <button className="article-share__btn" aria-label="Telegram">TG</button>
              <button className="article-share__btn" aria-label="ВКонтакте">VK</button>
              <button className="article-share__btn" aria-label="Копировать ссылку">Link</button>
            </div>
          </footer>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

const ARTICLE_CSS = `
.article-root {
  --primary: #f04b50;
  --primary-dark: #c9343a;
  --dark: #111827;
  --light-bg: #fff5f5;
  --neutral-bg: #f9fafb;
  --text: #1f2937;
  --muted: #6b7280;
  --line: #e5e7eb;
  --primary-rgb: 240,75,80;
  --dark-rgb: 17,24,39;
  font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text);
  background: var(--neutral-bg);
  min-height: 100vh;
}

.article-main { padding: 28px 36px 72px; }
.article-inner { max-width: 760px; margin: 0 auto; }

.article-breadcrumbs {
  display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
  margin: 0 0 28px; font-size: 13px; font-weight: 650; color: var(--muted);
}
.article-breadcrumbs a { color: var(--muted); text-decoration: none; }
.article-breadcrumbs a:hover { color: var(--primary-dark); }
.article-breadcrumbs .is-current { color: var(--text); }

.article-header { margin-bottom: 28px; }
.article-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.article-tag {
  padding: 5px 11px; border-radius: 999px;
  background: rgba(var(--primary-rgb), 0.08); color: var(--primary-dark);
  font-size: 12px; font-weight: 750; letter-spacing: -0.01em;
}
.article-title {
  margin: 0 0 14px;
  font-size: clamp(28px, 4.2vw, 42px);
  line-height: 1.08;
  letter-spacing: -0.04em;
  font-weight: 900;
  color: var(--dark);
}
.article-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px;
  font-size: 14px; font-weight: 650; color: var(--muted);
}
.article-meta__sep { color: var(--line); }

.article-cover {
  margin: 0 0 36px;
  border-radius: 22px;
  overflow: hidden;
  background: linear-gradient(160deg, var(--neutral-bg), var(--line));
}
.article-cover img {
  width: 100%; height: auto; display: block;
}

.article-body { font-size: 17px; line-height: 1.72; }
.article-body h2 {
  margin: 40px 0 14px;
  font-size: 22px; line-height: 1.2;
  letter-spacing: -0.03em; font-weight: 900; color: var(--dark);
}
.article-body h3 {
  margin: 28px 0 10px;
  font-size: 18px; line-height: 1.25;
  letter-spacing: -0.02em; font-weight: 850; color: var(--dark);
}
.article-body p { margin: 0 0 18px; }
.article-body blockquote {
  margin: 24px 0; padding: 20px 24px;
  border-left: 4px solid var(--primary);
  border-radius: 0 16px 16px 0;
  background: var(--white);
  color: var(--dark); font-style: italic;
}
.article-body blockquote p { margin: 0; }
.article-body ul {
  margin: 0 0 18px; padding-left: 22px;
}
.article-body ul li {
  margin-bottom: 8px; padding-left: 4px;
}
.article-body ul li::marker { color: var(--primary); }

.article-footer { margin-top: 40px; padding-top: 24px; border-top: 1px solid var(--line); }
.article-share { display: flex; align-items: center; gap: 10px; }
.article-share__label { font-size: 14px; font-weight: 700; color: var(--muted); }
.article-share__btn {
  min-height: 36px; padding: 0 14px;
  border: 1px solid var(--line); border-radius: 999px;
  background: var(--white); color: var(--dark);
  font-size: 13px; font-weight: 750; cursor: pointer;
  transition: transform .16s ease, border-color .16s ease;
}
.article-share__btn:hover { transform: translateY(-1px); border-color: var(--primary); }

@media (max-width: 720px) {
  .article-main { padding: 20px 18px 48px; }
  .article-body { font-size: 16px; line-height: 1.65; }
}
`;
