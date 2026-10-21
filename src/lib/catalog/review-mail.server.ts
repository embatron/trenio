import { and, eq, inArray } from "drizzle-orm";

import { getDb } from "@/db";
import { userRoles, users } from "@/db/schema";
import { getPublishedTrainer } from "@/lib/catalog/published-trainers";
import { reviewPlainText } from "@/lib/catalog/review-html";
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
  const text = [
    "Новый отзыв ждёт модерации.",
    `Отправитель: ${input.authorName} (${input.authorEmail})`,
    `Тренер: ${trainer}`,
    `Оценка: ${input.rating} из 5`,
    "",
    reviewPlainText(input.body),
    "",
    `Разобрать: ${mailAppUrl()}/admin/reviews`,
  ].join("\n");
  await sendMail({
    to: await staffEmails(),
    subject: `Отзыв на модерации: ${trainer}`,
    text,
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
  const text = input.status === "published"
    ? [`Ваш отзыв о ${trainer} опубликован.`, "", profile].join("\n")
    : [`Ваш отзыв о ${trainer} отклонён.`, "", `Комментарий: ${input.note?.trim() || "без комментария"}`, "", `Кабинет: ${cabinet}`].join("\n");
  await sendMail({
    to: [input.email],
    subject: input.status === "published" ? `Отзыв опубликован: ${trainer}` : `Отзыв отклонён: ${trainer}`,
    text,
  });
}
