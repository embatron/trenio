import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

type Trainer = {
  slug: string;
  name: string;
  sports: string[];
  sportLabel: string;
  primarySport: { slug: string; label: string };
  city: { slug: string; label: string };
  about: string[];
  taxonomy: {
    main: Array<{ label: string; accent?: boolean }>;
    groups: Array<{ label: string; items: string[] }>;
  };
  note: string;
  club: { slug: string; name: string; logo: string; meta: string };
  rating: { value: string; ratingCount: number; reviewCount: number };
  prices: {
    single: Array<{ name: string; price: string }>;
    packs: Array<{ name: string; price: string }>;
  };
  phone: string;
  badge?: string;
  reviews: Array<{ author: string; date: string; rating: number; text: string }>;
  similar: Array<{ slug: string; name: string; sport: string; city: string; price: string }>;
};

const TRAINERS: Record<string, Trainer> = {
  "farkhad-akhmedjanov": {
    slug: "farkhad-akhmedjanov",
    name: "Фархад Ахмеджанов",
    sports: ["Кикбоксинг", "Единоборства"],
    sportLabel: "Кикбоксинг · единоборства",
    primarySport: { slug: "kikboksing", label: "Кикбоксинг" },
    city: { slug: "minsk", label: "Минск" },
    about: [
      "Веду групповые и персональные занятия по кикбоксингу для взрослых. На старте — стойка, базовые удары и работа на снарядах без жёсткого контакта. Для опытных — связки, работа в парах и контролируемый спарринг по готовности.",
      "В группе темп выстраивается так, чтобы новичок успевал повторить технику, а опытный — не простаивал. На персональных занятиях разбираем стойку, работу ног, защиту и связки под вашу задачу — от первых тренировок до подготовки к спаррингу.",
      "Занятия проходят в BronxGym — полноценный зал с рингом, мешками и лапами. Можно прийти посмотреть формат и задать вопросы до записи: объясню, как устроена тренировка и с чего лучше начать именно вам.",
    ],
    taxonomy: {
      main: [
        { label: "Группа", accent: true },
        { label: "Индивидуально", accent: true },
        { label: "С нуля" },
        { label: "Продолжающие" },
        { label: "Русский" },
        { label: "В клубе" },
      ],
      groups: [
        { label: "Время", items: ["Вечер"] },
        { label: "Опыт", items: ["8+ лет"] },
        { label: "Аудитория", items: ["Взрослые 18+"] },
      ],
    },
    note: "Подойдёт новичкам и продолжающим — без давления и обязательных спаррингов на старте.",
    club: { slug: "bronxgym", name: "BronxGym", logo: "BG", meta: "Минск · групповые и персональные занятия" },
    rating: { value: "4.9", ratingCount: 38, reviewCount: 5 },
    prices: {
      single: [
        { name: "Группа", price: "45 BYN" },
        { name: "Индивидуально", price: "80 BYN" },
      ],
      packs: [
        { name: "8 групповых", price: "320 BYN" },
        { name: "4 персональных", price: "300 BYN" },
      ],
    },
    phone: "+375 (29) 123-45-67",
    badge: "Топ",
    reviews: [
      { author: "Алексей", date: "март 2026", rating: 5, text: "Пришёл с нуля — всё спокойно объяснили, без давления. Через месяц уже чувствую прогресс в стойке и работе на мешке." },
      { author: "Марина", date: "февраль 2026", rating: 5, text: "Хожу на групповые вечером. Темп комфортный, тренер видит каждого — техника реально улучшается." },
      { author: "Дмитрий", date: "январь 2026", rating: 5, text: "Брал персональные перед возвращением в спарринг — помогли собрать базу и не тащить старые ошибки." },
      { author: "Игорь", date: "декабрь 2025", rating: 4, text: "Нормальный рабочий тренер, зал удобный. Иногда группа большая — но успевает подсказать каждому." },
      { author: "Катя", date: "ноябрь 2025", rating: 5, text: "Первый раз пробовала единоборства — не страшно, всё по шагам. Осталась в группе." },
      { author: "Андрей", date: "октябрь 2025", rating: 5, text: "Хорошая подача техники, не дают халтурить, но и без перегрузки. Рекомендую." },
      { author: "Светлана", date: "сентябрь 2025", rating: 4, text: "Записывалась на пробное — приняли по-человечески, объяснили всё с нуля." },
    ],
    similar: [
      { slug: "dmitriy-hotin", name: "Дмитрий Хотин", sport: "Тайский бокс", city: "Минск", price: "от 50 BYN" },
      { slug: "sergey-ovsyannikov", name: "Сергей Овсяников", sport: "Тайский бокс", city: "Минск", price: "от 42 BYN" },
      { slug: "artem-romanovich", name: "Артем Романович", sport: "Бокс", city: "Минск", price: "от 38 BYN" },
      { slug: "vladimir-antipenko", name: "Владимир Антипенко", sport: "Кикбоксинг", city: "Минск", price: "от 35 BYN" },
    ],
  },
};

function getTrainer(slug: string): Trainer {
  const base = TRAINERS[slug];
  if (base) return base;
  // Fallback skeleton for any other slug from listing — keeps page navigable.
  const pretty = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    ...TRAINERS["farkhad-akhmedjanov"],
    slug,
    name: pretty,
    badge: undefined,
  };
}

export const Route = createFileRoute("/trainers/$slug")({
  loader: ({ params }) => {
    if (!params.slug) throw notFound();
    return { trainer: getTrainer(params.slug) };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.trainer;
    if (!t) return { meta: [{ title: "Тренер · trenio.by" }] };
    const title = `${t.name} — тренер по ${t.primarySport.label.toLowerCase()} в ${t.city.label} · trenio`;
    const desc = `Тренер по ${t.primarySport.label.toLowerCase()} в ${t.city.label}. Группы и индивидуальные занятия. ${t.club.name}. Цена от ${t.prices.single[0]?.price ?? ""}.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "profile" },
        { property: "og:url", content: `https://trenio.by/trainers/${t.slug}` },
      ],
      links: [{ rel: "canonical", href: `https://trenio.by/trainers/${t.slug}` }],
    };
  },
  component: TrainerPage,
});

function placeholder(seed: string, w = 680, h = 850) {
  return `https://placehold.co/${w}x${h}/fff5f5/c9343a?text=${encodeURIComponent(seed)}`;
}

const CSS = `
.trenio-trainer-root *, .trenio-trainer-root *::before, .trenio-trainer-root *::after { box-sizing: border-box; }
.trenio-trainer-root {
  --primary: #f04b50; --primary-dark: #c9343a; --dark: #111827; --light-bg: #fff5f5;
  --neutral-bg: #f9fafb; --text: #1f2937; --accent-cyan: #4bf0eb;
  --primary-rgb: 240,75,80; --dark-rgb: 17,24,39;
  --muted: #6b7280; --line: #e5e7eb; --white: #ffffff;
  --radius-xl: 44px; --radius-lg: 34px; --radius-md: 22px;
  --content-max: 1200px; --aside-w: minmax(360px, 38%);
  font-family: Inter, Manrope, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: var(--text); background: var(--neutral-bg); min-height: 100vh;
}



.page-shell { max-width: var(--content-max); margin: 0 auto; padding: 20px 36px 72px; }

.breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 24px; padding: 0; list-style: none; font-size: 13px; font-weight: 650; color: var(--muted); }
.breadcrumbs a { color: var(--muted); text-decoration: none; }
.breadcrumbs a:hover { color: var(--primary-dark); }
.breadcrumbs li + li::before { content: "›"; margin-right: 8px; color: var(--line); }

.profile-layout { display: grid; grid-template-columns: var(--aside-w) minmax(0, 1fr); gap: 32px; align-items: start; }
.profile-main { display: grid; gap: 22px; min-width: 0; }
.profile-aside { position: sticky; top: 96px; align-self: start; min-width: 0; }
.profile-aside__card { display: flex; flex-direction: column; border-radius: var(--radius-md); overflow: hidden; background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 14px 42px rgba(var(--dark-rgb),0.07); }

.photo-slider { position: relative; }
.photo-slider__frame { position: relative; aspect-ratio: 4/5; overflow: hidden; background: linear-gradient(160deg, var(--neutral-bg), var(--line)); }
.photo-slider__viewport { width: 100%; height: 100%; overflow: hidden; }
.photo-slider__track { display: flex; height: 100%; transition: transform 0.4s cubic-bezier(0.4,0,0.2,1); }
.photo-slider__slide { flex: 0 0 100%; height: 100%; }
.photo-slider__slide img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; user-select: none; }
.photo-slider__badge { position: absolute; top: 12px; left: 12px; z-index: 2; padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.94); color: var(--primary-dark); font-size: 11px; font-weight: 800; letter-spacing: 0.02em; text-transform: uppercase; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); }
.profile-save { position: absolute; top: 10px; right: 10px; z-index: 2; width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(255,255,255,0.92); color: var(--muted); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); }
.profile-save.is-saved { color: var(--primary); }
.profile-save svg { width: 20px; height: 20px; fill: currentColor; }
.photo-slider__nav { position: absolute; top: 50%; transform: translateY(-50%); width: 38px; height: 38px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.92); color: var(--dark); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); z-index: 2; }
.photo-slider__nav--prev { left: 10px; } .photo-slider__nav--next { right: 10px; }
.photo-slider__nav svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2.4; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.photo-slider__dots { display: flex; justify-content: center; gap: 6px; padding: 10px 0; background: var(--white); }
.photo-slider__dot { width: 8px; height: 8px; border-radius: 50%; border: 0; background: var(--line); cursor: pointer; padding: 0; }
.photo-slider__dot.is-active { background: var(--primary); width: 22px; border-radius: 4px; }

.contact-panel { padding: 4px 18px 18px; background: var(--white); }
.contact-prices { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px 14px; margin: 0 0 14px; }
.contact-prices__group { display: grid; gap: 8px; align-content: start; }
.contact-prices__heading { margin: 0; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.contact-price-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.contact-price-list__row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: 12px; background: var(--neutral-bg); }
.contact-price-list__name { font-size: 13px; font-weight: 700; color: var(--dark); }
.contact-price-list__amount { font-size: 14px; font-weight: 850; color: var(--dark); white-space: nowrap; }
.contact-panel__divider { height: 1px; margin: 0 0 14px; background: var(--line); }
.contact-actions { display: grid; gap: 8px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 20px; border: 0; border-radius: 999px; font-size: 15px; font-weight: 800; cursor: pointer; text-decoration: none; transition: transform 0.16s ease, background 0.16s ease; width: 100%; }
.btn:hover { transform: translateY(-1px); }
.btn--primary { background: var(--primary); color: #fff; }
.btn--primary:hover { background: var(--primary-dark); }
.btn--secondary { background: var(--neutral-bg); color: var(--dark); border: 1px solid var(--line); }
.btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: 2; fill: none; flex: 0 0 auto; }
.contact-reveal { display: none; margin-top: 12px; padding: 12px 14px; border-radius: 14px; background: var(--light-bg); text-align: center; }
.contact-reveal.is-visible { display: block; }
.contact-reveal__phone { display: block; margin-bottom: 4px; font-size: 18px; font-weight: 900; letter-spacing: -0.02em; color: var(--dark); text-decoration: none; }
.contact-reveal__hint { margin: 0; font-size: 12px; color: var(--muted); font-weight: 550; }

.profile-intro { min-width: 0; }
.profile-identity__sport { margin: 0 0 6px; font-size: 13px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--primary-dark); }
.profile-identity__name { margin: 0 0 12px; font-size: clamp(28px, 4vw, 40px); font-weight: 900; letter-spacing: -0.035em; color: var(--dark); line-height: 1.05; }
.profile-identity__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
.profile-location { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; font-weight: 650; }
.profile-location svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: 2; fill: none; }
.profile-rating { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; font-size: 15px; font-weight: 800; color: var(--dark); }
.profile-rating__stars { position: relative; display: inline-flex; }
.profile-rating__stars-empty, .profile-rating__stars-fill { display: inline-flex; gap: 2px; }
.profile-rating__stars-empty svg, .profile-rating__stars-fill svg { width: 16px; height: 16px; }
.profile-rating__stars-empty svg { fill: var(--line); }
.profile-rating__stars-filled { position: absolute; inset: 0 auto 0 0; overflow: hidden; }
.profile-rating__stars-fill svg { fill: #ffb400; }
.profile-rating__counts { color: var(--muted); font-size: 14px; font-weight: 650; }
.profile-rating__reviews-link { color: var(--primary-dark); font-weight: 750; text-decoration: none; }
.profile-rating__reviews-link:hover { text-decoration: underline; }

.profile-body { display: grid; gap: 32px; min-width: 0; }
.profile-block { display: grid; gap: 14px; }
.profile-heading { margin: 0; font-size: 14px; font-weight: 850; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.profile-text { margin: 0; color: var(--text); font-size: 15px; line-height: 1.65; font-weight: 500; }
.profile-text + .profile-text { margin-top: 12px; }
.profile-taxonomy { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.profile-taxonomy__group { display: grid; gap: 8px; }
.profile-taxonomy__group--merged { gap: 0; }
.profile-taxonomy__label { margin: 0; font-size: 12px; font-weight: 750; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.profile-taxonomy__tags { display: flex; flex-wrap: wrap; gap: 8px; }
.taxonomy-tag { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); color: var(--muted); font-size: 12px; font-weight: 750; line-height: 1.2; }
.taxonomy-tag--accent { background: rgba(var(--primary-rgb),0.1); color: var(--primary-dark); }
.profile-note { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; font-weight: 500; }

.profile-spotlight { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 16px; align-items: center; padding: 18px 20px; border-radius: var(--radius-md); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 10px 32px rgba(var(--dark-rgb),0.05); }
.profile-spotlight__logo { width: 56px; height: 56px; border-radius: 14px; background: var(--dark); color: var(--white); display: grid; place-items: center; font-size: 18px; font-weight: 900; letter-spacing: -0.04em; }
.profile-spotlight__title { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 4px; color: var(--dark); font-size: 16px; font-weight: 850; text-decoration: none; }
.profile-spotlight__title:hover { color: var(--primary-dark); }
.profile-spotlight__meta { margin: 0; color: var(--muted); font-size: 13px; font-weight: 500; }
.profile-spotlight__action { padding: 10px 14px; border-radius: 999px; background: var(--neutral-bg); color: var(--dark); font-size: 13px; font-weight: 750; text-decoration: none; white-space: nowrap; }
.profile-spotlight__action:hover { background: var(--light-bg); color: var(--primary-dark); }

.review-list { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.review-item { display: grid; gap: 8px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.review-item:last-child { padding-bottom: 0; border-bottom: 0; }
.review-item__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 12px; }
.review-item__author { font-size: 14px; font-weight: 800; color: var(--dark); }
.review-item__date { color: var(--muted); font-size: 12px; font-weight: 650; }
.review-item__stars { display: inline-flex; gap: 2px; }
.review-item__stars svg { width: 13px; height: 13px; fill: #ffb400; }
.review-item__stars svg.is-empty { fill: var(--line); }
.review-item__text { margin: 0; color: var(--text); font-size: 14px; line-height: 1.55; font-weight: 500; }

.profile-block__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.profile-block__head-meta { color: var(--muted); font-size: 13px; font-weight: 650; }
.reviews-more { margin-top: 4px; align-self: start; padding: 11px 18px; border-radius: 999px; border: 1px solid var(--line); background: var(--white); color: var(--dark); font-size: 14px; font-weight: 750; cursor: pointer; transition: background 0.16s ease, border-color 0.16s ease; }
.reviews-more:hover { background: var(--light-bg); border-color: rgba(var(--primary-rgb), 0.3); color: var(--primary-dark); }


.similar-trainers { min-width: 0; padding-top: 8px; }
.similar-trainers__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.similar-trainers__viewport { overflow-x: auto; scrollbar-width: none; }
.similar-trainers__viewport::-webkit-scrollbar { display: none; }
.similar-trainers__track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); gap: 14px; padding-bottom: 4px; }
.similar-card { display: flex; flex-direction: column; min-width: 0; border: 1px solid rgba(var(--dark-rgb),0.06); border-radius: var(--radius-md); background: var(--white); color: inherit; text-decoration: none; overflow: hidden; }
.similar-card__media { aspect-ratio: 4/5; background: linear-gradient(160deg, var(--neutral-bg), var(--line)); overflow: hidden; }
.similar-card__photo { width: 100%; height: 100%; object-fit: cover; }
.similar-card__body { padding: 14px 16px 16px; display: grid; gap: 4px; }
.similar-card__name { margin: 0; font-size: 15px; font-weight: 850; color: var(--dark); letter-spacing: -0.02em; }
.similar-card__sport { margin: 0; color: var(--muted); font-size: 13px; font-weight: 650; }
.similar-card__meta { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--muted); font-weight: 650; margin-top: 4px; }
.similar-card__price { color: var(--dark); font-weight: 850; }

.mobile-contact-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 200; padding: 10px 14px; background: rgba(255,255,255,0.96); backdrop-filter: blur(12px); border-top: 1px solid var(--line); display: none; }
.mobile-contact-bar__inner { max-width: 600px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

@media (max-width: 980px) {
  .profile-layout { grid-template-columns: 1fr; gap: 22px; }
  .profile-aside { position: static; }
  .mobile-contact-bar { display: block; }
  .page-shell { padding: 16px 16px 110px; }
}

`;

function Stars({ rating }: { rating: number }) {
  const pct = (rating / 5) * 100;
  return (
    <span className="profile-rating__stars" aria-hidden="true">
      <span className="profile-rating__stars-empty">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
        ))}
      </span>
      <span className="profile-rating__stars-filled" style={{ width: `${pct}%` }}>
        <span className="profile-rating__stars-fill">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg key={i} viewBox="0 0 24 24"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
          ))}
        </span>
      </span>
    </span>
  );
}

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="review-item__stars" aria-label={`Оценка ${rating} из 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} viewBox="0 0 24 24" className={i < rating ? "" : "is-empty"}><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
      ))}
    </span>
  );
}

function TrainerPage() {
  const { trainer: t } = Route.useLoaderData() as { trainer: Trainer };
  const [photoIdx, setPhotoIdx] = useState(0);
  const [saved, setSaved] = useState(false);
  const [reviewsShown, setReviewsShown] = useState(5);
  const [phoneVisible, setPhoneVisible] = useState(false);

  const photos = [
    placeholder(`${t.name} — портрет`),
    placeholder("Работа на лапах"),
    placeholder("Объяснение техники"),
  ];

  useEffect(() => {
    document.body.classList.add("page-trainer");
    return () => document.body.classList.remove("page-trainer");
  }, []);

  return (
    <div className="trenio-trainer-root">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <SiteHeader />

      <main className="page-shell">
        <nav aria-label="Хлебные крошки">
          <ol className="breadcrumbs">
            <li><Link to="/">Главная</Link></li>
            <li><a href={`/trainers/${t.city.slug}`}>Тренеры в {t.city.label === "Минск" ? "Минске" : t.city.label}</a></li>
            <li><a href={`/trainers/${t.city.slug}/${t.primarySport.slug}`}>{t.primarySport.label}</a></li>
            <li aria-current="page">{t.name}</li>
          </ol>
        </nav>

        <article className="profile-layout">
          <aside className="profile-aside">
            <div className="profile-aside__card">
              <div className="photo-slider">
                <div className="photo-slider__frame">
                  <div className="photo-slider__viewport">
                    <div className="photo-slider__track" style={{ transform: `translateX(-${photoIdx * 100}%)` }}>
                      {photos.map((src, i) => (
                        <div key={i} className="photo-slider__slide">
                          <img src={src} alt={`${t.name} — фото ${i + 1}`} width={680} height={850} draggable={false} loading={i === 0 ? "eager" : "lazy"} />
                        </div>
                      ))}
                    </div>
                  </div>
                  {t.badge && <span className="photo-slider__badge">{t.badge}</span>}
                  <button className={`profile-save${saved ? " is-saved" : ""}`} type="button" aria-label="Сохранить тренера" onClick={() => setSaved((s) => !s)}>
                    <svg viewBox="0 0 24 24"><path d="M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z" /></svg>
                  </button>
                  <button className="photo-slider__nav photo-slider__nav--prev" type="button" aria-label="Предыдущее фото" onClick={() => setPhotoIdx((i) => (i - 1 + photos.length) % photos.length)}>
                    <svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6" /></svg>
                  </button>
                  <button className="photo-slider__nav photo-slider__nav--next" type="button" aria-label="Следующее фото" onClick={() => setPhotoIdx((i) => (i + 1) % photos.length)}>
                    <svg viewBox="0 0 24 24"><path d="M10 6l6 6-6 6" /></svg>
                  </button>
                </div>
                <div className="photo-slider__dots" role="tablist" aria-label="Выбор фото">
                  {photos.map((_, i) => (
                    <button key={i} type="button" className={`photo-slider__dot${i === photoIdx ? " is-active" : ""}`} aria-label={`Фото ${i + 1}`} aria-selected={i === photoIdx} onClick={() => setPhotoIdx(i)} />
                  ))}
                </div>
              </div>

              <div className="contact-panel" aria-label="Связаться с тренером">
                <div className="contact-prices">
                  <div className="contact-prices__group">
                    <p className="contact-prices__heading">Разово</p>
                    <ul className="contact-price-list">
                      {t.prices.single.map((p) => (
                        <li key={p.name} className="contact-price-list__row">
                          <span className="contact-price-list__name">{p.name}</span>
                          <span className="contact-price-list__amount">{p.price}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="contact-prices__group">
                    <p className="contact-prices__heading">Пакеты</p>
                    <ul className="contact-price-list">
                      {t.prices.packs.map((p) => (
                        <li key={p.name} className="contact-price-list__row">
                          <span className="contact-price-list__name">{p.name}</span>
                          <span className="contact-price-list__amount">{p.price}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="contact-panel__divider" aria-hidden="true" />

                <div className="contact-actions">
                  <button className="btn btn--primary" type="button" onClick={() => setPhoneVisible(true)}>
                    <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z" /></svg>
                    {phoneVisible ? t.phone : "Показать телефон"}
                  </button>
                  <a className="btn btn--secondary" href="https://t.me/" target="_blank" rel="noopener noreferrer">
                    <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
                    Написать в Telegram
                  </a>
                </div>

                <div className={`contact-reveal${phoneVisible ? " is-visible" : ""}`}>
                  <a className="contact-reveal__phone" href={`tel:${t.phone.replace(/\s|\(|\)|-/g, "")}`}>{t.phone}</a>
                  <p className="contact-reveal__hint">Нажмите, чтобы позвонить</p>
                </div>
              </div>
            </div>
          </aside>

          <div className="profile-main">
            <header className="profile-intro">
              <div className="profile-identity">
                <p className="profile-identity__sport">{t.sportLabel}</p>
                <h1 className="profile-identity__name">{t.name}</h1>
                <div className="profile-identity__meta">
                  <span className="profile-location">
                    <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                    {t.city.label}
                  </span>
                  <div className="profile-rating" aria-label={`Рейтинг ${t.rating.value} из 5, ${t.rating.ratingCount} оценок, ${t.rating.reviewCount} отзывов`}>
                    <Stars rating={parseFloat(t.rating.value)} />
                    <span className="profile-rating__score">{t.rating.value}</span>
                    <span className="profile-rating__counts">
                      (<span>{t.rating.ratingCount} оценок</span> · <a className="profile-rating__reviews-link" href="#reviews">{t.rating.reviewCount} отзывов</a>)
                    </span>
                  </div>
                </div>
              </div>
            </header>

            <div className="profile-body">
              <section className="profile-block">
                {t.about.map((p, i) => (
                  <p key={i} className="profile-text">{p}</p>
                ))}

                <ul className="profile-taxonomy" aria-label="Характеристики тренера">
                  <li className="profile-taxonomy__group profile-taxonomy__group--merged">
                    <div className="profile-taxonomy__tags">
                      {t.taxonomy.main.map((tag) => (
                        <span key={tag.label} className={`taxonomy-tag${tag.accent ? " taxonomy-tag--accent" : ""}`}>{tag.label}</span>
                      ))}
                    </div>
                  </li>
                  {t.taxonomy.groups.map((g) => (
                    <li key={g.label} className="profile-taxonomy__group">
                      <p className="profile-taxonomy__label">{g.label}</p>
                      <div className="profile-taxonomy__tags">
                        {g.items.map((it) => (
                          <span key={it} className="taxonomy-tag">{it}</span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="profile-note">{t.note}</p>
              </section>

              <section className="profile-block">
                <h2 className="profile-heading">Место</h2>
                <div className="profile-spotlight">
                  <span className="profile-spotlight__logo" aria-hidden="true">{t.club.logo}</span>
                  <div>
                    <Link className="profile-spotlight__title" to="/clubs/$slug" params={{ slug: t.club.slug }}>
                      {t.club.name}
                      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
                    </Link>
                    <p className="profile-spotlight__meta">{t.club.meta}</p>
                  </div>
                  <Link className="profile-spotlight__action" to="/clubs/$slug" params={{ slug: t.club.slug }}>Страница клуба</Link>
                </div>
                <p className="profile-note">Занятия проходят в клубе — адрес и расписание уточняйте у тренера.</p>
              </section>

              <section className="profile-block" id="reviews">
                <div className="profile-block__head">
                  <h2 className="profile-heading">Отзывы · {t.rating.reviewCount}</h2>
                  <span className="profile-block__head-meta">{t.rating.value} из 5 · {t.rating.ratingCount} оценок</span>
                </div>
                <ul className="review-list">
                  {t.reviews.slice(0, reviewsShown).map((r, i) => (
                    <li key={`${r.author}-${i}`} className="review-item">
                      <div className="review-item__head">
                        <span className="review-item__author">{r.author}</span>
                        <span className="review-item__date">{r.date}</span>
                      </div>
                      <ReviewStars rating={r.rating} />
                      <p className="review-item__text">{r.text}</p>
                    </li>
                  ))}
                </ul>
                {reviewsShown < t.reviews.length && (
                  <button
                    type="button"
                    className="reviews-more"
                    onClick={() => setReviewsShown((n) => Math.min(n + 5, t.reviews.length))}
                  >
                    Показать ещё {Math.min(5, t.reviews.length - reviewsShown)} из {t.reviews.length - reviewsShown}
                  </button>
                )}
              </section>
            </div>


            <section className="similar-trainers" aria-labelledby="similar-heading">
              <div className="similar-trainers__head">
                <h2 className="profile-heading" id="similar-heading">Похожие тренеры</h2>
              </div>
              <div className="similar-trainers__viewport">
                <div className="similar-trainers__track">
                  {t.similar.map((s) => (
                    <Link key={s.slug} className="similar-card" to="/trainers/$slug" params={{ slug: s.slug }}>
                      <div className="similar-card__media">
                        <img className="similar-card__photo" src={placeholder(s.name, 420, 525)} alt={s.name} width={420} height={525} loading="lazy" />
                      </div>
                      <div className="similar-card__body">
                        <h3 className="similar-card__name">{s.name}</h3>
                        <p className="similar-card__sport">{s.sport}</p>
                        <div className="similar-card__meta">
                          <span>{s.city}</span>
                          <span className="similar-card__price">{s.price}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </article>
      </main>

      <div className="mobile-contact-bar" aria-label="Быстрая связь">
        <div className="mobile-contact-bar__inner">
          <a className="btn btn--secondary" href="https://t.me/" target="_blank" rel="noopener noreferrer">
            <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" /></svg>
            Telegram
          </a>
          <button className="btn btn--primary" type="button" onClick={() => setPhoneVisible(true)}>
            {phoneVisible ? t.phone : "Показать телефон"}
          </button>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
