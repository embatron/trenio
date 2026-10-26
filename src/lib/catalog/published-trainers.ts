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

const MINSK = { slug: "minsk", label: "Минск" };

export const PUBLISHED_TRAINERS: PublishedTrainer[] = [
  {
    slug: "antipenko.training",
    name: "Владимир Антипенко",
    firstName: "Владимир",
    lastName: "Антипенко",
    photo: "/trainers/instagram/antipenko.training.jpg",
    city: MINSK,
    sports: [
      { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
      { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
      { slug: "ofp", parentSlug: "fitnes", label: "ОФП" },
    ],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    bio: "🙋🏻‍♂️Владимир 📍Минск 🥊Кикбоксинг и бокс 🏋🏻ОФП для любого уровня подготовки 📩Вопросы в ЛС @bronxgym.by",
    audiences: ["adult", "teen"],
    formats: [],
    phone: "+375 33 637-62-68",
    instagram: "https://www.instagram.com/antipenko.training/",
    telegram: "https://t.me/antipenko_training",
    email: "",
    experience: 0,
    priceFrom: 35,
    district: "",
  },
  {
    slug: "levsha_team",
    name: "Сергей Овсяников",
    firstName: "Сергей",
    lastName: "Овсяников",
    photo: "/trainers/instagram/levsha_team.jpg",
    city: MINSK,
    sports: [
      { slug: "tajskij-boks", parentSlug: "edinoborstva", label: "Тайский бокс" },
      { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    ],
    primarySport: { slug: "tajskij-boks", parentSlug: "edinoborstva", label: "Тайский бокс" },
    bio: "🥊Тренер по МуайТай и кикбоксингу в Минске 📍(Петровщина/Пушкина) 👉стаж 30 лет 🏆Мастер спорта по тайскому боксу 🏆Мастер спорта по рукопашному бою",
    audiences: ["adult"],
    formats: [],
    phone: "",
    instagram: "https://www.instagram.com/levsha_team/",
    telegram: "https://t.me/levsha_team",
    email: "",
    experience: 30,
    priceFrom: 80,
    district: "Петровщина",
  },
  {
    slug: "ar.boxing.by",
    name: "Артём Романович",
    firstName: "Артём",
    lastName: "Романович",
    photo: "/trainers/instagram/ar.boxing.by.jpg",
    city: MINSK,
    sports: [{ slug: "boks", parentSlug: "edinoborstva", label: "Бокс" }],
    primarySport: { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
    bio: "ТРЕНЕР ПО БОКСУ МИНСК проспект Пушкина 68а ▫️групповые и индивидуальные тренировки ▫️зал @bronxgym.by",
    audiences: ["adult"],
    formats: ["individual", "group"],
    phone: "+375 29 704-13-26",
    instagram: "https://www.instagram.com/ar.boxing.by/",
    telegram: "",
    email: "",
    experience: 0,
    priceFrom: 45,
    district: "",
  },
  {
    slug: "farkhad_akhmejanau",
    name: "Farkhad Akhmejanau",
    firstName: "Farkhad",
    lastName: "Akhmejanau",
    photo: "/trainers/instagram/farkhad_akhmejanau.jpg",
    city: MINSK,
    sports: [{ slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" }],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    bio: "Тренер по кикбоксингу / Минск - Групповые/персональные занятия Prospekt Pushkina 68A, Minsk, Belarus 220002",
    audiences: ["adult"],
    formats: ["individual", "group"],
    phone: "",
    instagram: "https://www.instagram.com/farkhad_akhmejanau/",
    telegram: "",
    email: "",
    experience: 0,
    priceFrom: 120,
    district: "",
  },
  {
    slug: "shum_ann",
    name: "Аня Шумилова",
    firstName: "Аня",
    lastName: "Шумилова",
    photo: "/trainers/instagram/shum_ann.jpg",
    city: MINSK,
    sports: [
      { slug: "ofk", parentSlug: "reabilitaciya", label: "ОФК" },
      { slug: "lfk", parentSlug: "reabilitaciya", label: "ЛФК" },
    ],
    primarySport: { slug: "ofk", parentSlug: "reabilitaciya", label: "ОФК" },
    bio: "Тренирую в Минске и онлайн: ОФК и ЛФК. Инструктор-методист по оздоровительной физической культуре, магистр физической культуры и спорта.",
    audiences: ["adult"],
    formats: ["individual"],
    phone: "",
    instagram: "https://www.instagram.com/shum_ann/",
    telegram: "",
    email: "",
    experience: 10,
    priceFrom: 55,
    district: "",
  },
];

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
