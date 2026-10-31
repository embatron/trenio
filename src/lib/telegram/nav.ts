import { SITE_EMAIL } from "@/lib/seo/site";

export type TelegramNavItem = {
  label: string;
  path: string;
  command: string;
  text: string;
};

/** Same sections as the site footer and the two cabinets. Order is the bot keyboard, then the Mini App bar. */
export const TELEGRAM_NAV: readonly TelegramNavItem[] = [
  {
    label: "Тренеры",
    path: "/",
    command: "trainers",
    text: "Каталог тренеров: город, вид спорта и карточки.",
  },
  {
    label: "Категории",
    path: "/categories/",
    command: "categories",
    text: "Виды спорта. Откройте раздел и выберите занятие.",
  },
  {
    label: "На карте",
    path: "/map",
    command: "map",
    text: "Тренеры на карте. Можно сузить город и вид спорта.",
  },
  {
    label: "Сообщения",
    path: "/account/messages",
    command: "messages",
    text: "Написать тренеру или клубу. Нужен вход.",
  },
  {
    label: "Мой кабинет",
    path: "/account",
    command: "account",
    text: "Кабинет клиента: сообщения, отзывы, избранное и настройки.",
  },
  {
    label: "Кабинет тренера",
    path: "/me",
    command: "me",
    text: "Кабинет тренера: карточка, отзывы и сообщения.",
  },
  {
    label: "Стать тренером",
    path: "/join/trainer",
    command: "join",
    text: "Заявка тренера. Можно оставить Instagram, Telegram или телефон.",
  },
  {
    label: "Контакты",
    path: "/contacts",
    command: "contacts",
    text: `Почта ${SITE_EMAIL}.`,
  },
];

export type TelegramKeyboardButton =
  | { text: string }
  | { text: string; web_app: { url: string } };

const COMMANDS = new Map<string, string>([
  ["/start", "home"],
  ["/menu", "home"],
  ...TELEGRAM_NAV.map((item) => [`/${item.command}`, item.command] as const),
]);

const LABELS = new Map(TELEGRAM_NAV.map((item) => [item.label, item.command]));

export function telegramPublicOrigin(appUrl = process.env.APP_URL): string {
  const configured = appUrl?.trim().replace(/\/$/, "") ?? "";
  if (configured.startsWith("https://")) return configured;
  return "https://trenio.by";
}

export function telegramNavUrl(origin: string, path: string): string {
  return `${origin.replace(/\/$/, "")}${path}`;
}

function webAppButton(label: string, url: string): TelegramKeyboardButton {
  if (url.startsWith("https://")) return { text: label, web_app: { url } };
  return { text: label };
}

export function telegramMainKeyboard(origin: string): TelegramKeyboardButton[][] {
  const base = telegramPublicOrigin(origin);
  const rows: TelegramKeyboardButton[][] = [];
  for (let index = 0; index < TELEGRAM_NAV.length; index += 2) {
    const pair = TELEGRAM_NAV.slice(index, index + 2).map((item) =>
      webAppButton(item.label, telegramNavUrl(base, item.path)),
    );
    rows.push(pair);
  }
  return rows;
}

export function resolveTelegramAction(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  const command = (head ?? "").split("@")[0]?.toLowerCase() ?? "";
  if (command.startsWith("/")) {
    if (command === "/start" && rest[0]) {
      const payload = rest[0].toLowerCase();
      if (TELEGRAM_NAV.some((item) => item.command === payload)) return payload;
    }
    return COMMANDS.get(command) ?? null;
  }
  return LABELS.get(trimmed) ?? null;
}

export function telegramNavItem(action: string): TelegramNavItem | null {
  return TELEGRAM_NAV.find((item) => item.command === action) ?? null;
}

export function activeTelegramNavPath(pathname: string): string | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  const ranked = [...TELEGRAM_NAV].sort((left, right) => right.path.length - left.path.length);
  for (const item of ranked) {
    const itemPath = item.path.replace(/\/+$/, "") || "/";
    if (itemPath === "/") {
      if (path === "/") return item.path;
      continue;
    }
    if (path === itemPath || path.startsWith(`${itemPath}/`)) return item.path;
  }
  return null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function telegramHomeText(): string {
  return [
    "<b>trenio.by</b>",
    "",
    "Поиск тренеров и спортивных занятий в Беларуси.",
    "",
    "Кнопки внизу открывают каталог, карту, сообщения и кабинеты.",
  ].join("\n");
}

export function telegramSectionText(item: TelegramNavItem, origin: string): string {
  const href = telegramNavUrl(origin, item.path);
  return [
    `<b>${escapeHtml(item.label)}</b>`,
    "",
    escapeHtml(item.text),
    "",
    `<a href="${escapeHtml(href)}">${escapeHtml(item.label)}</a>`,
  ].join("\n");
}
