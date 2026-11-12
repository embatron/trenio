import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { AccountLikeButton } from "@/components/account-like-button";
import { FavoriteButton } from "@/components/favorite-button";
import { CardDirectLink } from "@/components/messages/card-direct-link";
import { ShareProfileButton } from "@/components/share-profile";
import { PhotoImage } from "@/components/photo-image";
import { TrainerName } from "@/components/trainer-name";
import { TrainerPresenceMark } from "@/components/trainer-presence";
import { TrainerRating } from "@/components/trainer-rating";
import { trainerSportCityLocation } from "@/lib/catalog/catalog-sports";
import { noteTrainerCardImpression } from "@/lib/catalog/trainer-impression-client";
import { NEGOTIABLE_PRICE_LABEL, statedTrainerPrice } from "@/lib/catalog/trainer-price";

export type TrainerSportTag = {
  slug: string;
  parentSlug: string;
  label: string;
};

export type CatalogTrainerCardData = {
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  photo: string;
  tags: string[];
  /** Stored sports. The card shows the names as text. */
  sports?: TrainerSportTag[];
  desc: string;
  rating: string;
  reviews: number;
  /** Catalog points from 0 to 100. Used for order. Not shown on the card. */
  catalogScore?: number;
  city: string;
  citySlug?: string;
  district?: string;
  experience?: number;
  price?: number | null;
  badge?: string;
  phone?: string;
  instagram?: string;
  telegram?: string;
  email?: string;
};

export function CatalogTrainerCard({
  trainer,
  marked = false,
  countImpression = true,
  onHover,
  fromSport,
}: {
  trainer: CatalogTrainerCardData;
  marked?: boolean;
  countImpression?: boolean;
  onHover?: (slug: string | null) => void;
  /** Child sport of the list that opened this card. Omitted on a general list. */
  fromSport?: string;
}) {
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!countImpression) return;
    const node = cardRef.current;
    if (node && getComputedStyle(node).display === "none") return;
    noteTrainerCardImpression(trainer.slug);
  }, [countImpression, trainer.slug]);

  const price = statedTrainerPrice(trainer.price);
  return (
    <article
      ref={cardRef}
      className={`trainer-card${marked ? " is-marked" : ""}`}
      data-map-trainer={trainer.slug}
      onMouseEnter={onHover ? () => onHover(trainer.slug) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
    >
      <Link
        className="trainer-card__hit"
        to="/trainers/$slug"
        params={{ slug: trainer.slug }}
        search={{ sport: fromSport || undefined }}
        aria-label={trainer.name}
      />
      <div className="trainer-card__media">
        <PhotoImage className="trainer-card__photo" src={trainer.photo} alt={trainer.name} preset="card" width={480} height={600} loading="lazy" />
        {trainer.badge ? <span className="trainer-card__badge">{trainer.badge}</span> : null}
        <div className="trainer-card__actions">
          <AccountLikeButton slug={trainer.slug} className="trainer-card__like" />
          <FavoriteButton target={{ type: "trainer", slug: trainer.slug }} className="trainer-card__save" />
          <CardDirectLink slug={trainer.slug} className="trainer-card__write" />
          <ShareProfileButton slug={trainer.slug} className="trainer-card__share" />
        </div>
      </div>
      <div className="trainer-card__body">
        <div className="trainer-card__head">
          <h3 className="trainer-card__name">
            <TrainerName
              firstName={trainer.firstName}
              lastName={trainer.lastName}
              afterName={<TrainerPresenceMark slug={trainer.slug} linked />}
            />
          </h3>
          <TrainerRating rating={trainer.rating} reviews={trainer.reviews} />
        </div>
        <p className="trainer-card__sport">
          <TrainerSportTags sports={trainer.sports} tags={trainer.tags} />
        </p>
        <p className="trainer-card__price">
          {price != null ? (
            <>
              <small>От </small>
              {price} BYN
            </>
          ) : NEGOTIABLE_PRICE_LABEL}
        </p>
        <div className="trainer-card__footer">
          <span className="trainer-card__location">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
              <circle cx="12" cy="9" r="2.4" />
            </svg>
            <span>{trainer.city}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

export function TrainerSportLink({
  citySlug,
  sport,
  className,
}: {
  citySlug: string;
  sport: TrainerSportTag;
  className?: string;
}) {
  const location = trainerSportCityLocation(citySlug, sport);
  if (!location) return <span className={className}>{sport.label}</span>;
  if (location.to === "/city/$slug/$sport/$child") {
    return <Link className={className} to={location.to} params={location.params}>{sport.label}</Link>;
  }
  if (location.to === "/city/$slug/$sport") {
    return <Link className={className} to={location.to} params={location.params}>{sport.label}</Link>;
  }
  if (location.to === "/categories/$parentSlug/$childSlug") {
    return <Link className={className} to={location.to} params={location.params}>{sport.label}</Link>;
  }
  return <Link className={className} to={location.to} params={location.params}>{sport.label}</Link>;
}

function TrainerSportTags({
  sports,
  tags,
}: {
  sports: TrainerSportTag[] | undefined;
  tags: string[];
}) {
  const labels = (sports ?? []).map((sport) => sport.label.trim()).filter(Boolean);
  if (labels.length === 0) return tags.join(", ");
  return labels.join(", ");
}
