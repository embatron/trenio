import { Link } from "@tanstack/react-router";

import { FavoriteButton } from "@/components/favorite-button";
import { TrainerContactIcons } from "@/components/messages/trainer-contact-icons";
import { PhotoImage } from "@/components/photo-image";
import { TrainerName } from "@/components/trainer-name";
import { TrainerRating } from "@/components/trainer-rating";
import { pluralRu } from "@/lib/ru-plural";

export type CatalogTrainerCardData = {
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  photo: string;
  tags: string[];
  desc: string;
  rating: string;
  reviews: number;
  city: string;
  district?: string;
  experience?: number;
  price?: number;
  badge?: string;
};

export function CatalogTrainerCard({ trainer }: { trainer: CatalogTrainerCardData }) {
  const experience = trainer.experience ?? 0;
  const price = trainer.price ?? 0;
  return (
    <article className="trainer-card">
      <Link className="trainer-card__hit" to="/trainers/$slug" params={{ slug: trainer.slug }} aria-label={trainer.name} />
      <div className="trainer-card__media">
        <PhotoImage className="trainer-card__photo" src={trainer.photo} alt={trainer.name} preset="card" width={480} height={600} loading="lazy" />
        {trainer.badge ? <span className="trainer-card__badge">{trainer.badge}</span> : null}
        <FavoriteButton target={{ type: "trainer", slug: trainer.slug }} className="trainer-card__save" />
      </div>
      <div className="trainer-card__body">
        <div className="trainer-card__head">
          <h3 className="trainer-card__name">
            <TrainerName firstName={trainer.firstName} lastName={trainer.lastName} />
          </h3>
          <TrainerRating rating={trainer.rating} reviews={trainer.reviews} />
        </div>
        <p className="trainer-card__sport">
          {trainer.tags.join(", ")}
          {experience > 0 ? ` · опыт ${experience} ${pluralRu(experience, "год", "года", "лет")}` : ""}
        </p>
        {price > 0 ? (
          <p className="trainer-card__price">
            <small>от </small>
            {price} BYN
          </p>
        ) : null}
        <div className="trainer-card__footer">
          <span className="trainer-card__location">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12z" />
              <circle cx="12" cy="9" r="2.4" />
            </svg>
            <span>{trainer.city}</span>
          </span>
          <TrainerContactIcons slug={trainer.slug} />
        </div>
      </div>
    </article>
  );
}
