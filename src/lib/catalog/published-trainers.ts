export type TrainerAudience = "adult" | "teen" | "kid";
export type TrainerFormat = "individual" | "group";

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
    slug: "vladimir-antipenko",
    name: "Владимир Антипенко",
    photo: "/trainers/instagram/antipenko.training.jpg",
    city: MINSK,
    sports: [
      { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
      { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
      { slug: "ofp", parentSlug: "ofp", label: "ОФП" },
    ],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    bio: "Кикбоксинг и бокс, ОФП для любого уровня подготовки. Минск. Запись: +375 33 637-62-68. Зал @bronxgym.by.",
    audiences: ["adult", "teen"],
    formats: [],
    phone: "+375 33 637-62-68",
    instagram: "https://www.instagram.com/antipenko.training/",
    experience: 0,
    district: "",
  },
  {
    slug: "ovsyannikov",
    name: "Сергей Овсянников",
    photo: "/trainers/instagram/levsha_team.jpg",
    city: MINSK,
    sports: [
      { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
      { slug: "tajskij-boks", parentSlug: "edinoborstva", label: "Тайский бокс" },
    ],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    bio: "Тренер по муай-тай и кикбоксингу в Минске (Петровщина, проспект Пушкина). Стаж 30 лет. Мастер спорта по тайскому боксу и по рукопашному бою.",
    audiences: [],
    formats: [],
    phone: "",
    instagram: "https://www.instagram.com/levsha_team/",
    experience: 30,
    district: "Петровщина",
  },
  {
    slug: "artem-romanovich",
    name: "Артём Романович",
    photo: "/trainers/instagram/ar.boxing.by.jpg",
    city: MINSK,
    sports: [{ slug: "boks", parentSlug: "edinoborstva", label: "Бокс" }],
    primarySport: { slug: "boks", parentSlug: "edinoborstva", label: "Бокс" },
    bio: "Тренер по боксу в Минске, проспект Пушкина 68а. Групповые и индивидуальные тренировки. Зал @bronxgym.by. Телефон +375 29 704-13-26.",
    audiences: [],
    formats: ["individual", "group"],
    phone: "+375 29 704-13-26",
    instagram: "https://www.instagram.com/ar.boxing.by/",
    experience: 0,
    district: "",
  },
  {
    slug: "akhmejanau",
    name: "Farkhad Akhmejanau",
    photo: "/trainers/instagram/farkhad_akhmejanau.jpg",
    city: MINSK,
    sports: [{ slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" }],
    primarySport: { slug: "kikboksing", parentSlug: "edinoborstva", label: "Кикбоксинг" },
    bio: "Тренер по кикбоксингу в Минске. Групповые и персональные занятия.",
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
