/** Where a published-profile visit came from. The raw address is not stored. */
export const VISIT_SOURCES = ["direct", "search", "social", "instagram", "chat", "catalog", "other"] as const;

export type VisitSource = (typeof VISIT_SOURCES)[number];

export const VISIT_SOURCE_TITLE: Record<VisitSource, string> = {
  direct: "Прямой заход",
  search: "Поиск",
  social: "Социальные сети",
  instagram: "Instagram",
  chat: "Чаты",
  catalog: "Каталог",
  other: "Другой сайт",
};

export const VISIT_SOURCE_NOTE: Record<VisitSource, string> = {
  catalog: "Переход с главной, из раздела, города, карты или клуба.",
  search: "Google, Яндекс, Bing, DuckDuckGo и другие поисковые системы, если браузер передал их адрес.",
  instagram: "Адрес Instagram или короткая ссылка из письма, которую мы помечаем сами.",
  social: "ВКонтакте, Facebook, TikTok, YouTube, Threads и другие. Instagram считается отдельно.",
  chat: "Telegram, WhatsApp, Viber, Messenger или переход из наших сообщений.",
  direct: "Предыдущей страницы нет: адрес ввели сами, открыли закладку, или приложение стёрло адрес.",
  other: "Чужой сайт, который не поиск, не социальная сеть и не чат.",
};

export const VISIT_SOURCE_LABEL: Record<VisitSource, string> = {
  direct: "прямой заход",
  search: "поиск",
  social: "социальные сети",
  instagram: "Instagram",
  chat: "чаты",
  catalog: "каталог",
  other: "другой сайт",
};

const SEARCH_HOSTS = ["yandex.by", "yandex.ru", "yandex.com", "yandex.kz", "ya.ru", "bing.com", "duckduckgo.com", "search.yahoo.com", "go.mail.ru", "rambler.ru", "ecosia.org"];
const CHAT_HOSTS = ["t.me", "telegram.me", "telegram.org", "whatsapp.com", "wa.me", "viber.com", "messenger.com", "m.me"];
const SOCIAL_HOSTS = ["vk.com", "vk.ru", "ok.ru", "facebook.com", "fb.com", "fb.me", "twitter.com", "x.com", "t.co", "tiktok.com", "youtube.com", "youtu.be", "threads.net", "linkedin.com", "pinterest.com", "snapchat.com"];

export function knownVisitSource(value: string | null | undefined): VisitSource | null {
  const text = value?.trim() ?? "";
  return (VISIT_SOURCES as readonly string[]).includes(text) ? text as VisitSource : null;
}

function hostOf(name: string, domain: string) {
  return name === domain || name.endsWith(`.${domain}`);
}

function isOwn(host: string) {
  return host === "trenio.by" || host === "trenio.local" || host === "localhost" || host === "127.0.0.1";
}

function isGoogle(host: string) {
  if (/^(mail|accounts|docs|drive|calendar|meet)\./.test(host)) return false;
  return /(^|\.)google\.[a-z.]+$/.test(host);
}

function isSearch(host: string) {
  return isGoogle(host) || SEARCH_HOSTS.some((domain) => hostOf(host, domain));
}

function isChat(host: string) {
  return CHAT_HOSTS.some((domain) => hostOf(host, domain));
}

function isSocial(host: string) {
  return SOCIAL_HOSTS.some((domain) => hostOf(host, domain));
}

/**
 * The first arrival of the day. `src` is a mark we put on our own link,
 * because a new tab with noreferrer and a client-side move keep no previous address.
 * An empty address is a direct open. A site we do not recognise stays «другой сайт».
 */
export function visitSource(input: { referrer?: string | null; src?: string | null }): VisitSource {
  const explicit = knownVisitSource(input.src);
  if (explicit) return explicit;
  const referrer = input.referrer?.trim() ?? "";
  if (!referrer) return "direct";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "direct";
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (isOwn(host)) {
    const path = url.pathname;
    if (path.startsWith("/account/messages") || path.startsWith("/me/messages") || path.startsWith("/admin/messages")) return "chat";
    return "catalog";
  }
  if (hostOf(host, "instagram.com")) return "instagram";
  if (isChat(host)) return "chat";
  if (isSearch(host)) return "search";
  if (isSocial(host)) return "social";
  return "other";
}

export function visitSourceLine(rows: ReadonlyArray<{ source: VisitSource; count: number }>) {
  const visible = rows.filter((row) => row.count > 0);
  if (visible.length === 0) return "";
  return visible.map((row) => `${VISIT_SOURCE_LABEL[row.source]} — ${row.count}`).join(", ");
}
