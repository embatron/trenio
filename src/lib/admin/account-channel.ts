import { displayAccountLogin } from "@/lib/auth/login-name";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { formatBelarusPhone } from "@/lib/auth/phone";

/** A trainer confirms the account by mailbox or by a Belarus mobile. Either one is enough. */
export type AccountConfirmation = {
  channel: "Почта" | "Телефон";
  value: string;
};

type ConfirmedAccount = {
  email: string;
  emailVerified: boolean;
  phone: string;
  phoneVerified: boolean;
};

/** Channels the owner has actually confirmed, mailbox first. An unverified value stays out. */
export function accountConfirmations(account: ConfirmedAccount | null): AccountConfirmation[] {
  if (!account) return [];
  const lines: AccountConfirmation[] = [];
  if (account.emailVerified && account.email && !isPendingSignupEmail(account.email)) {
    const value = displayAccountLogin(account.email);
    if (value && value !== "не указана") lines.push({ channel: "Почта", value });
  }
  if (account.phoneVerified) {
    const value = formatBelarusPhone(account.phone);
    if (value) lines.push({ channel: "Телефон", value });
  }
  return lines;
}
