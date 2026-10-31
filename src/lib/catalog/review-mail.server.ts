import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { userRoles, users } from "@/db/schema";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import { reviewPlainText } from "@/lib/catalog/review-html";
import { writeLog } from "@/lib/log/logger";
import { renderLetter } from "@/lib/mail/letter";
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
    .select({ avatarPath: users.avatarPath })
    .from(users)
    .where(eq(users.email, input.authorEmail))
    .limit(1);
  const letter = renderLetter({
    title: "Новый отзыв ждёт модерации",
    person: { name: input.authorName, avatarUrl: author?.avatarPath, caption: input.authorEmail },
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
  const trainer = getPublishedTrainer(input.trainerSlug)?.name ?? input.trainerSlug;
  const profile = `${mailAppUrl()}/trainers/${input.trainerSlug}`;
  const cabinet = `${mailAppUrl()}/account`;
  const published = input.status === "published";
  const note = input.note?.trim() ?? "";
  const letter = renderLetter({
    title: published ? "Отзыв опубликован" : "Отзыв отклонён",
    lead: published ? `Ваш отзыв о ${trainer} опубликован.` : `Ваш отзыв о ${trainer} отклонён.`,
    person: note ? { name: "Trenio", caption: "Комментарий модератора" } : undefined,
    quote: note || undefined,
    action: {
      href: published ? profile : cabinet,
      label: published ? "Открыть профиль" : "Открыть кабинет",
    },
  });
  if (!(await recipientAllowsMail(input.email, "reviews"))) {
    void writeLog({
      level: "info",
      domain: "email",
      action: "email.preference",
      outcome: "skipped",
      message: "Письмо об отзыве не отправлено: этот вид писем выключен.",
      subject: input.email,
      target: input.trainerSlug,
      context: { kind: "reviews" },
    });
    return;
  }
  await sendMail({
    to: [input.email],
    subject: published ? `Отзыв опубликован: ${trainer}` : `Отзыв отклонён: ${trainer}`,
    text: letter.text,
    html: letter.html,
  });
}
