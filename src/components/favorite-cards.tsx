import { Link } from "@tanstack/react-router";

import { CatalogTrainerCard } from "@/components/catalog-trainer-card";
import { FavoriteButton } from "@/components/favorite-button";
import { TablePager, useTablePage } from "@/components/table-pager";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import { ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";
import { priceForCard, type TrainerPriceMap } from "@/lib/catalog/trainer-price";
type FavoriteCard = {
  type: "trainer" | "club";
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  photo: string;
  line: string;
  desc: string;
  city: string;
  district?: string;
  tags?: string[];
  experience?: number;
  price?: number | null;
  rating: string;
  reviews: number;
  missing: boolean;
};

function toCard(key: string, ratings: Record<string, TrainerRatingSnapshot>, prices: TrainerPriceMap): FavoriteCard {
  const splitAt = key.indexOf(":");
  const type = key.slice(0, splitAt) === "club" ? "club" : "trainer";
  const slug = key.slice(splitAt + 1);
  if (type === "trainer") {
    const trainer = getPublishedTrainer(slug);
    const rating = ratingFor(slug, ratings);
    if (!trainer) {
      return { type, slug, name: slug, firstName: slug, lastName: "", photo: "", line: "Тренер снят с каталога", desc: "", city: "", rating: "0", reviews: 0, missing: true };
    }
    return {
      type,
      slug,
      name: trainer.name,
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      photo: trainer.photo,
      line: trainer.sports.map((sport) => sport.label).join(", "),
      desc: trainer.bio,
      city: trainer.city.label,
      district: trainer.district,
      tags: trainer.sports.map((sport) => sport.label),
      experience: trainer.experience,
      price: priceForCard(trainer.slug, trainer.priceFrom, prices),
      rating: rating.rating,
      reviews: rating.reviews,
      missing: false,
    };
  }
  return { type, slug, name: slug, firstName: slug, lastName: "", photo: "", line: "Клуб", desc: "", city: "", rating: "0", reviews: 0, missing: true };
}

export function FavoriteCards({
  keys,
  ratings,
  prices = {},
}: {
  keys: string[];
  ratings: Record<string, TrainerRatingSnapshot>;
  prices?: TrainerPriceMap;
}) {
  const cards = keys.map((key) => toCard(key, ratings, prices));
  const pager = useTablePage(cards);
  const pageCards = pager.rows;
  const trainers = pageCards.filter((card) => card.type === "trainer" && !card.missing);
  const rest = pageCards.filter((card) => card.missing || card.type === "club");

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
    <article className="cabinet-card">
      <h2>Избранное</h2>
      {trainers.length > 0 ? (
        <div className="favorites-grid">
          {trainers.map((card) => (
            <CatalogTrainerCard
              key={`${card.type}:${card.slug}`}
              trainer={{
                slug: card.slug,
                name: card.name,
                firstName: card.firstName,
                lastName: card.lastName,
                photo: card.photo,
                tags: card.tags ?? [],
                desc: card.desc,
                rating: card.rating,
                reviews: card.reviews,
                city: card.city,
                district: card.district,
                experience: card.experience,
                price: card.price,
              }}
            />
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
      <TablePager page={pager.page} pages={pager.pages} total={pager.total} from={pager.from} to={pager.to} onPage={pager.setPage} />
      <style>{`
        .cabinet-card .favorites-missing { margin: 0 18px 16px; }
        .favorites-missing { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
        .favorites-missing li { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; padding: 14px 16px; border: 1px solid var(--line); border-radius: var(--card-radius); background: var(--white); }
        .favorites-missing strong { display: block; color: var(--dark); }
        .favorites-missing span { color: var(--muted); font-size: 13px; }
        .favorites-missing__save { position: static; width: 44px; height: 44px; }
      `}</style>
    </article>
  );
}
