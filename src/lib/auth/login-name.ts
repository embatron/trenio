import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";

const NICK_DOMAIN = "nick.trenio.by";

/** A short nick that signs in to a real mailbox. The owner nick stays in the god-user check. */
const MAILBOX_NICKS: Record<string, string> = {
  trenioby: "trenioby@gmail.com",
};

export function mailboxForNick(value: string): string | null {
  return MAILBOX_NICKS[value.trim().toLowerCase()] ?? null;
}

/** Email stays an email. A nick becomes a stable internal address so the same login works later. */
export function resolveAccountLogin(value: string): string {
  const raw = value.trim().toLowerCase();
  if (raw.includes("@")) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) || raw.length > 320) {
      throw new AuthError("Введите почту или ник латиницей.", "VALIDATION");
    }
    return raw;
  }
  if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(raw)) {
    throw new AuthError("Ник: латиница, цифры, точка или дефис, от 3 символов.", "VALIDATION");
  }
  return `${raw}@${NICK_DOMAIN}`;
}

export function displayAccountLogin(email: string): string {
  if (isPendingSignupEmail(email)) return "не указана";
  const suffix = `@${NICK_DOMAIN}`;
  return email.endsWith(suffix) ? email.slice(0, -suffix.length) : email;
}

/** Staff nick: the mailbox map, a nick login, or the part before @. */
export function accountNick(email: string): string {
  const normalized = email.trim().toLowerCase();
  for (const [nick, mailbox] of Object.entries(MAILBOX_NICKS)) {
    if (mailbox === normalized) return nick;
  }
  const shown = displayAccountLogin(normalized);
  if (!shown.includes("@")) return shown;
  const local = shown.split("@")[0]?.trim();
  return local || "Сотрудник";
}
