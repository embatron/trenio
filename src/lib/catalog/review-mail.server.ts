import { and, eq, inArray } from "drizzle-orm";

import { displayAccountLogin } from "@/lib/auth/login-name";
import { getDb } from "@/db";
import { userRoles, users, trainerProfiles } from "@/db/schema";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import { reviewPlainText } from "@/lib/catalog/review-html";
import { writeLog } from "@/lib/log/logger";
import { renderLetter } from "@/lib/mail/letter";
import { canReceiveMailbox } from "@/lib/mail/notice-rules";
import { recipientAllowsMail } from "@/lib/mail/preferences";
import { mailAppUrl, sendMail } from "@/lib/mail/send.server";

async function staffEmails() {
  const rows = await getDb()
    .select({ email: users.email })
    .from(users)
    .innerJoin(userRoles, eq(userRoles.userId, users.id))
    .where(and(inArray(userRoles.role, ["admin", "superadmin"]), eq(users.status, "active")));
  return [...new Set(rows.map((row) => row.email))];
}

export async function notifyStaffAboutReview(input: {
  authorName: string;
  authorEmail: string;
  trainerSlug: string;
  rating: number;
  body: string;
}) {
  const trainer = getPublishedTrainer(input.trainerSlug)?.name ?? input.trainerSlug;
  const [author] = await getDb()
    .select({ avatarPath: users.avatarPath, phone: users.phone })
    .from(users)
    .where(eq(users.email, input.authorEmail))
    .limit(1);
  const letter = renderLetter({
    service: true,
    title: "Новый отзыв ждёт модерации",
    person: {
      name: input.authorName,
      avatarUrl: author?.avatarPath,
      caption: displayAccountLogin(input.authorEmail, author?.phone),
    },
    quote: reviewPlainText(input.body),
    lines: [`Тренер: ${trainer}`, `Оценка: ${input.rating} из 5`],
    action: { href: `${mailAppUrl()}/admin/reviews`, label: "Разобрать" },
  });
  await sendMail({
    to: await staffEmails(),
    subject: `Отзыв на модерации: ${trainer}`,
    text: letter.text,
    html: letter.html,
  });
}

export async function notifyAuthorAboutReview(input: {
  email: string;
  trainerSlug: string;
  status: "published" | "rejected";
  note?: string | null;
}) {
  const card = getPublishedTrainer(input.trainerSlug);
  const trainer = card?.name ?? input.trainerSlug;
  const profile = `${mailAppUrl()}/trainers/${input.trainerSlug}`;
  const cabinet = `${mailAppUrl()}/account`;
  const published = input.status === "published";
  const note = input.note?.trim() ?? "";
  if (!(await mailboxAcceptsReview(input.email))) return;
  const letter = renderLetter({
    title: published ? "Отзыв опубликован" : "Отзыв отклонён",
    lead: published ? `Ваш отзыв о ${trainer} опубликован.` : `Ваш отзыв о ${trainer} отклонён.`,
    person: { name: trainer, avatarUrl: card?.photo || undefined, caption: "Тренер" },
    lines: note ? [note] : undefined,
    action: {
      href: published ? profile : cabinet,
      label: published ? "Открыть профиль" : "Открыть кабинет",
    },
  });
  await sendMail({
    to: [input.email],
    subject: published ? `Отзыв опубликован: ${trainer}` : `Отзыв отклонён: ${trainer}`,
    text: letter.text,
    html: letter.html,
  });
}

async function mailboxAcceptsReview(email: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ emailVerifiedAt: users.emailVerifiedAt })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!canReceiveMailbox(email, row?.emailVerifiedAt ?? null)) {
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.notice",
      outcome: "skipped",
      message: "Письмо об отзыве не отправлено: почта не подтверждена.",
      subject: email,
    });
    return false;
  }
  if (await recipientAllowsMail(email, "reviews")) return true;
  void writeLog({
    level: "info",
    domain: "email",
    action: "email.preference",
    outcome: "skipped",
    message: "Письмо об отзыве не отправлено: этот вид писем выключен.",
    subject: email,
    context: { kind: "reviews" },
  });
  return false;
}

async function profileOwnerMail(slug: string) {
  const [row] = await getDb()
    .select({
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      firstName: users.firstName,
      lastName: users.lastName,
      avatarPath: trainerProfiles.avatarPath,
      fullName: trainerProfiles.fullName,
      trainerFirstName: trainerProfiles.firstName,
      trainerLastName: trainerProfiles.lastName,
    })
    .from(trainerProfiles)
    .innerJoin(users, eq(users.id, trainerProfiles.ownerUserId))
    .where(eq(trainerProfiles.slug, slug))
    .limit(1);
  return row ?? null;
}

function personName(firstName: string | null, lastName: string | null, fallback: string) {
  return [firstName, lastName].filter(Boolean).join(" ") || fallback;
}

/** After staff publish a review, the trainer hears about it. */
export async function notifyTrainerAboutPublishedReview(input: {
  trainerSlug: string;
  authorName: string;
  authorUserId: string;
  rating: number;
  body: string;
}) {
  const owner = await profileOwnerMail(input.trainerSlug);
  if (!owner || !(await mailboxAcceptsReview(owner.email))) return;
  const [author] = await getDb()
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, input.authorUserId))
    .limit(1);
  const hello = owner.firstName ? `Здравствуйте, ${owner.firstName}!` : "Здравствуйте!";
  const letter = renderLetter({
    title: "Новый отзыв",
    lead: hello,
    person: { name: input.authorName, avatarUrl: author?.avatarPath || undefined, caption: "Клиент" },
    quote: reviewPlainText(input.body),
    lines: [`Оценка ${input.rating} из 5.`],
    action: { href: `${mailAppUrl()}/me/reviews`, label: "Открыть отзывы" },
  });
  await sendMail({
    to: [owner.email],
    subject: "Новый отзыв trenio.by",
    text: letter.text,
    html: letter.html,
  });
}

/** The other person in the review thread. */
export async function notifyReviewReply(input: {
  role: "trainer" | "author";
  trainerSlug: string;
  authorUserId: string;
  reply: string;
}) {
  const owner = await profileOwnerMail(input.trainerSlug);
  const trainerName = owner
    ? personName(owner.trainerFirstName, owner.trainerLastName, owner.fullName || input.trainerSlug)
    : input.trainerSlug;
  const quote = reviewPlainText(input.reply);
  if (input.role === "trainer") {
    const [author] = await getDb()
      .select({ email: users.email, firstName: users.firstName, avatarPath: users.avatarPath })
      .from(users)
      .where(eq(users.id, input.authorUserId))
      .limit(1);
    if (!author || !(await mailboxAcceptsReview(author.email))) return;
    const letter = renderLetter({
      title: "Вам ответили",
      lead: author.firstName ? `Здравствуйте, ${author.firstName}!` : "Здравствуйте!",
      person: { name: trainerName, avatarUrl: owner?.avatarPath || undefined, caption: "Тренер" },
      quote,
      action: { href: `${mailAppUrl()}/account/reviews`, label: "Открыть отзывы" },
    });
    await sendMail({
      to: [author.email],
      subject: "Ответ на отзыв trenio.by",
      text: letter.text,
      html: letter.html,
    });
    return;
  }
  if (!owner || !(await mailboxAcceptsReview(owner.email))) return;
  const [author] = await getDb()
    .select({ firstName: users.firstName, lastName: users.lastName, avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.id, input.authorUserId))
    .limit(1);
  const letter = renderLetter({
    title: "Вам ответили",
    lead: owner.firstName ? `Здравствуйте, ${owner.firstName}!` : "Здравствуйте!",
    person: {
      name: personName(author?.firstName ?? null, author?.lastName ?? null, "Клиент"),
      avatarUrl: author?.avatarPath || undefined,
      caption: "Клиент",
    },
    quote,
    action: { href: `${mailAppUrl()}/me/reviews`, label: "Открыть отзывы" },
  });
  await sendMail({
    to: [owner.email],
    subject: "Ответ на отзыв trenio.by",
    text: letter.text,
    html: letter.html,
  });
}
