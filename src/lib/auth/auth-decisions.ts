import { isPendingSignupEmail } from "@/lib/auth/pending-email";

export type EmailSignupKind = "none" | "unverified" | "verified" | "blocked";

/** A short-link trainer proved a Belarus mobile, so the placeholder mailbox is not a second gate. */
export function phoneStandsInForMailbox(user: {
  email: string;
  phoneVerified: boolean;
  lastSignupIntent: string | null;
}): boolean {
  return Boolean(user.phoneVerified)
    && user.lastSignupIntent === "trainer_claim"
    && isPendingSignupEmail(user.email);
}

/**
 * A confirmed Belarus mobile is a login channel on its own.
 * The placeholder mailbox stays until the person chooses to add a real one.
 */
export function mailboxStillRequired(user: {
  email: string;
  phoneVerified: boolean;
}): boolean {
  return isPendingSignupEmail(user.email) && !user.phoneVerified;
}

/** Public email signup never opens a session. An unverified row can be refreshed. */
export function decideEmailSignup(kind: EmailSignupKind): "create" | "refresh" | "notice" {
  if (kind === "none") return "create";
  if (kind === "unverified") return "refresh";
  return "notice";
}

export type SmsSignupChoice = "create" | "login" | "refuse";

/**
 * A register code logs in only the account that already owned the number
 * when the code was issued, and only while that account still owns it.
 */
export function decideSmsSignup(input: {
  challengeUserId: string | null;
  ownerStillHasPhone: boolean;
  phoneIsFree: boolean;
}): SmsSignupChoice {
  if (input.challengeUserId) {
    return input.ownerStillHasPhone ? "login" : "refuse";
  }
  return input.phoneIsFree ? "create" : "refuse";
}

export type GoogleLinkChoice = "create" | "takeover" | "attach" | "refuse";

function decideMailboxLink(input: {
  exists: boolean;
  blocked: boolean;
  emailVerified: boolean;
  currentSub: string | null;
  incomingSub: string;
}): GoogleLinkChoice {
  if (!input.exists) return "create";
  if (input.blocked) return "refuse";
  if (!input.emailVerified) return "takeover";
  if (input.currentSub && input.currentSub !== input.incomingSub) return "refuse";
  return "attach";
}

/**
 * Google is proof of the mailbox. An unverified password row is replaced.
 * A verified row is entered only when its Google id is empty or the same.
 */
export function decideGoogleLink(input: {
  exists: boolean;
  blocked: boolean;
  emailVerified: boolean;
  googleSub: string | null;
  incomingSub: string;
}): GoogleLinkChoice {
  return decideMailboxLink({ ...input, currentSub: input.googleSub });
}

/** Yandex is the same proof, on `yandex_sub`. A Google id on the row does not block it. */
export function decideYandexLink(input: {
  exists: boolean;
  blocked: boolean;
  emailVerified: boolean;
  yandexSub: string | null;
  incomingSub: string;
}): GoogleLinkChoice {
  return decideMailboxLink({ ...input, currentSub: input.yandexSub });
}

/** Apple is the same proof, on `apple_sub`. A private-relay mailbox counts as verified. */
export function decideAppleLink(input: {
  exists: boolean;
  blocked: boolean;
  emailVerified: boolean;
  appleSub: string | null;
  incomingSub: string;
}): GoogleLinkChoice {
  return decideMailboxLink({ ...input, currentSub: input.appleSub });
}

export function accountGatePath(user: {
  needsCredentials: boolean;
  needsDoorPassword: boolean;
  needsTotp: boolean;
} | null): "/auth/credentials" | "/auth/password" | "/auth/totp" | null {
  if (!user) return null;
  if (user.needsCredentials) return "/auth/credentials";
  if (user.needsDoorPassword) return "/auth/password";
  if (user.needsTotp) return "/auth/totp";
  return null;
}

export function gateAllowsPath(pathname: string, gate: string): boolean {
  if (pathname === gate) return true;
  if (pathname.startsWith("/auth/confirm-email")) return true;
  if (pathname.startsWith("/auth/reset-password")) return true;
  if (pathname.startsWith("/auth/set-password")) return true;
  if (pathname.startsWith("/auth/forgot-password")) return true;
  if (pathname.startsWith("/hi/")) return true;
  if (gate === "/auth/password" && pathname.startsWith("/trainers/")) return true;
  if (pathname.startsWith("/offline")) return true;
  return false;
}
