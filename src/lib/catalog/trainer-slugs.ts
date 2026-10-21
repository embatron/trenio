/** Instagram handle is the public trainer URL and the account nick. */
export function instagramProfileSlug(handle: string) {
  return handle.trim().toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30);
}

/** Retired name slugs → the imported Instagram handle. */
export const TRAINER_LEGACY_SLUGS: Record<string, string> = {
  "vladimir-antipenko": "antipenko.training",
  ovsyannikov: "levsha_team",
  "artem-romanovich": "ar.boxing.by",
  akhmejanau: "farkhad_akhmejanau",
  shumilova: "shum_ann",
};
