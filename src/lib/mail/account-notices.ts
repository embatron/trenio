import { eq } from "drizzle-orm";

import { isSmsByEnabled, sendQuickSms } from "@/auth/sms";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { normalizeBelarusMobile } from "@/lib/auth/phone";
import { logCaught } from "@/lib/log/logger";
import { renderLetter, mailSettingsUrl, type LetterPerson } from "@/lib/mail/letter";
import {
  ACCOUNT_CLOSED_LETTER,
  canReceiveMailbox,
  NEW_BROWSER_LETTER,
  PHONE_SMS,
  phoneNoticeInsteadOfMail,
  profileStatusNotice,
} from "@/lib/mail/notice-rules";
import { mailAppUrl, sendMail } from "@/lib/mail/send.server";

type VerifiedLetter = {
  email: string;
  emailVerifiedAt: Date | null;
  subject: string;
  title: string;
  lead?: string;
  lines?: string[];
  action?: { href: string; label: string };
  note?: string;
};

async function letterPerson(email: string): Promise<LetterPerson> {
  const [row] = await getDb()
    .select({ firstName: users.firstName, lastName: users.lastName, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  return {
    name: [row?.firstName, row?.lastName].filter(Boolean).join(" ") || "Ваш аккаунт",
    avatarUrl: row?.avatarPath || undefined,
  };
}

/** Service letter. Returns false when the mailbox is not verified. */
export async function sendVerifiedServiceMail(input: VerifiedLetter): Promise<boolean> {
  if (!canReceiveMailbox(input.email, input.emailVerifiedAt)) return false;
  const letter = renderLetter({
    service: true,
    title: input.title,
    lead: input.lead,
    person: await letterPerson(input.email),
    lines: input.lines,
    action: input.action,
    note: input.note,
  });
  await sendMail({
    to: [input.email],
    subject: input.subject,
    text: letter.text,
    html: letter.html,
  });
  return true;
}

export async function sendNewBrowserNotice(input: {
  email: string;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  actorUserId: string;
}): Promise<void> {
  try {
    const sent = await sendVerifiedServiceMail({
      email: input.email,
      emailVerifiedAt: input.emailVerifiedAt,
      subject: NEW_BROWSER_LETTER.subject,
      title: NEW_BROWSER_LETTER.title,
      lead: NEW_BROWSER_LETTER.lead,
      note: NEW_BROWSER_LETTER.note,
      action: { href: mailSettingsUrl(), label: NEW_BROWSER_LETTER.actionLabel },
    });
    if (sent || !phoneNoticeInsteadOfMail(input)) return;
    const phone = normalizeBelarusMobile(input.phone ?? "");
    if (!phone || !isSmsByEnabled()) return;
    await sendQuickSms(phone, PHONE_SMS.newBrowser);
  } catch (error) {
    logCaught("email", "email.notice", error, {
      subject: isPendingSignupEmail(input.email) ? null : input.email,
      actorUserId: input.actorUserId,
    });
  }
}

export async function sendProfileStatusNotice(input: {
  email: string;
  emailVerifiedAt: Date | null;
  slug: string;
  previous: string;
  next: string;
}): Promise<void> {
  const note = profileStatusNotice(input.previous, input.next);
  if (!note) return;
  const published = input.next === "published";
  try {
    await sendVerifiedServiceMail({
      email: input.email,
      emailVerifiedAt: input.emailVerifiedAt,
      subject: note.subject,
      title: note.title,
      lead: note.lead,
      action: {
        href: published ? `${mailAppUrl()}/trainers/${input.slug}` : `${mailAppUrl()}/me`,
        label: published ? "Открыть карточку" : "Открыть кабинет",
      },
    });
  } catch (error) {
    logCaught("email", "email.notice", error, { subject: input.email, target: input.slug });
  }
}

export async function sendAccountClosedNotice(input: {
  email: string;
  emailVerifiedAt: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  actorUserId: string;
}): Promise<void> {
  try {
    const sent = await sendVerifiedServiceMail({
      email: input.email,
      emailVerifiedAt: input.emailVerifiedAt,
      subject: ACCOUNT_CLOSED_LETTER.subject,
      title: ACCOUNT_CLOSED_LETTER.title,
      lead: ACCOUNT_CLOSED_LETTER.lead,
      lines: [...ACCOUNT_CLOSED_LETTER.lines],
      action: { href: `${mailAppUrl()}/auth/login`, label: ACCOUNT_CLOSED_LETTER.actionLabel },
    });
    if (sent || !input.phoneVerifiedAt || !isSmsByEnabled()) return;
    const phone = normalizeBelarusMobile(input.phone ?? "");
    if (!phone) return;
    await sendQuickSms(phone, ACCOUNT_CLOSED_LETTER.sms);
  } catch (error) {
    logCaught("email", "email.notice", error, {
      subject: isPendingSignupEmail(input.email) ? null : input.email,
      actorUserId: input.actorUserId,
    });
  }
}
