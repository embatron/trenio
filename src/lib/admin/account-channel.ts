import { displayAccountLogin } from "@/lib/auth/login-name";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { formatBelarusPhone } from "@/lib/auth/phone";

export type ConfirmedAccount = {
  email: string;
  emailVerifiedAt: string | null;
  phone: string;
  phoneVerifiedAt: string | null;
};

function confirmedAt(value: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

/** The mailbox or Belarus mobile that first confirmed the account. Empty when neither is confirmed. */
export function confirmedAccountValue(account: ConfirmedAccount | null): string {
  if (!account) return "";
  const email = account.email.trim();
  const phone = formatBelarusPhone(account.phone);
  const emailReady = Boolean(email) && !isPendingSignupEmail(email) && Number.isFinite(Date.parse(account.emailVerifiedAt ?? ""));
  const phoneReady = Boolean(phone) && Number.isFinite(Date.parse(account.phoneVerifiedAt ?? ""));
  if (emailReady && phoneReady) {
    return confirmedAt(account.emailVerifiedAt) <= confirmedAt(account.phoneVerifiedAt)
      ? displayAccountLogin(email)
      : phone;
  }
  if (emailReady) return displayAccountLogin(email);
  if (phoneReady) return phone;
  return "";
}
