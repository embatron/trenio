import { createFileRoute, Link, notFound, redirect, useRouteContext, useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CabinetModal } from "@/components/cabinet";
import { ReviewStars, STAR_PATH } from "@/components/review-stars";
import { PhotoImage } from "@/components/photo-image";
import { UserAvatar } from "@/components/user-avatar";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { authErrorMessage } from "@/lib/auth/errors";
import { isStaff } from "@/lib/auth/roles";
import { trainerIntroPhrase, trainerSportDatives, trainerSportRoles } from "@/lib/catalog/sport-taxonomy";
import { listCatalogTrainersFn } from "@/lib/catalog/catalog-trainers";
import {
  audienceLabels,
  getPublishedTrainer,
  similarTrainers,
  sportLine,
  trainerBreadcrumbSport,
  TRAINER_FORMAT_OPTIONS,
  type PublishedTrainer,
} from "@/lib/catalog/published-trainers";
import { compareByPopularity, popularityChecklist, popularityScore, ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import { NEGOTIABLE_PRICE_LABEL, listTrainerPricesFn, priceForCard, type TrainerPriceMap } from "@/lib/catalog/trainer-price";
import {
  createTrainerReviewFn,
  listTrainerRatingSummariesFn,
  listTrainerReviewsFn,
  replyToTrainerReviewFn,
  type PublicTrainerReview,
  type TrainerReviewSummary,
} from "@/lib/catalog/trainer-reviews";
import { CabinetNotice } from "@/components/cabinet";
import { AccountLikeButton } from "@/components/account-like-button";
import { CardDirectLink } from "@/components/messages/card-direct-link";
import { FavoriteButton } from "@/components/favorite-button";
import { ShareProfileButton } from "@/components/share-profile";
import { TrainerAddressMap } from "@/components/trainer-address-map";
import { TrainerContactIcons } from "@/components/messages/trainer-contact-icons";
import { getPublicTrainerContactsFn, type PublicTrainerContacts } from "@/lib/catalog/trainer-contacts";
import { recordTrainerProfileViewFn } from "@/lib/catalog/trainer-views";
import { ReviewEditor } from "@/components/review-editor";
import { ReviewExcerpt, ReviewHtml } from "@/components/review-html";
import { compactReviewHtml, reviewPlainText } from "@/lib/catalog/review-html";
import { CatalogTrainerCard, TrainerSportLink, type CatalogTrainerCardData } from "@/components/catalog-trainer-card";
import { TrainerName } from "@/components/trainer-name";
import { TrainerDocuments } from "@/components/trainer-documents";
import type { TrainerDocument } from "@/lib/catalog/certificate-preview";
import { getTrainerCertificatesFn } from "@/lib/catalog/trainer-certificates";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { trainerDocumentPhrase, trainerSeoHead } from "@/lib/seo/trainer";
import { cityIn } from "@/lib/seo/text";
import { getTrainerAddressFn } from "@/lib/geo/functions";
import { pluralRu } from "@/lib/ru-plural";
import { DoorPasswordDialog } from "@/components/auth/door-password-dialog";
import { TrainerDoorMailDialog } from "@/components/trainer-door-editor";
import { useAuthServerFn } from "@/lib/auth/use-auth-form";
import { getMagicTrainerFn, loadVisibleTrainerFn, openTrainerMailFn, type MagicTrainerDraft } from "@/lib/catalog/trainer-magic";
import { TRAINER_LEGACY_SLUGS } from "@/lib/catalog/trainer-slugs";

type Trainer = {
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  sports: string[];
  sportLabel: string;
  sportDatives: string[];
  sportRoles: Array<{ text: string; po: boolean }>;
  primarySport: { slug: string; parentSlug: string; label: string };
  sportRefs: Array<{ slug: string; parentSlug: string; label: string }>;
  city: { slug: string; label: string };
  about: string[];
  sessions: string;
  taxonomy: {
    main: Array<{ slug: string; parentSlug: string; label: string; accent?: boolean }>;
    groups: Array<{ label: string; items: string[]; brand?: boolean }>;
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
  places: Array<{ city: string; district: string; address: string; lat: number | null; lng: number | null }>;
  photo: string;
  badge?: string;
  reviews: PublicTrainerReview[];
  certificates: TrainerDocument[];
  ownStatus: "pending" | "published" | "rejected" | null;
  ownComment: string | null;
  similar: CatalogTrainerCardData[];
  createdAt?: string;
  updatedAt?: string;
};

function toTrainer(
  trainer: PublishedTrainer,
  summary: TrainerReviewSummary,
  reviews: PublicTrainerReview[],
  ratings: Record<string, TrainerRatingSnapshot>,
  prices: TrainerPriceMap,
  ownStatus: Trainer["ownStatus"],
  ownComment: string | null,
  certificates: TrainerDocument[],
  catalog: PublishedTrainer[],
): Trainer {
  const formatLabel = (format: PublishedTrainer["formats"][number]) =>
    TRAINER_FORMAT_OPTIONS.find((option) => option.id === format)?.label ?? format;
  const sessionPrice = priceForCard(trainer.slug, trainer.priceFrom, prices);
  const rankCatalog = (item: PublishedTrainer) => {
    const rating = ratingFor(item.slug, ratings);
    const fill = popularityChecklist({
      photo: item.photo,
      bio: item.bio,
      sports: item.sports,
      experience: item.experience,
      price: item.priceFrom,
      formats: item.formats,
      city: item.city.label,
      phone: item.phone,
      instagram: item.instagram,
      telegram: item.telegram,
      email: item.email,
    });
    return {
      name: item.name,
      rating: rating.rating,
      reviews: rating.reviews,
      positiveReviews: rating.positiveReviews,
      recentPositiveReviews: rating.recentPositiveReviews,
      views: rating.views,
      engaged: rating.engaged,
      saves: rating.saves,
      likes: rating.likes,
      likePace: rating.likePace,
      cardFilled: item.cardFilled ?? fill.card,
      contactsFilled: item.contactsFilled ?? fill.contacts,
    };
  };
  return {
    slug: trainer.slug,
    name: trainer.name,
    firstName: trainer.firstName,
    lastName: trainer.lastName,
    sports: trainer.sports.map((sport) => sport.label),
    sportLabel: sportLine(trainer),
    sportDatives: trainerSportDatives(trainer.sports),
    sportRoles: trainerSportRoles(trainer.sports),
    primarySport: trainer.primarySport,
    sportRefs: trainer.sports,
    city: trainer.city,
    about: [trainer.bio],
    sessions: "",
    taxonomy: {
      main: trainer.sports.map((sport) => ({
        slug: sport.slug,
        parentSlug: sport.parentSlug,
        label: sport.label,
      })),
      groups: [
        { label: "С кем я работаю", brand: true, items: audienceLabels(trainer) },
        ...(trainer.formats.length ? [{ label: "Формат занятий", brand: true, items: trainer.formats.map(formatLabel) }] : []),
        {
          label: "Стоимость одного персонального занятия",
          brand: true,
          items: [sessionPrice != null ? `${sessionPrice} BYN` : NEGOTIABLE_PRICE_LABEL],
        },
        ...(trainer.experience ? [{ label: "Мой тренерский стаж", brand: true, items: [`${trainer.experience} ${pluralRu(trainer.experience, "год", "года", "лет")}`] }] : []),
      ],
    },
    note: "",
    club: { slug: "", name: "", logo: "", meta: "" },
    rating: summary,
    prices: { single: [], packs: [] },
    phone: trainer.phone,
    instagram: trainer.instagram,
    places: [],
    photo: trainer.photo,
    reviews,
    certificates,
    ownStatus,
    ownComment,
    createdAt: trainer.createdAt,
    updatedAt: trainer.updatedAt,
    similar: similarTrainers(catalog, trainer, 3, (left, right) => compareByPopularity(rankCatalog(left), rankCatalog(right))).map((item) => {
      const rating = ratingFor(item.slug, ratings);
      return {
        slug: item.slug,
        name: item.name,
        firstName: item.firstName,
        lastName: item.lastName,
        photo: item.photo,
        desc: item.bio,
        tags: item.sports.map((sport) => sport.label),
        sports: item.sports.map((sport) => ({ slug: sport.slug, parentSlug: sport.parentSlug, label: sport.label })),
        citySlug: item.city.slug,
        rating: rating.rating,
        reviews: rating.reviews,
        catalogScore: popularityScore({
          ...rating,
          cardFilled: item.cardFilled ?? 0,
          contactsFilled: item.contactsFilled ?? 0,
        }),
        city: item.city.label,
        district: item.district,
        experience: item.experience,
        price: priceForCard(item.slug, item.priceFrom, prices),
        phone: item.phone,
        instagram: item.instagram,
        telegram: item.telegram,
      };
    }),
  };
}

export const Route = createFileRoute("/trainers/$slug")({
  loader: async ({ params }) => {
    const legacy = TRAINER_LEGACY_SLUGS[params.slug];
    if (legacy) throw redirect({ to: "/trainers/$slug", params: { slug: legacy } });
    const [visible, doorDraft] = params.slug
      ? await Promise.all([
          loadVisibleTrainerFn({ data: { slug: params.slug } }),
          getMagicTrainerFn().catch(() => null),
        ])
      : [null, null];
    const published = visible?.trainer ?? (params.slug ? getPublishedTrainer(params.slug) : undefined);
    if (!published) throw notFound();
    const access = visible?.access ?? "public";
    const [{ reviews, summary, ownStatus, ownComment, isOwner }, ratings, prices, media, place, contacts, catalog] = await Promise.all([
      listTrainerReviewsFn({ data: { slug: published.slug } }),
      listTrainerRatingSummariesFn(),
      listTrainerPricesFn(),
      getTrainerCertificatesFn({ data: { slug: published.slug } }),
      getTrainerAddressFn({ data: { slug: published.slug } }),
      getPublicTrainerContactsFn({ data: { slug: published.slug } }),
      listCatalogTrainersFn(),
    ]);
    const trainer = toTrainer(published, summary, reviews, ratings, prices, ownStatus ?? null, ownComment ?? null, media.certificates, catalog);
    return {
      trainer: {
        ...trainer,
        phone: contacts.phone,
        instagram: contacts.instagram,
        places: place.places,
        sessions: place.about,
      },
      isOwner,
      photos: media.photos,
      contacts,
      access,
      editor: doorDraft && doorDraft.slug === published.slug ? doorDraft : null,
    };
  },
  head: ({ loaderData }) => {
    const t = loaderData?.trainer;
    if (!t) return { meta: [{ title: "Тренер · Я ищу тренера на trenio.by" }, { name: "robots", content: "noindex, follow" }] };
    const seo = trainerSeoHead({
      slug: t.slug,
      name: t.name,
      sports: t.sports,
      sportDatives: t.sportDatives,
      intro: trainerIntroPhrase(t.sportRoles),
      primarySport: t.primarySport,
      city: t.city,
      about: [t.about[0] ?? "", t.sessions],
      rating: t.rating,
      photo: [...(loaderData?.photos ?? []), t.photo].map((item) => item.trim()).find(Boolean) ?? "",
      instagram: t.instagram,
      telegram: loaderData?.contacts?.telegram,
      places: t.places,
      priceLines: t.taxonomy.groups.flatMap((group) => group.items),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      index: (loaderData?.access ?? "public") === "public",
    });
    return seo;
  },
  validateSearch: (search: Record<string, unknown>): {
    sport?: string;
    mail?: string;
    door?: string;
    created?: 1;
  } => ({
    sport: typeof search.sport === "string" && /^[a-z0-9-]{1,30}$/.test(search.sport) ? search.sport : undefined,
    mail: typeof search.mail === "string" ? search.mail : undefined,
    door: typeof search.door === "string" ? search.door : undefined,
    created: search.created === "1" || search.created === 1 ? 1 : undefined,
  }),
  component: TrainerPage,
});

const CSS = `
.trainer-page { background: var(--light-bg); --aside-w: minmax(360px, 38%); }
.trainer-page__inner { padding-block: var(--layout-section-y) clamp(40px, 6vw, 72px); }

.breadcrumbs { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin: 0 0 24px; padding: 0; list-style: none; font-size: 13px; font-weight: var(--fw-title); color: var(--muted); }
.breadcrumbs a { color: var(--muted); text-decoration: none; }
.breadcrumbs a:hover { color: var(--primary-dark); }
.breadcrumbs li + li::before { content: "›"; margin-right: 8px; color: var(--line); }
.profile-access { display: flex; align-items: flex-start; gap: 10px; margin: 0 0 16px; padding: 12px 14px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 12px; background: rgba(var(--primary-rgb), 0.08); color: var(--dark); font-size: 14px; line-height: 1.45; }
.profile-access__icon { width: 20px; height: 20px; flex: 0 0 20px; margin-top: 0; color: var(--primary); }
.profile-access__icon svg { display: block; width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.profile-access__text { margin: 0; min-width: 0; }
.profile-access__open { display: inline; position: relative; margin: 0; padding: 0; border: 0; background: none; color: var(--primary); font: inherit; font-weight: var(--fw-title); line-height: inherit; text-decoration: underline; text-underline-offset: 3px; vertical-align: baseline; cursor: pointer; }
.profile-access__open::after { content: ""; position: absolute; left: -6px; right: -6px; top: 50%; height: 44px; transform: translateY(-50%); }

.profile-layout { display: grid; grid-template-columns: var(--aside-w) minmax(0, 1fr); gap: 32px; align-items: start; }
.profile-main { position: relative; display: grid; gap: 22px; min-width: 0; }
.profile-tools { position: absolute; top: 0; right: 0; z-index: 2; display: flex; }
.profile-main.has-tools .profile-identity { padding-right: 52px; }
.profile-main.has-tools:has(.profile-tools > :nth-child(2)) .profile-identity { padding-right: 96px; }
.profile-main.has-tools:has(.profile-tools > :nth-child(3)) .profile-identity { padding-right: 140px; }
.profile-aside { position: sticky; top: 96px; align-self: start; min-width: 0; }
.profile-aside__card { display: flex; flex-direction: column; border-radius: var(--card-radius); overflow: hidden; background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 14px 42px rgba(var(--dark-rgb),0.07); }

.photo-slider { position: relative; }
.photo-slider__frame { position: relative; aspect-ratio: 4/5; overflow: hidden; background: var(--white); }
.photo-slider__viewport { display: flex; width: 100%; height: 100%; overflow-x: auto; scroll-snap-type: x mandatory; scroll-behavior: smooth; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
.photo-slider__viewport::-webkit-scrollbar { display: none; }
.photo-slider__slide { flex: 0 0 100%; height: 100%; scroll-snap-align: start; scroll-snap-stop: always; }
.photo-slider__slide img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; user-select: none; }
.photo-slider__badge { position: absolute; top: 12px; left: 12px; z-index: 2; padding: 5px 10px; border-radius: 999px; background: rgba(255,255,255,0.94); color: var(--primary-dark); font-size: 11px; font-weight: var(--fw-title); letter-spacing: 0.02em; text-transform: uppercase; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.08); }
.profile-actions { position: absolute; top: 0; right: 0; z-index: 3; display: flex; flex-direction: column; gap: 0; opacity: 0.85; transition: opacity 0.18s ease; }
.photo-slider:hover .profile-actions,
.photo-slider:focus-within .profile-actions { opacity: 1; }
.photo-slider__nav { position: absolute; top: 50%; transform: translateY(-50%); width: 44px; height: 44px; border-radius: 50%; border: 0; background: rgba(255,255,255,0.82); color: rgba(17, 24, 39, 0.78); cursor: pointer; display: grid; place-items: center; box-shadow: 0 6px 18px rgba(var(--dark-rgb),0.06); z-index: 2; transition: color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease; }
.photo-slider__nav:hover, .photo-slider__nav:focus-visible { background: rgba(255,255,255,0.94); color: var(--dark); box-shadow: 0 8px 22px rgba(var(--primary-rgb), 0.16); }
.photo-slider__nav--prev { left: 10px; }
/* Four 44px actions plus gaps end at 210px. Keep the next arrow's center below that column. */
.photo-slider__nav--next { right: 10px; top: max(50%, 240px); }
.photo-slider__nav svg { width: 16px; height: 16px; stroke: currentColor; stroke-width: var(--icon-stroke); fill: none; stroke-linecap: round; stroke-linejoin: round; }
.photo-thumbs { display: flex; gap: 8px; margin: 0; padding: 10px 12px 12px; overflow-x: auto; scrollbar-width: none; -webkit-overflow-scrolling: touch; background: var(--white); list-style: none; }
.photo-thumbs::-webkit-scrollbar { display: none; }
.photo-thumbs button { width: 64px; height: 80px; flex: 0 0 auto; padding: 0; border: 2px solid transparent; border-radius: 10px; overflow: hidden; background: var(--neutral-bg); cursor: pointer; }
.photo-thumbs button.is-active { border-color: var(--primary); }
.photo-thumbs img { width: 100%; height: 100%; object-fit: cover; object-position: top center; display: block; }

.contact-panel { padding: 4px 18px 18px; background: var(--light-bg); }
.contact-prices { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px 14px; margin: 0 0 14px; }
.contact-prices[data-groups="1"] { grid-template-columns: minmax(0, 1fr); }
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
.profile-identity__sport { margin: 0 0 6px; font-size: 15px; font-weight: var(--fw-title); letter-spacing: -0.01em; text-transform: none; color: var(--primary-dark); }
.profile-identity__sport-name { color: var(--primary); }
.profile-identity__title { display: flex; align-items: flex-start; flex-wrap: nowrap; gap: 0 2px; margin: 0 0 12px; }
.profile-identity__name { min-width: 0; flex: 1 1 auto; margin: 0; font-size: var(--fs-page); font-weight: var(--fw-heading); letter-spacing: -0.035em; color: var(--dark); line-height: 1.05; }
.profile-identity__name .trainer-name { flex-direction: row; flex-wrap: wrap; align-items: baseline; column-gap: 0.28em; max-width: 100%; }
.profile-identity__name .trainer-name__line { width: min(100%, max-content); max-width: 100%; white-space: normal; overflow: visible; text-overflow: clip; overflow-wrap: anywhere; }
.profile-edit { width: 44px; height: 44px; display: grid; place-items: center; border: 0; padding: 0; background: transparent; border-radius: 50%; color: rgba(17, 24, 39, 0.72); font: inherit; text-decoration: none; cursor: pointer; transition: color 0.18s ease, background 0.18s ease; }
.profile-edit:hover { background: rgba(var(--primary-rgb), 0.08); color: var(--primary); }
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

.profile-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; min-width: 0; }
.profile-block { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-width: 0; }
.profile-copy { display: grid; gap: 8px; }
.profile-heading { margin: 0; font-size: 14px; font-weight: var(--fw-title); letter-spacing: 0.01em; text-transform: none; color: var(--muted); }
.profile-text { margin: 0; color: var(--text); font-size: 15px; line-height: 1.65; font-weight: 500; }
.profile-text + .profile-text { margin-top: 12px; }
.profile-text.review-html p + p { margin-top: 12px; }
.profile-taxonomy { display: grid; gap: 16px; margin: 0; padding: 0; list-style: none; }
.profile-taxonomy__group { display: grid; gap: 8px; }
.profile-taxonomy__tags { display: flex; flex-wrap: wrap; gap: 8px; }
.taxonomy-tag { padding: 7px 12px; border-radius: 999px; background: var(--light-bg); color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); line-height: 1.2; }
.taxonomy-tag--brand { background: var(--primary); color: var(--white); }
a.taxonomy-tag { text-decoration: none; cursor: pointer; transition: background-color 0.16s ease, color 0.16s ease; }
a.taxonomy-tag--brand:hover,
a.taxonomy-tag--brand:focus-visible { background: var(--primary-dark); color: var(--white); text-decoration: none; }
.profile-note { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.55; font-weight: 500; }
.profile-reach .trainer-contacts { margin-left: 0; gap: 4px; flex-wrap: wrap; max-width: 100%; min-width: 0; }
.profile-reach .trainer-contacts__link { width: 68px; height: 68px; opacity: 0.82; transition: opacity 0.18s ease, background 0.18s ease, color 0.18s ease; }
.profile-reach .trainer-contacts__link:hover, .profile-reach .trainer-contacts__link:focus-visible { opacity: 1; }
.profile-reach .trainer-contacts__link--line:not(.trainer-contacts__link--send):hover,
.profile-reach .trainer-contacts__link--line:not(.trainer-contacts__link--send):focus-visible { background: rgba(var(--primary-rgb), 0.08); }
.profile-reach .trainer-contacts__link svg { width: 34px; height: 34px; }
.profile-reach .trainer-contacts__link--send svg { overflow: hidden; }
.profile-reach .trainer-contacts__link--phone { width: auto; max-width: 100%; min-height: 44px; padding: 0 12px 0 8px; gap: 8px; border-radius: 999px; display: inline-flex; }
.profile-reach .trainer-contacts__phone { font-size: 16px; font-weight: var(--fw-body); letter-spacing: 0; line-height: 1.2; white-space: nowrap; }
@media (max-width: 767px) {
  .profile-reach .trainer-contacts { gap: 2px; }
  .profile-reach .trainer-contacts__link { width: 52px; height: 52px; }
  .profile-reach .trainer-contacts__link svg { width: 34px; height: 34px; }
  .profile-reach .trainer-contacts__link--phone { flex: 1 0 100%; width: auto; height: 48px; padding: 0 4px 0 0; justify-content: flex-start; }
}

.profile-spotlight { display: grid; grid-template-columns: auto minmax(0,1fr) auto; gap: 16px; align-items: center; padding: 18px 20px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb),0.06); box-shadow: 0 10px 32px rgba(var(--dark-rgb),0.05); }
.profile-spotlight__logo { width: 56px; height: 56px; border-radius: var(--radius-tile); background: var(--dark); color: var(--white); display: grid; place-items: center; font-size: 18px; font-weight: var(--fw-heading); letter-spacing: -0.04em; }
.profile-spotlight__title { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 4px; color: var(--dark); font-size: 16px; font-weight: var(--fw-title); text-decoration: none; }
.profile-spotlight__title:hover { color: var(--primary-dark); }
.profile-spotlight__meta { margin: 0; color: var(--muted); font-size: 13px; font-weight: 500; }
.profile-spotlight__action { padding: 10px 14px; border-radius: 999px; background: var(--neutral-bg); color: var(--dark); font-size: 13px; font-weight: var(--fw-ui); text-decoration: none; white-space: nowrap; }
.profile-spotlight__action:hover { background: var(--light-bg); color: var(--primary-dark); }

.review-list { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; min-width: 0; margin: 0; padding: 0; list-style: none; }
.review-item { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; min-width: 0; padding: 18px 20px; border-radius: var(--card-radius); background: var(--white); border: 1px solid rgba(var(--dark-rgb), 0.06); box-shadow: 0 10px 32px rgba(var(--dark-rgb), 0.05); }
.review-item__head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px 16px; }
.review-item__who { display: inline-flex; align-items: center; gap: 12px; min-width: 0; min-height: 44px; }
.review-item__pair { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 44px; min-width: 0; }
.review-item__author { font-size: 18px; font-weight: var(--fw-title); letter-spacing: -0.02em; line-height: 1.2; color: var(--dark); white-space: nowrap; }
a.review-item__author { display: inline-flex; align-items: center; min-height: 44px; color: inherit; text-decoration: none; }
a.review-item__author:hover,
a.review-item__author:focus-visible { color: var(--primary); }
.review-item__date { color: var(--muted); font-size: 12px; font-weight: var(--fw-ui); line-height: 40px; }
.review-item__stars { display: inline-flex; align-items: center; justify-content: center; gap: 2px; height: 40px; flex: 0 0 auto; }
.review-item__stars svg { width: 22px; height: 22px; display: block; fill: #ffb400; }
.review-item__stars svg.is-empty { fill: var(--line); }
.review-item__text { position: relative; margin: 0; padding: 2px 0 0 28px; color: var(--text); font-size: 15px; line-height: 1.6; font-weight: 500; }
.review-item__text::before { content: "«"; position: absolute; left: 0; top: -8px; color: var(--primary); font-size: 34px; font-weight: var(--fw-heading); line-height: 1; }
.review-excerpt { display: grid; justify-items: start; min-width: 0; }
.review-excerpt__more { display: inline-flex; align-items: center; min-height: 44px; margin-left: 28px; padding: 0; border: 0; background: transparent; color: var(--primary-dark); font: inherit; font-size: 14px; font-weight: var(--fw-title); cursor: pointer; }
.review-excerpt__more:hover { text-decoration: underline; }
.review-item__text.review-html p { margin: 0; }
.review-item__text.review-html p + p { margin-top: 0.35em; }
.review-item__text.review-html :is(ul, ol) { margin: 0.2em 0 0; }
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
.review-form__label { margin: 0; font-size: 14px; font-weight: var(--fw-title); color: var(--muted); }
.review-stars { display: flex; gap: 2px; }
.review-stars button { width: 44px; height: 44px; border: 0; border-radius: 12px; background: transparent; color: var(--line); cursor: pointer; display: grid; place-items: center; transition: color 0.12s ease, transform 0.12s ease; }
.review-stars button.is-on { color: #ffd800; }
.review-snippets { display: flex; flex-wrap: wrap; gap: 8px; }
.review-snippet { min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--line); background: var(--white); color: var(--dark); font: inherit; font-size: 14px; font-weight: var(--fw-ui); cursor: pointer; }
.review-snippet:hover { border-color: rgba(var(--primary-rgb), 0.35); color: var(--primary-dark); }
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
.review-form__error { margin: 0; color: var(--primary-dark); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.review-note { margin: 0; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }
.review-note a { color: var(--primary); font-weight: var(--fw-title); text-decoration: none; }
.review-note a:hover { text-decoration: underline; }
.profile-created__row { display: flex; align-items: center; gap: 12px; min-width: 0; }
.profile-created__row > div { min-width: 0; display: grid; gap: 2px; flex: 1; }
.profile-created__row strong { color: var(--dark); font-size: 16px; overflow-wrap: anywhere; }
.profile-created__row span { color: var(--muted); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.profile-created__edit { width: 44px; height: 44px; flex: 0 0 auto; display: grid; place-items: center; border-radius: 50%; color: var(--dark); text-decoration: none; }
.profile-created__edit:hover { color: var(--primary); }
.profile-created__edit svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: var(--icon-stroke); stroke-linecap: round; stroke-linejoin: round; }
.review-form__hint { margin: 6px 0 0; color: var(--muted); font-size: 13px; font-weight: var(--fw-body); line-height: 1.45; }


.similar-trainers { min-width: 0; padding-top: 8px; }
.similar-trainers__head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.similar-trainers__track { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--layout-gap); }
.similar-trainers .trainer-name { flex-direction: column; align-items: flex-start; gap: 0; }

@media (prefers-reduced-motion: reduce) {
  .photo-slider__viewport, .photo-thumbs { scroll-behavior: auto; }
}

@media (max-width: 960px) {
  .profile-layout { grid-template-columns: 1fr; gap: 22px; }
  .profile-aside { position: static; }
  .trainer-page__inner { padding-block: clamp(16px, 3vw, 20px) clamp(32px, 6vw, 56px); }
}
@media (max-width: 640px) {
  .profile-identity__name { font-size: 24px; }
  .similar-trainers__track { grid-template-columns: 1fr; }
}
@media (max-width: 359px) {
  .review-item__pair { flex-wrap: wrap; justify-content: flex-start; }
}
@media (max-width: 767px) {
  .similar-trainers__track { gap: 20px; }
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

const REVIEW_SNIPPETS = [
  "Объясняет спокойно и понятно.",
  "На занятии было комфортно.",
  "Техника стала лучше.",
  "Приду ещё.",
  "Рекомендую.",
];

function insertReviewSnippet(html: string, snippet: string) {
  const safe = snippet.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  if (!reviewPlainText(html)) return `<p>${safe}</p>`;
  if (/<\/p>\s*$/i.test(html)) return html.replace(/<\/p>\s*$/i, ` ${safe}</p>`);
  return `${html} ${safe}`;
}
const EDIT_ICON = "M12 20h8M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z";

function ReviewForm({ slug, onClose, onSent }: { slug: string; onClose: () => void; onSent: () => void }) {
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
            onSent();
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
        <div className="review-snippets" role="group" aria-label="Быстрые ответы">
          {REVIEW_SNIPPETS.map((snippet) => (
            <button
              key={snippet}
              type="button"
              className="review-snippet"
              onClick={() => {
                setText((current) => insertReviewSnippet(current, snippet));
                if (textError) setTextError(null);
              }}
            >
              {snippet}
            </button>
          ))}
        </div>
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

function CabinetCreatedDialog({ trainer, onClose }: { trainer: Trainer; onClose: () => void }) {
  const caption = trainer.sportLabel || trainer.city.label || "Страница профиля";
  return (
    <CabinetModal onClick={onClose}>
      <div
        className="cabinet-modal__card profile-created"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-created-title"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="profile-created-title">Ваш аккаунт активирован</h2>
        <p>Страница опубликована и уже видна другим пользователям. Вы можете редактировать собственный контент, фотографии, тексты и добавлять контакты.</p>
        <div className="profile-created__row">
          <UserAvatar name={trainer.name} src={trainer.photo || null} size={44} />
          <div>
            <strong>{trainer.name}</strong>
            <span>{caption}</span>
          </div>
          <Link className="profile-created__edit" to="/me/profile" aria-label="Редактировать профиль" title="Редактировать профиль">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
          </Link>
        </div>
        <button type="button" onClick={onClose}>Понятно</button>
      </div>
      <style>{`
        .cabinet-modal { position: fixed; inset: 0; z-index: 420; display: grid; place-items: center; overflow: auto; padding: max(16px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left)); background: rgba(var(--dark-rgb), 0.45); }
        .profile-created { box-sizing: border-box; width: min(440px, 100%); display: grid; gap: 12px; padding: 20px; border-radius: var(--card-radius); background: var(--white); color: var(--text); }
        .profile-created h2 { margin: 0; color: var(--dark); font-size: 22px; }
        .profile-created p { margin: 0; }
        .profile-created > button { justify-self: start; min-height: 44px; padding: 0 16px; border: 0; border-radius: 999px; background: var(--primary); color: #fff; font: inherit; font-weight: var(--fw-title); cursor: pointer; }
      `}</style>
    </CabinetModal>
  );
}

function TrainerPage() {
  const { trainer: t, isOwner, photos: storedPhotos, contacts, access, editor } = Route.useLoaderData() as {
    trainer: Trainer;
    isOwner: boolean;
    photos: string[];
    contacts: PublicTrainerContacts;
    access: "public" | "staff" | "preview" | "owner";
    editor: MagicTrainerDraft | null;
  };
  useEffect(() => {
    if (access !== "public") return;
    void recordTrainerProfileViewFn({ data: { slug: t.slug } });
  }, [access, t.slug]);
  const documentPhrase = trainerDocumentPhrase(t.sportDatives, t.city, t.name);
  const { user } = useRouteContext({ from: "__root__" });
  const [photoIdx, setPhotoIdx] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const thumbsRef = useRef<HTMLUListElement>(null);
  const [reviewsShown, setReviewsShown] = useState(5);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const ownNote = t.ownStatus === "rejected"
      ? "Отзыв отклонён"
      : t.ownStatus === "published"
        ? "Вы уже оставили отзыв"
        : null;
  const reviewLabel = t.reviews.length === 0 ? "Сделать первый отзыв" : "Добавить отзыв";
  const staff = Boolean(user && isStaff(user.roles));
  const { sport: fromSport } = Route.useSearch();
  const crumbSport = trainerBreadcrumbSport(
    { primarySport: t.primarySport, sports: t.sportRefs },
    fromSport,
  );
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const openingMail = new URLSearchParams(searchStr).get("mail");
  const magicDoor = Boolean(editor?.magicDoor) && !isOwner && !openingMail;
  const [mailOpen, setMailOpen] = useState(magicDoor);
  const doorMailKey = `trenio-door-mail-to:${t.slug}`;
  const [mailSentTo, setMailSentTo] = useState<string | null>(editor?.mailSentTo ?? null);
  const [mailChecked, setMailChecked] = useState(Boolean(editor?.mailSentTo));
  function rememberMail(email: string) {
    setMailSentTo(email);
    try { sessionStorage.setItem(doorMailKey, email); } catch { /* the open window already shows the address */ }
  }
  useEffect(() => {
    if (editor?.mailSentTo) {
      setMailSentTo(editor.mailSentTo);
      try { sessionStorage.setItem(doorMailKey, editor.mailSentTo); } catch { /* the server value stays on the page */ }
      setMailChecked(true);
      return;
    }
    if (editor?.magicDoor) {
      setMailSentTo((current) => {
        if (current) return current;
        try { sessionStorage.removeItem(doorMailKey); } catch { /* the form is shown from the server */ }
        return null;
      });
      setMailChecked(true);
      return;
    }
    let stored: string | null = null;
    try { stored = sessionStorage.getItem(doorMailKey); } catch { stored = null; }
    if (stored) setMailSentTo(stored);
    setMailChecked(true);
  }, [doorMailKey, editor]);
  const [mailError, setMailError] = useState("");
  const openMail = useAuthServerFn(openTrainerMailFn);
  const [createdOpen, setCreatedOpen] = useState(false);
  const createdAudience = isOwner || access === "owner";
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mail = params.get("mail") ?? "";
    const door = params.get("door") ?? "";
    if (!mail || !door) return;
    const key = `trenio-door-mail:${door}:${mail.slice(0, 16)}`;
    try {
      if (sessionStorage.getItem(key) === "1") return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* a second open is refused by the spent link */
    }
    void openMail({ data: { code: door, token: mail } })
      .then((result) => {
        const slug = result?.slug ?? "";
        if (!/^[a-z0-9._]{1,30}$/.test(slug)) {
          setMailError("Ссылка уже не действует.");
          return;
        }
        window.location.replace(result.needsPassword ? `/trainers/${slug}` : "/me/profile?created=1");
      })
      .catch((error: unknown) => {
        try {
          sessionStorage.removeItem(key);
        } catch {
          /* the message stays on the page */
        }
        setMailError(authErrorMessage(error) || "Ссылка уже не действует.");
      });
  }, [openMail]);
  useEffect(() => {
    if (!createdAudience || user?.needsDoorPassword) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("created") !== "1") return;
    setCreatedOpen(true);
  }, [createdAudience, user?.needsDoorPassword]);
  function closeCreated() {
    setCreatedOpen(false);
    const params = new URLSearchParams(window.location.search);
    params.delete("created");
    const query = params.toString();
    const next = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", next);
  }

  const photos = storedPhotos.length > 0 ? storedPhotos : [t.photo].filter(Boolean);
  const photoMove = useRef(0);
  const scrollMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" as const : "smooth" as const;
  function showPhoto(index: number) {
    const viewport = viewportRef.current;
    if (!viewport || photos.length === 0) return;
    const next = (index + photos.length) % photos.length;
    const left = next * viewport.clientWidth;
    const move = ++photoMove.current;
    setPhotoIdx(next);
    if (Math.abs(viewport.scrollLeft - left) <= 2) return;
    viewport.style.scrollSnapType = "none";
    const finish = () => {
      if (photoMove.current !== move) {
        viewport.removeEventListener("scrollend", finish);
        return;
      }
      if (Math.abs(viewport.scrollLeft - left) > 2) {
        viewport.scrollTo({ left, behavior: "auto" });
        return;
      }
      viewport.removeEventListener("scrollend", finish);
      viewport.style.scrollSnapType = "";
      photoMove.current = 0;
    };
    viewport.addEventListener("scrollend", finish);
    viewport.scrollTo({ left, behavior: scrollMotion() });
  }
  const hasRating = t.rating.reviewCount > 0;

  useEffect(() => {
    const track = thumbsRef.current;
    const thumb = track?.children[photoIdx] as HTMLElement | undefined;
    if (!track || !thumb) return;
    const start = thumb.offsetLeft;
    const end = start + thumb.offsetWidth;
    const visibleStart = track.scrollLeft;
    const visibleEnd = visibleStart + track.clientWidth;
    if (start >= visibleStart && end <= visibleEnd) return;
    const left = start - (track.clientWidth - thumb.offsetWidth) / 2;
    track.scrollTo({ left: Math.max(0, left), behavior: scrollMotion() });
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
        {mailError ? <p className="profile-access" role="alert">{mailError}</p> : null}
        {access === "public" ? null : (
          <p className="profile-access" role="status">
            <span className="profile-access__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M10.3 3.9 1.8 18.2A2 2 0 0 0 3.6 21h16.8a2 2 0 0 0 1.8-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </span>
            <span className="profile-access__text">
              {access === "preview" || access === "owner" ? (
                <>
                  Профиль пока не опубликован и в каталоге его нет.{" "}
                  {access === "owner"
                    ? "Страница видна только вам."
                    : "Страница открыта по уникальной ссылке и видна только вам."}
                  {magicDoor ? (
                    <>
                      {" "}
                      <button type="button" className="profile-access__open" onClick={() => setMailOpen(true)}>
                        Завершить создание кабинета
                      </button>
                    </>
                  ) : null}
                </>
              ) : "Профиль не опубликован. В каталоге его нет. Статус меняет тренер в настройках профиля: при входе туда он по умолчанию опубликован."}
            </span>
          </p>
        )}
        <nav aria-label="Хлебные крошки">
          <ol className="breadcrumbs">
            <li><Link to="/">Главная</Link></li>
            <li>
              {cityCatalogBySlug(t.city.slug) ? (
                <Link to="/city/$slug" params={{ slug: t.city.slug }} search={{ sports: undefined }}>Тренеры в {cityIn(t.city.slug, t.city.label)}</Link>
              ) : (
                <span>Тренеры в {cityIn(t.city.slug, t.city.label)}</span>
              )}
            </li>
            <li>
              {crumbSport.parentSlug === crumbSport.slug ? (
                <Link to="/categories/$slug" params={{ slug: crumbSport.slug }}>{crumbSport.label}</Link>
              ) : (
                <Link to="/categories/$parentSlug/$childSlug" params={{ parentSlug: crumbSport.parentSlug, childSlug: crumbSport.slug }}>{crumbSport.label}</Link>
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
                      if (!viewport || viewport.clientWidth === 0 || photoMove.current !== 0) return;
                      const next = Math.min(photos.length - 1, Math.max(0, Math.round(viewport.scrollLeft / viewport.clientWidth)));
                      setPhotoIdx((current) => current === next ? current : next);
                    }}
                  >
                    {photos.map((src, i) => (
                      <div key={src} className="photo-slider__slide">
                        <PhotoImage src={src} alt={i === 0 ? `${t.name} — ${documentPhrase}` : `${t.name} — фото ${i + 1}`} preset="profile" width={680} height={850} loading={i === 0 ? "eager" : "lazy"} />
                      </div>
                    ))}
                  </div>
                  {t.badge && <span className="photo-slider__badge">{t.badge}</span>}
                  <div className="profile-actions">
                    <AccountLikeButton slug={t.slug} className="trainer-card__like profile-like" />
                    <FavoriteButton target={{ type: "trainer", slug: t.slug }} className="trainer-card__save profile-save" />
                    <CardDirectLink slug={t.slug} className="trainer-card__write profile-write" />
                    <ShareProfileButton slug={t.slug} className="trainer-card__share profile-share" />
                  </div>
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
            </div>
          </aside>

          <div className={`profile-main${staff || isOwner || magicDoor ? " has-tools" : ""}`}>
            {staff || isOwner || magicDoor ? (
              <div className="profile-tools">
                {staff ? (
                  <Link className="profile-edit" to="/admin/trainers/$slug" params={{ slug: t.slug }} aria-label="Редактировать профиль" title="Редактировать профиль">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                  </Link>
                ) : null}
                {isOwner ? (
                  <Link className="profile-edit" to="/me/profile" aria-label="Редактировать свой профиль" title="Редактировать свой профиль">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                  </Link>
                ) : null}
                {magicDoor ? (
                  <button type="button" className="profile-edit" aria-haspopup="dialog" aria-label="Создать аккаунт" title="Создать аккаунт" onClick={() => setMailOpen(true)}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d={EDIT_ICON} /></svg>
                  </button>
                ) : null}
              </div>
            ) : null}
            <header className="profile-intro">
              <div className="profile-identity">
                {t.sportRoles.length > 0 ? (
                  <p className="profile-identity__sport">
                    Тренер{" "}
                    {t.sportRoles.every((role) => role.po) ? "по " : null}
                    {t.sportRoles.map((role, index) => {
                      const sep = index === 0 ? "" : index === t.sportRoles.length - 1 ? " и " : ", ";
                      const sharedPo = t.sportRoles.every((item) => item.po);
                      return (
                        <span key={`${role.text}-${index}`}>
                          {sep}
                          {!sharedPo && role.po ? "по " : ""}
                          <span className="profile-identity__sport-name">{role.text}</span>
                        </span>
                      );
                    })}
                  </p>
                ) : null}
                <div className="profile-identity__title">
                  <h1 className="profile-identity__name">
                    <TrainerName firstName={t.firstName} lastName={t.lastName} />
                  </h1>
                </div>
                <div className="profile-identity__meta">
                  <span className="profile-location">
                    <svg viewBox="0 0 24 24"><path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.4" /></svg>
                    {t.city.label}
                  </span>
                  {hasRating ? <div className="profile-rating" aria-label={`Рейтинг ${t.rating.value} из 5, ${t.rating.reviewCount} ${pluralRu(t.rating.reviewCount, "отзыв", "отзыва", "отзывов")}`}>
                    <Stars rating={parseFloat(t.rating.value)} />
                    <span className="profile-rating__score">{t.rating.value}</span>
                    <span className="profile-rating__counts">
                      (<a className="profile-rating__reviews-link" href="#reviews">{t.rating.reviewCount} {pluralRu(t.rating.reviewCount, "отзыв", "отзыва", "отзывов")}</a>)
                    </span>
                  </div> : null}
                </div>
              </div>
            </header>

            <div className="profile-body">
              <section className="profile-block">
                {reviewPlainText(t.about.join("")) ? (
                  <div className="profile-copy">
                    <h2 className="profile-heading">Обо мне</h2>
                    <ReviewHtml html={compactReviewHtml(t.about.join(""))} className="profile-text" />
                  </div>
                ) : null}
                {reviewPlainText(t.sessions) ? (
                  <div className="profile-copy">
                    <h2 className="profile-heading">О занятиях</h2>
                    <ReviewHtml html={compactReviewHtml(t.sessions)} className="profile-text" />
                  </div>
                ) : null}
                {t.certificates.length > 0 ? <TrainerDocuments items={t.certificates} /> : null}

                <ul className="profile-taxonomy" aria-label="Характеристики тренера">
                  {t.taxonomy.main.length > 0 ? (
                    <li className="profile-taxonomy__group">
                      <h2 className="profile-heading">Я тренирую</h2>
                      <div className="profile-taxonomy__tags">
                        {t.taxonomy.main.map((tag) => (
                          <TrainerSportLink
                            key={`${tag.parentSlug}-${tag.slug}`}
                            citySlug={t.city.slug}
                            sport={tag}
                            className="taxonomy-tag taxonomy-tag--brand"
                          />
                        ))}
                      </div>
                    </li>
                  ) : null}
                  {t.taxonomy.groups.map((g) => (
                    <li key={g.label} className="profile-taxonomy__group">
                      <h2 className="profile-heading">{g.label}</h2>
                      <div className="profile-taxonomy__tags">
                        {g.items.map((it) => (
                          <span key={it} className={`taxonomy-tag${g.brand ? " taxonomy-tag--brand" : ""}`}>{it}</span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>

                {t.note ? <p className="profile-note">{t.note}</p> : null}
              </section>

              {t.places.length > 0 ? <TrainerAddressMap places={t.places} /> : null}

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
                  {t.ownStatus === "pending" ? (
                    <p className="review-note">
                      Ваш <Link to="/account/reviews">отзыв</Link> на модерации
                      {t.ownComment ? `. ${t.ownComment}` : null}
                    </p>
                  ) : ownNote ? (
                    <p className="review-note">
                      {ownNote}{t.ownComment ? `. ${t.ownComment}` : null}
                    </p>
                  ) : isOwner ? null : magicDoor ? (
                    <button type="button" className="review-add" onClick={() => setMailOpen(true)}>
                      {reviewLabel}
                    </button>
                  ) : user ? (
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
                {hasRating ? <p className="profile-block__head-meta">{t.rating.value} из 5 · {t.rating.reviewCount} {pluralRu(t.rating.reviewCount, "отзыв", "отзыва", "отзывов")}</p> : null}
                {reviewFormOpen && user ? (
                  <ReviewForm slug={t.slug} onClose={() => setReviewFormOpen(false)} onSent={() => setReviewSent(true)} />
                ) : null}
                {t.reviews.length === 0 ? <p className="profile-text">Отзывов пока нет.</p> : <ul className="review-list">
                  {t.reviews.slice(0, reviewsShown).map((r) => (
                    <li key={r.id} className="review-item">
                      <div className="review-item__head">
                        <span className="review-item__who">
                          <UserAvatar name={r.author} src={r.avatarPath} />
                          <span className="review-item__pair">
                            {r.authorSlug ? (
                              <Link
                                className="review-item__author"
                                to="/trainers/$slug"
                                params={{ slug: r.authorSlug }}
                                title="Открыть профиль"
                              >
                                {r.author}
                              </Link>
                            ) : (
                              <span className="review-item__author">{r.author}</span>
                            )}
                            <ReviewStars rating={r.rating} />
                          </span>
                        </span>
                        <span className="review-item__date">{r.date}</span>
                      </div>
                      <ReviewExcerpt className="review-item__text" html={r.text} />
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
                        const trainerHasReplied = r.messages.some((message) => message.role === "trainer");
                        const trainerTurn = isOwner && last !== "trainer";
                        const authorTurn = r.isMine && !isOwner && trainerHasReplied && last === "trainer";
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

              <TrainerContactIcons
                slug={t.slug}
                phone={contacts.phone}
                telegram={contacts.telegram}
                instagram={contacts.instagram}
                heading="Как со мной связаться"
              />
            </div>

            {t.similar.length > 0 ? (
              <section className="similar-trainers" aria-labelledby="similar-heading">
                <div className="similar-trainers__head">
                  <h2 className="profile-heading" id="similar-heading">Похожие тренеры</h2>
                </div>
                <div className="similar-trainers__track">
                  {t.similar.map((trainer) => (
                    <CatalogTrainerCard key={trainer.slug} trainer={trainer} countImpression={false} />
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        </article>
        </div>
      </main>

      <SiteFooter />
      {user?.needsDoorPassword && !user.needsCredentials ? <DoorPasswordDialog /> : null}
      {createdOpen ? <CabinetCreatedDialog trainer={t} onClose={closeCreated} /> : null}
      {mailOpen && (mailSentTo || mailChecked) ? (
        <TrainerDoorMailDialog
          sentTo={mailSentTo}
          onRemember={rememberMail}
          onClose={() => setMailOpen(false)}
        />
      ) : null}
      {reviewSent ? (
        <CabinetNotice
          title="Ваш отзыв на модерации"
          message="Мы сначала проверим ваш отзыв, а потом опубликуем его."
          onClose={() => setReviewSent(false)}
        />
      ) : null}
    </div>
  );
}
