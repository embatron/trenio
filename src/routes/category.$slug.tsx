import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const c = CATEGORIES[params.slug] ?? fallbackCategory(params.slug);
    const title = `Тренеры — ${c.title} в Беларуси | trenio.by`;
    const desc = `${c.title}: ${c.lead} Подбор по городу, цене, формату и опыту.`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  component: CategoryPage,
});

type Category = {
  slug: string;
  title: string;
  titleGenitive: string;
  eyebrow: string;
  lead: string;
  subSports: string[];
  related: { slug: string; label: string }[];
  about: { h: string; p: string }[];
  faq: { q: string; a: string }[];
  stats: { trainers: number; clubs: number; avgPrice: number; avgRating: number };
  isEmpty?: boolean;
};

const RELATED_DEFAULT = [
  { slug: "boks", label: "Бокс" },
  { slug: "kikboksing", label: "Кикбоксинг" },
  { slug: "mma", label: "MMA" },
  { slug: "fitnes", label: "Фитнес" },
  { slug: "yoga", label: "Йога" },
  { slug: "plavanie", label: "Плавание" },
];

const CATEGORIES: Record<string, Category> = {
  boks: {
    slug: "boks",
    title: "Бокс",
    titleGenitive: "бокса",
    eyebrow: "Единоборства · Бокс",
    lead: "Найдите тренера по боксу — от первого занятия до подготовки к соревнованиям.",
    subSports: ["Классический бокс", "Любительский бокс", "Бокс для женщин", "Бокс для детей", "Подготовка к соревнованиям", "Силовая база"],
    related: [
      { slug: "kikboksing", label: "Кикбоксинг" },
      { slug: "mma", label: "MMA" },
      { slug: "edinoborstva", label: "Единоборства" },
      { slug: "ofp", label: "ОФП" },
      { slug: "fitnes", label: "Фитнес" },
      { slug: "samooborona", label: "Самооборона" },
    ],
    about: [
      {
        h: "Что даёт бокс",
        p: "Бокс развивает координацию, скоростную выносливость и уверенность в себе. На начальном уровне тренер ставит стойку, дыхание и технику передвижения, потом подключается работа с лапами, грушей и парная техника. Спарринги — только тогда, когда вы готовы.",
      },
      {
        h: "Как выбрать тренера",
        p: "Смотрите на формат: индивидуально, в малой группе или общим потоком. Уточняйте опыт работы с новичками или с конкретной возрастной группой. Хороший тренер всегда расскажет про разминку, нагрузку и восстановление, а не только про удары.",
      },
      {
        h: "Сколько занятий нужно",
        p: "Для уверенной базы обычно нужно 8–12 занятий по 2–3 раза в неделю. Для подготовки к спаррингам — от 3 месяцев регулярной работы. Многие тренеры предлагают пакетные цены и пробное занятие со скидкой.",
      },
    ],
    faq: [
      { q: "Можно ли заниматься без опыта?", a: "Да. Большинство тренеров на платформе работают с новичками — первое занятие почти всегда вводное." },
      { q: "Нужна ли своя экипировка?", a: "На первое занятие — нет. Перчатки и бинты обычно есть в зале или у тренера. Свою экипировку покупают через 2–3 недели." },
      { q: "С какого возраста берут детей?", a: "Чаще с 7 лет — в детских группах. Некоторые тренеры работают с детьми с 5 лет в игровом формате." },
      { q: "Сколько стоит одно занятие?", a: "В среднем 35–55 BYN за персональное и 15–25 BYN за групповое. В пакете из 10 занятий цена ниже." },
    ],
    stats: { trainers: 48, clubs: 14, avgPrice: 42, avgRating: 4.8 },
  },
  edinoborstva: {
    slug: "edinoborstva",
    title: "Единоборства",
    titleGenitive: "единоборств",
    eyebrow: "Спорт · Единоборства",
    lead: "Тренеры по боксу, кикбоксингу, MMA, тайскому боксу и борьбе — для взрослых и детей.",
    subSports: ["Бокс", "Кикбоксинг", "MMA", "Тайский бокс", "Дзюдо", "Самбо", "Грэпплинг", "Каратэ"],
    related: RELATED_DEFAULT,
    about: [
      { h: "Что входит в направление", p: "Единоборства объединяют ударные и борцовские дисциплины. Под единым фильтром мы собрали тренеров, которые работают с базовой техникой, спаррингами и подготовкой к соревнованиям." },
      { h: "С чего начать", p: "Если не уверены, какое направление выбрать — берите пробное в боксе или кикбоксинге. Это даст базовое понимание стойки, дистанции и работы ног, на которую опираются все остальные виды." },
    ],
    faq: [
      { q: "Чем отличается бокс от кикбоксинга?", a: "В боксе работают только руками, в кикбоксинге добавляются удары ногами и колени." },
      { q: "Опасно ли это?", a: "На уровне тренировок — нет. Контактные спарринги тренер подключает постепенно и только в защитной экипировке." },
    ],
    stats: { trainers: 120, clubs: 32, avgPrice: 40, avgRating: 4.8 },
  },
  yoga: {
    slug: "yoga",
    title: "Йога",
    titleGenitive: "йоги",
    eyebrow: "Здоровье · Йога",
    lead: "Тренеры по йоге, пилатесу и стретчингу — для разных уровней подготовки.",
    subSports: ["Хатха-йога", "Виньяса", "Аштанга", "Йога для начинающих", "Йога для беременных", "Йога-терапия"],
    related: [
      { slug: "pilates", label: "Пилатес" },
      { slug: "fitnes", label: "Фитнес" },
      { slug: "lfk", label: "ЛФК" },
      { slug: "tancy", label: "Танцы" },
      { slug: "plavanie", label: "Плавание" },
    ],
    about: [
      { h: "Кому подойдёт йога", p: "Подойдёт тем, кто хочет работать с гибкостью, дыханием и снять напряжение. Начинают с мягких практик — хатхи или йоги для начинающих." },
    ],
    faq: [
      { q: "Нужна ли растяжка с детства?", a: "Нет. Большинство учеников приходят без подготовки — это нормально." },
    ],
    stats: { trainers: 36, clubs: 9, avgPrice: 38, avgRating: 4.9 },
  },
  fitnes: {
    slug: "fitnes",
    title: "Фитнес",
    titleGenitive: "фитнеса",
    eyebrow: "Зал · Фитнес",
    lead: "Персональные тренеры по фитнесу, силовому и функциональному тренингу.",
    subSports: ["Похудение", "Набор массы", "Силовой тренинг", "Функциональный тренинг", "Кроссфит", "Реабилитация"],
    related: RELATED_DEFAULT,
    about: [
      { h: "Что важно в фитнесе", p: "Цель важнее программы. Сначала тренер уточняет, чего вы хотите — снизить вес, набрать массу, восстановиться после травмы — и строит план под это." },
    ],
    faq: [
      { q: "Сколько раз в неделю заниматься?", a: "Обычно 2–3 раза. Этого достаточно для устойчивого прогресса при адекватной нагрузке." },
    ],
    stats: { trainers: 72, clubs: 21, avgPrice: 45, avgRating: 4.8 },
  },
  kerling: {
    slug: "kerling",
    title: "Кёрлинг",
    titleGenitive: "кёрлингу",
    eyebrow: "Новое направление · Зимние виды",
    lead: "Пока ни одного тренера на платформе. Будьте первым — или подпишитесь и мы напишем, когда появятся.",
    subSports: ["Для начинающих", "Команды", "Дети", "Соревнования"],
    related: [
      { slug: "hokkej", label: "Хоккей" },
      { slug: "figurnoe-katanie", label: "Фигурное катание" },
      { slug: "snoubord", label: "Сноуборд" },
      { slug: "fitnes", label: "Фитнес" },
    ],
    about: [
      { h: "Что такое кёрлинг", p: "Командный вид спорта на льду: точность, тактика и техника скольжения. Подойдёт и взрослым, и подросткам — без серьёзной физической подготовки." },
    ],
    faq: [
      { q: "Когда появятся тренеры?", a: "Мы открываем направление и ищем сертифицированных тренеров по кёрлингу. Подпишитесь — пришлём письмо, как только кто-то добавится." },
    ],
    stats: { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 },
    isEmpty: true,
  },
};

function fallbackCategory(slug: string): Category {
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    slug,
    title,
    titleGenitive: title.toLowerCase(),
    eyebrow: "Направление",
    lead: `Тренеры по направлению «${title}» — подбор по городу, цене и формату.`,
    subSports: ["Для начинающих", "Для опытных", "Дети", "Взрослые"],
    related: RELATED_DEFAULT,
    about: [
      { h: "О направлении", p: "Здесь собраны тренеры, которые работают по этому направлению. Используйте фильтры, чтобы найти подходящего по городу, цене, формату и опыту." },
    ],
    faq: [
      { q: "Как связаться с тренером?", a: "На странице тренера есть кнопка «Написать» — сообщение придёт ему в Telegram. Можно также показать телефон." },
    ],
    stats: { trainers: 12, clubs: 4, avgPrice: 40, avgRating: 4.7 },
  };
}

type TrainerCard = {
  slug: string;
  name: string;
  sub: string;
  desc: string;
  tags: string[];
  rating: string;
  reviews: number;
  price: number;
  city: string;
  district: string;
  badge?: string;
  experience: number;
  audience: "adult" | "kid" | "teen";
  format: "individual" | "group";
};

function generateTrainers(c: Category): TrainerCard[] {
  if (c.isEmpty) return [];
  const first = ["Фархад", "Дмитрий", "Сергей", "Артем", "Владимир", "Анна", "Ольга", "Игорь", "Павел", "Никита", "Юлия", "Михаил"];
  const last = ["Ахмеджанов", "Хотин", "Овсяников", "Романович", "Антипенко", "Ковалёва", "Сидорова", "Зайцев", "Левин", "Гомель", "Дроздова", "Беленький"];
  const districts = ["Центр", "Уручье", "Малиновка", "Серебрянка", "Каменная Горка", "Восток", "Юг"];
  const cities = ["Минск", "Минск", "Минск", "Гомель", "Брест", "Гродно", "Витебск", "Могилёв"];
  const tagsPool = ["Индивидуально", "Группа", "Взрослые", "Дети", "Подростки", "Онлайн", "С нуля", "Соревнования"];
  return Array.from({ length: 12 }).map((_, i) => {
    const f = first[i % first.length];
    const l = last[(i * 3) % last.length];
    const sub = c.subSports[i % c.subSports.length];
    const aud = i % 4 === 0 ? "kid" : i % 5 === 0 ? "teen" : "adult";
    const fmt = i % 3 === 0 ? "group" : "individual";
    const tags = [fmt === "group" ? "Группа" : "Индивидуально", aud === "kid" ? "Дети" : aud === "teen" ? "Подростки" : "Взрослые", tagsPool[(i + 4) % tagsPool.length]];
    return {
      slug: `${c.slug}-trainer-${i + 1}`,
      name: `${f} ${l}`,
      sub,
      desc: `${sub} — постановка техники, безопасность и понятный темп. Работаю в малых группах и индивидуально.`,
      tags,
      rating: (4.5 + (i % 6) * 0.08).toFixed(1),
      reviews: 6 + ((i * 7) % 60),
      price: 28 + ((i * 9) % 38),
      city: cities[i % cities.length],
      district: districts[i % districts.length],
      badge: i === 0 ? "Топ" : i === 3 ? "Новый" : undefined,
      experience: 1 + ((i * 3) % 14),
      audience: aud,
      format: fmt,
    };
  });
}

function placeholder(seed: string) {
  return `https://placehold.co/480x600/fff5f5/c9343a?text=${encodeURIComponent(seed)}`;
}

const PAGE_CSS = `
.cat-hero { background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%); padding: 36px 0 28px; border-bottom: 1px solid var(--line); }
.cat-hero__inner { max-width: 1240px; margin: 0 auto; padding: 0 32px; }
.cat-breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; font-size: 13px; color: var(--muted); margin-bottom: 18px; }
.cat-breadcrumbs a { color: var(--muted); text-decoration: none; }
.cat-breadcrumbs a:hover { color: var(--primary); }
.cat-breadcrumbs span { color: var(--dark); font-weight: 700; }
.cat-hero__grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); gap: 40px; align-items: center; }
.cat-hero__eyebrow { display: inline-block; padding: 5px 11px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.12); color: var(--primary-dark); font-size: 11px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 14px; }
.cat-hero__title { margin: 0; font-size: clamp(34px, 5vw, 56px); line-height: 1.02; letter-spacing: -0.035em; font-weight: 900; color: var(--dark); }
.cat-hero__lead { margin: 14px 0 22px; font-size: 17px; line-height: 1.5; color: var(--muted); max-width: 56ch; font-weight: 550; }
.cat-hero__stats { display: flex; flex-wrap: wrap; gap: 10px; }
.cat-hero__stat { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--white); border: 1px solid var(--line); border-radius: 14px; font-size: 13px; font-weight: 700; color: var(--dark); }
.cat-hero__stat b { color: var(--primary); font-weight: 900; font-size: 16px; }
.cat-hero__visual { aspect-ratio: 4/3; border-radius: 24px; background: linear-gradient(135deg, var(--primary) 0%, #ff7a4a 100%); display: grid; place-items: center; color: #fff; position: relative; overflow: hidden; box-shadow: 0 30px 60px -30px rgba(var(--primary-rgb), 0.5); }
.cat-hero__visual::before { content: ""; position: absolute; inset: 0; background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 60%); }
.cat-hero__visual svg { width: 60%; height: 60%; opacity: 0.92; position: relative; }
.cat-subsports { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 24px; }
.cat-subchip { padding: 9px 14px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); color: var(--dark); font-size: 13px; font-weight: 700; cursor: pointer; transition: all 0.18s ease; }
.cat-subchip:hover { border-color: var(--primary); color: var(--primary); }
.cat-subchip.is-active { background: var(--primary); border-color: var(--primary); color: #fff; }

.cat-body { max-width: 1240px; margin: 0 auto; padding: 36px 32px 60px; display: grid; grid-template-columns: 280px minmax(0, 1fr); gap: 32px; }
.cat-filters { position: sticky; top: calc(var(--header-clearance, 80px) + 16px); align-self: start; background: var(--white); border: 1px solid var(--line); border-radius: var(--radius-md); padding: 22px; max-height: calc(100vh - var(--header-clearance, 80px) - 32px); overflow-y: auto; }
.cat-filters h3 { margin: 0 0 16px; font-size: 17px; letter-spacing: -0.02em; font-weight: 850; }
.cat-filter { border-top: 1px solid var(--line); padding: 16px 0; }
.cat-filter:first-of-type { border-top: 0; padding-top: 0; }
.cat-filter__title { font-size: 12px; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.cat-filter__opts { display: flex; flex-wrap: wrap; gap: 6px; }
.cat-pill { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); border: 1px solid transparent; color: var(--dark); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.16s ease; }
.cat-pill:hover { background: rgba(var(--primary-rgb), 0.08); }
.cat-pill.is-active { background: var(--primary); color: #fff; }
.cat-filter__check { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 14px; cursor: pointer; color: var(--dark); }
.cat-filter__check input { accent-color: var(--primary); }
.cat-price__values { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--dark); margin-bottom: 10px; gap: 8px; }
.cat-price__values b { font-size: 14px; font-weight: 800; color: var(--ink); }
.cat-price__values span { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; display: block; }
.cat-price__slider { position: relative; height: 28px; margin: 0 10px; }
.cat-price__track { position: absolute; left: 0; right: 0; top: 50%; height: 4px; transform: translateY(-50%); background: var(--line); border-radius: 999px; }
.cat-price__fill { position: absolute; top: 50%; height: 4px; transform: translateY(-50%); background: linear-gradient(90deg, var(--primary), #ff7a59); border-radius: 999px; }
.cat-price__slider input[type="range"] { position: absolute; left: -10px; right: -10px; top: 0; width: calc(100% + 20px); height: 28px; -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; margin: 0; }
.cat-price__slider input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--white); border: 2px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.18); cursor: pointer; pointer-events: auto; }
.cat-price__slider input[type="range"]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--white); border: 2px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.18); cursor: pointer; pointer-events: auto; border-width: 2px; }
.cat-price__slider input[type="range"]::-moz-range-track { background: transparent; }
.cat-price__bounds { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 6px; }
.cat-filter__reset { width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: 12px; background: var(--white); color: var(--dark); font-weight: 700; font-size: 13px; cursor: pointer; margin-top: 8px; }
.cat-filter__reset:hover { border-color: var(--primary); color: var(--primary); }

.cat-results__head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
.cat-results__count { font-size: 15px; color: var(--muted); font-weight: 600; }
.cat-results__count b { color: var(--dark); font-weight: 850; }
.cat-results__sort { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.cat-results__sort select { padding: 9px 14px; border: 1px solid var(--line); border-radius: 10px; font: inherit; font-size: 13px; background: var(--white); cursor: pointer; font-weight: 700; color: var(--dark); }
.cat-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 22px; }
@media (max-width: 1100px) { .cat-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.cat-empty {
  padding: 56px 36px; text-align: center; border-radius: var(--radius-md);
  background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%);
  border: 1px solid rgba(var(--primary-rgb), 0.16); color: var(--text);
  display: grid; gap: 18px; justify-items: center;
}
.cat-empty__icon { width: 96px; height: 96px; border-radius: 50%; background: #fff; box-shadow: 0 12px 30px -12px rgba(var(--dark-rgb), 0.18); display: grid; place-items: center; color: var(--primary); }
.cat-empty__icon svg { width: 44px; height: 44px; stroke: currentColor; stroke-width: 1.8; fill: none; stroke-linecap: round; stroke-linejoin: round; }
.cat-empty h3 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.025em; color: var(--dark); }
.cat-empty p { margin: 0; max-width: 540px; color: var(--muted); font-size: 15px; line-height: 1.55; }
.cat-empty__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 4px; }
.cat-empty__btn { padding: 12px 22px; border-radius: 12px; font-size: 14px; font-weight: 800; text-decoration: none; cursor: pointer; border: 0; }
.cat-empty__btn--primary { background: var(--primary); color: #fff; }
.cat-empty__btn--ghost { background: #fff; color: var(--dark); border: 1.5px solid var(--line); }
.cat-empty__suggest { margin-top: 22px; padding-top: 22px; border-top: 1px dashed rgba(var(--dark-rgb), 0.12); width: 100%; max-width: 640px; }
.cat-empty__suggest h4 { margin: 0 0 12px; font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.cat-empty__chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.cat-empty__chip { padding: 8px 14px; border-radius: 999px; background: #fff; border: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--dark); text-decoration: none; transition: border-color 0.15s ease, color 0.15s ease; }
.cat-empty__chip:hover { border-color: var(--primary); color: var(--primary); }

.cat-map-banner { margin-top: 28px; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 20px; align-items: center; padding: 22px 26px; border: 1px solid var(--line); border-radius: var(--radius-md); background: linear-gradient(135deg, #1a1a1f 0%, #2a1a1a 100%); color: #fff; }
.cat-map-banner h3 { margin: 0 0 4px; font-size: 19px; font-weight: 850; letter-spacing: -0.02em; }
.cat-map-banner p { margin: 0; color: rgba(255,255,255,0.7); font-size: 14px; }
.cat-map-banner button { padding: 12px 22px; border: 0; border-radius: 12px; background: var(--primary); color: #fff; font: inherit; font-weight: 800; cursor: pointer; }

.cat-extra { max-width: 1240px; margin: 0 auto; padding: 0 32px 60px; display: grid; gap: 48px; }
.cat-block { display: grid; gap: 18px; }
.cat-block h2 { margin: 0; font-size: clamp(24px, 3vw, 32px); letter-spacing: -0.03em; font-weight: 900; color: var(--dark); }
.cat-clubs-row { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; }
@media (max-width: 1100px) { .cat-clubs-row { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.cat-club { display: flex; flex-direction: column; padding: 18px; border: 1px solid var(--line); border-radius: var(--radius-md); background: var(--white); text-decoration: none; color: inherit; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
.cat-club:hover { transform: translateY(-3px); border-color: rgba(var(--primary-rgb), 0.3); box-shadow: 0 12px 30px -16px rgba(var(--dark-rgb), 0.18); }
.cat-club__logo { width: 56px; height: 56px; border-radius: 14px; background: var(--light-bg); display: grid; place-items: center; font-size: 22px; font-weight: 900; color: var(--primary); margin-bottom: 12px; }
.cat-club h4 { margin: 0 0 4px; font-size: 16px; font-weight: 850; letter-spacing: -0.02em; }
.cat-club p { margin: 0; color: var(--muted); font-size: 13px; }
.cat-club__meta { margin-top: auto; padding-top: 12px; display: flex; gap: 12px; font-size: 12px; color: var(--muted); font-weight: 700; }

.cat-article { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 40px; align-items: start; }
.cat-article__body { display: grid; gap: 22px; }
.cat-article__body h3 { margin: 0 0 6px; font-size: 20px; letter-spacing: -0.02em; font-weight: 850; }
.cat-article__body p { margin: 0; color: #4a4a4f; font-size: 15px; line-height: 1.65; }
.cat-article__aside { background: var(--light-bg); border-radius: var(--radius-md); padding: 26px; }
.cat-article__aside h4 { margin: 0 0 14px; font-size: 16px; font-weight: 850; letter-spacing: -0.02em; }
.cat-related { display: flex; flex-wrap: wrap; gap: 8px; }
.cat-related a { padding: 9px 14px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); font-size: 13px; font-weight: 700; color: var(--dark); text-decoration: none; transition: all 0.16s ease; }
.cat-related a:hover { border-color: var(--primary); color: var(--primary); }

.cat-faq { display: grid; gap: 8px; max-width: 820px; }
.cat-faq details { background: var(--white); border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
.cat-faq summary { padding: 18px 22px; font-weight: 800; cursor: pointer; font-size: 15px; letter-spacing: -0.01em; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.cat-faq summary::after { content: "+"; font-size: 22px; color: var(--primary); font-weight: 700; }
.cat-faq details[open] summary::after { content: "−"; }
.cat-faq details > div { padding: 0 22px 20px; color: var(--muted); font-size: 14px; line-height: 1.6; }

.cat-cta { background: linear-gradient(135deg, var(--primary) 0%, #e63946 60%, #ad2030 100%); border-radius: 28px; padding: 44px 48px; color: #fff; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; }
.cat-cta h2 { margin: 0 0 6px; font-size: clamp(22px, 2.6vw, 30px); font-weight: 900; letter-spacing: -0.025em; }
.cat-cta p { margin: 0; color: rgba(255,255,255,0.85); font-size: 15px; max-width: 56ch; }
.cat-cta a { padding: 14px 24px; border-radius: 14px; background: #fff; color: var(--primary-dark); font-weight: 850; text-decoration: none; white-space: nowrap; }

@media (max-width: 960px) {
  .cat-hero__grid { grid-template-columns: 1fr; }
  .cat-hero__visual { max-width: 360px; }
  .cat-body { grid-template-columns: 1fr; padding: 24px 20px 40px; }
  .cat-filters { position: static; max-height: none; }
  .cat-article { grid-template-columns: 1fr; }
  .cat-cta { grid-template-columns: 1fr; padding: 32px 26px; }
  .cat-extra { padding: 0 20px 40px; gap: 36px; }
  .cat-hero__inner { padding: 0 20px; }
}
@media (max-width: 620px) {
  .cat-grid { grid-template-columns: 1fr; }
  .cat-map-banner { grid-template-columns: 1fr; }
}
`;

const CITIES_FILTER = ["Минск", "Гомель", "Брест", "Гродно", "Витебск", "Могилёв"];

function CategoryPage() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const category = CATEGORIES[slug] ?? fallbackCategory(slug);
  const allTrainers = useMemo(() => generateTrainers(category), [category]);

  const [city, setCity] = useState<string | null>(null);
  const [audience, setAudience] = useState<"all" | "adult" | "kid" | "teen">("all");
  const [format, setFormat] = useState<"all" | "individual" | "group">("all");
  const priceBounds = useMemo(() => {
    if (!allTrainers.length) return { min: 0, max: 100 };
    const prices = allTrainers.map((t) => t.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [allTrainers]);
  const [priceMin, setPriceMin] = useState<number>(priceBounds.min);
  const [priceMax, setPriceMax] = useState<number>(priceBounds.max);
  useEffect(() => { setPriceMin(priceBounds.min); setPriceMax(priceBounds.max); }, [priceBounds.min, priceBounds.max]);
  const [minRating, setMinRating] = useState<number>(0);
  const [sort, setSort] = useState("popular");
  const [subSport, setSubSport] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = allTrainers.filter((t) => {
      if (city && t.city !== city) return false;
      if (audience !== "all" && t.audience !== audience) return false;
      if (format !== "all" && t.format !== format) return false;
      if (priceMin && t.price < Number(priceMin)) return false;
      if (priceMax && t.price > Number(priceMax)) return false;
      if (minRating && Number(t.rating) < minRating) return false;
      if (subSport && t.sub !== subSport) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "rating") list = [...list].sort((a, b) => Number(b.rating) - Number(a.rating));
    else if (sort === "reviews") list = [...list].sort((a, b) => b.reviews - a.reviews);
    return list;
  }, [allTrainers, city, audience, format, priceMin, priceMax, minRating, sort, subSport]);

  const reset = () => {
    setCity(null); setAudience("all"); setFormat("all"); setPriceMin(priceBounds.min); setPriceMax(priceBounds.max); setMinRating(0); setSubSport(null);
  };

  return (
    <div className="page-shell">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <SiteHeader />

      <main>
        <section className="cat-hero">
          <div className="cat-hero__inner">
            <nav className="cat-breadcrumbs" aria-label="breadcrumbs">
              <Link to="/">Главная</Link>
              <span>/</span>
              <Link to="/category/$slug" params={{ slug: "edinoborstva" }}>Категории</Link>
              <span>/</span>
              <span>{category.title}</span>
            </nav>
            <div className="cat-hero__grid">
              <div>
                <span className="cat-hero__eyebrow">{category.eyebrow}</span>
                <h1 className="cat-hero__title">Тренеры по {category.titleGenitive} в Беларуси</h1>
                <p className="cat-hero__lead">{category.lead}</p>
                <div className="cat-hero__stats">
                  <span className="cat-hero__stat"><b>{category.stats.trainers}</b> тренеров</span>
                  <span className="cat-hero__stat"><b>{category.stats.clubs}</b> клубов</span>
                  <span className="cat-hero__stat"><b>{category.stats.avgPrice}</b> BYN средн.</span>
                  <span className="cat-hero__stat"><b>{category.stats.avgRating}</b> рейтинг</span>
                </div>
              </div>
              <div className="cat-hero__visual" aria-hidden="true">
                <svg viewBox="0 0 200 200" fill="none">
                  <circle cx="100" cy="100" r="80" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                  <circle cx="100" cy="100" r="55" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                  <path d="M70 90 L100 60 L130 90 L130 140 L70 140 Z" fill="rgba(255,255,255,0.95)" />
                  <circle cx="100" cy="110" r="10" fill="var(--primary)" />
                </svg>
              </div>
            </div>
            <div className="cat-subsports" role="tablist">
              <button className={`cat-subchip${subSport === null ? " is-active" : ""}`} onClick={() => setSubSport(null)}>Все</button>
              {category.subSports.map((s) => (
                <button key={s} className={`cat-subchip${subSport === s ? " is-active" : ""}`} onClick={() => setSubSport(s === subSport ? null : s)}>{s}</button>
              ))}
            </div>
          </div>
        </section>

        <div className="cat-body">
          <aside className="cat-filters">
            <h3>Фильтры</h3>
            <div className="cat-filter">
              <div className="cat-filter__title">Город</div>
              <div className="cat-filter__opts">
                <button className={`cat-pill${city === null ? " is-active" : ""}`} onClick={() => setCity(null)}>Все</button>
                {CITIES_FILTER.map((c) => (
                  <button key={c} className={`cat-pill${city === c ? " is-active" : ""}`} onClick={() => setCity(c === city ? null : c)}>{c}</button>
                ))}
              </div>
            </div>
            <div className="cat-filter">
              <div className="cat-filter__title">Аудитория</div>
              <div className="cat-filter__opts">
                {[
                  { v: "all", l: "Любая" },
                  { v: "adult", l: "Взрослые" },
                  { v: "teen", l: "Подростки" },
                  { v: "kid", l: "Дети" },
                ].map((o) => (
                  <button key={o.v} className={`cat-pill${audience === o.v ? " is-active" : ""}`} onClick={() => setAudience(o.v as typeof audience)}>{o.l}</button>
                ))}
              </div>
            </div>
            <div className="cat-filter">
              <div className="cat-filter__title">Формат</div>
              <div className="cat-filter__opts">
                {[
                  { v: "all", l: "Любой" },
                  { v: "individual", l: "Индивидуально" },
                  { v: "group", l: "Группа" },
                ].map((o) => (
                  <button key={o.v} className={`cat-pill${format === o.v ? " is-active" : ""}`} onClick={() => setFormat(o.v as typeof format)}>{o.l}</button>
                ))}
              </div>
            </div>
            <div className="cat-filter">
              <div className="cat-filter__title">Цена, BYN</div>
              <div className="cat-price__values">
                <div><span>от</span><b>{priceMin}</b></div>
                <div style={{ textAlign: "right" }}><span>до</span><b>{priceMax}</b></div>
              </div>
              <div className="cat-price__slider">
                <div className="cat-price__track" />
                <div
                  className="cat-price__fill"
                  style={{
                    left: `${((priceMin - priceBounds.min) / Math.max(1, priceBounds.max - priceBounds.min)) * 100}%`,
                    right: `${100 - ((priceMax - priceBounds.min) / Math.max(1, priceBounds.max - priceBounds.min)) * 100}%`,
                  }}
                />
                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  value={priceMin}
                  onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax - 1))}
                  style={{ zIndex: priceMin > priceBounds.max - 10 ? 5 : 3 }}
                />
                <input
                  type="range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  value={priceMax}
                  onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin + 1))}
                  style={{ zIndex: 4 }}
                />
              </div>
              <div className="cat-price__bounds">
                <span>{priceBounds.min} BYN</span>
                <span>{priceBounds.max} BYN</span>
              </div>
            </div>
            <div className="cat-filter">
              <div className="cat-filter__title">Рейтинг</div>
              <div className="cat-filter__opts">
                {[0, 4, 4.5, 4.8].map((r) => (
                  <button key={r} className={`cat-pill${minRating === r ? " is-active" : ""}`} onClick={() => setMinRating(r)}>{r === 0 ? "Любой" : `${r}+`}</button>
                ))}
              </div>
            </div>
            <button className="cat-filter__reset" onClick={reset}>Сбросить</button>
          </aside>

          <div>
            <div className="cat-results__head">
              <div className="cat-results__count"><b>{filtered.length}</b> тренеров{city ? ` · ${city}` : ""}</div>
              <label className="cat-results__sort">
                Сортировка:
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="popular">По популярности</option>
                  <option value="rating">По рейтингу</option>
                  <option value="reviews">По отзывам</option>
                  <option value="price-asc">Сначала дешевле</option>
                  <option value="price-desc">Сначала дороже</option>
                </select>
              </label>
            </div>

            {filtered.length === 0 ? (
              <div className="cat-empty">
                <div className="cat-empty__icon">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M16 16l5 5" /><path d="M8 11h6" /></svg>
                </div>
                <h3>{category.isEmpty ? `Тренеров по ${category.titleGenitive} пока нет` : "По вашим фильтрам ничего не нашлось"}</h3>
                <p>
                  {category.isEmpty
                    ? "Направление только открылось на trenio.by. Будьте первым тренером или подпишитесь — мы напишем, когда кто-то добавится."
                    : "Попробуйте сбросить часть фильтров, расширить ценовой диапазон или посмотреть похожие направления."}
                </p>
                <div className="cat-empty__actions">
                  {category.isEmpty ? (
                    <>
                      <Link to="/auth/signup" className="cat-empty__btn cat-empty__btn--primary">Стать первым тренером</Link>
                      <button type="button" className="cat-empty__btn cat-empty__btn--ghost" onClick={() => alert("Подписка оформлена — мы напишем на e-mail.")}>Сообщить, когда появятся</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="cat-empty__btn cat-empty__btn--primary" onClick={reset}>Сбросить фильтры</button>
                      <Link to="/" className="cat-empty__btn cat-empty__btn--ghost">На главную</Link>
                    </>
                  )}
                </div>
                <div className="cat-empty__suggest">
                  <h4>Похожие направления</h4>
                  <div className="cat-empty__chips">
                    {category.related.map((r) => (
                      <Link key={r.slug} to="/category/$slug" params={{ slug: r.slug }} className="cat-empty__chip">{r.label}</Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="cat-grid">
                {filtered.map((t) => (
                  <Link key={t.slug} className="trainer-card" to="/trainers/$slug" params={{ slug: "farkhad-akhmedjanov" }}>
                    <div className="trainer-card__media">
                      <img className="trainer-card__photo" src={placeholder(t.name)} alt={t.name} width={480} height={600} loading="lazy" />
                      {t.badge && <span className="trainer-card__badge">{t.badge}</span>}
                      <button className="trainer-card__save" type="button" aria-label="Сохранить" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5l-1.1-1C6.5 15.2 4 12.8 4 9.5 4 7 5.8 5 8.2 5c1.4 0 2.7.7 3.8 1.8C13.1 5.7 14.4 5 15.8 5 18.2 5 20 7 20 9.5c0 3.3-2.5 5.7-6.9 10l-1.1 1z" /></svg>
                      </button>
                    </div>
                    <div className="trainer-card__body">
                      <div className="trainer-card__head">
                        <h3 className="trainer-card__name">{t.name}</h3>
                        <span className="trainer-card__rating">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" /></svg>
                          {t.rating} <span>({t.reviews})</span>
                        </span>
                      </div>
                      <p className="trainer-card__sport">{t.sub} · опыт {t.experience} {t.experience === 1 ? "год" : t.experience < 5 ? "года" : "лет"}</p>
                      <p className="trainer-card__desc">{t.desc}</p>
                      <div className="trainer-card__tags">
                        {t.tags.map((tag, i) => (
                          <span key={tag} className={`trainer-card__tag${i === 0 ? " trainer-card__tag--accent" : ""}`}>{tag}</span>
                        ))}
                      </div>
                      <div className="trainer-card__footer">
                        <span className="trainer-card__location">
                          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                          <span>{t.city}, {t.district}</span>
                        </span>
                        <span className="trainer-card__price"><small>от </small>{t.price} BYN</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            <div className="cat-map-banner">
              <div>
                <h3>Посмотреть на карте</h3>
                <p>Откройте карту, чтобы выбрать тренера рядом с домом или работой.</p>
              </div>
              <button type="button">Открыть карту</button>
            </div>
          </div>
        </div>

        <div className="cat-extra">
          <section className="cat-block">
            <h2>Лучшие клубы по направлению</h2>
            <div className="cat-clubs-row">
              {["BronxGym", "Champion", "FightLab", "Atlet"].map((name, i) => (
                <Link key={name} className="cat-club" to="/clubs/$slug" params={{ slug: "bronxgym" }}>
                  <div className="cat-club__logo">{name[0]}</div>
                  <h4>{name}</h4>
                  <p>Зал в Минске, тренеры по {category.titleGenitive} и смежным направлениям.</p>
                  <div className="cat-club__meta">
                    <span>★ {(4.6 + i * 0.08).toFixed(1)}</span>
                    <span>{6 + i * 3} тренеров</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="cat-block">
            <h2>О направлении</h2>
            <div className="cat-article">
              <div className="cat-article__body">
                {category.about.map((b) => (
                  <div key={b.h}>
                    <h3>{b.h}</h3>
                    <p>{b.p}</p>
                  </div>
                ))}
              </div>
              <aside className="cat-article__aside">
                <h4>Смежные направления</h4>
                <div className="cat-related">
                  {category.related.map((r) => (
                    <Link key={r.slug} to="/category/$slug" params={{ slug: r.slug }}>{r.label}</Link>
                  ))}
                </div>
              </aside>
            </div>
          </section>

          <section className="cat-block">
            <h2>Частые вопросы</h2>
            <div className="cat-faq">
              {category.faq.map((f) => (
                <details key={f.q}>
                  <summary>{f.q}</summary>
                  <div>{f.a}</div>
                </details>
              ))}
            </div>
          </section>

          <section className="cat-cta">
            <div>
              <h2>Вы тренер по {category.titleGenitive}?</h2>
              <p>Разместите анкету бесплатно — расскажите о себе, добавьте цены, расписание и начните принимать заявки.</p>
            </div>
            <a href="/auth/signup" onClick={(e) => { e.preventDefault(); navigate({ to: "/auth/signup" }); }}>Стать тренером</a>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
