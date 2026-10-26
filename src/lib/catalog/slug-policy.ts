/**
 * Public catalog slugs. See `.cursor/rules/url-slugs.mdc`.
 * Old slugs stay here so existing links resolve to the canonical path.
 */
export type CatalogSlugTarget = {
  parentSlug: string;
  childSlug?: string;
};

export const SLUG_MAX_LENGTH = 18;

/** Previous slug → canonical category path. Keys are the retired segment only. */
export const LEGACY_CATALOG_SLUGS: Record<string, CatalogSlugTarget> = {
  "fitnes-i-trenirovki-v-zale": { parentSlug: "fitnes" },
  "ofp-i-sportivnaya-podgotovka": { parentSlug: "fitnes", childSlug: "ofp" },
  ofp: { parentSlug: "fitnes", childSlug: "ofp" },
  "yoga-pilates-i-rastyazhka": { parentSlug: "yoga" },
  "plavanie-i-vodnye-trenirovki": { parentSlug: "plavanie" },
  "futbol-i-komandnye-igry": { parentSlug: "komandnye" },
  "tennis-i-igry-s-raketkoy": { parentSlug: "raketki" },
  "beg-i-legkaya-atletika": { parentSlug: "beg" },
  "tancy-i-horeografiya": { parentSlug: "tancy" },
  "gimnastika-i-akrobatika": { parentSlug: "gimnastika" },
  "zimnie-vidy-sporta": { parentSlug: "zima" },
  "velosport-roliki-i-skeyt": { parentSlug: "velo" },
  "reabilitaciya-i-vosstanovlenie": { parentSlug: "reabilitaciya" },
  "outdoor-i-aktivnyj-sport": { parentSlug: "outdoor" },
  "intellektualnyj-sport": { parentSlug: "intellekt" },

  "personalnyj-fitnes": { parentSlug: "fitnes", childSlug: "trenazhernyj-zal" },
  personalnyj: { parentSlug: "fitnes", childSlug: "trenazhernyj-zal" },
  "silovye-trenirovki": { parentSlug: "fitnes", childSlug: "trenazhernyj-zal" },
  silovye: { parentSlug: "fitnes", childSlug: "trenazhernyj-zal" },
  funkcional: { parentSlug: "fitnes", childSlug: "krossfit" },
  "funkcionalnyj-trening": { parentSlug: "fitnes", childSlug: "krossfit" },
  "kardio-trenirovki": { parentSlug: "fitnes", childSlug: "trenazhernyj-zal" },
  kardio: { parentSlug: "fitnes", childSlug: "trenazhernyj-zal" },
  trx: { parentSlug: "fitnes", childSlug: "krossfit" },
  "atleticheskaya-podgotovka": { parentSlug: "fitnes", childSlug: "ofp" },
  atletika: { parentSlug: "beg", childSlug: "legkaya-atletika" },
  "sportivnaya-podgotovka": { parentSlug: "fitnes", childSlug: "ofp" },
  sportsmeny: { parentSlug: "fitnes", childSlug: "ofp" },
  "podgotovka-k-sorevnovaniyam": { parentSlug: "fitnes", childSlug: "ofp" },
  sorevnovaniya: { parentSlug: "fitnes", childSlug: "ofp" },
  "skorostno-silovaya-podgotovka": { parentSlug: "fitnes", childSlug: "ofp" },
  "skorost-sila": { parentSlug: "fitnes", childSlug: "ofp" },
  sfp: { parentSlug: "fitnes", childSlug: "ofp" },
  normativy: { parentSlug: "fitnes", childSlug: "ofp" },
  "sustavnaya-gimnastika": { parentSlug: "yoga", childSlug: "stretching" },
  sustavy: { parentSlug: "yoga", childSlug: "stretching" },
  "dyhatelnye-praktiki": { parentSlug: "yoga", childSlug: "stretching" },
  dyhanie: { parentSlug: "yoga", childSlug: "stretching" },
  massazh: { parentSlug: "reabilitaciya", childSlug: "massazh" },
  osanka: { parentSlug: "reabilitaciya", childSlug: "osanka" },
  "zdorovaya-spina": { parentSlug: "yoga", childSlug: "stretching" },
  mobility: { parentSlug: "yoga", childSlug: "stretching" },
  mfr: { parentSlug: "yoga", childSlug: "stretching" },
  "obuchenie-plavaniyu": { parentSlug: "plavanie", childSlug: "plavanie" },
  obuchenie: { parentSlug: "plavanie", childSlug: "plavanie" },
  "sportivnoe-plavanie": { parentSlug: "plavanie", childSlug: "plavanie" },
  sportivnoe: { parentSlug: "plavanie", childSlug: "plavanie" },
  akvafitnes: { parentSlug: "plavanie", childSlug: "akvaaerobika" },
  "sinhronnoe-plavanie": { parentSlug: "plavanie", childSlug: "sinhronnoe" },
  "pryzhki-v-vodu": { parentSlug: "plavanie", childSlug: "pryzhki" },
  kayaking: { parentSlug: "plavanie", childSlug: "kayaking" },
  sup: { parentSlug: "plavanie", childSlug: "sup" },
  "sportivnaya-hodba": { parentSlug: "beg", childSlug: "legkaya-atletika" },
  hodba: { parentSlug: "beg", childSlug: "legkaya-atletika" },
  "tehnika-bega": { parentSlug: "beg", childSlug: "beg" },
  "srednie-distancii": { parentSlug: "beg", childSlug: "beg" },
  "dlinnye-distancii": { parentSlug: "beg", childSlug: "beg" },
  marafon: { parentSlug: "beg", childSlug: "beg" },
  "sovremennye-tancy": { parentSlug: "tancy", childSlug: "sovremennye" },
  "balnye-tancy": { parentSlug: "tancy", childSlug: "balnye" },
  latina: { parentSlug: "tancy", childSlug: "balnye" },
  zumba: { parentSlug: "tancy", childSlug: "sovremennye" },
  "detskaya-horeografiya": { parentSlug: "tancy", childSlug: "deti" },
  "klassicheskaya-horeografiya": { parentSlug: "tancy", childSlug: "klassika" },
  "sportivnaya-gimnastika": { parentSlug: "gimnastika", childSlug: "sportivnaya" },
  "hudozhestvennaya-gimnastika": { parentSlug: "gimnastika", childSlug: "hudozhestvennaya" },
  "detskaya-gimnastika": { parentSlug: "gimnastika", childSlug: "detskaya" },
  parkur: { parentSlug: "outdoor", childSlug: "parkur" },
  "konkobezhnyj-sport": { parentSlug: "zima", childSlug: "konki" },
  "shossejnyj-velosport": { parentSlug: "velo", childSlug: "velosiped" },
  shosse: { parentSlug: "velo", childSlug: "velosiped" },
  mtb: { parentSlug: "velo", childSlug: "velosiped" },
  velosport: { parentSlug: "velo", childSlug: "velosiped" },
  "posttravmaticheskoe-vosstanovlenie": { parentSlug: "reabilitaciya", childSlug: "posttravma" },
  "korrekcionnyj-fitnes": { parentSlug: "reabilitaciya" },
  korrekciya: { parentSlug: "reabilitaciya" },
  "adaptivnyj-fitnes": { parentSlug: "reabilitaciya" },
  adaptivnyj: { parentSlug: "reabilitaciya" },
  kineziterapiya: { parentSlug: "reabilitaciya" },
  "zdorovaya-spina-rehab": { parentSlug: "yoga", childSlug: "stretching" },
  spina: { parentSlug: "yoga", childSlug: "stretching" },
  "mfr-rehab": { parentSlug: "yoga", childSlug: "stretching" },
  "trenirovki-50-plus": { parentSlug: "reabilitaciya" },
  "50-plus": { parentSlug: "reabilitaciya" },
  "pohodnaya-podgotovka": { parentSlug: "outdoor", childSlug: "pohod" },
  turizm: { parentSlug: "outdoor", childSlug: "pohod" },
  skalodrom: { parentSlug: "outdoor", childSlug: "skalolazanie" },
  "sportivnyj-bridzh": { parentSlug: "intellekt", childSlug: "bridzh" },
};

/** Returns the canonical path when `parentSlug` / `childSlug` still use a retired segment. */
export function canonicalCategoryPath(
  parentSlug: string,
  childSlug?: string,
): CatalogSlugTarget | null {
  const parentAlias = LEGACY_CATALOG_SLUGS[parentSlug];
  const childAlias = childSlug ? LEGACY_CATALOG_SLUGS[childSlug] : undefined;

  const nextParent = childAlias?.parentSlug ?? parentAlias?.parentSlug ?? parentSlug;
  // A retired child with no childSlug folds into the parent page.
  const nextChild = childSlug
    ? childAlias
      ? childAlias.childSlug
      : childSlug
    : parentAlias?.childSlug;

  if (nextParent === parentSlug && nextChild === childSlug) return null;
  return nextChild ? { parentSlug: nextParent, childSlug: nextChild } : { parentSlug: nextParent };
}
