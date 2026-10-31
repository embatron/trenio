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
};

export const PUBLISHED_TRAINERS: PublishedTrainer[] = [];

export function getPublishedTrainer(slug: string): PublishedTrainer | undefined {
  return PUBLISHED_TRAINERS.find((trainer) => trainer.slug === slug);
}

export function trainersForCategory(categorySlug: string): PublishedTrainer[] {
  return PUBLISHED_TRAINERS.filter((trainer) =>
    trainer.sports.some((sport) => sport.slug === categorySlug || sport.parentSlug === categorySlug),
  );
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
