import { isPendingSignupEmail } from "@/lib/auth/pending-email";

/** A real mailbox the person has proved. Pending signup shells are not one. */
export function canReceiveMailbox(email: string, emailVerifiedAt: Date | null): boolean {
  return Boolean(emailVerifiedAt) && !isPendingSignupEmail(email);
}

/** Direct-message letter: the switch is on and the mailbox is verified. */
export function messageMailAllowed(input: {
  email: string;
  emailVerifiedAt: Date | null;
  allowsMessages: boolean;
}): boolean {
  return input.allowsMessages && canReceiveMailbox(input.email, input.emailVerifiedAt);
}

/**
 * Telegram notice for a direct message.
 * Any participant who already opened the bot or the Mini App. The phone then shows Telegram's own notice.
 */
export function messageTelegramNoticeAllowed(input: {
  telegramUserId: number | null;
  botSeenAt: Date | null;
}): boolean {
  return input.telegramUserId != null && input.botSeenAt != null;
}

/**
 * Older owner-only check. A confirmed card contact, a stored chat id, and a bot chat that already exists.
 */
export function trainerTelegramNoticeAllowed(input: {
  isProfileOwner: boolean;
  telegramUserId: number | null;
  telegramVerifiedAt: Date | null;
  botSeenAt: Date | null;
}): boolean {
  return (
    input.isProfileOwner &&
    input.telegramUserId != null &&
    input.telegramVerifiedAt != null &&
    input.botSeenAt != null
  );
}

/** Inline button. Mini App buttons need https; any other absolute URL stays a normal link. */
export function telegramThreadButton(url: string): { inline_keyboard: Array<Array<Record<string, unknown>>> } | null {
  if (url.startsWith("https://")) {
    return { inline_keyboard: [[{ text: "Открыть переписку", web_app: { url } }]] };
  }
  if (url.startsWith("http://")) {
    return { inline_keyboard: [[{ text: "Открыть переписку", url }]] };
  }
  return null;
}

/** Another browser only. The first open session, an empty agent, and the same agent stay quiet. */
export function isNewBrowserLogin(input: { incomingUserAgent: string; liveUserAgents: string[] }): boolean {
  const incoming = input.incomingUserAgent.trim();
  if (!incoming || input.liveUserAgents.length === 0) return false;
  return !input.liveUserAgents.some((agent) => agent.trim() === incoming);
}

export function browserLabel(userAgent: string): string {
  return userAgent.replace(/\s+/g, " ").replace(/\p{C}/gu, "").trim().slice(0, 160);
}

const PROFILE_STATUS_LETTERS: Record<string, { subject: string; title: string; lead: string }> = {
  published: {
    subject: "Карточка опубликована trenio.by",
    title: "Карточка опубликована",
    lead: "Теперь её видно в каталоге.",
  },
  hidden: {
    subject: "Карточка скрыта trenio.by",
    title: "Карточка скрыта",
    lead: "В каталоге её сейчас нет. В кабинете она на месте.",
  },
  archived: {
    subject: "Карточка в архиве trenio.by",
    title: "Карточка в архиве",
    lead: "В каталоге её больше нет.",
  },
  draft: {
    subject: "Карточка на модерации trenio.by",
    title: "Карточка на модерации",
    lead: "Пока её нет в каталоге.",
  },
};

/** Null when the status did not change or the next status has no letter. */
export function profileStatusNotice(previous: string, next: string): { subject: string; title: string; lead: string } | null {
  if (previous === next) return null;
  return PROFILE_STATUS_LETTERS[next] ?? null;
}

export const NEW_BROWSER_LETTER = {
  subject: "Новый вход trenio.by",
  title: "Новый вход",
  lead: "В ваш аккаунт вошли с другого браузера.",
  note: "Если это были не вы, смените пароль.",
  actionLabel: "Открыть настройки",
} as const;

export const ACCOUNT_CLOSED_LETTER = {
  subject: "Аккаунт trenio.by закрыт",
  title: "Аккаунт закрыт",
  lead: "Вы закрыли аккаунт.",
  lines: [
    "Шесть месяцев его можно вернуть: войдите прежней почтой и паролем. На странице входа будет «Восстановить аккаунт».",
    "Потом почта, имя и переписка удалятся.",
  ],
  actionLabel: "Войти",
  sms: "Trenio.by: вы закрыли аккаунт на 6 месяцев. Вернуть его можно на странице входа.",
} as const;

export function reviewReplyAudience(role: "trainer" | "author"): "author" | "owner" {
  return role === "trainer" ? "author" : "owner";
}
