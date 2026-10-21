import { Link } from "@tanstack/react-router";

import { FavoriteButton } from "@/components/favorite-button";
import { TrainerRating } from "@/components/trainer-rating";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import { ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import { countRu } from "@/lib/ru-plural";

type FavoriteCard = {
  type: "trainer" | "club";
  slug: string;
  name: string;
  photo: string;
  line: string;
  city: string;
  rating: string;
  reviews: number;
  missing: boolean;
};

function toCard(key: string, ratings: Record<string, TrainerRatingSnapshot>): FavoriteCard {
  const splitAt = key.indexOf(":");
  const type = key.slice(0, splitAt) === "club" ? "club" : "trainer";
  const slug = key.slice(splitAt + 1);
  if (type === "trainer") {
    const trainer = getPublishedTrainer(slug);
    const rating = ratingFor(slug, ratings);
    if (!trainer) {
      return { type, slug, name: slug, photo: "", line: "Тренер снят с каталога", city: "", rating: "0", reviews: 0, missing: true };
    }
    return {
      type,
      slug,
      name: trainer.name,
      photo: trainer.photo,
      line: trainer.sports.map((sport) => sport.label).join(", "),
      city: trainer.district ? `${trainer.city.label}, ${trainer.district}` : trainer.city.label,
      rating: rating.rating,
      reviews: rating.reviews,
      missing: false,
    };
  }
  return { type, slug, name: slug, photo: "", line: "Клуб", city: "", rating: "0", reviews: 0, missing: true };
}

export function FavoriteCards({
  keys,
  ratings,
}: {
  keys: string[];
  ratings: Record<string, TrainerRatingSnapshot>;
}) {
  const cards = keys.map((key) => toCard(key, ratings));
  const trainers = cards.filter((card) => card.type === "trainer" && !card.missing);
  const rest = cards.filter((card) => card.missing || card.type === "club");

  if (cards.length === 0) {
    return (
      <article className="cabinet-card">
        <h2>Избранное</h2>
        <p className="cabinet-empty">
          Нажмите сердечко на карточке тренера, и он останется здесь.{" "}
          <Link className="cabinet-inline-link" to="/">Смотреть тренеров</Link>
        </p>
      </article>
    );
  }

  return (
    <>
      <p className="cabinet-note">{countRu(cards.length, "сохранённая карточка", "сохранённые карточки", "сохранённых карточек")}</p>
      {trainers.length > 0 ? (
        <div className="trainer-grid">
          {trainers.map((card) => (
            <Link key={`${card.type}:${card.slug}`} className="trainer-card" to="/trainers/$slug" params={{ slug: card.slug }}>
              <div className="trainer-card__media">
                <img className="trainer-card__photo" src={card.photo} alt={card.name} width={480} height={600} />
                <FavoriteButton target={{ type: card.type, slug: card.slug }} className="trainer-card__save" />
              </div>
              <div className="trainer-card__body">
                <div className="trainer-card__head">
                  <h2 className="trainer-card__name">{card.name}</h2>
                  <TrainerRating rating={card.rating} reviews={card.reviews} />
                </div>
                <p className="trainer-card__sport">{card.line}</p>
                <p className="trainer-card__location">{card.city}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
      {rest.length > 0 ? (
        <ul className="favorites-missing">
          {rest.map((card) => (
            <li key={`${card.type}:${card.slug}`}>
              <div>
                <strong>{card.name}</strong>
                <span>{card.line}</span>
              </div>
              <FavoriteButton target={{ type: card.type, slug: card.slug }} className="trainer-card__save favorites-missing__save" />
            </li>
          ))}
        </ul>
      ) : null}
      <style>{`
        .favorites-missing { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .favorites-missing li { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); }
        .favorites-missing strong { display: block; color: var(--dark); }
        .favorites-missing span { color: var(--muted); font-size: 13px; }
        .favorites-missing__save { position: static; width: 44px; height: 44px; }
      `}</style>
    </>
  );
}
