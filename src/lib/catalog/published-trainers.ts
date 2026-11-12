export type TrainerAudience = "adult" | "teen" | "kid";
export type TrainerFormat = "individual" | "group";

export const TRAINER_FORMAT_OPTIONS: Array<{ id: TrainerFormat; label: string }> = [
  { id: "individual", label: "Индивидуально" },
  { id: "group", label: "В группе" },
];

export const TRAINER_AUDIENCE_OPTIONS: Array<{ id: TrainerAudience; label: string }> = [
  { id: "adult", label: "Взрослые" },
  { id: "kid", label: "Дети" },
  { id: "teen", label: "Подростки" },
];

export type PublishedSport = {
  slug: string;
  parentSlug: string;
  label: string;
};

export type PublishedTrainer = {
  slug: string;
  name: string;
  firstName: string;
  lastName: string;
  photo: string;
  city: { slug: string; label: string };
  sports: PublishedSport[];
  primarySport: PublishedSport;
  bio: string;
  /** Line above the name. Empty until the sport formula or a person fills it. */
  headline?: string;
  audiences: TrainerAudience[];
  formats: TrainerFormat[];
  phone: string;
  instagram: string;
  telegram: string;
  email: string;
  experience: number;
  /** Price of one session, BYN. Two or three digits. */
  priceFrom: number;
  district: string;
  /** Filled card fields, 0–10. Present on a row loaded for the catalog. */
  cardFilled?: number;
  /** Filled contacts, 0–4. Present on a row loaded for the catalog. */
  contactsFilled?: number;
  /** ISO timestamps. Present on a row loaded from the database. */
  createdAt?: string;
  updatedAt?: string;
};

export const PUBLISHED_TRAINERS: PublishedTrainer[] = [];

export function getPublishedTrainer(slug: string): PublishedTrainer | undefined {
  return PUBLISHED_TRAINERS.find((trainer) => trainer.slug === slug);
}

export function trainersMatchingCategory(trainers: readonly PublishedTrainer[], categorySlug: string): PublishedTrainer[] {
  return trainers.filter((trainer) =>
    trainer.sports.some((sport) => sport.slug === categorySlug || sport.parentSlug === categorySlug),
  );
}

/** The sport crumb. The first sport stays, unless this visit names another sport on the card. */
export function trainerBreadcrumbSport(
  trainer: Pick<PublishedTrainer, "primarySport" | "sports">,
  fromSlug: string | null | undefined,
): PublishedSport {
  const requested = fromSlug?.trim() ?? "";
  if (!requested) return trainer.primarySport;
  return trainer.sports.find((sport) => sport.slug === requested) ?? trainer.primarySport;
}

/** Category pages this card appears on: each sport and its parent direction. */
export function trainerCategorySlugs(trainer: Pick<PublishedTrainer, "sports">): string[] {
  const slugs = new Set<string>();
  for (const sport of trainer.sports) {
    if (sport.slug) slugs.add(sport.slug);
    if (sport.parentSlug) slugs.add(sport.parentSlug);
  }
  return [...slugs];
}

/** Up to three other published cards from the same categories, in the catalog rank. */
export function similarTrainers(
  catalog: readonly PublishedTrainer[],
  trainer: PublishedTrainer,
  limit = 3,
  compare: (left: PublishedTrainer, right: PublishedTrainer) => number = () => 0,
): PublishedTrainer[] {
  const categories = trainerCategorySlugs(trainer);
  if (categories.length === 0) return [];
  const ranked = catalog.flatMap((item, index) => {
    if (item.slug === trainer.slug) return [];
    const sharesCategory = categories.some((slug) =>
      item.sports.some((sport) => sport.slug === slug || sport.parentSlug === slug),
    );
    return sharesCategory ? [{ item, index }] : [];
  });
  ranked.sort((left, right) => compare(left.item, right.item) || left.index - right.index);
  return ranked.slice(0, limit).map((row) => row.item);
}

export function trainersForCategory(categorySlug: string): PublishedTrainer[] {
  return trainersMatchingCategory(PUBLISHED_TRAINERS, categorySlug);
}

export function trainersForCity(citySlug: string): PublishedTrainer[] {
  return PUBLISHED_TRAINERS.filter((trainer) => trainer.city.slug === citySlug);
}

export function sportLine(trainer: PublishedTrainer): string {
  return trainer.sports.map((sport) => sport.label).join(", ");
}

/**
 * No audience means adults. Children and teens stay empty until the trainer sets them.
 * A list that already names an audience is kept as written, including a child-only list.
 */
export function effectiveAudiences(audiences: readonly TrainerAudience[]): TrainerAudience[] {
  if (audiences.length === 0) return ["adult"];
  return [...audiences];
}

/** «Для себя» is adults. «Для ребёнка» is children and teens together. */
export function matchesCatalogAudience(
  audiences: readonly TrainerAudience[],
  filter: "self" | "child" | "adult",
): boolean {
  const list = effectiveAudiences(audiences);
  if (filter === "child") return list.includes("kid") || list.includes("teen");
  return list.includes("adult");
}

export function audienceLabels(trainer: { audiences: readonly TrainerAudience[] }): string[] {
  const labels: Record<TrainerAudience, string> = {
    adult: "Взрослые",
    teen: "Подростки",
    kid: "Дети",
  };
  return effectiveAudiences(trainer.audiences).map((audience) => labels[audience]);
}
