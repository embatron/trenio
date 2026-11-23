import { SITE_EMAIL } from "@/lib/seo/site";

export type TelegramNavItem = {
  label: string;
  path: string;
  command: string;
  /** Shown in Telegram’s command menu. A short action, not the button label alone. */
  commandDescription: string;
  text: string;
};

/** Opens a private chat. The reply keyboard cannot hold a link, so the bot answers with an inline button. */
export const TELEGRAM_SUPPORT_URL = "https://t.me/embatron";
export const TELEGRAM_SUPPORT_LABEL = "Написать менеджеру";
/** The previous button text. An old keyboard still sends it. */
const TELEGRAM_SUPPORT_LABEL_PREVIOUS = "Написать @embatron";

/** Same sections as the site footer and the two cabinets. Order is the bot keyboard, then the Mini App bar. */
export const TELEGRAM_NAV: readonly TelegramNavItem[] = [
  {
    label: "Тренеры",
    path: "/",
    command: "trainers",
    commandDescription: "Каталог тренеров",
    text: "Город, вид спорта и карточки тренеров.",
  },
  {
    label: "Категории",
    path: "/categories/",
    command: "categories",
    commandDescription: "Виды спорта",
    text: "Разделы спорта. Откройте нужное занятие.",
  },
  {
    label: "На карте",
    path: "/map",
    command: "map",
    commandDescription: "Тренеры на карте",
    text: "Тренеры на карте города.",
  },
  {
    label: "Сообщения",
    path: "/account/messages",
    command: "messages",
    commandDescription: "Написать тренеру",
    text: "Переписка с тренером или клубом. Нужен вход.",
  },
  {
    label: "Мой кабинет",
    path: "/account",
    command: "account",
    commandDescription: "Кабинет клиента",
    text: "Сообщения, отзывы, избранное и настройки.",
  },
  {
    label: "Кабинет тренера",
    path: "/me",
    command: "me",
    commandDescription: "Кабинет тренера",
    text: "Карточка, отзывы и сообщения.",
  },
  {
    label: "Стать тренером",
    path: "/join/trainer",
    command: "join",
    commandDescription: "Оставить заявку",
    text: "Заявка. Можно указать Instagram, Telegram или телефон.",
  },
  {
    label: "Контакты",
    path: "/contacts",
    command: "contacts",
    commandDescription: "Почта и вопросы",
    text: `Почта ${SITE_EMAIL}.`,
  },
];

export type TelegramKeyboardButton =
  | { text: string }
  | { text: string; web_app: { url: string } };

export function telegramPrivateCommands(): Array<{ command: string; description: string }> {
  return [
    { command: "start", description: "Открыть меню" },
    ...TELEGRAM_NAV.map((item) => ({ command: item.command, description: item.commandDescription })),
  ];
}

export function telegramGroupCommands(): Array<{ command: string; description: string }> {
  return [{ command: "start", description: "Сводка в этом чате" }];
}

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
  rows.push([{ text: TELEGRAM_SUPPORT_LABEL }]);
  return rows;
}

export function telegramSupportText(): string {
  return `По всем вопросам напишите <a href="${TELEGRAM_SUPPORT_URL}">менеджеру</a>.`;
}

export function telegramSupportInlineKeyboard(): { inline_keyboard: Array<Array<{ text: string; url: string }>> } {
  return {
    inline_keyboard: [[{ text: TELEGRAM_SUPPORT_LABEL, url: TELEGRAM_SUPPORT_URL }]],
  };
}

export function resolveTelegramAction(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const [head, ...rest] = trimmed.split(/\s+/);
  const command = (head ?? "").split("@")[0]?.toLowerCase() ?? "";
  if (trimmed === TELEGRAM_SUPPORT_LABEL || trimmed === TELEGRAM_SUPPORT_LABEL_PREVIOUS) return "support";
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

export function telegramHomeText(account: { firstName: string } | null): string {
  const lines = [
    "<b>Trenio</b> — каталог тренеров и клубов в Беларуси.",
    "",
    "Кнопки внизу открывают каталог, карту, сообщения и кабинеты.",
    "Кнопка «Написать менеджеру» внизу.",
  ];
  if (account?.firstName.trim()) {
    lines.push("", `Этот Telegram привязан к аккаунту ${escapeHtml(account.firstName)}.`);
  }
  return lines.join("\n");
}

export function telegramUnknownText(): string {
  return "Напишите /start, и я покажу разделы.";
}

/** One line for the staff group. No site keyboard. */
export function telegramGroupText(): string {
  return "Каждый день в 10:00 напишу, сколько тренеров опубликовано за сутки.";
}

/** Extra line for cabinets. The name is already escaped. */
export function telegramSectionNote(action: string, account: { firstName: string } | null): string | null {
  if (action !== "messages" && action !== "account" && action !== "me") return null;
  if (!account) return "Этот Telegram ещё не привязан, поэтому кабинет попросит вход.";
  return `Вход откроет аккаунт ${escapeHtml(account.firstName)}.`;
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
