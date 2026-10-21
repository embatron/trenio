import { createFileRoute, Link, notFound, redirect, useRouteContext, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { PhotoImage } from "@/components/photo-image";
import { UserAvatar } from "@/components/user-avatar";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { authErrorMessage } from "@/lib/auth/errors";
import { isStaff } from "@/lib/auth/roles";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { getSportTaxonomyChild, getTopLevelSportCategory } from "@/lib/catalog/sport-taxonomy";
import {
  audienceLabels,
  getPublishedTrainer,
  PUBLISHED_TRAINERS,
  sportLine,
  type PublishedTrainer,
} from "@/lib/catalog/published-trainers";
import { ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import {
  createTrainerReviewFn,
  listTrainerRatingSummariesFn,
  listTrainerReviewsFn,
  replyToTrainerReviewFn,
  type PublicTrainerReview,
  type TrainerReviewSummary,
} from "@/lib/catalog/trainer-reviews";
import { FavoriteButton } from "@/components/favorite-button";
import { ReviewEditor } from "@/components/review-editor";
import { ReviewHtml } from "@/components/review-html";
import { reviewPlainText } from "@/lib/catalog/review-html";
import { TrainerRating } from "@/components/trainer-rating";
import type { TrainerCertificate } from "@/lib/catalog/certificate-file";
import { getTrainerCertificatesFn } from "@/lib/catalog/trainer-certificates";
import { pluralRu } from "@/lib/ru-plural";
import { TRAINER_LEGACY_SLUGS } from "@/lib/catalog/trainer-slugs";

type Trainer = {
  slug: string;
  name: string;
  sports: string[];
  sportLabel: string;
  primarySport: { slug: string; parentSlug: string; label: string };
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
  instagram: string;
  photo: string;
  badge?: string;
  reviews: PublicTrainerReview[];
  certificates: TrainerCertificate[];
  ownStatus: "pending" | "published" | "rejected" | null;
  ownComment: string | null;
  similar: Array<{ slug: string; name: string; sport: string; city: string; price: string; photo: string; rating: string; reviews: number }>;
};

function toTrainer(
  trainer: PublishedTrainer,
  summary: TrainerReviewSummary,
  reviews: PublicTrainerReview[],
  ratings: Record<string, TrainerRatingSnapshot>,
  ownStatus: Trainer["ownStatus"],
  ownComment: string | null,
  certificates: TrainerCertificate[],
): Trainer {
  const formatLabel = (format: PublishedTrainer["formats"][number]) =>
    format === "group" ? "Группа" : "Индивидуально";
  return {
    slug: trainer.slug,
    name: trainer.name,
    sports: trainer.sports.map((sport) => sport.label),
    sportLabel: sportLine(trainer),
    primarySport: trainer.primarySport,
    city: trainer.city,
    about: [trainer.bio],
    taxonomy: {
      main: trainer.sports.map((sport) => ({
        label: sport.label,
        accent: sport.slug === trainer.primarySport.slug,
      })),
      groups: [
        ...(trainer.audiences.length ? [{ label: "Возраст", items: audienceLabels(trainer) }] : []),
        ...(trainer.formats.length ? [{ label: "Формат", items: trainer.formats.map(formatLabel) }] : []),
        ...(trainer.experience ? [{ label: "Стаж", items: [`${trainer.experience} ${pluralRu(trainer.experience, "год", "года", "лет")}`] }] : []),
      ],
    },
    note: "",
    club: { slug: "", name: "", logo: "", meta: "" },
    rating: summary,
    prices: { single: [], packs: [] },
    phone: trainer.phone,
    instagram: trainer.instagram,
    photo: trainer.photo,
    reviews,
    certificates,
    ownStatus,
    ownComment,
    similar: PUBLISHED_TRAINERS.filter((item) => item.slug !== trainer.slug).map((item) => {
      const rating = ratingFor(item.slug, ratings);
      return {
        slug: item.slug,
        name: item.name,
        sport: sportLine(item),
        city: item.city.label,
        price: "",
        photo: item.photo,
        rating: rating.rating,
        reviews: rating.reviews,
      };
    }),
  };
}

export const Route = createFileRoute("/trainers/$slug")({
  loader: async ({ params }) => {
    const legacy = TRAINER_LEGACY_SLUGS[params.slug];
    if (legacy) throw redirect({ to: "/trainers/$slug", params: { slug: legacy } });
    const published = params.slug ? getPublishedTrainer(params.slug) : undefined;
    if (!published) throw notFound();
    const [{ reviews, summary, ownStatus, ownComment, isOwner }, ratings, media] = await Promise.all([
      listTrainerReviewsFn({ data: { slug: published.slug } }),
      listTrainerRatingSummariesFn(),
      getTrainerCertificatesFn({ data: { slug: published.slug } }),
    ]);
    return {
      trainer: toTrainer(published, summary, reviews, ratings, ownStatus ?? null, ownComment ?? null, media.certificates),
      isOwner,
      photos: media.photos,
    };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.trainer;
    if (!t) return { meta: [{ title: "Тренер · trenio.by" }] };
    const sportGenitive =
      getSportTaxonomyChild(t.primarySport.slug)?.titleGenitive ??
      getTopLevelSportCategory(t.primarySport.slug)?.titleGenitive ??
      t.primarySport.label.toLowerCase();
    const cityIn = t.city.slug === "minsk" ? "Минске" : t.city.label;
    const title = `${t.name} — тренер по ${sportGenitive} в ${cityIn} · trenio`;
    const desc = `${t.name}, тренер по ${sportGenitive} в ${cityIn}. ${t.about[0] ?? ""}`;
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

const CSS = `
.trainer-page { background: var(--white); --aside-w: minmax(360px, 38%); }
.trainer-page__inner { padding-block: var(--layout-section-y) clamp(40px, 6vw, 72px); }

.breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 24px; padding: 0; list-style: none; font-size: 13px; font-weight: var(--fw-title); color: var(--muted); }
.breadcrumbs a { color: var(--muted); text-decoration: none; }
.breadcrumbs a:hover { color: var(--primary-dark); }
.breadcrumbs li + li::before { content: "›"; margin-right: 8px; color: var(--line); }

.profile-layout { display: grid; grid-template-columns: var(--aside-w) minmax(0, 1fr); gap: 32px; align-items: start; }
.profile-main { position: relative; display: grid; gap: 22px; min-width: 0; }
.profile-tools { position: absolute; top: 0; right: 0; z-index: 2; display: flex; }
.profile-main.has-tools .profile-identity { padding-right: 96px; }
.profile-aside { position: sticky; top: 96px; align-self: start; min-width: 0; }
.profile-aside__card { display: flex; flex-direction: column; border-radius: var(--card-radius); overflow: hidden; background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 14px 42px rgba(var(--dark-rgb),0.07); }

.photo-slider { position: relative; }
.photo-slider__frame { position: relative; aspect-ratio: 4/5; overflow: hidden; background: linear-gradient(160deg, var(--neutral-bg), var(--line)); }
.photo-slider__viewport { display: flex; width: 100%; height: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.photo-slider__viewport::-webkit-scrollbar { display: none; }
.photo-slider__slide { flex: 0 0 100%; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; }
.photo-slider__slide img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; user-select: none; }
.photo-slider__badge { position: absolute; top: 12px; left: 12px; z-index: 2; padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.94); color: var(--primary-dark); font-size: 11px; font-weight: var(--fw-title); letter-spacing: 0.02em; text-transform: uppercase; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); }
.profile-save { position: absolute; top: 10px; right: 10px; z-index: 2; width: 40px; height: 40px; border: 0; border-radius: 50%; background: rgba(255,255,255,0.92); color: var(--muted); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); }
.profile-save.is-saved { color: var(--primary); }
.profile-save svg { width: 20px; height: 20px; fill: currentColor; }
.photo-slider__nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.92); color: var(--dark); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); z-index: 2; }
.photo-slider__nav--prev { left: 10px; } .photo-slider__nav--next { right: 10px; }
.photo-slider__nav svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.photo-thumbs { display: flex; gap: 8px; margin: 0; padding: 10px 12px 12px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; -webkit-overflow-scrolling: touch; background: var(--white); list-style: none; }
.photo-thumbs::-webkit-scrollbar { display: none; }
.photo-thumbs button { width: 64px; height: 80px; flex: 0 0 auto; padding: 0; border: 2px solid transparent; border-radius: 10px; overflow: hidden; background: var(--neutral-bg); cursor: pointer; scroll-snap-align: center; }
.photo-thumbs button.is-active { border-color: var(--primary); }
.photo-thumbs img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }

.contact-panel { padding: 4px 18px 18px; background: var(--white); }
.contact-prices { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px 14px; margin: 0 0 14px; }
.contact-prices__group { display: grid; gap: 8px; align-content: start; }
.contact-prices__heading { margin: 0; font-size: 11px; font-weight: var(--fw-title); letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
.contact-price-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.contact-price-list__row { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; padding: 8px 10px; border-radius: var(--radius-control); background: var(--neutral-bg); }
.contact-price-list__name { font-size: 13px; font-weight: var(--fw-heading); color: var(--dark); }
.contact-price-list__amount { font-size: 14px; font-weight: var(--fw-title); color: var(--dark); white-space: nowrap; }
.contact-panel__divider { height: 1px; margin: 0 0 14px; background: var(--line); }
.contact-actions { display: grid; gap: 8px; }
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 20px; border: 0; border-radius: 999px; font-size: 15px; font-weight: var(--fw-title); cursor: pointer; text-decoration: none; transition: transform 0.16s ease, background 0.16s ease; width: 100%; }
.btn:hover { transform: translateY(-1px); }
.btn--primary { background: var(--primary); color: #fff; }
.btn--primary:hover { background: var(--primary-dark); }
.btn--secondary { background: var(--neutral-bg); color: var(--dark); border: 1px solid var(--line); }
.btn--instagram {
  color: #fff; border: 0;
  background: radial-gradient(circle at 30% 110%, #fdf497 0%, #fd5949 45%, #d6249f 62%, #285aeb 100%);
}
.btn--instagram:hover { filter: brightness(1.06); }
.btn svg { width: 18px; height: 18px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; flex: 0 0 auto; }
.btn--instagram svg { fill: currentColor; stroke: none; }

.profile-intro { min-width: 0; }
.profile-identity__sport { margin: 0 0 6px; font-size: 13px; font-weight: var(--fw-title); letter-spacing: 0.05em; text-transform: uppercase; color: var(--primary-dark); }
.profile-identity__title { display: flex; align-items: center; flex-wrap: wrap; gap: 0 2px; margin: 0 0 12px; }
.profile-identity__name { margin: 0; font-size: var(--fs-page); font-weight: var(--fw-heading); letter-spacing: -0.035em; color: var(--dark); line-height: 1.05; }
.profile-edit { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 50%; color: var(--dark); text-decoration: none; }
.profile-edit:hover { background: rgba(var(--dark-rgb), 0.04); color: var(--primary); }
.profile-edit svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.review-reply__open { align-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: transparent; color: var(--primary-dark); font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.profile-identity__meta { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 18px; }
.profile-location { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); font-size: 14px; font-weight: var(--fw-title); }
.profile-location svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.profile-rating { display: inline-flex; align-items: center; flex-wrap: wrap; gap: 6px 8px; font-size: 15px; font-weight: var(--fw-title); color: var(--dark); }
.profile-rating__stars { position: relative; display: inline-flex; }
.profile-rating__stars-empty, .profile-rating__stars-fill { display: inline-flex; gap: 2px; }
.profile-rating__stars-empty svg, .profile-rating__stars-fill svg { width: 16px; height: 16px; }
.profile-rating__stars-empty svg { fill: var(--line); }
.profile-rating__stars-filled { position: absolute; inset: 0 auto 0 0; overflow: hidden; }
.profile-rating__stars-fill svg { fill: #ffb400; }
.profile-rating__counts { color: var(--muted); font-size: 14px; font-weight: var(--fw-title); }
.profile-rating__reviews-link { color: var(--primary-dark); font-weight: var(--fw-ui); text-decoration: none; }
.profile-rating__reviews-link:hover { text-decoration: underline; }

.profile-body { display: grid; gap: 32px; min-width: 0; }
.profile-block { display: grid; gap: 14px; }
.profile-copy { display: grid; gap: 8px; }
.profile-heading { margin: 0; font-size: 14px; font-weight: var(--fw-title); letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.profile-text { margin: 0; color: var(--text); font-size: 15px; line-height: 1.65; font-weight: 500; }
.profile-text + .profile-text { margin-top: 12px; }
.cert-list { display: grid; gap: 2px; margin: 0; padding: 0 0 0 1.15em; list-style: disc; }
.cert-list li { margin: 0; min-width: 0; }
.cert-list a { display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; color: var(--primary); font-size: 15px; font-weight: var(--fw-title); line-height: 1.35; text-decoration: none; }
.cert-list a:hover { text-decoration: underline; }
.cert-list svg { width: 16px; height: 16px; flex: 0 0 auto; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.profile-taxonomy { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.profile-taxonomy__group { display: grid; gap: 8px; }
.profile-taxonomy__group--merged { gap: 0; }
.profile-taxonomy__label { margin: 0; font-size: 12px; font-weight: var(--fw-ui); letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); }
.profile-taxonomy__tags { display: flex; flex-wrap: wrap; gap: 8px; }
.taxonomy-tag { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); line-height: 1.2; }
.taxonomy-tag--accent { background: rgba(var(--primary-rgb),0.1); color: var(--primary-dark); }
.profile-note { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; font-weight: 500; }

.profile-spotlight { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 16px; align-items: center; padding: 18px 20px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 10px 32px rgba(var(--dark-rgb),0.05); }
.profile-spotlight__logo { width: 56px; height: 56px; border-radius: var(--radius-tile); background: var(--dark); color: var(--white); display: grid; place-items: center; font-size: 18px; font-weight: var(--fw-heading); letter-spacing: -0.04em; }
.profile-spotlight__title { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 4px; color: var(--dark); font-size: 16px; font-weight: var(--fw-title); text-decoration: none; }
.profile-spotlight__title:hover { color: var(--primary-dark); }
.profile-spotlight__meta { margin: 0; color: var(--muted); font-size: 13px; font-weight: 500; }
.profile-spotlight__action { padding: 10px 14px; border-radius: 999px; background: var(--neutral-bg); color: var(--dark); font-size: 13px; font-weight: var(--fw-ui); text-decoration: none; white-space: nowrap; }
.profile-spotlight__action:hover { background: var(--light-bg); color: var(--primary-dark); }

.review-list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
.review-item { display: grid; gap: 14px; padding: 18px 20px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.06); box-shadow: 0 10px 32px rgba(var(--dark-rgb), 0.05); }
.review-item__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.review-item__who { display: inline-flex; align-items: center; gap: 12px; min-width: 0; height: 40px; }
.review-item__pair { display: inline-flex; align-items: center; justify-content: center; gap: 8px; height: 40px; min-width: 0; }
.review-item__author { font-size: 18px; font-weight: var(--fw-title); letter-spacing: -0.02em; line-height: 40px; color: var(--dark); white-space: nowrap; }
.review-item__date { color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); line-height: 40px; }
.review-item__stars { display: inline-flex; align-items: center; justify-content: center; gap: 2px; height: 40px; flex: 0 0 auto; }
.review-item__stars svg { width: 22px; height: 22px; display: block; fill: #ffb400; }
.review-item__stars svg.is-empty { fill: var(--line); }
.review-item__text { position: relative; margin: 0; padding: 2px 0 0 28px; color: var(--text); font-size: 16px; line-height: 1.6; font-weight: 500; }
.review-item__text::before { content: "«"; position: absolute; left: 0; top: -8px; color: var(--primary); font-size: 34px; font-weight: var(--fw-heading); line-height: 1; }
.review-reply { display: grid; gap: 4px; padding: 12px; border-radius: var(--radius-control); background: var(--neutral-bg); }
.review-reply__who { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12px; font-weight: var(--fw-title); }
.review-reply p { margin: 0; color: var(--text); font-size: 14px; line-height: 1.55; }

.profile-block__head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.profile-block__head-meta { color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.reviews-more { margin-top: 4px; align-self: start; min-height: 44px; padding: 11px 18px; border-radius: 999px; border: 1px solid var(--line); background: var(--white); color: var(--dark); font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; text-decoration: none; transition: background 0.16s ease, border-color 0.16s ease; }
.reviews-more:hover { background: var(--light-bg); border-color: rgba(var(--primary-rgb), 0.3); color: var(--primary-dark); }
.review-add { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid rgba(var(--primary-rgb), 0.35); background: var(--white); color: var(--primary-dark); font-size: 14px; font-weight: var(--fw-title); cursor: pointer; text-decoration: none; }
.review-add:hover { background: var(--light-bg); }
.review-form { display: grid; gap: 12px; padding: 16px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.06); box-shadow: 0 10px 32px rgba(var(--dark-rgb), 0.05); scroll-margin: 88px 0 96px; }
.review-form__label { margin: 0; font-size: 13px; font-weight: var(--fw-title); color: var(--muted); }
.review-stars { display: flex; gap: 2px; }
.review-stars button { width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--line); cursor: pointer; display: grid; place-items: center; transition: color 0.12s ease, transform 0.12s ease; }
.review-stars button.is-on { color: #ffb400; }
.review-stars button.is-hot { transform: scale(1.12); }
.review-stars svg { width: 22px; height: 22px; fill: currentColor; }
.review-form__req { color: var(--primary); }
.review-stars.is-invalid { outline: 1px solid var(--primary); outline-offset: 2px; border-radius: 12px; }
.review-form label, .review-form__field { display: grid; gap: 6px; }
.review-form textarea { width: 100%; min-height: 120px; padding: 12px 14px; border-radius: var(--radius-control); border: 1px solid var(--line); background: var(--white); color: var(--text); font: inherit; font-size: 15px; resize: vertical; }
.review-form__actions { display: flex; flex-wrap: wrap; gap: 8px; }
.review-form__submit { min-height: 44px; padding: 0 18px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.review-form__submit:disabled { opacity: 0.6; cursor: default; }
.review-form__cancel { min-height: 44px; padding: 0 16px; border-radius: 999px; border: 1px solid var(--line); background: var(--white); color: var(--dark); font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; }
.review-form__error { margin: 0; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-ui); }
.review-note { margin: 0; color: var(--muted); font-size: 13px; font-weight: var(--fw-ui); }
.review-note a { color: var(--primary); font-weight: var(--fw-title); text-decoration: none; }
.review-form__hint { margin: 0; color: var(--muted); font-size: 13px; }


.similar-trainers { min-width: 0; padding-top: 8px; }
.similar-trainers__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.similar-trainers__viewport { overflow-x: auto; scrollbar-width: none; }
.similar-trainers__viewport::-webkit-scrollbar { display: none; }
.similar-trainers__track { display: grid; grid-auto-flow: column; grid-auto-columns: minmax(220px, 1fr); gap: 14px; padding-bottom: 4px; }
.similar-card { display: flex; flex-direction: column; min-width: 0; border: 1px solid rgba(var(--dark-rgb),0.06); border-radius: var(--card-radius); background: var(--white); color: inherit; text-decoration: none; overflow: hidden; cursor: pointer; }
.similar-card__media { aspect-ratio: 4/5; background: linear-gradient(160deg, var(--neutral-bg), var(--line)); overflow: hidden; }
.similar-card__photo { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }
.similar-card__body { padding: 14px 16px 16px; display: grid; gap: 4px; }
.similar-card__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.similar-card__name { margin: 0; font-size: 15px; font-weight: var(--fw-title); color: var(--dark); letter-spacing: -0.02em; transition: color 0.16s ease; }
.similar-card:hover .similar-card__name,
.similar-card:focus-visible .similar-card__name { color: var(--primary); }
.similar-card__sport { margin: 0; color: var(--muted); font-size: 13px; font-weight: var(--fw-title); }
.similar-card__meta { display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--muted); font-weight: var(--fw-title); margin-top: 4px; }
.similar-card__price { color: var(--dark); font-weight: var(--fw-title); }

.mobile-contact-bar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 200; padding: 10px var(--layout-gutter) calc(10px + env(safe-area-inset-bottom, 0px)); background: rgba(255,255,255,0.96); backdrop-filter: blur(12px); border-top: 1px solid var(--line); display: none; }
.mobile-contact-bar__inner { max-width: 600px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }

@media (prefers-reduced-motion: reduce) {
  .photo-slider__viewport, .photo-thumbs { scroll-behavior: auto; }
}

@media (max-width: 960px) {
  .profile-layout { grid-template-columns: 1fr; gap: 22px; }
  .profile-aside { position: static; }
  .mobile-contact-bar { display: block; }
  .trainer-page__inner { padding-block: clamp(16px, 3vw, 20px) clamp(72px, 12vw, 110px); }
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

const STAR_PATH = "M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z";
const EDIT_ICON = "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z";

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 2.8h10A4.2 4.2 0 0 1 21.2 7v10A4.2 4.2 0 0 1 17 21.2H7A4.2 4.2 0 0 1 2.8 17V7A4.2 4.2 0 0 1 7 2.8zm5 3.5A5.7 5.7 0 1 0 17.7 12 5.7 5.7 0 0 0 12 6.3zm6.35-.85a1.25 1.25 0 1 0 1.25 1.25 1.25 1.25 0 0 0-1.25-1.25zM12 8.6A3.4 3.4 0 1 1 8.6 12 3.4 3.4 0 0 1 12 8.6z" />
    </svg>
  );
}

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function ReviewForm({ slug, onClose }: { slug: string; onClose: () => void }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [textError, setTextError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
    form.scrollIntoView({ block: "start", behavior: motion });
  }, []);

  return (
    <form
      ref={formRef}
      className="review-form"
      onSubmit={(event) => {
        const submitter = (event.nativeEvent as SubmitEvent).submitter;
        if (submitter?.classList.contains("rsw-btn")) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        const plain = reviewPlainText(text);
        const nextRatingError = rating < 1 ? "Поставьте оценку от 1 до 5." : null;
        const nextTextError = plain.length < 10
          ? "Напишите хотя бы 10 символов."
          : plain.length > 1000
            ? "Не длиннее 1000 символов."
            : null;
        setRatingError(nextRatingError);
        setTextError(nextTextError);
        if (nextRatingError || nextTextError) return;
        setPending(true);
        setError(null);
        void createTrainerReviewFn({ data: { slug, rating, text } })
          .then(async () => {
            onClose();
            await router.invalidate();
          })
          .catch((err: unknown) => {
            setError(authErrorMessage(err));
          })
          .finally(() => setPending(false));
      }}
    >
      <p className="review-form__label" id={`${slug}-rating`}>Оценка <span className="review-form__req" aria-hidden="true">*</span></p>
      <div
        className={ratingError ? "review-stars is-invalid" : "review-stars"}
        role="radiogroup"
        aria-labelledby={`${slug}-rating`}
        aria-required="true"
        aria-invalid={ratingError ? true : undefined}
        onMouseLeave={() => setHover(0)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft" && event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : -1;
          setRating((current) => Math.min(5, Math.max(1, (current || 0) + step)));
        }}
      >
        {Array.from({ length: 5 }).map((_, index) => {
          const value = index + 1;
          const shown = hover || rating;
          return (
            <button
              key={value}
              type="button"
              className={[value <= shown ? "is-on" : "", hover === value ? "is-hot" : ""].filter(Boolean).join(" ") || undefined}
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} из 5`}
              onMouseEnter={() => setHover(value)}
              onFocus={() => setHover(value)}
              onBlur={() => setHover(0)}
              onClick={() => {
                setRating(value);
                setRatingError(null);
              }}
            >
              <svg viewBox="0 0 24 24"><path d={STAR_PATH} /></svg>
            </button>
          );
        })}
      </div>
      {ratingError ? <p className="review-form__error" role="alert">{ratingError}</p> : null}
      <div className="review-form__field">
        <span className="review-form__label">Отзыв <span className="review-form__req" aria-hidden="true">*</span></span>
        <ReviewEditor
          value={text}
          invalid={Boolean(textError)}
          onChange={(value) => {
            setText(value);
            if (textError) setTextError(null);
          }}
        />
      </div>
      {textError ? <p className="review-form__error" role="alert">{textError}</p> : null}
      {error ? <p className="review-form__error" role="alert">{error}</p> : null}
      <p className="review-form__hint">Отзыв появится на странице после проверки.</p>
      <div className="review-form__actions">
        <button className="review-form__submit" type="submit" disabled={pending}>
          {pending ? "Отправка…" : "Отправить"}
        </button>
        <button className="review-form__cancel" type="button" onClick={onClose}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function ReviewReply({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  if (!open) {
    return (
      <button type="button" className="review-reply__open" onClick={() => setOpen(true)}>
        Ответить
      </button>
    );
  }
  return (
    <form
      className="review-form"
      onSubmit={(event) => {
        event.preventDefault();
        const reply = text.trim();
        if (reply.length < 10) {
          setError("Напишите хотя бы 10 символов.");
          return;
        }
        setPending(true);
        setError(null);
        void replyToTrainerReviewFn({ data: { id, reply } })
          .then(async () => {
            setOpen(false);
            await router.invalidate();
          })
          .catch((err: unknown) => setError(authErrorMessage(err)))
          .finally(() => setPending(false));
      }}
    >
      <label className="review-form__field">
        <span className="review-form__label">Ответ</span>
        <textarea
          required
          maxLength={1000}
          value={text}
          placeholder="Один ответ на этот отзыв"
          onChange={(event) => {
            setText(event.target.value);
            if (error) setError(null);
          }}
        />
      </label>
      {error ? <p className="review-form__error" role="alert">{error}</p> : null}
      <div className="review-form__actions">
        <button className="review-form__submit" type="submit" disabled={pending}>
          {pending ? "Публикация…" : "Ответить"}
        </button>
        <button className="review-form__cancel" type="button" onClick={() => setOpen(false)}>
          Отмена
        </button>
      </div>
    </form>
  );
}

function TrainerPage() {
  const { trainer: t, isOwner, photos: storedPhotos } = Route.useLoaderData() as { trainer: Trainer; isOwner: boolean; photos: string[] };
  const { user } = useRouteContext({ from: "__root__" });
  const [photoIdx, setPhotoIdx] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLUListElement>(null);
  const [reviewsShown, setReviewsShown] = useState(5);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const shownPhone = formatBelarusPhone(t.phone) || t.phone;
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const ownNote = t.ownStatus === "pending"
    ? "Ваш отзыв на модерации"
    : t.ownStatus === "rejected"
      ? "Отзыв отклонён"
      : t.ownStatus === "published"
        ? "Вы уже оставили отзыв"
        : null;
  const reviewLabel = t.reviews.length === 0 ? "Сделать первый отзыв" : "Добавить отзыв";
  const staff = Boolean(user && isStaff(user.roles));

  const photos = storedPhotos.length > 0 ? storedPhotos : [t.photo].filter(Boolean);
  const scrollMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" as const : "smooth" as const;
  function showPhoto(index: number) {
    const viewport = viewportRef.current;
    if (!viewport || photos.length === 0) return;
    const next = (index + photos.length) % photos.length;
    viewport.scrollTo({ left: next * viewport.clientWidth, behavior: scrollMotion() });
    setPhotoIdx(next);
  }
  const hasPrices = t.prices.single.length > 0 || t.prices.packs.length > 0;
  const hasRating = t.rating.reviewCount > 0;

  useEffect(() => {
    const track = thumbsRef.current;
    const thumb = track?.children[photoIdx] as HTMLElement | undefined;
    if (!track || !thumb) return;
    const left = thumb.offsetLeft - (track.clientWidth - thumb.clientWidth) / 2;
    track.scrollTo({ left, behavior: scrollMotion() });
  }, [photoIdx]);

  useEffect(() => {
    document.body.classList.add("page-trainer");
    return () => document.body.classList.remove("page-trainer");
  }, []);

  return (
    <div className="page-shell trainer-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <SiteHeader />

      <main>
        <div className="layout-container trainer-page__inner">
        <nav aria-label="Хлебные крошки">
          <ol className="breadcrumbs">
            <li><Link to="/">Главная</Link></li>
            <li><Link to="/city/$slug" params={{ slug: t.city.slug }}>Тренеры в {t.city.label === "Минск" ? "Минске" : t.city.label}</Link></li>
            <li>
              {t.primarySport.parentSlug === t.primarySport.slug ? (
                <Link to="/categories/$slug" params={{ slug: t.primarySport.slug }}>{t.primarySport.label}</Link>
              ) : (
                <Link to="/categories/$parentSlug/$childSlug" params={{ parentSlug: t.primarySport.parentSlug, childSlug: t.primarySport.slug }}>{t.primarySport.label}</Link>
              )}
            </li>
            <li className="is-current" aria-current="page">{t.name}</li>
          </ol>
        </nav>

        <article className="profile-layout">
          <aside className="profile-aside">
            <div className="profile-aside__card">
              <div className="photo-slider">
                <div className="photo-slider__frame">
                  <div
                    className="photo-slider__viewport"
                    ref={viewportRef}
                    onScroll={() => {
                      const viewport = viewportRef.current;
                      if (!viewport || viewport.clientWidth === 0) return;
                      const next = Math.min(photos.length - 1, Math.max(0, Math.round(viewport.scrollLeft / viewport.clientWidth)));
                      setPhotoIdx((current) => current === next ? current : next);
                    }}
                  >
                    {photos.map((src, i) => (
                      <div key={src} className="photo-slider__slide">
                        <PhotoImage src={src} alt={`${t.name} — фото ${i + 1}`} preset="profile" width={680} height={850} loading={i === 0 ? "eager" : "lazy"} />
                      </div>
                    ))}
                  </div>
                  {t.badge && <span className="photo-slider__badge">{t.badge}</span>}
                  <FavoriteButton target={{ type: "trainer", slug: t.slug }} className="profile-save" />
                  {photos.length > 1 ? (
                    <>
                      <button className="photo-slider__nav photo-slider__nav--prev" type="button" aria-label="Предыдущее фото" onClick={() => showPhoto(photoIdx - 1)}>
                        <svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6" /></svg>
                      </button>
                      <button className="photo-slider__nav photo-slider__nav--next" type="button" aria-label="Следующее фото" onClick={() => showPhoto(photoIdx + 1)}>
                        <svg viewBox="0 0 24 24"><path d="M10 6l6 6-6 6" /></svg>
                      </button>
                    </>
                  ) : null}
                </div>
                {photos.length > 1 ? (
                  <ul className="photo-thumbs" ref={thumbsRef} aria-label="Миниатюры фото">
                    {photos.map((src, i) => (
                      <li key={src}>
                        <button type="button" className={i === photoIdx ? "is-active" : undefined} aria-label={`Фото ${i + 1}`} aria-current={i === photoIdx ? "true" : undefined} onClick={() => showPhoto(i)}>
                          <PhotoImage src={src} alt="" preset="tile" width={64} height={80} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="contact-panel" aria-label="Связаться с тренером">
                {hasPrices ? <div className="contact-prices">
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
                </div> : null}

                {hasPrices ? <div className="contact-panel__divider" aria-hidden="true" /> : null}

                <div className="contact-actions">
                  {t.phone ? (
                    phoneVisible ? (
                      <a className="btn btn--primary" href={phoneHref(shownPhone)}>
                        <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z" /></svg>
                        {shownPhone}
                      </a>
                    ) : (
                      <button className="btn btn--primary" type="button" onClick={() => setPhoneVisible(true)}>
                        <svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.5 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.4-1.4a2 2 0 0 1 2.1-.5c.9.2 1.8.4 2.7.5A2 2 0 0 1 22 16.9z" /></svg>
                        Показать телефон
                      </button>
                    )
                  ) : null}
                  <a className="btn btn--instagram" href={t.instagram} target="_blank" rel="noopener noreferrer">
                    <InstagramIcon />
                    Instagram
                  </a>
                </div>
              </div>
            </div>
          </aside>

          <div className={`profile-main${staff || isOwner ? " has-tools" : ""}`}>
            {staff || isOwner ? (
              <div className="profile-tools">
                {staff ? (
                  <Link className="profile-edit" to="/admin/trainers/$slug" params={{ slug: t.slug }} aria-label="Редактировать профиль" title="Редактировать профиль">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                  </Link>
                ) : null}
                {isOwner ? (
                  <Link className="profile-edit" to="/trainer-admin" search={{ tab: "card" }} aria-label="Редактировать свой профиль" title="Редактировать свой профиль">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                  </Link>
                ) : null}
              </div>
            ) : null}
            <header className="profile-intro">
              <div className="profile-identity">
                <p className="profile-identity__sport">{t.sportLabel}</p>
                <div className="profile-identity__title">
                  <h1 className="profile-identity__name">{t.name}</h1>
                </div>
                <div className="profile-identity__meta">
                  <span className="profile-location">
                    <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                    {t.city.label}
                  </span>
                  {hasRating ? <div className="profile-rating" aria-label={`Рейтинг ${t.rating.value} из 5, ${t.rating.ratingCount} ${pluralRu(t.rating.ratingCount, "оценка", "оценки", "оценок")}, ${t.rating.reviewCount} ${pluralRu(t.rating.reviewCount, "отзыв", "отзыва", "отзывов")}`}>
                    <Stars rating={parseFloat(t.rating.value)} />
                    <span className="profile-rating__score">{t.rating.value}</span>
                    <span className="profile-rating__counts">
                      (<span>{t.rating.ratingCount} {pluralRu(t.rating.ratingCount, "оценка", "оценки", "оценок")}</span> · <a className="profile-rating__reviews-link" href="#reviews">{t.rating.reviewCount} {pluralRu(t.rating.reviewCount, "отзыв", "отзыва", "отзывов")}</a>)
                    </span>
                  </div> : null}
                </div>
              </div>
            </header>

            <div className="profile-body">
              <section className="profile-block">
                {t.about.some((paragraph) => paragraph.trim()) ? (
                  <div className="profile-copy">
                    <h2 className="profile-heading">Обо мне</h2>
                    {t.about.filter((paragraph) => paragraph.trim()).map((paragraph, index) => (
                      <p key={index} className="profile-text">{paragraph}</p>
                    ))}
                  </div>
                ) : null}
                {t.certificates.length > 0 ? (
                  <div className="profile-copy">
                    <h2 className="profile-heading">Сертификаты и дипломы</h2>
                    <ul className="cert-list">
                      {t.certificates.map((item) => (
                        <li key={item.path}>
                          <a href={item.path} target="_blank" rel="noopener noreferrer">
                            {item.caption}
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path d="M14 5h5v5" />
                              <path d="M19 5l-8 8" />
                              <path d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5" />
                            </svg>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

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

                {t.note ? <p className="profile-note">{t.note}</p> : null}
              </section>

              {t.club.slug ? <section className="profile-block">
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
              </section> : null}

              <section className="profile-block" id="reviews">
                <div className="profile-block__head">
                  <h2 className="profile-heading">Отзывы{hasRating ? ` · ${t.rating.reviewCount}` : ""}</h2>
                  {ownNote ? (
                    <p className="review-note">
                      {ownNote}. {t.ownComment ? `${t.ownComment} ` : null}
                      <Link to="/account/reviews">Кабинет</Link>
                    </p>
                  ) : isOwner ? null : user ? (
                    reviewFormOpen ? null : (
                      <button type="button" className="review-add" onClick={() => setReviewFormOpen(true)}>
                        {reviewLabel}
                      </button>
                    )
                  ) : (
                    <Link className="review-add" to="/auth/login" search={{ redirect: `/trainers/${t.slug}` }}>
                      {reviewLabel}
                    </Link>
                  )}
                </div>
                {hasRating ? <p className="profile-block__head-meta">{t.rating.value} из 5 · {t.rating.ratingCount} {pluralRu(t.rating.ratingCount, "оценка", "оценки", "оценок")}</p> : null}
                {reviewFormOpen && user ? <ReviewForm slug={t.slug} onClose={() => setReviewFormOpen(false)} /> : null}
                {t.reviews.length === 0 ? <p className="profile-text">Отзывов пока нет.</p> : <ul className="review-list">
                  {t.reviews.slice(0, reviewsShown).map((r) => (
                    <li key={r.id} className="review-item">
                      <div className="review-item__head">
                        <span className="review-item__who">
                          <UserAvatar name={r.author} src={r.avatarPath} />
                          <span className="review-item__pair">
                            <span className="review-item__author">{r.author}</span>
                            <ReviewStars rating={r.rating} />
                          </span>
                        </span>
                        <span className="review-item__date">{r.date}</span>
                      </div>
                      <ReviewHtml className="review-item__text" html={r.text} />
                      {r.messages.map((message, index) => (
                        <div key={`${r.id}-${index}`} className="review-reply">
                          <span className="review-reply__who">
                            <UserAvatar name={message.author} src={message.avatarPath} size={28} />
                            <span>{message.role === "trainer" ? "Ответ тренера" : message.author}</span>
                          </span>
                          <p>{message.body}</p>
                        </div>
                      ))}
                      {(() => {
                        const last = r.messages.at(-1)?.role;
                        const trainerTurn = isOwner && last !== "trainer";
                        const authorTurn = r.isMine && !isOwner && last === "trainer";
                        return trainerTurn || authorTurn ? <ReviewReply id={r.id} /> : null;
                      })()}
                    </li>
                  ))}
                </ul>}
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
                        <PhotoImage className="similar-card__photo" src={s.photo} alt={s.name} preset="card" width={420} height={525} loading="lazy" />
                      </div>
                      <div className="similar-card__body">
                        <div className="similar-card__head">
                          <h3 className="similar-card__name">{s.name}</h3>
                          <TrainerRating rating={s.rating} reviews={s.reviews} />
                        </div>
                        <p className="similar-card__sport">{s.sport}</p>
                        <div className="similar-card__meta">
                          <span>{s.city}</span>
                          {s.price ? <span className="similar-card__price">{s.price}</span> : null}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </article>
        </div>
      </main>

      <div className="mobile-contact-bar" aria-label="Быстрая связь">
        <div className="mobile-contact-bar__inner" style={t.phone ? undefined : { gridTemplateColumns: "1fr" }}>
          <a className="btn btn--instagram" href={t.instagram} target="_blank" rel="noopener noreferrer">
            <InstagramIcon />
            Instagram
          </a>
          {t.phone ? (
            phoneVisible ? (
              <a className="btn btn--primary" href={phoneHref(shownPhone)}>{shownPhone}</a>
            ) : (
              <button className="btn btn--primary" type="button" onClick={() => setPhoneVisible(true)}>
                Показать телефон
              </button>
            )
          ) : null}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
