import { normalizeBelarusMobile, storedBelarusPhone, validateBelarusMobile } from "@/lib/auth/phone";
import { parseInstagramHandle, parseTelegramHandle } from "@/lib/catalog/trainer-welcome";

/**
 * What the cabinet shows as Instagram.
 * An imported profile keeps the nick in `instagram_handle` even when the URL field is empty.
 * A self-made nick (`self…`) is not an Instagram account.
 */
export function cabinetInstagram(input: {
  instagramUrl: string;
  instagramHandle: string;
  createdSource: string;
}): string {
  const url = input.instagramUrl.trim();
  if (parseInstagramHandle(url)) return url;
  if (input.createdSource !== "import") return "";
  const handle = parseInstagramHandle(input.instagramHandle);
  if (!handle) return "";
  return `https://instagram.com/${handle}`;
}

export type TelegramPhoneAction =
  | { kind: "ignore" }
  | { kind: "keep" }
  | { kind: "keep-other" }
  | { kind: "store"; phone: string; replacedUnverified: boolean };

/**
 * A phone that arrived inside signed Telegram data.
 * A verified different number stays. An empty or unverified number takes the Telegram one.
 * The result never names Telegram fields: the caller must not write them from this decision.
 */
export function decideTelegramPhone(
  currentRaw: string,
  verified: boolean,
  incomingRaw: string | null,
): TelegramPhoneAction {
  const incoming = incomingRaw ? storedBelarusPhone(incomingRaw) : null;
  if (!incoming) return { kind: "ignore" };
  const current = storedBelarusPhone(currentRaw);
  if (!current) return { kind: "store", phone: incoming, replacedUnverified: false };
  if (normalizeBelarusMobile(current) === normalizeBelarusMobile(incoming)) {
    return verified ? { kind: "keep" } : { kind: "store", phone: incoming, replacedUnverified: false };
  }
  if (verified) return { kind: "keep-other" };
  return { kind: "store", phone: incoming, replacedUnverified: true };
}

export type TelegramCardDecision =
  | { kind: "missing" }
  | { kind: "mismatch" }
  | { kind: "verify"; handle: string }
  | { kind: "write"; handle: string };

/** The card handle is written only when it is empty. A different public name is refused. */
export function decideTelegramCard(savedRaw: string, incomingRaw: string | null): TelegramCardDecision {
  const incoming = incomingRaw ? parseTelegramHandle(incomingRaw) : null;
  if (!incoming) return { kind: "missing" };
  const saved = parseTelegramHandle(savedRaw);
  if (!saved) return { kind: "write", handle: incoming };
  if (saved.toLowerCase() !== incoming.toLowerCase()) return { kind: "mismatch" };
  return { kind: "verify", handle: saved };
}

export type TelegramConfirmPlan = {
  error: "missing" | "mismatch" | null;
  decision: TelegramCardDecision;
  phone: TelegramPhoneAction;
};

/**
 * Telegram confirm and the phone that came with it.
 * A refused handle does not adopt the phone. An unsigned or foreign number does not change the phone.
 */
export function planTrainerTelegramConfirm(input: {
  savedTelegram: string;
  incomingUsername: string | null;
  currentPhone: string;
  phoneVerified: boolean;
  incomingPhone: string | null;
  acceptPhone: boolean;
}): TelegramConfirmPlan {
  const decision = decideTelegramCard(input.savedTelegram, input.incomingUsername);
  const error = decision.kind === "missing" || decision.kind === "mismatch" ? decision.kind : null;
  const phone = error || !input.acceptPhone
    ? { kind: "ignore" as const }
    : decideTelegramPhone(input.currentPhone, input.phoneVerified, input.incomingPhone);
  return { error, decision, phone };
}

/** SMS adds a phone and nothing else. Telegram columns are not part of the result. */
export function planSmsPhone(phoneRaw: string): { phone: string | null; error: string | null; touchesTelegram: false } {
  const error = validateBelarusMobile(phoneRaw);
  if (error) return { phone: null, error, touchesTelegram: false };
  return { phone: storedBelarusPhone(phoneRaw), error: null, touchesTelegram: false };
}

/**
 * Phone taken from a signed Telegram contact.
 * `touchesTelegram` stays false: this path must not link a username or a Telegram id.
 */
export function planTrainerPhoneOnly(input: {
  currentPhone: string;
  phoneVerified: boolean;
  incomingPhone: string | null;
  proofMatchesContact: boolean;
}): { phone: TelegramPhoneAction; touchesTelegram: false } {
  if (!input.proofMatchesContact) return { phone: { kind: "ignore" }, touchesTelegram: false };
  return {
    phone: decideTelegramPhone(input.currentPhone, input.phoneVerified, input.incomingPhone),
    touchesTelegram: false,
  };
}
