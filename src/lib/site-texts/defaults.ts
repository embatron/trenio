import { sanitizeReviewHtml } from "@/lib/catalog/review-html";

/** Telegram bot that opens the Mini App. `{telegram}` in the trainer letter becomes this link. */
export const PORTAL_TELEGRAM_URL = "https://t.me/TrenioByBot";

export const SITE_TEXT_KEYS = ["trainer_welcome", "user_welcome", "instagram_message"] as const;
export type SiteTextKey = (typeof SITE_TEXT_KEYS)[number];

export const DEFAULT_TRAINER_WELCOME = [
  "{hello}",
  "Я Trenioby и пишу тебе от портала trenio.by. Мы очень рады, что ты с нами. Хорошо, что ты теперь здесь.",
  "trenio.by помогает людям в Беларуси найти тренера, а тебе — спокойно показать себя и свои тренировки. Здесь можно общаться, следить за своей популярностью и просто быть на связи.",
  "Профиль стоит растить: живые отзывы, репутация, оценки. Чем понятнее и теплее страница, тем выше ты стоишь среди остальных.",
  "Денег за размещение мы не берём, никакой оплаты за карточку нет.",
  "В будущем хотим сделать запись на тренировки и постепенно заменить сервисы вроде YClients: расписание и клиенты рядом, в том же месте.",
  "Если появится вопрос или захочется что-то сказать, пиши прямо в этот диалог.",
  "Если ты хочешь, чтобы это приложение было постоянно в доступе, пройди {telegram} и получи miniApp в своём телефоне.",
].join("\n\n");

export const DEFAULT_USER_WELCOME = [
  "Подтвердите почту",
  "---",
  "Остался один шаг, чтобы пользоваться trenio.by.",
  "---",
  "Подтвердить почту",
  "---",
  "Ссылка действует сутки. Никому её не пересылайте.",
].join("\n");

/** The site name in the first Instagram message. Instagram linkifies the address, not a separate label. */
export const OUTREACH_SITE_LINK = "https://trenio.by";

/** Turn the words «trenio by» into the address Instagram can open. */
export function outreachWithSiteLink(text: string) {
  return text.replaceAll("trenio by", OUTREACH_SITE_LINK);
}

/** First Instagram direct message. The short link is copied separately and sent later. */
export const DEFAULT_INSTAGRAM_MESSAGE = [
  "{hello}",
  "",
  "Мы развиваем trenio by – единую базу тренеров Беларуси, которая помогает людям находить подходящих специалистов в разных спортивных направлениях.",
  "Нам очень понравился ваш профиль, поэтому хотели бы пригласить вас присоединиться к нашему каталогу! Будем рады, если вы станете его частью.",
  "",
  "Подскажите, было бы вам интересно такое предложение?",
  "Участие в проекте и дополнительное продвижение вашей анкеты абсолютно бесплатны.",
].join("\n");

/**
 * Instagram letter after an application, when the page is already prepared.
 * `{hello}` is the given name. `{doorUrl}` is that trainer's short link.
 * Do not add sports or other profile facts.
 */
export const DEFAULT_CLAIM_INSTAGRAM_MESSAGE = [
  "{hello}",
  "",
  "Мы увидели вашу заявку на https://trenio.by и уже подготовили страницу.",
  "",
  "Откройте её, посмотрите, всё ли на месте, и опубликуйте в кабинете:",
  "{doorUrl}",
  "",
  "После публикации страницу можно менять в любой момент: править текст, фото и остальные сведения и управлять тем, что видят посетители. Участие и продвижение анкеты бесплатные.",
].join("\n");

/** The application letter with this trainer's given name and short link. */
export function renderClaimInstagramMessage(firstName: string, doorUrl: string) {
  return DEFAULT_CLAIM_INSTAGRAM_MESSAGE
    .replaceAll("{hello}", outreachHello(firstName))
    .replaceAll("{doorUrl}", doorUrl);
}

/** The saved row still holds an older letter that includes the short link. Do not send that as the first message. */
export function outreachTemplate(saved: string) {
  const body = saved.trim();
  if (!body || body.includes("{doorUrl}")) return DEFAULT_INSTAGRAM_MESSAGE;
  return body;
}

export const SITE_TEXT_DEFAULTS: Record<SiteTextKey, string> = {
  trainer_welcome: DEFAULT_TRAINER_WELCOME,
  user_welcome: DEFAULT_USER_WELCOME,
  instagram_message: DEFAULT_INSTAGRAM_MESSAGE,
};

function escapeText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function welcomeHello(firstName: string) {
  const name = firstName.trim();
  return name ? `${name}, привет!` : "Привет!";
}

/** Opening line of the first Instagram message. */
export function outreachHello(firstName: string) {
  const name = firstName.trim();
  return name ? `${name}, добрый день!` : "Добрый день!";
}

/** The in-app letter a new trainer receives. `{hello}` and `{telegram}` come from the saved text. */
export function renderTrainerWelcome(firstName: string, template = DEFAULT_TRAINER_WELCOME) {
  const source = template.trim() || DEFAULT_TRAINER_WELCOME;
  const telegram = `<a href="${PORTAL_TELEGRAM_URL}">верификацию через Telegram</a>`;
  const filled = escapeText(source)
    .replaceAll("{hello}", escapeText(welcomeHello(firstName)))
    .replaceAll("{telegram}", telegram);
  const paragraphs = filled
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, "<br>")}</p>`);
  return sanitizeReviewHtml(paragraphs.join(""));
}

export type UserWelcomeLetter = {
  title: string;
  lead: string;
  button: string;
  note: string;
  subject: string;
};

/** Signup letter for a new user. Four parts, split by a line that is only `---`. */
export function parseUserWelcome(template = DEFAULT_USER_WELCOME): UserWelcomeLetter {
  const fallback = DEFAULT_USER_WELCOME.split("\n---\n").map((part) => part.trim());
  const parts = (template.trim() || DEFAULT_USER_WELCOME).replace(/\r\n/g, "\n").split("\n---\n").map((part) => part.trim());
  const title = parts[0] || fallback[0] || "Подтвердите почту";
  const lead = parts[1] || fallback[1] || "";
  const button = parts[2] || fallback[2] || "Подтвердить почту";
  const note = parts[3] || fallback[3] || "";
  return {
    title,
    lead,
    button,
    note,
    subject: title.includes("trenio.by") ? title : `${title} trenio.by`,
  };
}

export function userWelcomePartCount(template: string) {
  return template.replace(/\r\n/g, "\n").split("\n---\n").map((part) => part.trim()).filter(Boolean).length;
}

export function instagramGaps(missing: string[]) {
  if (missing.length === 0) return "Открой страницу и глянь, всё ли на месте.";
  return ["Сверь на странице то, чего не было в открытых данных:", ...missing.map((line) => `— ${line}`)].join("\n");
}

/** Text copied into an Instagram direct message. Tokens are filled for that trainer. */
export function renderInstagramMessage(input: {
  template?: string;
  hello: string;
  gaps: string;
  doorUrl: string;
}) {
  const source = input.template?.trim() || DEFAULT_INSTAGRAM_MESSAGE;
  return source
    .replaceAll("{hello}", input.hello)
    .replaceAll("{gaps}", input.gaps)
    .replaceAll("{doorUrl}", input.doorUrl);
}
