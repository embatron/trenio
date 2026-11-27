import { isReservedAccountEmail } from "@/lib/auth/pending-email";
import { isSpecificAddress } from "@/lib/geo/schemas";

export type PulsePeriod = {
  current: number;
  previous: number;
};

export type PulseMode = "day" | "week" | "month";

type ContactPeriods = {
  phone: Record<PulseMode, PulsePeriod>;
  instagram: Record<PulseMode, PulsePeriod>;
  telegram: Record<PulseMode, PulsePeriod>;
  message: Record<PulseMode, PulsePeriod>;
};

/** Phone, Instagram, Telegram, and the write button, added for one period. */
export function contactAttempts(contacts: ContactPeriods, mode: PulseMode): PulsePeriod {
  const kinds = [contacts.phone, contacts.instagram, contacts.telegram, contacts.message];
  return {
    current: kinds.reduce((sum, kind) => sum + kind[mode].current, 0),
    previous: kinds.reduce((sum, kind) => sum + kind[mode].previous, 0),
  };
}

const PERIOD_LEAD: Record<PulseMode, string> = {
  day: "За сутки",
  week: "За неделю",
  month: "За месяц",
};

const PERIOD_PAST: Record<PulseMode, string> = {
  day: "вчера",
  week: "на прошлой неделе",
  month: "в прошлом месяце",
};

export type PulseStoryId = "show" | "visit" | "contact";

export type PulseStoryLine = {
  id: PulseStoryId;
  before: string;
  emphasis: string;
  after: string;
  note: string;
};

function times(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? "раз" : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? "раза" : "раз";
  return `${count} ${word}`;
}

function pastSentence(mode: PulseMode) {
  const past = PERIOD_PAST[mode];
  return `${past.charAt(0).toUpperCase()}${past.slice(1)} тоже.`;
}

function comparison(current: number, previous: number, mode: PulseMode) {
  if (current === 0 && previous === 0) return `. ${pastSentence(mode)}`;
  const past = PERIOD_PAST[mode];
  if (current === previous) return ` — столько же, сколько ${past}.`;
  const diff = Math.abs(current - previous);
  const word = current > previous ? "больше" : "меньше";
  return ` — на ${diff} ${word}, чем ${past}.`;
}

function happened(current: number, verb: string, none: string) {
  return current === 0 ? none : `${verb} ${times(current)}`;
}

/** Three sentences for the chosen period. The share lines are the same counts, so they are not repeated. */
export function pulseStory(
  mode: PulseMode,
  impressions: PulsePeriod,
  visits: PulsePeriod,
  contacts: PulsePeriod,
): PulseStoryLine[] {
  return [
    {
      id: "show",
      before: `${PERIOD_LEAD[mode]} карточку в списках `,
      emphasis: happened(impressions.current, "показали", "не показали"),
      after: comparison(impressions.current, impressions.previous, mode),
      note: "Один человек в одном браузере за календарные сутки по Минску. Запись появляется, когда опубликованная карточка нарисована на странице списка: на главной, в разделе, в городе и на карте, в том числе в поиске. Это не взгляд глазами: карточка ниже экрана тоже считается. Избранное, похожие тренеры и пустые «Сообщения» не считаются. Гость без аккаунта считается. Ваш заход и заход сотрудника проекта не считаются. Повтор в тот же день остаётся одним показом.",
    },
    {
      id: "visit",
      before: "Страницу ",
      emphasis: happened(visits.current, "открыли", "не открыли"),
      after: comparison(visits.current, visits.previous, mode),
      note: "Это открытие вашей страницы. Гость без аккаунта тоже считается. Ваш заход и заход сотрудника проекта не считаются. Черновик и скрытая страница не считаются. Если тот же браузер открывает страницу снова через полчаса или позже, это новый заход: утро, через три часа и вечер — три захода. Обновление страницы сразу не добавляет ещё один. У каждого захода свой источник: каталог, поиск, Instagram, другие социальные сети, чаты или прямой заход. Ссылку из письма в Instagram мы помечаем сами. Адрес чужой страницы не хранится.",
    },
    {
      id: "contact",
      before: "К телефону, Instagram, Telegram или «Написать» ",
      emphasis: happened(contacts.current, "перешли", "не перешли"),
      after: comparison(contacts.current, contacts.previous, mode),
      note: "Это клики. Гость без аккаунта тоже считается. Ваши клики и клики сотрудников проекта не считаются. Трубка, Instagram и Telegram записываются, когда человек в окне подтвердил переход и нажал «Позвонить» или «Открыть». «Остаться здесь» не считается. «Написать» записывается сразу, без этого окна. Два клика за три секунды считаются одним. Ниже те же переходы разложены по четырём способам.",
    },
  ];
}

/** Share of catalog shows that became a page open. A direct open has no show, so the line stays quiet. */
export function openedShare(visits: number, impressions: number) {
  if (impressions <= 0 || visits > impressions) return "";
  return `${Math.round((visits / impressions) * 100)}% открыли карточку`;
}

/** Share of page opens that tried a contact. */
export function contactShare(contacts: number, visits: number) {
  if (visits <= 0) return "";
  return `${Math.round((contacts / visits) * 100)}% перешли к контакту`;
}

export type PulseStoryTrainer = {
  pageStatus: string;
  verified: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  telegramVerified: boolean;
  createdSource: string;
  email: string;
  phone: string;
  instagram: string;
  telegram: string;
  headline: string;
  bio: string;
  about: string;
  sportSlugs: readonly string[];
  city: string;
  experienceYears: number;
  formats: readonly string[];
  priceFrom: number | null;
  places: readonly { address: string }[];
  certificates: readonly { path: string }[];
};

export type TrainerNextStep = {
  text: string;
  to: "/me/profile" | "/me/settings";
  hash?: string;
};

function plain(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function ruList(items: string[]) {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} и ${items[items.length - 1]}`;
}

function hasStreet(trainer: PulseStoryTrainer) {
  return trainer.places.some((place) => isSpecificAddress(place.address));
}

function realEmail(email: string) {
  const value = email.trim();
  return value.length > 0 && !isReservedAccountEmail(value);
}

type ContactAsk = { add: string[]; confirm: string[]; instagram: boolean };

function contactAsk(trainer: PulseStoryTrainer): ContactAsk {
  const ask: ContactAsk = { add: [], confirm: [], instagram: false };
  const phone = trainer.phone.trim();
  if (!phone) ask.add.push("телефон");
  else if (!trainer.phoneVerified) ask.confirm.push("телефон");
  if (!trainer.instagram.trim()) ask.instagram = true;
  const telegram = trainer.telegram.trim();
  if (!telegram) ask.add.push("Telegram");
  else if (!trainer.telegramVerified) ask.confirm.push("Telegram");
  if (!realEmail(trainer.email)) ask.add.push("почту");
  else if (!trainer.emailVerified) ask.confirm.push("почту");
  return ask;
}

const FIELD_GAPS: Array<{ label: string; hash: string; empty: (trainer: PulseStoryTrainer) => boolean }> = [
  { label: "заголовок", hash: "trainer-name", empty: (trainer) => !trainer.headline.trim() },
  { label: "текст о себе", hash: "trainer-main", empty: (trainer) => !plain(trainer.bio) },
  { label: "как проходят тренировки", hash: "trainer-work", empty: (trainer) => !plain(trainer.about) },
  { label: "вид спорта", hash: "trainer-work", empty: (trainer) => trainer.sportSlugs.length < 1 },
  { label: "стаж", hash: "trainer-work", empty: (trainer) => trainer.experienceYears < 1 },
  { label: "цену", hash: "trainer-work", empty: (trainer) => trainer.priceFrom == null || trainer.priceFrom < 1 },
  { label: "формат тренировок", hash: "trainer-work", empty: (trainer) => trainer.formats.length < 1 },
  { label: "город", hash: "trainer-places", empty: (trainer) => !trainer.city.trim() },
  { label: "улицу", hash: "trainer-places", empty: (trainer) => !hasStreet(trainer) },
  { label: "документы", hash: "trainer-docs", empty: (trainer) => !trainer.certificates.some((item) => item.path.trim()) },
];

/** The one gap a trainer can close. A photo is required by the form, so this step does not ask for it. */
export function trainerNextStep(trainer: PulseStoryTrainer): TrainerNextStep | null {
  if (trainer.pageStatus !== "published") {
    return {
      text: "Опубликуйте страницу. Пока её нет в каталоге, люди её не увидят.",
      to: "/me/profile",
      hash: "trainer-page-status",
    };
  }
  if (!trainer.verified || (!trainer.emailVerified && !trainer.phoneVerified)) {
    return {
      text: "Подтвердите почту или телефон. Без этого на карточке нет отметки.",
      to: "/me/settings",
    };
  }
  const contacts = contactAsk(trainer);
  const fields = FIELD_GAPS.filter((item) => item.empty(trainer));
  const sentences: string[] = [];
  if (contacts.add.length > 0) sentences.push(`Добавьте и подтвердите ${ruList(contacts.add)}.`);
  if (contacts.confirm.length > 0) sentences.push(`Подтвердите ${ruList(contacts.confirm)}.`);
  if (contacts.instagram) sentences.push("Добавьте Instagram.");
  if (fields.length > 0) sentences.push(`Заполните ${ruList(fields.map((item) => item.label))}.`);
  if (sentences.length === 0) return null;
  const toContacts = contacts.add.length > 0 || contacts.confirm.length > 0 || contacts.instagram;
  return {
    text: sentences.join(" "),
    to: "/me/profile",
    hash: toContacts ? "trainer-contact-block" : fields[0]?.hash,
  };
}
