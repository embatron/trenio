/** Settlement shown on the public card. An import with no street and no settlement is Minsk. */
export function publicTrainerCityLabel(row: {
  city: string;
  createdSource: string;
  address: string | null;
  trainingPlaces: Array<{ city?: string; address?: string; district?: string }> | null;
}): string {
  const stored = row.city.trim();
  if (stored) return stored;
  if (row.createdSource !== "import") return "";
  if ((row.address ?? "").trim()) return "";
  const placed = (row.trainingPlaces ?? []).some((place) =>
    (place.city ?? "").trim() || (place.address ?? "").trim() || (place.district ?? "").trim(),
  );
  return placed ? "" : "Минск";
}
