export type SportIconKey =
  | "martialArts"
  | "gymFitness"
  | "athleticPrep"
  | "yogaStretch"
  | "swimming"
  | "teamSports"
  | "racketSports"
  | "running"
  | "dance"
  | "gymnastics"
  | "winterSports"
  | "cycling"
  | "rehab"
  | "outdoor"
  | "mindSports";

export type SportTaxonomyChild = {
  slug: string;
  label: string;
  titleGenitive?: string;
  description?: string;
  aliases?: string[];
};

export type TopLevelSportCategory = {
  slug: string;
  label: string;
  titleGenitive: string;
  iconKey: SportIconKey;
  description: string;
  count: string;
  bg: string;
  /** Card thumbnail (720×480) for homepage and listings */
  image?: string;
  /** Hero featured image (960×640) for parent category pages */
  featuredImage?: string;
  children: SportTaxonomyChild[];
  sports: string[];
};

export type SportTaxonomyChildWithParent = SportTaxonomyChild & {
  parentSlug: string;
  parentLabel: string;
};

type TopLevelSportCategoryInput = Omit<TopLevelSportCategory, "sports">;

function defineCategory(category: TopLevelSportCategoryInput): TopLevelSportCategory {
  return {
    ...category,
    sports: category.children.map((sport) => sport.label),
  };
}

export const TOP_LEVEL_SPORT_CATEGORIES: TopLevelSportCategory[] = [
  defineCategory({
    slug: "edinoborstva",
    label: "Единоборства",
    titleGenitive: "единоборствам",
    iconKey: "martialArts",
    description: "Бокс, кикбоксинг, MMA, борьба и самооборона.",
    count: "120+ тренеров",
    bg: "linear-gradient(135deg, #ffe1e2 0%, #ffb3b6 100%)",
    image: "/images/categories/edinoborstva-card.webp",
    featuredImage: "/images/categories/edinoborstva.webp",
    children: [
      { slug: "boks", label: "Бокс", titleGenitive: "боксу" },
      { slug: "kikboksing", label: "Кикбоксинг", titleGenitive: "кикбоксингу" },
      { slug: "tajskij-boks", label: "Тайский бокс", titleGenitive: "тайскому боксу" },
      { slug: "mma", label: "MMA", titleGenitive: "MMA" },
      { slug: "karate", label: "Карате", titleGenitive: "карате" },
      { slug: "dzyudo", label: "Дзюдо", titleGenitive: "дзюдо" },
      { slug: "sambo", label: "Самбо", titleGenitive: "самбо" },
      { slug: "borba", label: "Борьба", titleGenitive: "борьбе" },
      { slug: "bjj", label: "BJJ", titleGenitive: "BJJ", aliases: ["Бразильское джиу-джитсу"] },
      { slug: "grepling", label: "Грэпплинг", titleGenitive: "грэпплингу" },
      { slug: "thekvondo", label: "Тхэквондо", titleGenitive: "тхэквондо" },
      { slug: "aikido", label: "Айкидо", titleGenitive: "айкидо" },
      { slug: "samooborona", label: "Самооборона", titleGenitive: "самообороне" },
    ],
  }),
  defineCategory({
    slug: "fitnes-i-trenirovki-v-zale",
    label: "Фитнес и зал",
    titleGenitive: "фитнесу и тренировкам в зале",
    iconKey: "gymFitness",
    description: "Силовой, функциональный, TRX, кардио и работа под цель.",
    count: "180+ тренеров",
    bg: "linear-gradient(135deg, #fff1d6 0%, #ffd08a 100%)",
    image: "/images/categories/fitnes-i-trenirovki-v-zale-card.webp",
    featuredImage: "/images/categories/fitnes-i-trenirovki-v-zale.webp",
    children: [
      { slug: "trenazhernyj-zal", label: "Тренажёрный зал", titleGenitive: "тренажёрному залу" },
      {
        slug: "personalnyj-fitnes",
        label: "Персональный фитнес",
        titleGenitive: "персональному фитнесу",
      },
      {
        slug: "silovye-trenirovki",
        label: "Силовые тренировки",
        titleGenitive: "силовым тренировкам",
      },
      {
        slug: "funkcionalnyj-trening",
        label: "Функциональный тренинг",
        titleGenitive: "функциональному тренингу",
      },
      { slug: "krossfit", label: "Кроссфит", titleGenitive: "кроссфиту" },
      { slug: "trx", label: "TRX", titleGenitive: "TRX" },
      {
        slug: "kardio-trenirovki",
        label: "Кардио-тренировки",
        titleGenitive: "кардио-тренировкам",
      },
    ],
  }),
  defineCategory({
    slug: "ofp-i-sportivnaya-podgotovka",
    label: "ОФП и спортподготовка",
    titleGenitive: "ОФП и спортивной подготовке",
    iconKey: "athleticPrep",
    description: "ОФП, СФП, атлетическая база, нормативы и подготовка спортсменов.",
    count: "85+ тренеров",
    bg: "linear-gradient(135deg, #fff2dd 0%, #ffc56f 100%)",
    image: "/images/categories/ofp-i-sportivnaya-podgotovka-card.webp",
    featuredImage: "/images/categories/ofp-i-sportivnaya-podgotovka.webp",
    children: [
      { slug: "ofp", label: "ОФП", titleGenitive: "ОФП" },
      { slug: "sfp", label: "СФП", titleGenitive: "СФП" },
      {
        slug: "atleticheskaya-podgotovka",
        label: "Атлетическая подготовка",
        titleGenitive: "атлетической подготовке",
      },
      {
        slug: "sportivnaya-podgotovka",
        label: "Подготовка спортсменов",
        titleGenitive: "подготовке спортсменов",
      },
      {
        slug: "podgotovka-k-sorevnovaniyam",
        label: "Подготовка к соревнованиям",
        titleGenitive: "подготовке к соревнованиям",
      },
      {
        slug: "skorostno-silovaya-podgotovka",
        label: "Скоростно-силовая подготовка",
        titleGenitive: "скоростно-силовой подготовке",
      },
      { slug: "normativy", label: "Нормативы", titleGenitive: "нормативам" },
    ],
  }),
  defineCategory({
    slug: "yoga-pilates-i-rastyazhka",
    label: "Йога и растяжка",
    titleGenitive: "йоге, пилатесу и растяжке",
    iconKey: "yogaStretch",
    description: "Йога, пилатес, mobility, МФР и здоровая спина.",
    count: "90+ тренеров",
    bg: "linear-gradient(135deg, #e3f0ff 0%, #a9caff 100%)",
    image: "/images/categories/yoga-pilates-i-rastyazhka-card.webp",
    featuredImage: "/images/categories/yoga-pilates-i-rastyazhka.webp",
    children: [
      { slug: "yoga", label: "Йога", titleGenitive: "йоге" },
      { slug: "pilates", label: "Пилатес", titleGenitive: "пилатесу" },
      { slug: "stretching", label: "Стретчинг", titleGenitive: "стретчингу" },
      { slug: "zdorovaya-spina", label: "Здоровая спина", titleGenitive: "здоровой спине" },
      { slug: "mobility", label: "Mobility", titleGenitive: "mobility" },
      { slug: "mfr", label: "МФР", titleGenitive: "МФР" },
      {
        slug: "sustavnaya-gimnastika",
        label: "Суставная гимнастика",
        titleGenitive: "суставной гимнастике",
      },
      {
        slug: "dyhatelnye-praktiki",
        label: "Дыхательные практики",
        titleGenitive: "дыхательным практикам",
      },
    ],
  }),
  defineCategory({
    slug: "plavanie-i-vodnye-trenirovki",
    label: "Плавание",
    titleGenitive: "плаванию и водным тренировкам",
    iconKey: "swimming",
    description: "Плавание, аквааэробика и водные тренировки для всех уровней.",
    count: "60+ тренеров",
    bg: "linear-gradient(135deg, #d8f3ff 0%, #8edcff 100%)",
    image: "/images/categories/plavanie-i-vodnye-trenirovki-card.webp",
    featuredImage: "/images/categories/plavanie-i-vodnye-trenirovki.webp",
    children: [
      { slug: "plavanie", label: "Плавание", titleGenitive: "плаванию" },
      {
        slug: "obuchenie-plavaniyu",
        label: "Обучение плаванию",
        titleGenitive: "обучению плаванию",
      },
      {
        slug: "sportivnoe-plavanie",
        label: "Спортивное плавание",
        titleGenitive: "спортивному плаванию",
      },
      { slug: "akvaaerobika", label: "Аквааэробика", titleGenitive: "аквааэробике" },
      { slug: "akvafitnes", label: "Аквафитнес", titleGenitive: "аквафитнесу" },
      { slug: "pryzhki-v-vodu", label: "Прыжки в воду", titleGenitive: "прыжкам в воду" },
      {
        slug: "sinhronnoe-plavanie",
        label: "Синхронное плавание",
        titleGenitive: "синхронному плаванию",
      },
    ],
  }),
  defineCategory({
    slug: "futbol-i-komandnye-igry",
    label: "Командные игры",
    titleGenitive: "командным играм",
    iconKey: "teamSports",
    description: "Футбол, баскетбол, волейбол, гандбол и другие командные виды.",
    count: "70+ тренеров",
    bg: "linear-gradient(135deg, #ecebff 0%, #b6b1ff 100%)",
    image: "/images/categories/futbol-i-komandnye-igry-card.webp",
    featuredImage: "/images/categories/futbol-i-komandnye-igry.webp",
    children: [
      { slug: "futbol", label: "Футбол", titleGenitive: "футболу" },
      { slug: "mini-futbol", label: "Мини-футбол", titleGenitive: "мини-футболу" },
      { slug: "basketbol", label: "Баскетбол", titleGenitive: "баскетболу" },
      { slug: "volejbol", label: "Волейбол", titleGenitive: "волейболу" },
      { slug: "gandbol", label: "Гандбол", titleGenitive: "гандболу" },
      { slug: "regbi", label: "Регби", titleGenitive: "регби" },
      { slug: "florbol", label: "Флорбол", titleGenitive: "флорболу" },
    ],
  }),
  defineCategory({
    slug: "tennis-i-igry-s-raketkoy",
    label: "Ракеточные виды",
    titleGenitive: "теннису и играм с ракеткой",
    iconKey: "racketSports",
    description: "Большой теннис, падел, сквош, бадминтон и настольный теннис.",
    count: "45+ тренеров",
    bg: "linear-gradient(135deg, #e2f8e0 0%, #9fe3a0 100%)",
    image: "/images/categories/tennis-i-igry-s-raketkoy-card.webp",
    featuredImage: "/images/categories/tennis-i-igry-s-raketkoy.webp",
    children: [
      { slug: "bolshoj-tennis", label: "Большой теннис", titleGenitive: "большому теннису" },
      {
        slug: "nastolnyj-tennis",
        label: "Настольный теннис",
        titleGenitive: "настольному теннису",
      },
      { slug: "padel", label: "Падел", titleGenitive: "паделу" },
      { slug: "skvosh", label: "Сквош", titleGenitive: "сквошу" },
      { slug: "badminton", label: "Бадминтон", titleGenitive: "бадминтону" },
    ],
  }),
  defineCategory({
    slug: "beg-i-legkaya-atletika",
    label: "Бег и атлетика",
    titleGenitive: "бегу и лёгкой атлетике",
    iconKey: "running",
    description: "Бег, спринт, длинные дистанции, марафон и техника бега.",
    count: "40+ тренеров",
    bg: "linear-gradient(135deg, #f0fce6 0%, #c6f08d 100%)",
    image: "/images/categories/beg-i-legkaya-atletika-card.webp",
    featuredImage: "/images/categories/beg-i-legkaya-atletika.webp",
    children: [
      { slug: "beg", label: "Бег", titleGenitive: "бегу" },
      { slug: "tehnika-bega", label: "Техника бега", titleGenitive: "технике бега" },
      { slug: "sprint", label: "Спринт", titleGenitive: "спринту" },
      {
        slug: "srednie-distancii",
        label: "Средние дистанции",
        titleGenitive: "средним дистанциям",
      },
      {
        slug: "dlinnye-distancii",
        label: "Длинные дистанции",
        titleGenitive: "длинным дистанциям",
      },
      { slug: "marafon", label: "Марафон", titleGenitive: "марафону" },
      { slug: "legkaya-atletika", label: "Лёгкая атлетика", titleGenitive: "лёгкой атлетике" },
      { slug: "sportivnaya-hodba", label: "Спортивная ходьба", titleGenitive: "спортивной ходьбе" },
    ],
  }),
  defineCategory({
    slug: "tancy-i-horeografiya",
    label: "Танцы",
    titleGenitive: "танцам и хореографии",
    iconKey: "dance",
    description: "Современные, бальные, латина, hip-hop, zumba и детская хореография.",
    count: "55+ тренеров",
    bg: "linear-gradient(135deg, #ffe6f4 0%, #ffa8d4 100%)",
    image: "/images/categories/tancy-i-horeografiya-card.webp",
    featuredImage: "/images/categories/tancy-i-horeografiya.webp",
    children: [
      {
        slug: "sovremennye-tancy",
        label: "Современные танцы",
        titleGenitive: "современным танцам",
      },
      { slug: "balnye-tancy", label: "Бальные танцы", titleGenitive: "бальным танцам" },
      { slug: "latina", label: "Латина", titleGenitive: "латине" },
      { slug: "hip-hop", label: "Hip-hop", titleGenitive: "hip-hop" },
      { slug: "high-heels", label: "High heels", titleGenitive: "high heels" },
      { slug: "zumba", label: "Zumba", titleGenitive: "zumba" },
      {
        slug: "detskaya-horeografiya",
        label: "Детская хореография",
        titleGenitive: "детской хореографии",
      },
      {
        slug: "klassicheskaya-horeografiya",
        label: "Классическая хореография",
        titleGenitive: "классической хореографии",
      },
    ],
  }),
  defineCategory({
    slug: "gimnastika-i-akrobatika",
    label: "Гимнастика",
    titleGenitive: "гимнастике и акробатике",
    iconKey: "gymnastics",
    description: "Спортивная, художественная, акробатика, батут и паркур.",
    count: "38+ тренеров",
    bg: "linear-gradient(135deg, #ffe9d8 0%, #ffbd89 100%)",
    image: "/images/categories/gimnastika-i-akrobatika-card.webp",
    featuredImage: "/images/categories/gimnastika-i-akrobatika.webp",
    children: [
      {
        slug: "sportivnaya-gimnastika",
        label: "Спортивная гимнастика",
        titleGenitive: "спортивной гимнастике",
      },
      {
        slug: "hudozhestvennaya-gimnastika",
        label: "Художественная гимнастика",
        titleGenitive: "художественной гимнастике",
      },
      { slug: "akrobatika", label: "Акробатика", titleGenitive: "акробатике" },
      { slug: "batut", label: "Батут", titleGenitive: "батуту" },
      {
        slug: "detskaya-gimnastika",
        label: "Детская гимнастика",
        titleGenitive: "детской гимнастике",
      },
      { slug: "parkur", label: "Паркур", titleGenitive: "паркуру" },
    ],
  }),
  defineCategory({
    slug: "zimnie-vidy-sporta",
    label: "Зимние виды",
    titleGenitive: "зимним видам спорта",
    iconKey: "winterSports",
    description: "Хоккей, фигурное катание, лыжи, сноуборд, биатлон и кёрлинг.",
    count: "22+ тренеров",
    bg: "linear-gradient(135deg, #eaf4ff 0%, #b4d5ff 100%)",
    image: "/images/categories/zimnie-vidy-sporta-card.webp",
    featuredImage: "/images/categories/zimnie-vidy-sporta.webp",
    children: [
      { slug: "hokkej", label: "Хоккей", titleGenitive: "хоккею" },
      { slug: "figurnoe-katanie", label: "Фигурное катание", titleGenitive: "фигурному катанию" },
      {
        slug: "konkobezhnyj-sport",
        label: "Конькобежный спорт",
        titleGenitive: "конькобежному спорту",
        aliases: ["Коньки"],
      },
      { slug: "gornye-lyzhi", label: "Горные лыжи", titleGenitive: "горным лыжам" },
      { slug: "snoubord", label: "Сноуборд", titleGenitive: "сноуборду" },
      { slug: "lyzhnye-gonki", label: "Лыжные гонки", titleGenitive: "лыжным гонкам" },
      { slug: "biatlon", label: "Биатлон", titleGenitive: "биатлону" },
      { slug: "kerling", label: "Кёрлинг", titleGenitive: "кёрлингу" },
    ],
  }),
  defineCategory({
    slug: "velosport-roliki-i-skeyt",
    label: "Велоспорт и скейт",
    titleGenitive: "велоспорту, роликам и скейту",
    iconKey: "cycling",
    description: "Велоспорт, BMX, ролики, скейтборд и самокат.",
    count: "28+ тренеров",
    bg: "linear-gradient(135deg, #e6fbff 0%, #8ce7ff 100%)",
    image: "/images/categories/velosport-roliki-i-skeyt-card.webp",
    featuredImage: "/images/categories/velosport-roliki-i-skeyt.webp",
    children: [
      { slug: "velosport", label: "Велоспорт", titleGenitive: "велоспорту" },
      {
        slug: "shossejnyj-velosport",
        label: "Шоссейный велоспорт",
        titleGenitive: "шоссейному велоспорту",
      },
      { slug: "mtb", label: "MTB", titleGenitive: "MTB" },
      { slug: "bmx", label: "BMX", titleGenitive: "BMX" },
      { slug: "roliki", label: "Ролики", titleGenitive: "роликам" },
      { slug: "skejtbord", label: "Скейтборд", titleGenitive: "скейтборду" },
      { slug: "samokat", label: "Самокат", titleGenitive: "самокату" },
    ],
  }),
  defineCategory({
    slug: "reabilitaciya-i-vosstanovlenie",
    label: "Реабилитация",
    titleGenitive: "реабилитации и восстановлению",
    iconKey: "rehab",
    description: "ЛФК, восстановительные программы и бережная физическая нагрузка.",
    count: "34+ тренеров",
    bg: "linear-gradient(135deg, #ebfff4 0%, #a5efc2 100%)",
    image: "/images/categories/reabilitaciya-i-vosstanovlenie-card.webp",
    featuredImage: "/images/categories/reabilitaciya-i-vosstanovlenie.webp",
    children: [
      { slug: "lfk", label: "ЛФК", titleGenitive: "ЛФК" },
      { slug: "kineziterapiya", label: "Кинезитерапия", titleGenitive: "кинезитерапии" },
      {
        slug: "posttravmaticheskoe-vosstanovlenie",
        label: "Посттравматическое восстановление",
        titleGenitive: "посттравматическому восстановлению",
      },
      {
        slug: "korrekcionnyj-fitnes",
        label: "Коррекционный фитнес",
        titleGenitive: "коррекционному фитнесу",
      },
      {
        slug: "adaptivnyj-fitnes",
        label: "Адаптивный фитнес",
        titleGenitive: "адаптивному фитнесу",
      },
      { slug: "zdorovaya-spina-rehab", label: "Здоровая спина", titleGenitive: "здоровой спине" },
      { slug: "mfr-rehab", label: "МФР", titleGenitive: "МФР" },
      { slug: "trenirovki-50-plus", label: "Тренировки 50+", titleGenitive: "тренировкам 50+" },
    ],
  }),
  defineCategory({
    slug: "outdoor-i-aktivnyj-sport",
    label: "Outdoor и активный спорт",
    titleGenitive: "outdoor и активному спорту",
    iconKey: "outdoor",
    description: "Туризм, скалолазание, SUP, каякинг и походная подготовка.",
    count: "18+ тренеров",
    bg: "linear-gradient(135deg, #edfbe8 0%, #bfe9ac 100%)",
    image: "/images/categories/outdoor-i-aktivnyj-sport-card.webp",
    featuredImage: "/images/categories/outdoor-i-aktivnyj-sport.webp",
    children: [
      { slug: "turizm", label: "Туризм", titleGenitive: "туризму" },
      { slug: "skalolazanie", label: "Скалолазание", titleGenitive: "скалолазанию" },
      { slug: "skalodrom", label: "Скалодром", titleGenitive: "скалодрому" },
      { slug: "orientirovanie", label: "Ориентирование", titleGenitive: "ориентированию" },
      { slug: "sup", label: "SUP", titleGenitive: "SUP" },
      { slug: "kayaking", label: "Каякинг", titleGenitive: "каякингу" },
      {
        slug: "pohodnaya-podgotovka",
        label: "Походная подготовка",
        titleGenitive: "походной подготовке",
      },
    ],
  }),
  defineCategory({
    slug: "intellektualnyj-sport",
    label: "Интеллектуальный спорт",
    titleGenitive: "интеллектуальному спорту",
    iconKey: "mindSports",
    description: "Шахматы, шашки, го и стратегические дисциплины.",
    count: "12+ тренеров",
    bg: "linear-gradient(135deg, #f2f0ff 0%, #cfc4ff 100%)",
    image: "/images/categories/intellektualnyj-sport-card.webp",
    featuredImage: "/images/categories/intellektualnyj-sport.webp",
    children: [
      { slug: "shahmaty", label: "Шахматы", titleGenitive: "шахматам" },
      { slug: "shashki", label: "Шашки", titleGenitive: "шашкам" },
      { slug: "go", label: "Го", titleGenitive: "го" },
      { slug: "sportivnyj-bridzh", label: "Спортивный бридж", titleGenitive: "спортивному бриджу" },
    ],
  }),
];

export const TOP_LEVEL_SPORT_CATEGORY_BY_SLUG = Object.fromEntries(
  TOP_LEVEL_SPORT_CATEGORIES.map((category) => [category.slug, category]),
) as Record<string, TopLevelSportCategory>;

export const SPORT_TAXONOMY_CHILDREN_BY_SLUG = Object.fromEntries(
  TOP_LEVEL_SPORT_CATEGORIES.flatMap((category) =>
    category.children.map((child) => [
      child.slug,
      {
        ...child,
        parentSlug: category.slug,
        parentLabel: category.label,
      },
    ]),
  ),
) as Record<string, SportTaxonomyChildWithParent>;

export function getTopLevelSportCategory(slug: string) {
  return TOP_LEVEL_SPORT_CATEGORY_BY_SLUG[slug];
}

export function getParentCategoryFeaturedImage(parentSlug: string) {
  const category = getTopLevelSportCategory(parentSlug);
  return category?.featuredImage ?? category?.image;
}

export function getSportTaxonomyChild(slug: string) {
  return SPORT_TAXONOMY_CHILDREN_BY_SLUG[slug];
}

export function getSportTaxonomyParent(slug: string) {
  const child = getSportTaxonomyChild(slug);
  return child ? getTopLevelSportCategory(child.parentSlug) : undefined;
}

export type CategoryRouteRef = {
  parentSlug: string;
  childSlug?: string;
};

export function categoryRouteRef(parentSlug: string, childSlug?: string): CategoryRouteRef {
  return childSlug ? { parentSlug, childSlug } : { parentSlug };
}

export function getSportTaxonomyChildInCategory(parentSlug: string, childSlug: string) {
  const parent = getTopLevelSportCategory(parentSlug);
  if (!parent) return undefined;

  const child = parent.children.find((sport) => sport.slug === childSlug);
  if (!child) return undefined;

  return {
    ...child,
    parentSlug: parent.slug,
    parentLabel: parent.label,
  } satisfies SportTaxonomyChildWithParent;
}

export function isTopLevelCategorySlug(slug: string) {
  return Boolean(getTopLevelSportCategory(slug));
}

export function isChildSportSlug(slug: string) {
  return Boolean(getSportTaxonomyChild(slug));
}
