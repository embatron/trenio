import { pluralRu } from "@/lib/ru-plural";

export function TrainerRating({ rating, reviews }: { rating: string; reviews: number }) {
  const empty = reviews <= 0;
  const label = empty
    ? "Пока нет отзывов, 0 голосов"
    : `Рейтинг ${rating} из 5, ${reviews} ${pluralRu(reviews, "отзыв", "отзыва", "отзывов")}`;
  return (
    <span className={`trainer-card__rating${empty ? " trainer-card__rating--empty" : ""}`} aria-label={label}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z" />
      </svg>
      {empty ? null : rating}
      <span>({reviews})</span>
    </span>
  );
}
