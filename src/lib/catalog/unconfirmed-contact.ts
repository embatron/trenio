import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/auth/rate-limit";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { optionalAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfiles, users } from "@/db/schema";
import { AuthError } from "@/lib/auth/errors";
import { isPendingSignupEmail } from "@/lib/auth/pending-email";
import { formatBelarusPhone } from "@/lib/auth/phone";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { trainerAccountReady } from "@/lib/catalog/trainer-verified";
import { reviewPlainText, reviewTextLength } from "@/lib/catalog/review-html";
import { logCaught, markLogged, writeLog } from "@/lib/log/logger";
import { maskPhone } from "@/lib/log/redact";
import { renderLetter } from "@/lib/mail/letter";
import { mailAppUrl, sendMail } from "@/lib/mail/send.server";
import { SITE_EMAIL } from "@/lib/seo/site";

const MESSAGE_MAX = 1000;

function journalSubject(value: string | null | undefined): string | undefined {
  const text = value?.trim() ?? "";
  if (!text) return undefined;
  if (text.includes("@") && !text.includes(" ") && !isPendingSignupEmail(text)) return text;
  return maskPhone(text) ?? undefined;
}

/** A visitor note about a trainer whose account is still unconfirmed. The letter goes to the public mailbox. */
export const sendUnconfirmedContactFn = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator(z.object({
    slug: z.string().trim().min(1).max(40),
    message: z.string().trim().min(1).max(4000),
    reply: z.string().trim().max(120).optional(),
    company: z.string().trim().max(120).optional(),
  }))
  .handler(async ({ data, context }) => {
    const user = context.user;
    const ip = clientIpFromHeaders(getRequest().headers.get("x-real-ip"));
    if (data.company) {
      void writeLog({
        level: "warn",
        domain: "form",
        action: "form.unconfirmed_contact",
        outcome: "denied",
        message: "Пустое поле формы было заполнено.",
        actorUserId: user?.id,
        target: data.slug,
        context: { reason: "honeypot" },
      });
      return { ok: true as const };
    }

    const message = reviewPlainText(data.message).trim();
    const chars = reviewTextLength(message);
    if (!message || chars < 5) {
      throw new AuthError("Напишите сообщение хотя бы в несколько слов.", "VALIDATION");
    }
    if (chars > MESSAGE_MAX) {
      throw new AuthError("Сообщение не длиннее 1000 символов.", "VALIDATION");
    }

    const [row] = await getDb()
      .select({
        slug: trainerProfiles.slug,
        firstName: trainerProfiles.firstName,
        lastName: trainerProfiles.lastName,
        fullName: trainerProfiles.fullName,
        verified: trainerProfiles.verified,
        emailVerifiedAt: users.emailVerifiedAt,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(trainerProfiles)
      .leftJoin(users, eq(users.id, trainerProfiles.ownerUserId))
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    if (!row) throw new AuthError("Профиль не найден.", "VALIDATION");
    if (trainerAccountReady(row)) {
      throw new AuthError("Аккаунт уже подтверждён. Напишите тренеру напрямую.", "VALIDATION");
    }

    const accountMail = user && user.emailVerified && !isPendingSignupEmail(user.email) ? user.email : "";
    let accountPhone = "";
    if (user && user.phoneVerified) {
      const [found] = await getDb()
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      accountPhone = formatBelarusPhone(found?.phone ?? "") || found?.phone || "";
    }
    const reply = (data.reply ?? "").trim();
    const reach = accountMail || accountPhone || reply;
    if (!reach) {
      throw new AuthError("Напишите почту или телефон, чтобы мы могли ответить.", "VALIDATION");
    }

    const byIp = await consumeRateLimit(`unconfirmed:${ip}`, 60 * 60_000, 5);
    if (!byIp.ok) {
      void writeLog({
        level: "warn",
        domain: "form",
        action: "form.unconfirmed_contact",
        outcome: "denied",
        message: RATE_LIMITED_MESSAGE,
        actorUserId: user?.id,
        subject: journalSubject(accountMail || accountPhone || reply),
        target: row.slug,
      });
      throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
    }

    const name = joinTrainerName(row.firstName, row.lastName) || row.fullName || row.slug;
    const who = user
      ? joinTrainerName(user.firstName, user.lastName) || accountMail || "Посетитель"
      : "Посетитель";
    const letter = renderLetter({
      title: "Сообщение по неподтверждённому профилю",
      lead: "Посетитель просит разыскать тренера",
      service: true,
      lines: [
        `Кто: ${who}`,
        `Ответить: ${reach}`,
        `Тренер: ${name}`,
        `Страница: ${mailAppUrl()}/trainers/${row.slug}`,
      ],
      quote: message,
    });
    try {
      const sent = await sendMail({
        to: [SITE_EMAIL],
        subject: `Неподтверждённый профиль: ${row.slug}`,
        text: letter.text,
        html: letter.html,
      });
      if (!sent) {
        void writeLog({
          level: "error",
          domain: "form",
          action: "form.unconfirmed_contact",
          outcome: "failure",
          message: "Сообщение по неподтверждённому профилю не отправилось.",
          actorUserId: user?.id,
          subject: journalSubject(accountMail || accountPhone || reply),
          target: row.slug,
          context: { chars },
        });
        const failure = new AuthError("Не удалось отправить сообщение. Попробуйте ещё раз.", "VALIDATION");
        markLogged(failure);
        throw failure;
      }
    } catch (error) {
      if (error instanceof AuthError) throw error;
      logCaught("form", "form.unconfirmed_contact", error, {
        actorUserId: user?.id,
        subject: journalSubject(accountMail || accountPhone || reply),
        target: row.slug,
      });
      const failure = new AuthError("Не удалось отправить сообщение. Попробуйте ещё раз.", "VALIDATION");
      markLogged(failure);
      throw failure;
    }
    void writeLog({
      level: "info",
      domain: "form",
      action: "form.unconfirmed_contact",
      outcome: "success",
      message: "Сообщение по неподтверждённому профилю отправлено.",
      actorUserId: user?.id,
      subject: journalSubject(accountMail || accountPhone || reply),
      target: row.slug,
      context: { chars },
    });
    return { ok: true as const };
  });
