import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { compactBelarusPhone } from "@/lib/auth/phone-label";

const NICK_DOMAIN = "nick.trenio.by";
const TOMBSTONE_EMAIL_RE = /^deleted\.[0-9a-f-]{36}@users\.trenio\.invalid$/i;
const PLACEHOLDER_NAME = "Пользователь";

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

/** The part before @. A pending or deleted shell has no public nick. */
export function mailboxLocalName(email: string | null | undefined): string | null {
  const raw = (email ?? "").trim().toLowerCase();
  if (!raw.includes("@") || isPendingSignupEmail(raw) || TOMBSTONE_EMAIL_RE.test(raw)) return null;
  const local = raw.slice(0, raw.indexOf("@")).trim();
  if (!local || local.length > 100) return null;
  return local;
}

/**
 * A typed name stays. A phone mask stays. An empty name or «Пользователь»
 * on a real mailbox becomes the part before @.
 */
export function storedGivenName(firstName: string | null | undefined, email: string | null | undefined): string {
  const current = (firstName ?? "").trim();
  if (current && current !== PLACEHOLDER_NAME) return current;
  return mailboxLocalName(email) || current || PLACEHOLDER_NAME;
}

export function displayAccountLogin(email: string, phone?: string | null): string {
  if (isPendingSignupEmail(email)) return compactBelarusPhone(phone) || "не указана";
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
