/** Instagram handle is the public trainer URL and the account nick. */
export function instagramProfileSlug(handle: string) {
  return handle.trim().toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
}

/**
 * One person, one slug. Both names are required: a given name alone
 * matches too many trainers. The same slug is an update, not a second card.
 */
export function trainerPersonKey(firstName: string, lastName: string): string | null {
  const fold = (value: string) => value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
  const first = fold(firstName);
  const last = fold(lastName);
  if (first.length < 2 || last.length < 2) return null;
  return `${first}|${last}`;
}

/** Retired name slugs → the imported Instagram handle. */
export const TRAINER_LEGACY_SLUGS: Record<string, string> = {
  "vladimir-antipenko": "antipenko.training",
  ovsyannikov: "levsha_team",
  "artem-romanovich": "ar.boxing.by",
  akhmejanau: "farkhad_akhmejanau",
  shumilova: "shum_ann",
};
