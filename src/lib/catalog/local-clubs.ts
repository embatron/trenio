/**
 * Three club fixtures for the local Vite server. The production build drops
 * them: `import.meta.env.DEV` is false there, so `/clubs` stays empty.
 */

export type LocalClubTrainer = {
  slug: string;
  name: string;
  sport: string;
  meta: string;
  price: string;
  photo: string;
};

export type LocalClubDirection = {
  slug: string;
  label: string;
  meta: string;
  href: string;
};

export type LocalClub = {
  slug: string;
  name: string;
  logo: string;
  city: { slug: string; label: string };
  area: string;
  address: string;
  hours: string;
  phone: string;
  telegram: string;
  mapUrl: string;
  cover: string;
  photos: string[];
  priceFrom: number;
  rating: { value: string; ratingCount: number; reviewCount: number; fillPct: number };
  badge: string;
  stats: Array<{ label: string; accent?: boolean }>;
  about: string[];
  formats: Array<{ label: string; accent?: boolean }>;
  amenities: string[];
  note: string;
  prices: {
    single: Array<{ name: string; price: string }>;
    packs: Array<{ name: string; price: string }>;
  };
  directions: LocalClubDirection[];
  trainers: LocalClubTrainer[];
  reviews: Array<{ author: string; date: string; rating: number; text: string }>;
};

const RING = "/images/categories/edinoborstva.webp";
const RING_CARD = "/images/categories/edinoborstva-card.webp";
const GYM = "/images/categories/fitnes-i-trenirovki-v-zale.webp";
const GYM_CARD = "/images/categories/fitnes-i-trenirovki-v-zale-card.webp";
const YOGA = "/images/categories/yoga-pilates-i-rastyazhka.webp";
const YOGA_CARD = "/images/categories/yoga-pilates-i-rastyazhka-card.webp";
const GYMNASTICS = "/images/categories/gimnastika-i-akrobatika.webp";
const POOL = "/images/categories/plavanie-i-vodnye-trenirovki.webp";
const POOL_CARD = "/images/categories/plavanie-i-vodnye-trenirovki-card.webp";

function localClubs(): LocalClub[] {
  if (!import.meta.env.DEV) return [];
  return [
    {
      slug: "ring-minsk",
      name: "Клуб «Ринг»",
      logo: "РГ",
      city: { slug: "minsk", label: "Минск" },
      area: "Центральный",
      address: "Минск, ул. Кальварийская, 21",
      hours: "Ежедневно, 7:00–23:00",
      phone: "+375 29 100-00-11",
      telegram: "",
      mapUrl: "https://yandex.by/maps/?text=%D0%9C%D0%B8%D0%BD%D1%81%D0%BA%20%D0%9A%D0%B0%D0%BB%D1%8C%D0%B2%D0%B0%D1%80%D0%B8%D0%B9%D1%81%D0%BA%D0%B0%D1%8F%2021",
      cover: RING,
      photos: [RING, RING_CARD, GYM, GYM_CARD],
      priceFrom: 25,
      rating: { value: "4.8", ratingCount: 36, reviewCount: 2, fillPct: 96 },
      badge: "Зал",
      stats: [
        { label: "3 зала", accent: true },
        { label: "бокс и MMA" },
        { label: "с 2014" },
      ],
      about: [
        "Зал единоборств в центре Минска. Ринг, мешки и отдельная зона ОФП.",
        "Группы для взрослых и подростков. Персональная тренировка — по записи у тренера.",
      ],
      formats: [
        { label: "В группе", accent: true },
        { label: "Индивидуально" },
        { label: "В зале" },
      ],
      amenities: ["Ринг", "Мешки", "Раздевалка", "Душ", "Парковка"],
      note: "Тестовая карточка локального сайта. На trenio.by её нет.",
      prices: {
        single: [
          { name: "Группа, бокс", price: "25 BYN" },
          { name: "Персонально", price: "60 BYN" },
        ],
        packs: [
          { name: "8 занятий", price: "160 BYN" },
          { name: "Безлимит, месяц", price: "120 BYN" },
        ],
      },
      directions: [
        { slug: "boks", label: "Бокс", meta: "группы утром и вечером", href: "/city/minsk/boks" },
        { slug: "mma", label: "MMA", meta: "взрослые", href: "/city/minsk/mma" },
        { slug: "dzyudo", label: "Дзюдо", meta: "подростки", href: "/city/minsk/dzyudo" },
      ],
      trainers: [
        { slug: "", name: "Игорь Савич", sport: "Бокс", meta: "12 лет", price: "от 60 BYN", photo: RING_CARD },
        { slug: "", name: "Марина Коваль", sport: "MMA", meta: "8 лет", price: "от 55 BYN", photo: GYM_CARD },
      ],
      reviews: [
        { author: "Алексей", date: "март 2026", rating: 5, text: "Ринг свободный по вечерам, тренер объясняет спокойно." },
        { author: "Ольга", date: "январь 2026", rating: 4, text: "Группа для подростков небольшая, зал чистый." },
      ],
    },
    {
      slug: "tishina",
      name: "Студия «Тишина»",
      logo: "ТШ",
      city: { slug: "grodno", label: "Гродно" },
      area: "Центр",
      address: "Гродно, ул. Советская, 14",
      hours: "Пн–сб, 8:00–21:00",
      phone: "+375 29 100-00-22",
      telegram: "",
      mapUrl: "https://yandex.by/maps/?text=%D0%93%D1%80%D0%BE%D0%B4%D0%BD%D0%BE%20%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B0%D1%8F%2014",
      cover: YOGA,
      photos: [YOGA, YOGA_CARD, GYMNASTICS, YOGA_CARD],
      priceFrom: 20,
      rating: { value: "4.9", ratingCount: 18, reviewCount: 2, fillPct: 98 },
      badge: "Студия",
      stats: [
        { label: "2 зала", accent: true },
        { label: "йога и пилатес" },
        { label: "до 12 человек" },
      ],
      about: [
        "Небольшая студия в центре Гродно. Пилатес, йога и растяжка.",
        "Коврики есть в зале. Первое занятие можно прийти без своей формы.",
      ],
      formats: [
        { label: "В группе", accent: true },
        { label: "Индивидуально" },
      ],
      amenities: ["Коврики", "Раздевалка", "Душ", "Чай"],
      note: "Тестовая карточка локального сайта. На trenio.by её нет.",
      prices: {
        single: [
          { name: "Пилатес, группа", price: "20 BYN" },
          { name: "Йога, персонально", price: "45 BYN" },
        ],
        packs: [
          { name: "4 занятия", price: "70 BYN" },
          { name: "8 занятий", price: "130 BYN" },
        ],
      },
      directions: [
        { slug: "pilates", label: "Пилатес", meta: "утро и вечер", href: "/city/grodno/pilates" },
        { slug: "yoga", label: "Йога", meta: "хатха", href: "/city/grodno/yoga/yoga" },
      ],
      trainers: [
        { slug: "", name: "Елена Брук", sport: "Пилатес", meta: "9 лет", price: "от 45 BYN", photo: YOGA_CARD },
        { slug: "", name: "Дарья Литвин", sport: "Йога", meta: "6 лет", price: "от 40 BYN", photo: GYMNASTICS },
      ],
      reviews: [
        { author: "Настя", date: "февраль 2026", rating: 5, text: "Тихий зал, группы не больше десяти человек." },
        { author: "Ирина", date: "декабрь 2025", rating: 5, text: "Удобно после работы, душ есть." },
      ],
    },
    {
      slug: "volna-gomel",
      name: "Бассейн «Волна»",
      logo: "ВЛ",
      city: { slug: "gomel", label: "Гомель" },
      area: "Советский",
      address: "Гомель, ул. Советская, 8",
      hours: "Ежедневно, 6:30–22:00",
      phone: "+375 29 100-00-33",
      telegram: "",
      mapUrl: "https://yandex.by/maps/?text=%D0%93%D0%BE%D0%BC%D0%B5%D0%BB%D1%8C%20%D0%A1%D0%BE%D0%B2%D0%B5%D1%82%D1%81%D0%BA%D0%B0%D1%8F%208",
      cover: POOL,
      photos: [POOL, POOL_CARD, POOL, POOL_CARD],
      priceFrom: 15,
      rating: { value: "4.6", ratingCount: 22, reviewCount: 2, fillPct: 92 },
      badge: "Бассейн",
      stats: [
        { label: "25 метров", accent: true },
        { label: "4 дорожки" },
        { label: "дети и взрослые" },
      ],
      about: [
        "Крытый бассейн в Гомеле. Дорожки для взрослых и детские группы.",
        "Шапочка и очки свои. Полотенце можно взять на ресепшен.",
      ],
      formats: [
        { label: "В группе", accent: true },
        { label: "Индивидуально" },
        { label: "В бассейне" },
      ],
      amenities: ["Дорожки 25 м", "Детская чаша", "Раздевалка", "Сауна"],
      note: "Тестовая карточка локального сайта. На trenio.by её нет.",
      prices: {
        single: [
          { name: "Дорожка, 45 минут", price: "15 BYN" },
          { name: "Персонально в воде", price: "50 BYN" },
        ],
        packs: [
          { name: "8 посещений", price: "100 BYN" },
          { name: "Месяц, утро", price: "80 BYN" },
        ],
      },
      directions: [
        { slug: "plavanie", label: "Плавание", meta: "взрослые и дети", href: "/city/gomel/plavanie/plavanie" },
      ],
      trainers: [
        { slug: "", name: "Павел Реут", sport: "Плавание", meta: "15 лет", price: "от 50 BYN", photo: POOL_CARD },
        { slug: "", name: "Светлана Юрченко", sport: "Плавание", meta: "дети", price: "от 40 BYN", photo: POOL },
      ],
      reviews: [
        { author: "Денис", date: "апрель 2026", rating: 5, text: "Утром дорожки свободные, вода тёплая." },
        { author: "Марина", date: "ноябрь 2025", rating: 4, text: "Детская группа по субботам, тренер внимательный." },
      ],
    },
  ];
}

export const LOCAL_CLUBS: LocalClub[] = localClubs();

export function localClubBySlug(slug: string): LocalClub | undefined {
  return LOCAL_CLUBS.find((club) => club.slug === slug);
}

export function localClubCards() {
  return LOCAL_CLUBS.map((club) => ({
    slug: club.slug,
    name: club.name,
    city: club.city.label,
    area: club.area,
    directions: club.directions.map((item) => item.label),
    rating: Number(club.rating.value),
    reviews: club.rating.reviewCount,
    priceFrom: club.priceFrom,
    badge: club.badge,
    cover: club.cover,
    logo: club.logo,
  }));
}
