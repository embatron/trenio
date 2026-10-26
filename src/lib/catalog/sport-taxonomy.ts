import { clipMeta } from "@/lib/seo/text";

export type SportIconKey =
  | "martialArts"
  | "gymFitness"
  | "athleticPrep"
  | "yogaStretch"
  | "wellness"
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
  | "clubSports"
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
  /** Search phrases for this page. Not separate URLs. */
  aliases?: string[];
  count: string;
  bg: string;
  /** Card thumbnail (720×480) for homepage and listings */
  image?: string;
  /** Hero featured image (960×640) for parent category pages */
  featuredImage?: string;
  /** False keeps the section in the taxonomy and off the public site. */
  published?: boolean;
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
    aliases: ["единоборства", "боевые искусства"],
    count: "",
    bg: "linear-gradient(135deg, #ffe1e2 0%, #ffb3b6 100%)",
    image: "/images/categories/edinoborstva-card.webp",
    featuredImage: "/images/ideogram/boxing.png",
    children: [
      { slug: "boks", label: "Бокс", titleGenitive: "боксу", aliases: ["бокс", "любительский бокс"] },
      { slug: "kikboksing", label: "Кикбоксинг", titleGenitive: "кикбоксингу", aliases: ["кикбоксинг"] },
      { slug: "tajskij-boks", label: "Тайский бокс", titleGenitive: "тайскому боксу", aliases: ["муай тай", "тайский бокс"] },
      { slug: "mma", label: "MMA", titleGenitive: "MMA", aliases: ["мма", "смешанные единоборства"] },
      { slug: "karate", label: "Карате", titleGenitive: "карате", aliases: ["каратэ", "киокушинкай", "киокушин"] },
      { slug: "dzyudo", label: "Дзюдо", titleGenitive: "дзюдо" },
      { slug: "sambo", label: "Самбо", titleGenitive: "самбо", aliases: ["боевое самбо", "спортивное самбо"] },
      { slug: "borba", label: "Борьба", titleGenitive: "борьбе", aliases: ["вольная борьба", "греко-римская борьба"] },
      { slug: "bjj", label: "Джиу-джитсу", titleGenitive: "джиу-джитсу", aliases: ["BJJ", "бжж", "бразильское джиу-джитсу"] },
      { slug: "grepling", label: "Грэпплинг", titleGenitive: "грэпплингу", aliases: ["грепплинг"] },
      { slug: "thekvondo", label: "Тхэквондо", titleGenitive: "тхэквондо", aliases: ["тхеквондо", "таеквондо"] },
      { slug: "aikido", label: "Айкидо", titleGenitive: "айкидо" },
      { slug: "rukopashnyj", label: "Рукопашный бой", titleGenitive: "рукопашному бою", aliases: ["рукопашка", "армейский рукопашный бой"] },
      { slug: "ushu", label: "Ушу", titleGenitive: "ушу", aliases: ["у-шу", "кунг-фу"] },
      { slug: "fehtovanie", label: "Фехтование", titleGenitive: "фехтованию" },
      { slug: "armrestling", label: "Армрестлинг", titleGenitive: "армрестлингу", aliases: ["армспорт"] },
      { slug: "samooborona", label: "Самооборона", titleGenitive: "самообороне", aliases: ["курсы самообороны", "женская самооборона"] },
    ],
  }),
  defineCategory({
    slug: "fitnes",
    label: "Фитнес",
    titleGenitive: "фитнесу",
    iconKey: "gymFitness",
    description: "Тренажёрный зал, ОФП, кроссфит, тяжёлая атлетика и пауэрлифтинг.",
    aliases: ["фитнес", "тренажёрный зал", "персональный тренер", "тренировки 50+"],
    count: "",
    bg: "linear-gradient(135deg, #fff1d6 0%, #ffd08a 100%)",
    image: "/images/categories/fitnes-i-trenirovki-v-zale-card.webp",
    featuredImage: "/images/ideogram/fitness.png",
    children: [
      {
        slug: "trenazhernyj-zal",
        label: "Тренажёрный зал",
        titleGenitive: "тренажёрному залу",
        aliases: ["тренажерный зал", "тренажерка", "спортзал", "силовые тренировки", "персональный тренер", "кардио"],
      },
      {
        slug: "ofp",
        label: "ОФП",
        titleGenitive: "общефизической подготовке",
        aliases: [
          "общая физическая подготовка",
          "СФП",
          "специальная физическая подготовка",
          "атлетическая подготовка",
          "подготовка спортсменов",
          "подготовка к соревнованиям",
          "скоростно-силовая подготовка",
          "нормативы",
        ],
      },
      {
        slug: "krossfit",
        label: "Кроссфит",
        titleGenitive: "кроссфиту",
        aliases: ["crossfit", "функциональные тренировки", "функциональный тренинг", "TRX"],
      },
      {
        slug: "shtanga",
        label: "Тяжёлая атлетика",
        titleGenitive: "тяжёлой атлетике",
        aliases: ["тяжелая атлетика", "штанга"],
      },
      {
        slug: "pauerlifting",
        label: "Пауэрлифтинг",
        titleGenitive: "пауэрлифтингу",
        aliases: ["силовое троеборье"],
      },
    ],
  }),
  defineCategory({
    slug: "yoga",
    label: "Йога и растяжка",
    titleGenitive: "йоге, пилатесу и растяжке",
    iconKey: "yogaStretch",
    description: "Йога, пилатес и растяжка.",
    aliases: ["йога", "пилатес", "растяжка"],
    count: "",
    bg: "linear-gradient(135deg, #e3f0ff 0%, #a9caff 100%)",
    image: "/images/categories/yoga-pilates-i-rastyazhka-card.webp",
    featuredImage: "/images/ideogram/yoga2.png",
    children: [
      { slug: "yoga", label: "Йога", titleGenitive: "йоге", aliases: ["хатха", "виньяса", "йога для начинающих"] },
      { slug: "pilates", label: "Пилатес", titleGenitive: "пилатесу" },
      {
        slug: "stretching",
        label: "Растяжка",
        titleGenitive: "растяжке",
        aliases: ["стретчинг", "здоровая спина", "МФР", "миофасциальный релиз", "суставная гимнастика"],
      },
    ],
  }),
  defineCategory({
    slug: "velnes",
    label: "Велнес",
    titleGenitive: "велнесу",
    iconKey: "wellness",
    description: "Медитация, цигун и тайцзи.",
    aliases: ["велнесс", "wellness"],
    published: false,
    count: "",
    bg: "linear-gradient(135deg, #e7f7f2 0%, #b7e6d4 100%)",
    children: [
      {
        slug: "meditaciya",
        label: "Медитация",
        titleGenitive: "медитации",
        aliases: ["йога-нидра", "осознанность", "mindfulness"],
      },
      { slug: "cigun", label: "Цигун", titleGenitive: "цигун", aliases: ["ци-гун", "qigong"] },
      { slug: "tajczi", label: "Тайцзи", titleGenitive: "тайцзи", aliases: ["тайцзицюань", "тай-чи", "тайчи"] },
    ],
  }),
  defineCategory({
    slug: "plavanie",
    label: "Водные виды",
    titleGenitive: "водным видам спорта",
    iconKey: "swimming",
    description: "Плавание, гребля, каноэ, байдарка, парус и другие занятия на воде.",
    aliases: ["плавание", "бассейн", "водные виды", "лодки"],
    count: "",
    bg: "linear-gradient(135deg, #d8f3ff 0%, #8edcff 100%)",
    image: "/images/categories/plavanie-i-vodnye-trenirovki-card.webp",
    featuredImage: "/images/ideogram/swimmer.png",
    children: [
      {
        slug: "plavanie",
        label: "Плавание",
        titleGenitive: "плаванию",
        aliases: ["обучение плаванию", "научиться плавать", "спортивное плавание", "плавание для детей"],
      },
      { slug: "akvaaerobika", label: "Аквааэробика", titleGenitive: "аквааэробике", aliases: ["аквафитнес"] },
      { slug: "pryzhki", label: "Прыжки в воду", titleGenitive: "прыжкам в воду" },
      {
        slug: "sinhronnoe",
        label: "Синхронное плавание",
        titleGenitive: "синхронному плаванию",
        aliases: ["артистическое плавание"],
      },
      {
        slug: "greblya",
        label: "Гребля",
        titleGenitive: "гребле",
        aliases: ["академическая гребля", "лодки", "распашная гребля", "парная гребля"],
      },
      {
        slug: "kanoe",
        label: "Каноэ",
        titleGenitive: "каноэ",
        aliases: ["гребля на каноэ", "гребной слалом", "лодки"],
      },
      {
        slug: "kayaking",
        label: "Байдарка",
        titleGenitive: "байдарке",
        aliases: ["каякинг", "каяк", "гребля на байдарках", "сплав", "гребной слалом", "лодки"],
      },
      {
        slug: "parus",
        label: "Парус",
        titleGenitive: "парусу",
        aliases: ["парусный спорт", "яхты", "яхтинг", "парусные лодки", "лодки"],
      },
      {
        slug: "vodnye-lyzhi",
        label: "Водные лыжи",
        titleGenitive: "водным лыжам",
        aliases: ["воднолыжный спорт"],
      },
      { slug: "vejkbord", label: "Вейкборд", titleGenitive: "вейкборду", aliases: ["вейк", "вейксерф"] },
      { slug: "vodnoe-polo", label: "Водное поло", titleGenitive: "водному поло", aliases: ["ватерполо"] },
      {
        slug: "podvodnyj",
        label: "Подводный спорт",
        titleGenitive: "подводному спорту",
        aliases: ["дайвинг", "фридайвинг", "плавание в ластах", "апноэ", "подводное плавание"],
      },
      { slug: "sup", label: "Сап", titleGenitive: "сапу", aliases: ["SUP", "сапборд", "сапсерфинг"] },
    ],
  }),
  defineCategory({
    slug: "komandnye",
    label: "Командные игры",
    titleGenitive: "командным играм",
    iconKey: "teamSports",
    description: "Футбол, баскетбол, волейбол, гандбол, хоккей на траве и другие командные виды.",
    count: "",
    bg: "linear-gradient(135deg, #ecebff 0%, #b6b1ff 100%)",
    image: "/images/categories/futbol-i-komandnye-igry-card.webp",
    featuredImage: "/images/ideogram/soccer.png",
    children: [
      { slug: "futbol", label: "Футбол", titleGenitive: "футболу", aliases: ["футбол для детей"] },
      { slug: "mini-futbol", label: "Мини-футбол", titleGenitive: "мини-футболу", aliases: ["футзал", "минифутбол"] },
      { slug: "basketbol", label: "Баскетбол", titleGenitive: "баскетболу" },
      { slug: "volejbol", label: "Волейбол", titleGenitive: "волейболу" },
      { slug: "gandbol", label: "Гандбол", titleGenitive: "гандболу" },
      { slug: "regbi", label: "Регби", titleGenitive: "регби" },
      { slug: "florbol", label: "Флорбол", titleGenitive: "флорболу" },
      { slug: "hokkej-trava", label: "Хоккей на траве", titleGenitive: "хоккею на траве" },
    ],
  }),
  defineCategory({
    slug: "raketki",
    label: "Ракеточные виды",
    titleGenitive: "теннису и играм с ракеткой",
    iconKey: "racketSports",
    description: "Большой теннис, падел, сквош, бадминтон и настольный теннис.",
    count: "",
    bg: "linear-gradient(135deg, #e2f8e0 0%, #9fe3a0 100%)",
    image: "/images/categories/tennis-i-igry-s-raketkoy-card.webp",
    featuredImage: "/images/ideogram/tennisist.png",
    children: [
      { slug: "bolshoj-tennis", label: "Большой теннис", titleGenitive: "большому теннису", aliases: ["теннис"] },
      {
        slug: "nastolnyj-tennis",
        label: "Настольный теннис",
        titleGenitive: "настольному теннису",
        aliases: ["пинг-понг"],
      },
      { slug: "padel", label: "Падел", titleGenitive: "паделу", aliases: ["padel"] },
      { slug: "skvosh", label: "Сквош", titleGenitive: "сквошу" },
      { slug: "badminton", label: "Бадминтон", titleGenitive: "бадминтону" },
    ],
  }),
  defineCategory({
    slug: "beg",
    label: "Бег и атлетика",
    titleGenitive: "бегу и лёгкой атлетике",
    iconKey: "running",
    description: "Бег, спринт, лёгкая атлетика и триатлон.",
    count: "",
    bg: "linear-gradient(135deg, #f0fce6 0%, #c6f08d 100%)",
    image: "/images/categories/beg-i-legkaya-atletika-card.webp",
    featuredImage: "/images/ideogram/runner.png",
    children: [
      {
        slug: "beg",
        label: "Бег",
        titleGenitive: "бегу",
        aliases: ["техника бега", "марафон", "полумарафон", "длинные дистанции", "бег для начинающих"],
      },
      { slug: "sprint", label: "Спринт", titleGenitive: "спринту", aliases: ["бег на короткие дистанции"] },
      {
        slug: "legkaya-atletika",
        label: "Лёгкая атлетика",
        titleGenitive: "лёгкой атлетике",
        aliases: ["легкая атлетика", "прыжки", "метания", "спортивная ходьба"],
      },
      { slug: "triatlon", label: "Триатлон", titleGenitive: "триатлону" },
    ],
  }),
  defineCategory({
    slug: "tancy",
    label: "Танцы",
    titleGenitive: "танцам и хореографии",
    iconKey: "dance",
    description: "Современные, бальные, хип-хоп, балет, брейкинг и чирлидинг.",
    count: "",
    bg: "linear-gradient(135deg, #ffe6f4 0%, #ffa8d4 100%)",
    image: "/images/categories/tancy-i-horeografiya-card.webp",
    featuredImage: "/images/ideogram/dancer.png",
    children: [
      {
        slug: "sovremennye",
        label: "Современные танцы",
        titleGenitive: "современным танцам",
        aliases: ["контемп", "контемпорари", "зумба"],
      },
      {
        slug: "balnye",
        label: "Бальные танцы",
        titleGenitive: "бальным танцам",
        aliases: ["латина", "бальная латина", "стандарт"],
      },
      { slug: "hip-hop", label: "Хип-хоп", titleGenitive: "хип-хопу", aliases: ["hip-hop", "хип хоп"] },
      {
        slug: "high-heels",
        label: "Танцы на каблуках",
        titleGenitive: "танцам на каблуках",
        aliases: ["high heels", "хай хилс"],
      },
      {
        slug: "deti",
        label: "Детские танцы",
        titleGenitive: "детским танцам",
        aliases: ["детская хореография", "танцы для детей"],
      },
      {
        slug: "klassika",
        label: "Балет",
        titleGenitive: "балету",
        aliases: ["классическая хореография", "классический танец"],
      },
      {
        slug: "brejking",
        label: "Брейкинг",
        titleGenitive: "брейкингу",
        aliases: ["брейк-данс", "брейкданс", "breaking"],
      },
      {
        slug: "chirliding",
        label: "Чирлидинг",
        titleGenitive: "чирлидингу",
        aliases: ["чир", "группы поддержки"],
      },
    ],
  }),
  defineCategory({
    slug: "gimnastika",
    label: "Гимнастика",
    titleGenitive: "гимнастике и акробатике",
    iconKey: "gymnastics",
    description: "Спортивная, художественная, эстетическая, акробатика, батут и аэробика.",
    count: "",
    bg: "linear-gradient(135deg, #ffe9d8 0%, #ffbd89 100%)",
    image: "/images/categories/gimnastika-i-akrobatika-card.webp",
    featuredImage: "/images/ideogram/gymnast.png",
    children: [
      {
        slug: "sportivnaya",
        label: "Спортивная гимнастика",
        titleGenitive: "спортивной гимнастике",
      },
      {
        slug: "hudozhestvennaya",
        label: "Художественная гимнастика",
        titleGenitive: "художественной гимнастике",
        aliases: ["худгимнастика"],
      },
      { slug: "akrobatika", label: "Акробатика", titleGenitive: "акробатике" },
      { slug: "batut", label: "Батут", titleGenitive: "батуту", aliases: ["прыжки на батуте"] },
      {
        slug: "estetika",
        label: "Эстетическая гимнастика",
        titleGenitive: "эстетической гимнастике",
      },
      {
        slug: "detskaya",
        label: "Детская гимнастика",
        titleGenitive: "детской гимнастике",
        aliases: ["гимнастика для детей"],
      },
      {
        slug: "aerobika",
        label: "Спортивная аэробика",
        titleGenitive: "спортивной аэробике",
      },
    ],
  }),
  defineCategory({
    slug: "zima",
    label: "Зимние виды",
    titleGenitive: "зимним видам спорта",
    iconKey: "winterSports",
    description: "Хоккей, фигурное катание, лыжи, сноуборд, биатлон, шорт-трек и фристайл.",
    count: "",
    bg: "linear-gradient(135deg, #eaf4ff 0%, #b4d5ff 100%)",
    image: "/images/categories/zimnie-vidy-sporta-card.webp",
    featuredImage: "/images/ideogram/ski.png",
    children: [
      { slug: "hokkej", label: "Хоккей", titleGenitive: "хоккею", aliases: ["хоккей с шайбой"] },
      { slug: "figurnoe-katanie", label: "Фигурное катание", titleGenitive: "фигурному катанию" },
      {
        slug: "konki",
        label: "Коньки",
        titleGenitive: "конькам",
        aliases: ["конькобежный спорт", "беговые коньки"],
      },
      { slug: "gornye-lyzhi", label: "Горные лыжи", titleGenitive: "горным лыжам", aliases: ["горнолыжный спорт"] },
      { slug: "snoubord", label: "Сноуборд", titleGenitive: "сноуборду" },
      { slug: "lyzhnye-gonki", label: "Лыжные гонки", titleGenitive: "лыжным гонкам", aliases: ["беговые лыжи"] },
      { slug: "biatlon", label: "Биатлон", titleGenitive: "биатлону" },
      { slug: "kerling", label: "Кёрлинг", titleGenitive: "кёрлингу" },
      { slug: "short-trek", label: "Шорт-трек", titleGenitive: "шорт-треку", aliases: ["шорттрек"] },
      {
        slug: "fristajl",
        label: "Фристайл",
        titleGenitive: "фристайлу",
        aliases: ["лыжный фристайл", "могул"],
      },
    ],
  }),
  defineCategory({
    slug: "velo",
    label: "Велоспорт и скейт",
    titleGenitive: "велоспорту, роликам и скейту",
    iconKey: "cycling",
    description: "Велосипед, ролики, скейт и самокат.",
    count: "",
    bg: "linear-gradient(135deg, #e6fbff 0%, #8ce7ff 100%)",
    image: "/images/categories/velosport-roliki-i-skeyt-card.webp",
    featuredImage: "/images/ideogram/cyclist.png",
    children: [
      {
        slug: "velosiped",
        label: "Велосипед",
        titleGenitive: "велосипеду",
        aliases: ["велоспорт", "шоссе", "шоссейный велоспорт", "MTB", "горный велосипед"],
      },
      { slug: "bmx", label: "BMX", titleGenitive: "BMX", aliases: ["бмх"] },
      { slug: "roliki", label: "Ролики", titleGenitive: "роликам", aliases: ["роликовые коньки"] },
      { slug: "skejtbord", label: "Скейт", titleGenitive: "скейту", aliases: ["скейтборд"] },
      { slug: "samokat", label: "Самокат", titleGenitive: "самокату", aliases: ["трюковой самокат"] },
    ],
  }),
  defineCategory({
    slug: "reabilitaciya",
    label: "Реабилитация",
    titleGenitive: "реабилитации и восстановлению",
    iconKey: "rehab",
    description: "ЛФК, массаж, осанка и восстановление после травмы.",
    aliases: ["реабилитация", "восстановление", "лечебная физкультура"],
    count: "",
    bg: "linear-gradient(135deg, #ebfff4 0%, #a5efc2 100%)",
    image: "/images/categories/reabilitaciya-i-vosstanovlenie-card.webp",
    featuredImage: "/images/ideogram/reability.png",
    children: [
      {
        slug: "lfk",
        label: "ЛФК",
        titleGenitive: "лечебной физической культуре",
        aliases: ["лечебная физкультура", "кинезитерапия", "адаптивная физкультура"],
      },
      {
        slug: "posttravma",
        label: "После травмы",
        titleGenitive: "восстановлению после травмы",
        aliases: ["восстановление после травмы", "реабилитация после травмы"],
      },
      {
        slug: "massazh",
        label: "Массаж",
        titleGenitive: "массажу",
        aliases: ["спортивный массаж", "расслабляющий массаж", "классический массаж"],
      },
      {
        slug: "osanka",
        label: "Осанка",
        titleGenitive: "осанке",
        aliases: ["ровная осанка", "постуральная гимнастика"],
      },
      {
        slug: "ofk",
        label: "ОФК",
        titleGenitive: "оздоровительной физической культуре",
        aliases: ["оздоровительная физическая культура", "оздоровительная физкультура"],
      },
    ],
  }),
  defineCategory({
    slug: "outdoor",
    label: "Экстрим",
    titleGenitive: "экстремальному спорту",
    iconKey: "outdoor",
    description: "Скалолазание, альпинизм, паркур, походы и ориентирование.",
    aliases: ["экстрим", "экстремальный спорт", "походы и скалы", "активный отдых"],
    count: "",
    bg: "linear-gradient(135deg, #edfbe8 0%, #bfe9ac 100%)",
    image: "/images/categories/outdoor-i-aktivnyj-sport-card.webp",
    featuredImage: "/images/ideogram/xtreme.png",
    children: [
      {
        slug: "skalolazanie",
        label: "Скалолазание",
        titleGenitive: "скалолазанию",
        aliases: ["скалодром", "боулдеринг"],
      },
      { slug: "alpinizm", label: "Альпинизм", titleGenitive: "альпинизму" },
      { slug: "parkur", label: "Паркур", titleGenitive: "паркуру" },
      {
        slug: "pohod",
        label: "Походы",
        titleGenitive: "походам",
        aliases: ["туризм", "поход", "трекинг"],
      },
      { slug: "orientirovanie", label: "Ориентирование", titleGenitive: "ориентированию", aliases: ["спортивное ориентирование"] },
    ],
  }),
  defineCategory({
    slug: "klub",
    label: "Клубные виды",
    titleGenitive: "клубным видам спорта",
    iconKey: "clubSports",
    description: "Гольф, бильярд и конный спорт.",
    aliases: ["гольф", "бильярд", "конный спорт"],
    count: "",
    bg: "linear-gradient(135deg, #f7f1e4 0%, #e4d2a8 100%)",
    featuredImage: "/images/ideogram/rider.png",
    children: [
      { slug: "golf", label: "Гольф", titleGenitive: "гольфу", aliases: ["мини-гольф", "гольф-клуб"] },
      {
        slug: "bilyard",
        label: "Бильярд",
        titleGenitive: "бильярду",
        aliases: ["снукер", "пул", "пирамида", "русский бильярд"],
      },
      {
        slug: "konnyj",
        label: "Конный спорт",
        titleGenitive: "конному спорту",
        aliases: ["верховая езда", "лошади", "конкур", "выездка"],
      },
    ],
  }),
  defineCategory({
    slug: "intellekt",
    label: "Шахматы и шашки",
    titleGenitive: "шахматам и шашкам",
    iconKey: "mindSports",
    description: "Шахматы, шашки, го и бридж.",
    aliases: ["интеллектуальный спорт", "шахматы", "шашки"],
    count: "",
    bg: "linear-gradient(135deg, #f2f0ff 0%, #cfc4ff 100%)",
    image: "/images/categories/intellektualnyj-sport-card.webp",
    featuredImage: "/images/ideogram/chessist.png",
    children: [
      { slug: "shahmaty", label: "Шахматы", titleGenitive: "шахматам", aliases: ["шахматы для детей"] },
      { slug: "shashki", label: "Шашки", titleGenitive: "шашкам", aliases: ["русские шашки"] },
      { slug: "go", label: "Го", titleGenitive: "го", aliases: ["игра го"] },
      { slug: "bridzh", label: "Бридж", titleGenitive: "бриджу", aliases: ["спортивный бридж"] },
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

function foldAlias(value: string) {
  return value.trim().toLowerCase().replaceAll("ё", "е");
}

/** An alias that is a second query, not another spelling of the same sport name. */
export function pickSearchAlias(keyword: string, aliases?: string[]) {
  const key = foldAlias(keyword);
  const stem = key.slice(0, Math.min(4, key.length));
  const candidates = (aliases ?? []).filter((alias) => {
    const value = foldAlias(alias);
    if (value.length < 4 || value.length > 40) return false;
    if (value === key) return false;
    if (value.length <= stem.length + 3 && (value.startsWith(stem) || stem.startsWith(value.slice(0, 4)))) return false;
    return true;
  });
  return candidates.find((alias) => /тренер|для детей|секци|инструктор/i.test(alias)) ?? candidates[0];
}

/** Snippet for a category document. One extra query, then the selection facts. */
export function categorySearchDescription(title: string, _lead: string, aliases?: string[]) {
  const phrase = title.replace(/\s*\|\s*trenio\.by\s*$/i, "").trim();
  const keyword = phrase.replace(/^Найти тренера по\s+/i, "");
  const extra = pickSearchAlias(keyword, aliases);
  const middle = extra ? ` ${extra.charAt(0).toUpperCase()}${extra.slice(1)}.` : "";
  return clipMeta(
    `${phrase} в Беларуси.${middle} Город, цена и формат — индивидуально или в группе, для взрослых и детей.`,
  );
}

export function getTopLevelSportCategory(slug: string) {
  return TOP_LEVEL_SPORT_CATEGORY_BY_SLUG[slug];
}

export function isPublishedSportCategory(category: { published?: boolean } | undefined) {
  return Boolean(category && category.published !== false);
}

export function listPublishedSportCategories() {
  return TOP_LEVEL_SPORT_CATEGORIES.filter((category) => isPublishedSportCategory(category));
}

export function getParentCategoryFeaturedImage(parentSlug: string) {
  const category = getTopLevelSportCategory(parentSlug);
  return category?.featuredImage ?? category?.image;
}

export function getSportTaxonomyChild(slug: string) {
  return SPORT_TAXONOMY_CHILDREN_BY_SLUG[slug];
}

export function listSecondLevelSports() {
  return Object.values(SPORT_TAXONOMY_CHILDREN_BY_SLUG)
    .filter((sport) => isPublishedSportCategory(getTopLevelSportCategory(sport.parentSlug)))
    .sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

/** A trainer card lists at most four second-level sports. */
export const MAX_TRAINER_SPORTS = 4;

/** Dative after «по»: «тренер по боксу». Abbreviations and indeclinable names stay as written. */
export function sportDative(sport: { slug: string; label: string }): string {
  return getSportTaxonomyChild(sport.slug)?.titleGenitive
    ?? getTopLevelSportCategory(sport.slug)?.titleGenitive
    ?? sport.label.toLowerCase();
}

export function trainerSportDatives(sports: Array<{ slug: string; label: string }>): string[] {
  return sports.slice(0, MAX_TRAINER_SPORTS).map(sportDative);
}

/** The profile line: one sport, «а и б», or «а, б и в». */
export function trainerByPhrase(datives: string[]): string {
  const sports = datives.map((item) => item.trim()).filter(Boolean).slice(0, MAX_TRAINER_SPORTS);
  if (sports.length === 0) return "Тренер";
  if (sports.length === 1) return `Тренер по ${sports[0]}`;
  if (sports.length === 2) return `Тренер по ${sports[0]} и ${sports[1]}`;
  return `Тренер по ${sports.slice(0, -1).join(", ")} и ${sports[sports.length - 1]}`;
}

export function trainerSportsFromSlugs(slugs: string[]) {
  const unique = [...new Set(slugs.map((slug) => slug.trim()).filter(Boolean))];
  const sports = unique.flatMap((slug) => {
    const sport = getSportTaxonomyChild(slug);
    return sport ? [{ slug: sport.slug, parentSlug: sport.parentSlug, label: sport.label }] : [];
  });
  return { slugs: unique, sports };
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
