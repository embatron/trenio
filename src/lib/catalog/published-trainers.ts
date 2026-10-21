export type TrainerAudience = "adult" | "teen" | "kid";
export type TrainerFormat = "individual" | "group";

export const TRAINER_FORMAT_OPTIONS: Array<{ id: TrainerFormat; label: string }> = [
  { id: "individual", label: "Индивидуально" },
  { id: "group", label: "Группа" },
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
  photo: string;
  city: { slug: string; label: string };
  sports: PublishedSport[];
  primarySport: PublishedSport;
  bio: string;
  audiences: TrainerAudience[];
  formats: TrainerFormat[];
  phone: string;
  instagram: string;
  experience: number;
  district: string;
};

const MINSK = { slug: "minsk", label: "Минск" };

export const PUBLISHED_TRAINERS: PublishedTrainer[] = [
  {
    slug: "antipenko.training",
    name: "Владимир Антипенко",
    photo: "/trainers/instagram/antipenko.training.jpg",
    city: MINSK,
    sports: [
      { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
      { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
      { slug: "ofp", parentSlug: "ofp", label: "ОФП" },
    ],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    bio: "🙋🏻‍♂️Владимир 📍Минск 🥊Кикбоксинг и бокс 🏋🏻ОФП для любого уровня подготовки 📩Вопросы в ЛС @bronxgym.by",
    audiences: ["adult", "teen"],
    formats: [],
    phone: "+375 33 637-62-68",
    instagram: "https://www.instagram.com/antipenko.training/",
    experience: 0,
    district: "",
  },
  {
    slug: "levsha_team",
    name: "Сергей Овсяников",
    photo: "/trainers/instagram/levsha_team.jpg",
    city: MINSK,
    sports: [
      { slug: "tajskij-boks", parentSlug: "edinoborstva", label: "Тайский бокс" },
      { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    ],
    primarySport: { slug: "tajskij-boks", parentSlug: "edinoborstva", label: "Тайский бокс" },
    bio: "🥊Тренер по МуайТай и кикбоксингу в Минске 📍(Петровщина/Пушкина) 👉стаж 30 лет 🏆Мастер спорта по тайскому боксу 🏆Мастер спорта по рукопашному бою",
    audiences: [],
    formats: [],
    phone: "",
    instagram: "https://www.instagram.com/levsha_team/",
    experience: 30,
    district: "Петровщина",
  },
  {
    slug: "ar.boxing.by",
    name: "Артём Романович",
    photo: "/trainers/instagram/ar.boxing.by.jpg",
    city: MINSK,
    sports: [{ slug: "boks", parentSlug: "edinoborstva", label: "Бокс" }],
    primarySport: { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
    bio: "ТРЕНЕР ПО БОКСУ МИНСК проспект Пушкина 68а ▫️групповые и индивидуальные тренировки ▫️зал @bronxgym.by",
    audiences: [],
    formats: ["individual", "group"],
    phone: "+375 29 704-13-26",
    instagram: "https://www.instagram.com/ar.boxing.by/",
    experience: 0,
    district: "",
  },
  {
    slug: "farkhad_akhmejanau",
    name: "Farkhad Akhmejanau",
    photo: "/trainers/instagram/farkhad_akhmejanau.jpg",
    city: MINSK,
    sports: [{ slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" }],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    bio: "Тренер по кикбоксингу / Минск - Групповые/персональные занятия Prospekt Pushkina 68A, Minsk, Belarus 220002",
    audiences: [],
    formats: ["individual", "group"],
    phone: "",
    instagram: "https://www.instagram.com/farkhad_akhmejanau/",
    experience: 0,
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

export function audienceLabels(trainer: PublishedTrainer): string[] {
  const labels: Record<TrainerAudience, string> = {
    adult: "Взрослые",
    teen: "Подростки",
    kid: "Дети",
  };
  return trainer.audiences.map((audience) => labels[audience]);
}
