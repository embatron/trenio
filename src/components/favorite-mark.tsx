/** Outline bookmark. The favorite mark on cards, the profile, and the header. */
export const FAVORITE_BOOKMARK =
  "M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z";

export function FavoriteMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={FAVORITE_BOOKMARK} />
    </svg>
  );
}
