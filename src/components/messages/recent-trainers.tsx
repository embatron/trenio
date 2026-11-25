import { CatalogTrainerCard } from "@/components/catalog-trainer-card";
import type { PublishedTrainer } from "@/lib/catalog/published-trainers";
import { priceForCard, type TrainerPriceMap } from "@/lib/catalog/trainer-price";
import { ratingFor, type TrainerRatingSnapshot } from "@/lib/catalog/trainer-popularity";

/** Catalog cards for trainers this browser already opened, so a message can start here. */
export function RecentTrainers({
  trainers,
  ratings,
  prices,
}: {
  trainers: PublishedTrainer[];
  ratings: Record<string, TrainerRatingSnapshot>;
  prices: TrainerPriceMap;
}) {
  if (trainers.length === 0) return null;
  return (
    <section className="direct-recent" aria-label="Недавно смотрели">
      <p className="direct-empty">Сообщений пока нет</p>
      <h2>Недавно смотрели</h2>
      <div className="cat-grid">
        {trainers.map((trainer) => {
          const rating = ratingFor(trainer.slug, ratings);
          return (
            <CatalogTrainerCard
              key={trainer.slug}
              countImpression={false}
              trainer={{
                slug: trainer.slug,
                name: trainer.name,
                firstName: trainer.firstName,
                lastName: trainer.lastName,
                trusted: trainer.trusted === true,
                photo: trainer.photo,
                tags: trainer.sports.map((sport) => sport.label),
                sports: trainer.sports,
                desc: trainer.bio,
                rating: rating.rating,
                reviews: rating.reviews,
                city: trainer.city.label,
                citySlug: trainer.city.slug,
                district: trainer.district,
                experience: trainer.experience,
                price: priceForCard(trainer.slug, trainer.priceFrom, prices),
              }}
            />
          );
        })}
      </div>
    </section>
  );
}
