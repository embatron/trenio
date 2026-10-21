import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategoryLink } from "@/lib/catalog/category-routes";
import { canonicalCategoryPath } from "@/lib/catalog/slug-policy";
import {
  getSportTaxonomyChild,
  getSportTaxonomyChildInCategory,
  getSportTaxonomyParent,
  getParentCategoryFeaturedImage,
  getTopLevelSportCategory,
  categorySearchDescription,
  type CategoryRouteRef,
} from "@/lib/catalog/sport-taxonomy";
import { CatalogSearchForm } from "@/components/catalog-search-form";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { trainersForCategory, type PublishedTrainer } from "@/lib/catalog/published-trainers";
import { compareByPopularity, compareByRating, compareByReviews, ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import { listTrainerRatingSummariesFn } from "@/lib/catalog/trainer-reviews";
import { FavoriteButton } from "@/components/favorite-button";
import { TrainerRating } from "@/components/trainer-rating";
import { pluralRu } from "@/lib/ru-plural";
import { toggleFilterValue } from "@/lib/catalog/belarus-settlements";
import { BELARUS_QUICK_CITIES, filterBelarusCities } from "@/lib/catalog/city-taxonomy";
import {
  emptyCatalogPlace,
  resolveVisitorPlaceFn,
  writeVisitorPlace,
  type CatalogPlace,
  type VisitorPlace,
} from "@/lib/catalog/visitor-place";
import { catalogFilterCities, resolveSearchCity, readVisitorPlaceCookie } from "@/lib/catalog/search-city";

export const Route = createFileRoute("/categories/$slug")({
  beforeLoad: ({ params }) => {
    const canonical = canonicalCategoryPath(params.slug);
    if (canonical?.childSlug) {
      throw redirect({
        to: "/categories/$parentSlug/$childSlug",
        params: { parentSlug: canonical.parentSlug, childSlug: canonical.childSlug },
      });
    }
    if (canonical) {
      throw redirect({
        to: "/categories/$slug",
        params: { slug: canonical.parentSlug },
      });
    }

    const child = getSportTaxonomyChild(params.slug);
    if (child && !getTopLevelSportCategory(params.slug)) {
      throw redirect({
        to: "/categories/$parentSlug/$childSlug",
        params: { parentSlug: child.parentSlug, childSlug: child.slug },
      });
    }
  },
  head: ({ params }) => {
    const c = resolveParentCategory(params.slug);
    const keyword = categoryKeyword(c);
    const title = categoryPageTitle(keyword);
    const desc = categorySearchDescription(
      title.replace(" | trenio.by", ""),
      categoryHeroLead(keyword, categoryTopicLabels(c)),
      getTopLevelSportCategory(params.slug)?.aliases,
    );
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
      ],
    };
  },
  loader: async () => {
    const [ratings, place] = await Promise.all([
      listTrainerRatingSummariesFn(),
      resolveVisitorPlaceFn(),
    ]);
    return { ratings, place };
  },
  component: CategoryPage,
});

type Category = {
  slug: string;
  title: string;
  titleGenitive: string;
  lead: string;
  subSports: string[];
  related: (CategoryRouteRef & { label: string })[];
  about: { h: string; p: string }[];
  faq: { q: string; a: string }[];
  stats: { trainers: number; clubs: number; avgPrice: number; avgRating: number };
  isEmpty?: boolean;
};

const RELATED_DEFAULT: Category["related"] = [
  { parentSlug: "edinoborstva", childSlug: "boks", label: "Бокс" },
  { parentSlug: "edinoborstva", childSlug: "kikboksing", label: "Кикбоксинг" },
  { parentSlug: "edinoborstva", childSlug: "mma", label: "MMA" },
  { parentSlug: "fitnes", label: "Фитнес" },
  { parentSlug: "yoga", childSlug: "yoga", label: "Йога" },
  { parentSlug: "plavanie", childSlug: "plavanie", label: "Плавание" },
];

const CATEGORIES: Record<string, Category> = {
  boks: {
    slug: "boks",
    title: "Бокс",
    titleGenitive: "бокса",
    lead: "Найдите тренера по боксу — от первого занятия до подготовки к соревнованиям.",
    subSports: [
      "Классический бокс",
      "Любительский бокс",
      "Бокс для женщин",
      "Бокс для детей",
      "Подготовка к соревнованиям",
      "Силовая база",
    ],
    related: [
      { parentSlug: "edinoborstva", childSlug: "kikboksing", label: "Кикбоксинг" },
      { parentSlug: "edinoborstva", childSlug: "mma", label: "MMA" },
      { parentSlug: "edinoborstva", label: "Единоборства" },
      { parentSlug: "ofp", label: "ОФП" },
      { parentSlug: "fitnes", label: "Фитнес" },
      { parentSlug: "edinoborstva", childSlug: "samooborona", label: "Самооборона" },
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
      {
        q: "Можно ли заниматься без опыта?",
        a: "Да. Большинство тренеров на платформе работают с новичками — первое занятие почти всегда вводное.",
      },
      {
        q: "Нужна ли своя экипировка?",
        a: "На первое занятие — нет. Перчатки и бинты обычно есть в зале или у тренера. Свою экипировку покупают через 2–3 недели.",
      },
      {
        q: "С какого возраста берут детей?",
        a: "Чаще с 7 лет — в детских группах. Некоторые тренеры работают с детьми с 5 лет в игровом формате.",
      },
      {
        q: "Сколько стоит одно занятие?",
        a: "В среднем 35–55 BYN за персональное и 15–25 BYN за групповое. В пакете из 10 занятий цена ниже.",
      },
    ],
    stats: { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 },
  },
  edinoborstva: {
    slug: "edinoborstva",
    title: "Единоборства",
    titleGenitive: "единоборств",
    lead: "Тренеры по боксу, кикбоксингу, MMA, тайскому боксу и борьбе — для взрослых и детей.",
    subSports: [
      "Бокс",
      "Кикбоксинг",
      "MMA",
      "Тайский бокс",
      "Дзюдо",
      "Самбо",
      "Грэпплинг",
      "Каратэ",
    ],
    related: RELATED_DEFAULT,
    about: [
      {
        h: "Что входит в направление",
        p: "Единоборства объединяют ударные и борцовские дисциплины. Под единым фильтром мы собрали тренеров, которые работают с базовой техникой, спаррингами и подготовкой к соревнованиям.",
      },
      {
        h: "С чего начать",
        p: "Если не уверены, какое направление выбрать — берите пробное в боксе или кикбоксинге. Это даст базовое понимание стойки, дистанции и работы ног, на которую опираются все остальные виды.",
      },
    ],
    faq: [
      {
        q: "Чем отличается бокс от кикбоксинга?",
        a: "В боксе работают только руками, в кикбоксинге добавляются удары ногами и колени.",
      },
      {
        q: "Опасно ли это?",
        a: "На уровне тренировок — нет. Контактные спарринги тренер подключает постепенно и только в защитной экипировке.",
      },
    ],
    stats: { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 },
  },
  yoga: {
    slug: "yoga",
    title: "Йога",
    titleGenitive: "йоги",
    lead: "Тренеры по йоге, пилатесу и стретчингу — для разных уровней подготовки.",
    subSports: [
      "Хатха-йога",
      "Виньяса",
      "Аштанга",
      "Йога для начинающих",
      "Йога для беременных",
      "Йога-терапия",
    ],
    related: [
      { parentSlug: "yoga", childSlug: "pilates", label: "Пилатес" },
      { parentSlug: "fitnes", label: "Фитнес" },
      { parentSlug: "reabilitaciya", childSlug: "lfk", label: "ЛФК" },
      { parentSlug: "tancy", label: "Танцы" },
      { parentSlug: "plavanie", childSlug: "plavanie", label: "Плавание" },
    ],
    about: [
      {
        h: "Кому подойдёт йога",
        p: "Подойдёт тем, кто хочет работать с гибкостью, дыханием и снять напряжение. Начинают с мягких практик — хатхи или йоги для начинающих.",
      },
    ],
    faq: [
      {
        q: "Нужна ли растяжка с детства?",
        a: "Нет. Большинство учеников приходят без подготовки — это нормально.",
      },
    ],
    stats: { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 },
  },
  fitnes: {
    slug: "fitnes",
    title: "Фитнес",
    titleGenitive: "фитнеса",
    lead: "Персональные тренеры по фитнесу, силовому и функциональному тренингу.",
    subSports: [
      "Похудение",
      "Набор массы",
      "Силовой тренинг",
      "Функциональный тренинг",
      "Кроссфит",
      "Реабилитация",
    ],
    related: RELATED_DEFAULT,
    about: [
      {
        h: "Что важно в фитнесе",
        p: "Цель важнее программы. Сначала тренер уточняет, чего вы хотите — снизить вес, набрать массу, восстановиться после травмы — и строит план под это.",
      },
    ],
    faq: [
      {
        q: "Сколько раз в неделю заниматься?",
        a: "Обычно 2–3 раза. Этого достаточно для устойчивого прогресса при адекватной нагрузке.",
      },
    ],
    stats: { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 },
  },
  kerling: {
    slug: "kerling",
    title: "Кёрлинг",
    titleGenitive: "кёрлингу",
    lead: "Пока ни одного тренера на платформе. Будьте первым — или подпишитесь и мы напишем, когда появятся.",
    subSports: ["Для начинающих", "Команды", "Дети", "Соревнования"],
    related: [
      { parentSlug: "zima", childSlug: "hokkej", label: "Хоккей" },
      { parentSlug: "zima", childSlug: "figurnoe-katanie", label: "Фигурное катание" },
      { parentSlug: "zima", childSlug: "snoubord", label: "Сноуборд" },
      { parentSlug: "fitnes", label: "Фитнес" },
    ],
    about: [
      {
        h: "Что такое кёрлинг",
        p: "Командный вид спорта на льду: точность, тактика и техника скольжения. Подойдёт и взрослым, и подросткам — без серьёзной физической подготовки.",
      },
    ],
    faq: [
      {
        q: "Когда появятся тренеры?",
        a: "Мы открываем направление и ищем сертифицированных тренеров по кёрлингу. Подпишитесь — пришлём письмо, как только кто-то добавится.",
      },
    ],
    stats: { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 },
    isEmpty: true,
  },
};

function resolveParentCategory(slug: string): Category {
  return CATEGORIES[slug] ?? fallbackCategory(slug);
}

/** Dative phrase after «по»: «командным играм», «футболу». */
export function categoryKeyword(category: Pick<Category, "slug" | "titleGenitive">, parentSlug?: string) {
  if (parentSlug) {
    return getSportTaxonomyChildInCategory(parentSlug, category.slug)?.titleGenitive ?? category.titleGenitive;
  }
  return getTopLevelSportCategory(category.slug)?.titleGenitive ?? category.titleGenitive;
}

export function categoryPageTitle(keyword: string) {
  return `Найти тренера по ${keyword} | trenio.by`;
}

export function categoryTopicLabels(category: Pick<Category, "slug" | "subSports">, parentSlug?: string) {
  if (!parentSlug) {
    const children = getTopLevelSportCategory(category.slug)?.children ?? [];
    if (children.length) return children.map((child) => child.label);
  }
  return category.subSports;
}

function topicInSentence(item: string) {
  const first = item.charAt(0);
  if (/[A-Za-z0-9]/.test(first)) return item;
  return first.toLowerCase() + item.slice(1);
}

export function categoryHeroLead(keyword: string, topics: string[], aliases: string[] = []) {
  const list = topics.slice(0, 4).map(topicInSentence).join(", ");
  const extra = aliases
    .filter((alias) => alias.toLowerCase() !== keyword.toLowerCase())
    .slice(0, 2)
    .join(", ");
  const focus = list
    ? `Тренеры по ${keyword} в Беларуси: ${list}.`
    : `Тренеры по ${keyword} в Беларуси${extra ? `, в том числе ${extra}` : ""}.`;
  return `${focus} Подбор по городу, цене и формату — индивидуально или в группе, для взрослых и детей.`;
}

export function resolveChildCategory(parentSlug: string, childSlug: string): Category | null {
  const childInCategory = getSportTaxonomyChildInCategory(parentSlug, childSlug);
  if (!childInCategory) return null;

  const mock = CATEGORIES[childSlug];
  if (mock) {
    return {
      ...mock,
      related: withParentSlug(mock.related, parentSlug),
    };
  }

  return fallbackChildCategory(parentSlug, childSlug);
}

function withParentSlug(
  related: Category["related"],
  parentSlug: string,
): Category["related"] {
  return related.map((item) => ({
    ...item,
    parentSlug: item.childSlug ? item.parentSlug : item.parentSlug || parentSlug,
  }));
}

function fallbackChildCategory(parentSlug: string, childSlug: string): Category {
  const parentCategory = getTopLevelSportCategory(parentSlug);
  const child = getSportTaxonomyChildInCategory(parentSlug, childSlug);
  if (!parentCategory || !child) {
    return fallbackCategory(childSlug);
  }

  return {
    slug: childSlug,
    title: child.label,
    titleGenitive: child.titleGenitive ?? child.label.toLowerCase(),
    lead: `${child.label} в разделе «${parentCategory.label}»: подбор тренера по городу, цене и формату занятий.`,
    subSports: [
      "С нуля",
      "Для детей",
      "Для взрослых",
      "Индивидуально",
      "В группе",
      "Подготовка к соревнованиям",
    ],
    related: [
      { parentSlug, label: parentCategory.label },
      ...parentCategory.children
        .filter((sport) => sport.slug !== childSlug)
        .slice(0, 7)
        .map((sport) => ({
          parentSlug,
          childSlug: sport.slug,
          label: sport.label,
        })),
    ],
    about: [
      {
        h: "О направлении",
        p: `В разделе «${parentCategory.label}» собраны тренеры по направлению «${child.label}». Используйте фильтры, чтобы найти подходящего по городу, цене, формату и опыту.`,
      },
    ],
    faq: [
      {
        q: "Как связаться с тренером?",
        a: "На странице тренера есть кнопка «Написать» — сообщение придёт ему в Telegram. Можно также показать телефон.",
      },
    ],
    stats: { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 },
  };
}
function getStatsFromCount(_count: string): Category["stats"] {
  return { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 };
}

function fallbackCategory(slug: string): Category {
  const topLevelCategory = getTopLevelSportCategory(slug);
  const child = getSportTaxonomyChild(slug);
  const parentCategory = child ? getSportTaxonomyParent(slug) : undefined;
  const title =
    topLevelCategory?.label ??
    child?.label ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const lead = topLevelCategory
    ? `${topLevelCategory.description} Подбор по городу, цене и формату занятий.`
    : child && parentCategory
      ? `${child.label} в разделе «${parentCategory.label}»: подбор тренера по городу, цене и формату занятий.`
      : `Тренеры по направлению «${title}» — подбор по городу, цене и формату.`;
  const subSports = topLevelCategory?.children.length
    ? topLevelCategory.children.map((sport) => sport.label)
    : child
      ? [
          "С нуля",
          "Для детей",
          "Для взрослых",
          "Индивидуально",
          "В группе",
          "Подготовка к соревнованиям",
        ]
      : ["Для начинающих", "Для опытных", "Дети", "Взрослые"];
  const related = topLevelCategory?.children.length
    ? topLevelCategory.children.map((sport) => ({
        parentSlug: topLevelCategory.slug,
        childSlug: sport.slug,
        label: sport.label,
      }))
    : parentCategory
      ? [
          { parentSlug: parentCategory.slug, label: parentCategory.label },
          ...parentCategory.children
            .filter((sport) => sport.slug !== slug)
            .slice(0, 7)
            .map((sport) => ({
              parentSlug: parentCategory.slug,
              childSlug: sport.slug,
              label: sport.label,
            })),
        ]
      : RELATED_DEFAULT;
  const stats = topLevelCategory
    ? getStatsFromCount(topLevelCategory.count)
    : parentCategory
      ? { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 }
      : { trainers: 0, clubs: 0, avgPrice: 0, avgRating: 0 };
  const taxonomyItems = topLevelCategory?.sports.length
    ? topLevelCategory.sports
    : parentCategory?.sports;
  return {
    slug,
    title,
    titleGenitive: topLevelCategory?.titleGenitive ?? child?.titleGenitive ?? title.toLowerCase(),
    lead,
    subSports,
    related,
    about: [
      {
        h: topLevelCategory ? "Что входит в категорию" : "О направлении",
        p: taxonomyItems?.length
          ? `В этом разделе собраны направления: ${taxonomyItems.slice(0, 7).join(", ")}${taxonomyItems.length > 7 ? " и другие." : "."}`
          : "Здесь собраны тренеры, которые работают по этому направлению. Используйте фильтры, чтобы найти подходящего по городу, цене, формату и опыту.",
      },
    ],
    faq: [
      {
        q: "Как связаться с тренером?",
        a: "На странице тренера есть кнопка «Написать» — сообщение придёт ему в Telegram. Можно также показать телефон.",
      },
    ],
    stats,
  };
}

type TrainerCard = {
  slug: string;
  name: string;
  photo: string;
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
  audiences: Array<"adult" | "kid" | "teen">;
  formats: Array<"individual" | "group">;
};

function toCategoryCard(trainer: PublishedTrainer, ratings: Record<string, TrainerRatingSnapshot>): TrainerCard {
  const rating = ratingFor(trainer.slug, ratings);
  return {
    slug: trainer.slug,
    name: trainer.name,
    photo: trainer.photo,
    sub: trainer.primarySport.label,
    desc: trainer.bio,
    tags: trainer.sports.map((sport) => sport.label),
    rating: rating.rating,
    reviews: rating.reviews,
    price: 0,
    city: trainer.city.label,
    district: trainer.district,
    experience: trainer.experience,
    audiences: trainer.audiences,
    formats: trainer.formats,
  };
}

function generateTrainers(category: Category, ratings: Record<string, TrainerRatingSnapshot>): TrainerCard[] {
  return trainersForCategory(category.slug).map((trainer) => toCategoryCard(trainer, ratings));
}

const PAGE_CSS = `

.cat-page { background: var(--white); }
.cat-hero { padding-top: 16px; background: var(--white); }
.cat-hero .layout-container { display: grid; gap: var(--layout-gap); align-items: center; }
.cat-hero .layout-container:has(.cat-hero__photo) { grid-template-columns: minmax(0, 1fr) 320px; }
.cat-hero__copy { display: grid; gap: var(--layout-gap); min-width: 0; }
.cat-hero__head { display: grid; gap: 10px; }
.cat-hero__crumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0; font-size: 13px; line-height: 1.3; font-weight: var(--fw-title); color: var(--muted); }
.cat-hero__crumbs a { color: var(--muted); text-decoration: none; }
.cat-hero__crumbs a:hover { color: var(--primary); }
.cat-hero__crumbs .is-current { color: var(--dark); }
.cat-hero__photo { width: 100%; aspect-ratio: 1; object-fit: contain; border-radius: var(--card-radius); display: block; }
.cat-hero__title { margin: 0; font-size: var(--fs-page); line-height: 1.15; letter-spacing: var(--tracking-heading); font-weight: var(--fw-heading); color: var(--dark); }
.cat-hero__title em { font-style: normal; color: var(--primary); }
.cat-hero__lead { margin: 0; font-size: var(--fs-meta); line-height: 1.45; color: var(--muted); max-width: 68ch; font-weight: var(--fw-body); }
.cat-hero__stats { display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; }
.cat-hero__stat { display: inline-flex; align-items: center; gap: 6px; font-size: 14px; line-height: 1.2; font-weight: var(--fw-ui); color: var(--muted); }
.cat-hero__stat b { color: var(--dark); font-weight: var(--fw-title); }
.cat-hero__stat svg { width: 16px; height: 16px; flex: 0 0 auto; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; color: var(--dark); }
.cat-hero__stat svg.is-star { fill: #ffb400; stroke: none; }
.cat-child-nav { padding-top: 16px; }
.cat-child-nav__inner {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.cat-child-nav__tile {
  min-width: 0;
  width: auto;
  min-height: 44px;
  padding: 6px 12px;
  border-radius: var(--radius-control);
  background: var(--white);
  border: 1.5px solid var(--line);
  color: var(--dark);
  font-size: var(--fs-ui);
  font-weight: var(--fw-ui);
  letter-spacing: -0.01em;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  line-height: 1.25;
  transition: border-color 0.18s ease, color 0.18s ease, background 0.18s ease;
}
.cat-child-nav__tile:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.cat-child-nav__tile:focus-visible {
  outline: 3px solid rgba(var(--primary-rgb), 0.35);
  outline-offset: 2px;
}
.cat-child-nav__tile.is-active {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}
.cat-child-nav__tile.is-active:hover {
  background: var(--primary);
  border-color: var(--primary);
  color: #fff;
}

.cat-body { align-items: start; }
.cat-filters { position: sticky; top: calc(var(--header-clearance, 80px) + 16px); align-self: start; background: var(--white); border: 1px solid var(--line); border-radius: var(--card-radius); padding: 22px; }
.cat-filter { border-top: 1px solid var(--line); padding: 16px 0; }
.cat-filter:first-of-type { border-top: 0; padding-top: 0; }
.cat-filter__title { font-size: 12px; font-weight: var(--fw-title); letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted); margin-bottom: 10px; }
.cat-place-note { margin: 8px 0 0; font-size: 12px; line-height: 1.4; color: var(--muted); }
.cat-city-field { position: relative; }
.cat-city-input {
  width: 100%;
  min-height: 44px;
  padding: 10px 36px 10px 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-control);
  font: inherit;
  font-size: 14px;
  font-weight: var(--fw-ui);
  color: var(--dark);
  background: var(--white);
}
.cat-city-input:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.12);
}
.cat-city-input::placeholder { color: var(--muted); font-weight: 500; }
.cat-city-clear {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border: 0;
  border-radius: 999px;
  background: var(--light-bg);
  color: var(--muted);
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
}
.cat-city-clear:hover { color: var(--primary); }
.cat-city-suggest {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: grid;
  gap: 4px;
  max-height: 180px;
  overflow-y: auto;
}
.cat-city-suggest button {
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius-control);
  background: var(--light-bg);
  color: var(--dark);
  font: inherit;
  font-size: 13px;
  font-weight: var(--fw-title);
  cursor: pointer;
}
.cat-city-suggest button:hover { background: rgba(var(--primary-rgb), 0.08); color: var(--primary-dark); }
.cat-city-quick { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
.cat-filter__opts { display: flex; flex-wrap: wrap; gap: 6px; }
.cat-pill { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); border: 1px solid transparent; color: var(--dark); font-size: var(--fs-caption); font-weight: var(--fw-ui); cursor: pointer; transition: all 0.16s ease; }
.cat-pill:hover { background: rgba(var(--primary-rgb), 0.08); }
.cat-pill.is-active { background: var(--primary); color: #fff; }
.cat-filter__check { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 14px; cursor: pointer; color: var(--dark); }
.cat-filter__check input { accent-color: var(--primary); }
.cat-price__values { display: flex; justify-content: space-between; align-items: baseline; font-size: 13px; color: var(--dark); margin-bottom: 10px; gap: 8px; }
.cat-price__values b { font-size: 14px; font-weight: var(--fw-title); color: var(--ink); }
.cat-price__values span { color: var(--muted); font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; display: block; }
.cat-price__slider { position: relative; height: 28px; margin: 0 10px; }
.cat-price__track { position: absolute; left: 0; right: 0; top: 50%; height: 4px; transform: translateY(-50%); background: var(--line); border-radius: 999px; }
.cat-price__fill { position: absolute; top: 50%; height: 4px; transform: translateY(-50%); background: linear-gradient(90deg, var(--primary), #ff7a59); border-radius: 999px; }
.cat-price__slider input[type="range"] { position: absolute; left: -10px; right: -10px; top: 0; width: calc(100% + 20px); height: 28px; -webkit-appearance: none; appearance: none; background: transparent; pointer-events: none; margin: 0; }
.cat-price__slider input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--white); border: 2px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.18); cursor: pointer; pointer-events: auto; }
.cat-price__slider input[type="range"]::-moz-range-thumb { width: 20px; height: 20px; border-radius: 50%; background: var(--white); border: 2px solid var(--primary); box-shadow: 0 2px 8px rgba(0,0,0,.18); cursor: pointer; pointer-events: auto; border-width: 2px; }
.cat-price__slider input[type="range"]::-moz-range-track { background: transparent; }
.cat-price__bounds { display: flex; justify-content: space-between; font-size: 11px; color: var(--muted); margin-top: 6px; }
.cat-filter__reset { width: 100%; padding: 10px; border: 1px solid var(--line); border-radius: var(--radius-control); background: var(--white); color: var(--dark); font-weight: var(--fw-heading); font-size: 13px; cursor: pointer; margin-top: 8px; }
.cat-filter__reset:hover { border-color: var(--primary); color: var(--primary); }

.cat-results__head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--layout-gap); margin-bottom: var(--layout-gap); }
.cat-results__count { font-size: 15px; color: var(--muted); font-weight: var(--fw-ui); }
.cat-results__count b { color: var(--dark); font-weight: var(--fw-title); }
.cat-results__sort { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted); }
.cat-results__sort select { padding: 9px 14px; border: 1px solid var(--line); border-radius: var(--radius-control); font: inherit; font-size: 13px; background: var(--white); cursor: pointer; font-weight: var(--fw-heading); color: var(--dark); }
.cat-grid { align-items: stretch; }
.cat-empty {
  padding: 56px 36px; text-align: center; border-radius: var(--card-radius);
  background: linear-gradient(180deg, rgba(var(--primary-rgb), 0.06) 0%, rgba(var(--primary-rgb), 0) 100%);
  border: 1px solid rgba(var(--primary-rgb), 0.16); color: var(--text);
  display: grid; gap: 18px; justify-items: center;
}
.cat-empty__icon { width: 96px; height: 96px; border-radius: 50%; background: #fff; box-shadow: 0 12px 30px -12px rgba(var(--dark-rgb), 0.18); display: grid; place-items: center; color: var(--primary); }
.cat-empty__icon svg { width: 44px; height: 44px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.cat-empty h3 { margin: 0; font-size: 24px; font-weight: var(--fw-heading); letter-spacing: -0.025em; color: var(--dark); }
.cat-empty p { margin: 0; max-width: 540px; color: var(--muted); font-size: 15px; line-height: 1.55; }
.cat-empty__actions { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; margin-top: 4px; }
.cat-empty__btn { padding: 12px 22px; border-radius: var(--radius-control); font-size: 14px; font-weight: var(--fw-title); text-decoration: none; cursor: pointer; border: 0; }
.cat-empty__btn--primary { background: var(--primary); color: #fff; }
.cat-empty__btn--ghost { background: #fff; color: var(--dark); border: 1.5px solid var(--line); }
.cat-empty__suggest { margin-top: 22px; padding-top: 22px; border-top: 1px dashed rgba(var(--dark-rgb), 0.12); width: 100%; max-width: 640px; }
.cat-empty__suggest h4 { margin: 0 0 12px; font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); }
.cat-empty__chips { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.cat-empty__chip { padding: 8px 14px; border-radius: 999px; background: #fff; border: 1px solid var(--line); font-size: 13px; font-weight: var(--fw-heading); color: var(--dark); text-decoration: none; transition: border-color 0.15s ease, color 0.15s ease; }
.cat-empty__chip:hover { border-color: var(--primary); color: var(--primary); }

.cat-map-banner { margin-top: var(--layout-gap); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: var(--layout-gap); align-items: center; padding: 22px 26px; border: 1px solid var(--line); border-radius: var(--card-radius); background: linear-gradient(135deg, #1a1a1f 0%, #2a1a1a 100%); color: #fff; }
.cat-map-banner h3 { margin: 0 0 4px; font-size: 19px; font-weight: var(--fw-title); letter-spacing: -0.02em; }
.cat-map-banner p { margin: 0; color: rgba(255,255,255,0.7); font-size: 14px; }
.cat-map-banner button { min-height: 44px; padding: 12px 22px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }

.cat-extra { display: grid; gap: var(--layout-section-y); padding-bottom: clamp(40px, 6vw, 60px); }
.cat-block { display: grid; gap: var(--layout-gap); }
.cat-block h2 { margin: 0; font-size: var(--fs-section); letter-spacing: -0.03em; font-weight: var(--fw-heading); color: var(--dark); }
.cat-clubs-row { align-items: stretch; }
.cat-club { display: flex; flex-direction: column; padding: 18px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); text-decoration: none; color: inherit; transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease; }
.cat-club:hover { transform: translateY(-3px); border-color: rgba(var(--primary-rgb), 0.3); box-shadow: 0 12px 30px -16px rgba(var(--dark-rgb), 0.18); }
.cat-club__logo { width: 56px; height: 56px; border-radius: var(--radius-tile); background: var(--light-bg); display: grid; place-items: center; font-size: 22px; font-weight: var(--fw-heading); color: var(--primary); margin-bottom: 12px; }
.cat-club h4 { margin: 0 0 4px; font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; color: var(--dark); transition: color 0.16s ease; }
.cat-club:hover h4,
.cat-club:focus-visible h4 { color: var(--primary); }
.cat-club p { margin: 0; color: var(--muted); font-size: 13px; }
.cat-club__meta { margin-top: auto; padding-top: 12px; display: flex; gap: 12px; font-size: 12px; color: var(--muted); font-weight: var(--fw-heading); }

.cat-article { display: grid; grid-template-columns: minmax(0, 2fr) minmax(240px, 1fr); gap: var(--layout-gap); align-items: start; }
.cat-article__body { display: grid; gap: var(--layout-gap); }
.cat-article__body h3 { margin: 0 0 6px; font-size: 20px; letter-spacing: -0.02em; font-weight: var(--fw-title); }
.cat-article__body p { margin: 0; color: #4a4a4f; font-size: 15px; line-height: 1.65; }
.cat-article__aside { background: var(--light-bg); border-radius: var(--card-radius); padding: 26px; }
.cat-article__aside h4 { margin: 0 0 14px; font-size: 16px; font-weight: var(--fw-title); letter-spacing: -0.02em; }
.cat-related { display: flex; flex-wrap: wrap; gap: 8px; }
.cat-related a { padding: 9px 14px; border-radius: 999px; background: var(--white); border: 1px solid var(--line); font-size: 13px; font-weight: var(--fw-heading); color: var(--dark); text-decoration: none; transition: all 0.16s ease; }
.cat-related a:hover { border-color: var(--primary); color: var(--primary); }

.cat-faq { display: grid; gap: var(--layout-gap); }
.cat-faq details { background: var(--white); border: 1px solid var(--line); border-radius: var(--card-radius); overflow: hidden; }
.cat-faq summary { padding: 18px 22px; font-weight: var(--fw-title); cursor: pointer; font-size: 15px; letter-spacing: -0.01em; list-style: none; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.cat-faq summary::after { content: "+"; font-size: 22px; color: var(--primary); font-weight: var(--fw-heading); }
.cat-faq details[open] summary::after { content: "−"; }
.cat-faq details > div { padding: 0 22px 20px; color: var(--muted); font-size: 14px; line-height: 1.6; }

.cat-cta { background: linear-gradient(135deg, var(--primary) 0%, #e63946 60%, #ad2030 100%); border-radius: var(--card-radius); padding: 44px 48px; color: #fff; display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: center; }
.cat-cta h2 { margin: 0 0 6px; font-size: var(--fs-section); font-weight: var(--fw-heading); letter-spacing: -0.025em; }
.cat-cta p { margin: 0; color: rgba(255,255,255,0.85); font-size: 15px; max-width: 56ch; }
.cat-cta a { display: inline-flex; align-items: center; min-height: 44px; padding: 12px 22px; border-radius: 999px; background: #fff; color: var(--primary-dark); font-weight: var(--fw-title); text-decoration: none; white-space: nowrap; }

@media (max-width: 960px) {
  .cat-hero .layout-container:has(.cat-hero__photo) { grid-template-columns: minmax(0, 1fr) 220px; }
  .cat-article { grid-template-columns: 1fr; }
  .cat-filters { position: static; }
  .cat-cta { grid-template-columns: 1fr; padding: var(--layout-block-gap) var(--layout-gap); }
}
@media (max-width: 640px) {
  .cat-hero .layout-container:has(.cat-hero__photo) { grid-template-columns: 1fr; }
  .cat-hero__photo { display: none; }
  .cat-map-banner { grid-template-columns: 1fr; }
}
`;

function CategoryPage() {
  const { slug } = Route.useParams();
  const { ratings, place } = Route.useLoaderData();
  const category = resolveParentCategory(slug);
  return <CategoryCatalogPage category={category} ratings={ratings} place={place} />;
}

type CategoryCatalogPageProps = {
  category: Category;
  parentCategory?: { slug: string; label: string };
  ratings?: Record<string, TrainerRatingSnapshot>;
  place?: CatalogPlace;
};

export function CategoryCatalogPage({
  category,
  parentCategory,
  ratings = {},
  place = emptyCatalogPlace,
}: CategoryCatalogPageProps) {
  const navigate = useNavigate();
  const allTrainers = useMemo(() => generateTrainers(category, ratings), [category, ratings]);
  const parentSlug = parentCategory?.slug ?? category.slug;
  const keyword = categoryKeyword(category, parentCategory?.slug);
  const heroAliases = parentCategory
    ? (getSportTaxonomyChildInCategory(parentCategory.slug, category.slug)?.aliases ?? [])
    : [];
  const heroLead = categoryHeroLead(
    keyword,
    parentCategory ? [] : categoryTopicLabels(category),
    heroAliases,
  );
  const topLevelCategory = getTopLevelSportCategory(parentSlug);
  const heroImage = getParentCategoryFeaturedImage(parentSlug);
  const navChildren = topLevelCategory?.children ?? [];
  const activeChildSlug = parentCategory ? category.slug : null;

  const [selectedCities, setSelectedCities] = useState<string[]>(() => catalogFilterCities(place));
  const [cityQuery, setCityQuery] = useState(place.query);
  const [cityFocused, setCityFocused] = useState(false);
  const [placeNote, setPlaceNote] = useState<"detected" | "saved" | null>(
    place.source === "none" ? null : place.source,
  );
  const citySuggestions = useMemo(() => filterBelarusCities(cityQuery), [cityQuery]);

  useEffect(() => {
    const siteHeader = document.querySelector<HTMLElement>("#site-header");
    const syncHeaderClearance = () => {
      if (siteHeader) {
        document.documentElement.style.setProperty(
          "--header-clearance",
          `${siteHeader.offsetHeight}px`,
        );
      }
    };
    syncHeaderClearance();
    window.addEventListener("resize", syncHeaderClearance);
    return () => {
      window.removeEventListener("resize", syncHeaderClearance);
    };
  }, []);

  const [audience, setAudience] = useState<"self" | "child" | null>(null);
  const [formats, setFormats] = useState<Array<"individual" | "group">>([]);
  const priceBounds = useMemo(() => {
    if (!allTrainers.length) return { min: 0, max: 100 };
    const prices = allTrainers.map((t) => t.price);
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [allTrainers]);
  const [priceMin, setPriceMin] = useState<number>(priceBounds.min);
  const [priceMax, setPriceMax] = useState<number>(priceBounds.max);
  useEffect(() => {
    setPriceMin(priceBounds.min);
    setPriceMax(priceBounds.max);
  }, [priceBounds.min, priceBounds.max]);
  const [minExperience, setMinExperience] = useState<number | null>(null);
  const [sort, setSort] = useState("popular");

  const locationSummary = useMemo(() => {
    const parts = [...selectedCities];
    const q = cityQuery.trim();
    if (q && !parts.includes(q)) parts.push(q);
    return parts.join(", ");
  }, [selectedCities, cityQuery]);

  const filtered = useMemo(() => {
    let list = allTrainers.filter((t) => {
      const q = cityQuery.trim().toLowerCase();
      const hasLocationFilter = selectedCities.length > 0 || q;
      if (hasLocationFilter) {
        const cityLower = t.city.toLowerCase();
        const matchesQuick = selectedCities.some((city) => cityLower.includes(city.toLowerCase()));
        const matchesQuery = q && cityLower.includes(q);
        if (!matchesQuick && !matchesQuery) return false;
      }
      if (audience === "self" && t.audiences.length > 0 && !t.audiences.includes("adult")) return false;
      if (
        audience === "child" &&
        t.audiences.length > 0 &&
        !t.audiences.some((item) => item === "kid" || item === "teen")
      ) {
        return false;
      }
      if (formats.length > 0 && t.formats.length > 0 && !t.formats.some((item) => formats.includes(item))) return false;
      if (priceMin && t.price < Number(priceMin)) return false;
      if (priceMax && t.price > Number(priceMax)) return false;
      if (minExperience != null && t.experience < minExperience) return false;
      return true;
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "rating") list = [...list].sort(compareByRating);
    else if (sort === "reviews") list = [...list].sort(compareByReviews);
    else list = [...list].sort(compareByPopularity);
    return list;
  }, [allTrainers, selectedCities, cityQuery, audience, formats, priceMin, priceMax, minExperience, sort]);

  const cityPills = useMemo(() => {
    const quick = new Set<string>(BELARUS_QUICK_CITIES);
    return [...selectedCities.filter((city) => !quick.has(city)), ...BELARUS_QUICK_CITIES];
  }, [selectedCities]);
  const committedPlace = useRef({ cities: place.cities, query: place.query });
  const skipCityBlur = useRef(false);
  const userTouchedPlace = useRef(false);

  const applyPlace = (cities: string[], query: string, origin: VisitorPlace["origin"] = "chosen") => {
    userTouchedPlace.current = true;
    const trimmed = query.trim();
    setSelectedCities(cities);
    setCityQuery(trimmed);
    committedPlace.current = { cities, query: trimmed };
    const empty = cities.length === 0 && trimmed.length === 0;
    writeVisitorPlace({ cities, query: trimmed, dismissed: empty, origin });
    setPlaceNote(empty ? null : origin === "detected" ? "detected" : "saved");
  };

  useEffect(() => {
    if (place.cities.length > 0 || place.query.trim()) return;
    let cancel = false;
    void resolveSearchCity().then((city) => {
      if (cancel || userTouchedPlace.current) return;
      setSelectedCities((current) => (current.length === 1 && current[0] === city ? current : [city]));
      const saved = readVisitorPlaceCookie();
      const remembered = saved && !saved.dismissed && (saved.cities[0] === city || saved.query === city);
      if (remembered) setPlaceNote(saved.origin === "detected" ? "detected" : "saved");
    });
    return () => {
      cancel = true;
    };
  }, [place.cities, place.query]);

  const reset = () => {
    userTouchedPlace.current = true;
    setSelectedCities([]);
    setCityQuery("");
    setAudience(null);
    setFormats([]);
    setPriceMin(priceBounds.min);
    setPriceMax(priceBounds.max);
    setMinExperience(null);
    writeVisitorPlace({ cities: [], query: "", dismissed: true, origin: "chosen" });
    setPlaceNote(null);
  };

  return (
    <div className="page-shell cat-page">
      <style dangerouslySetInnerHTML={{ __html: PAGE_CSS }} />
      <SiteHeader
        middleSlot={
          <CatalogSearchForm
            key={`${category.slug}:${selectedCities.join("|")}`}
            variant="header"
            sport={parentCategory ? category.title : (topLevelCategory?.label ?? category.title)}
            location={selectedCities[0]}
          />
        }
      />

      <main>
        <section className="cat-hero">
          <div className="layout-container">
            <div className="cat-hero__copy">
              <div className="cat-hero__head">
                <nav className="cat-hero__crumbs" aria-label="breadcrumbs">
                  <Link to="/" activeOptions={{ exact: true }}>Главная</Link>
                  <span aria-hidden="true">/</span>
                  <Link to="/categories/" activeOptions={{ exact: true }}>Категории</Link>
                  <span aria-hidden="true">/</span>
                  {parentCategory ? (
                    <>
                      <CategoryLink
                        route={{ parentSlug: parentCategory.slug }}
                        activeOptions={{ exact: true }}
                      >
                        {parentCategory.label}
                      </CategoryLink>
                      <span aria-hidden="true">/</span>
                    </>
                  ) : null}
                  <span className="is-current" aria-current="page">
                    {category.title}
                  </span>
                </nav>
                <h1 className="cat-hero__title">
                  Найти тренера по <em>{keyword}</em>
                </h1>
              </div>
              <p className="cat-hero__lead">{heroLead}</p>
              {category.stats.trainers || category.stats.clubs || category.stats.avgPrice || category.stats.avgRating ? (
              <div className="cat-hero__stats">
                <span className="cat-hero__stat">
                  Тренеры:
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="8" r="3.2" />
                    <path d="M5.5 19.5v-.8a4.2 4.2 0 0 1 4.2-4.2h4.6a4.2 4.2 0 0 1 4.2 4.2v.8" />
                  </svg>
                  <b>{category.stats.trainers}</b>
                </span>
                <span className="cat-hero__stat">
                  Клубы:
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 21V6.5L12 3l8 3.5V21" />
                    <path d="M4 21h16" />
                    <path d="M9 21v-5h6v5" />
                    <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
                  </svg>
                  <b>{category.stats.clubs}</b>
                </span>
                <span className="cat-hero__stat">
                  Цена:
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 12V5h7l9 9-7 7-9-9z" />
                    <circle cx="8.5" cy="8.5" r="1.1" />
                  </svg>
                  <b>{category.stats.avgPrice} BYN</b>
                </span>
                <span className="cat-hero__stat">
                  Рейтинг:
                  <svg className="is-star" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" />
                  </svg>
                  <b>{category.stats.avgRating}</b>
                </span>
              </div>
              ) : null}
            </div>
            {heroImage ? (
              <img
                className="cat-hero__photo"
                src={heroImage}
                alt={topLevelCategory?.label ?? category.title}
                width={1024}
                height={1024}
              />
            ) : null}
          </div>
        </section>

        {navChildren.length > 0 ? (
          <nav className="cat-child-nav" aria-label="Направления категории">
            <div className="layout-container cat-child-nav__inner">
              <CategoryLink
                route={{ parentSlug }}
                className={`cat-child-nav__tile${activeChildSlug === null ? " is-active" : ""}`}
                aria-current={activeChildSlug === null ? "page" : undefined}
              >
                Все направления
              </CategoryLink>
              {navChildren.map((child) => (
                <CategoryLink
                  key={child.slug}
                  route={{ parentSlug, childSlug: child.slug }}
                  className={`cat-child-nav__tile${activeChildSlug === child.slug ? " is-active" : ""}`}
                  aria-current={activeChildSlug === child.slug ? "page" : undefined}
                >
                  {child.label}
                </CategoryLink>
              ))}
            </div>
          </nav>
        ) : null}

        <div className="layout-with-sidebar cat-body">
          <aside className="cat-filters">
            <div className="cat-filter">
              <div className="cat-filter__title">Ищу тренера</div>
              <div className="cat-filter__opts">
                {(
                  [
                    { v: "self" as const, l: "для себя" },
                    { v: "child" as const, l: "для ребёнка" },
                  ]
                ).map((option) => (
                  <button
                    key={option.v}
                    type="button"
                    className={`cat-pill${audience === option.v ? " is-active" : ""}`}
                    aria-pressed={audience === option.v}
                    onClick={() => setAudience((prev) => (prev === option.v ? null : option.v))}
                  >
                    {option.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="cat-filter">
              <div className="cat-filter__title">Город или населённый пункт</div>
              <div className="cat-city-field">
                <input
                  type="text"
                  className="cat-city-input"
                  placeholder="Начните вводить название"
                  value={cityQuery}
                  onChange={(e) => setCityQuery(e.target.value)}
                  onFocus={() => setCityFocused(true)}
                  onBlur={() => {
                    setCityFocused(false);
                    if (skipCityBlur.current) {
                      skipCityBlur.current = false;
                      return;
                    }
                    const trimmed = cityQuery.trim();
                    const committed = committedPlace.current;
                    const sameCities =
                      selectedCities.length === committed.cities.length &&
                      selectedCities.every((city, index) => city === committed.cities[index]);
                    if (sameCities && trimmed === committed.query) {
                      if (trimmed !== cityQuery) setCityQuery(trimmed);
                      return;
                    }
                    applyPlace(selectedCities, trimmed);
                  }}
                  autoComplete="off"
                  aria-label="Город или населённый пункт"
                />
                {cityQuery ? (
                  <button
                    type="button"
                    className="cat-city-clear"
                    aria-label="Очистить"
                    onClick={() => applyPlace(selectedCities, "")}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              {cityFocused && citySuggestions.length > 0 ? (
                <ul className="cat-city-suggest" aria-label="Подсказки">
                  {citySuggestions.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          skipCityBlur.current = true;
                        }}
                        onClick={() =>
                          applyPlace(
                            selectedCities.includes(name) ? selectedCities : [...selectedCities, name],
                            "",
                          )
                        }
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="cat-city-quick" role="group" aria-label="Крупные города">
                {cityPills.map((city) => (
                  <button
                    key={city}
                    type="button"
                    className={`cat-pill${selectedCities.includes(city) ? " is-active" : ""}`}
                    aria-pressed={selectedCities.includes(city)}
                    onClick={() => applyPlace(toggleFilterValue(selectedCities, city), cityQuery)}
                  >
                    {city}
                  </button>
                ))}
              </div>
              {placeNote && (selectedCities.length > 0 || cityQuery.trim()) ? (
                <p className="cat-place-note">
                  {placeNote === "detected" ? "Определили по IP и запомнили" : "Запомнили город"}
                </p>
              ) : null}
            </div>
            <div className="cat-filter">
              <div className="cat-filter__title">Формат</div>
              <div className="cat-filter__opts">
                {[
                  { v: "individual" as const, l: "Индивидуально" },
                  { v: "group" as const, l: "Группа" },
                ].map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    className={`cat-pill${formats.includes(o.v) ? " is-active" : ""}`}
                    aria-pressed={formats.includes(o.v)}
                    onClick={() => setFormats((prev) => toggleFilterValue(prev, o.v))}
                  >
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="cat-filter">
              <div className="cat-filter__title">Цена, BYN</div>
              <div className="cat-price__values">
                <div>
                  <span>от</span>
                  <b>{priceMin}</b>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span>до</span>
                  <b>{priceMax}</b>
                </div>
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
              <div className="cat-filter__title">Опыт</div>
              <div className="cat-filter__opts">
                {[
                  { years: 1, label: "от 1 года" },
                  { years: 3, label: "от 3 лет" },
                  { years: 5, label: "от 5 лет" },
                  { years: 10, label: "от 10 лет" },
                ].map((option) => (
                  <button
                    key={option.years}
                    type="button"
                    className={`cat-pill${minExperience === option.years ? " is-active" : ""}`}
                    aria-pressed={minExperience === option.years}
                    onClick={() => setMinExperience((prev) => (prev === option.years ? null : option.years))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <button className="cat-filter__reset" onClick={reset}>
              Сбросить
            </button>
          </aside>

          <div>
            <div className="cat-results__head">
              <div className="cat-results__count">
                <b>{filtered.length}</b> {pluralRu(filtered.length, "тренер", "тренера", "тренеров")}{locationSummary ? ` · ${locationSummary}` : ""}
              </div>
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
                  <svg viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="7" />
                    <path d="M16 16l5 5" />
                    <path d="M8 11h6" />
                  </svg>
                </div>
                <h3>
                  {allTrainers.length === 0 || category.isEmpty
                    ? `Тренеров по ${category.titleGenitive} пока нет`
                    : "По вашим фильтрам ничего не нашлось"}
                </h3>
                <p>
                  {allTrainers.length === 0 || category.isEmpty
                    ? "Направление только открылось на trenio.by. Будьте первым тренером или подпишитесь — мы напишем, когда кто-то добавится."
                    : "Попробуйте сбросить часть фильтров, расширить ценовой диапазон или посмотреть похожие направления."}
                </p>
                <div className="cat-empty__actions">
                  {allTrainers.length === 0 || category.isEmpty ? (
                    <>
                      <Link to="/auth/signup" className="cat-empty__btn cat-empty__btn--primary">
                        Стать первым тренером
                      </Link>
                      <button
                        type="button"
                        className="cat-empty__btn cat-empty__btn--ghost"
                        onClick={() => alert("Подписка оформлена — мы напишем на e-mail.")}
                      >
                        Сообщить, когда появятся
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="cat-empty__btn cat-empty__btn--primary"
                        onClick={reset}
                      >
                        Сбросить фильтры
                      </button>
                      <Link to="/" className="cat-empty__btn cat-empty__btn--ghost">
                        На главную
                      </Link>
                    </>
                  )}
                </div>
                <div className="cat-empty__suggest">
                  <h4>Похожие направления</h4>
                  <div className="cat-empty__chips">
                    {category.related.map((r) => (
                      <CategoryLink
                        key={`${r.parentSlug}-${r.childSlug ?? "root"}`}
                        route={r}
                        className="cat-empty__chip"
                      >
                        {r.label}
                      </CategoryLink>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="cat-grid">
                {filtered.map((t) => (
                  <Link
                    key={t.slug}
                    className="trainer-card"
                    to="/trainers/$slug"
                    params={{ slug: t.slug }}
                  >
                    <div className="trainer-card__media">
                      <img
                        className="trainer-card__photo"
                        src={t.photo}
                        alt={t.name}
                        width={480}
                        height={600}
                        loading="lazy"
                      />
                      {t.badge && <span className="trainer-card__badge">{t.badge}</span>}
                      <FavoriteButton target={{ type: "trainer", slug: t.slug }} className="trainer-card__save" />
                    </div>
                    <div className="trainer-card__body">
                      <div className="trainer-card__head">
                        <h3 className="trainer-card__name">{t.name}</h3>
                        <TrainerRating rating={t.rating} reviews={t.reviews} />
                      </div>
                      <p className="trainer-card__sport">
                        {t.tags.join(", ")}
                        {t.experience > 0
                          ? ` · опыт ${t.experience} ${pluralRu(t.experience, "год", "года", "лет")}`
                          : ""}
                      </p>
                      <p className="trainer-card__desc">{t.desc}</p>
                      <div className="trainer-card__tags">
                        {t.tags.map((tag, i) => (
                          <span
                            key={tag}
                            className={`trainer-card__tag${i === 0 ? " trainer-card__tag--accent" : ""}`}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                      <div className="trainer-card__footer">
                        <span className="trainer-card__location">
                          <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
                            <circle cx="12" cy="9" r="2.4" />
                          </svg>
                          <span>
                            {t.district ? `${t.city}, ${t.district}` : t.city}
                          </span>
                        </span>
                        {t.price > 0 ? (
                          <span className="trainer-card__price">
                            <small>от </small>
                            {t.price} BYN
                          </span>
                        ) : null}
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

        <div className="layout-container cat-extra">
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
                    <CategoryLink key={`${r.parentSlug}-${r.childSlug ?? "root"}`} route={r}>
                      {r.label}
                    </CategoryLink>
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
              <p>
                Разместите анкету бесплатно — расскажите о себе, добавьте цены, расписание и начните
                принимать заявки.
              </p>
            </div>
            <a
              href="/auth/signup"
              onClick={(e) => {
                e.preventDefault();
                navigate({ to: "/auth/signup" });
              }}
            >
              Стать тренером
            </a>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
