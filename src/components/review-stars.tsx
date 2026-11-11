const STAR_PATH = "M12 2l2.9 6.9 7.4.6-5.6 4.9 1.7 7.2L12 18.8 5.6 22.6l1.7-7.2L1.7 9.5l7.4-.6L12 2z";

/** Five filled stars, the same mark as a public review. Empty stars stay the line color. */
export function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="review-item__stars" aria-label={`Оценка ${rating} из 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg key={index} viewBox="0 0 24 24" className={index < rating ? undefined : "is-empty"} aria-hidden="true">
          <path d={STAR_PATH} />
        </svg>
      ))}
    </span>
  );
}

export { STAR_PATH };
