import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireAuthMiddleware } from "@/auth/middleware";
import { clientIpFromHeaders } from "@/auth/request-meta";
import { consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/auth/rate-limit";
import { AuthError } from "@/lib/auth/errors";
import { hasAnyRole } from "@/lib/auth/roles";
import { reviewPlainText, reviewTextLength } from "@/lib/catalog/review-html";
import { joinTrainerName } from "@/lib/catalog/trainer-name";
import { markLogged, writeLog } from "@/lib/log/logger";
import { renderLetter } from "@/lib/mail/letter";
import { sendMail } from "@/lib/mail/send.server";
import { SITE_EMAIL } from "@/lib/seo/site";

export const BECOME_TRAINER_MAX = 1000;

const BLOCKED = ["trainer", "club", "admin", "superadmin"] as const;

export const requestBecomeTrainerFn = createServerFn({ method: "POST" })
  .middleware([requireAuthMiddleware])
  .validator(z.object({
    request: z.string().trim().min(1).max(4000),
  }))
  .handler(async ({ data, context }) => {
    if (hasAnyRole(context.user.roles, [...BLOCKED])) {
      void writeLog({
        level: "warn",
        domain: "form",
        action: "form.become_trainer",
        outcome: "denied",
        message: "Заявка стать тренером недоступна этой роли.",
        actorUserId: context.user.id,
        subject: context.user.email,
      });
      throw new AuthError("Кабинет тренера для этого аккаунта уже не нужен.", "FORBIDDEN");
    }
    const request = data.request.trim();
    const chars = reviewTextLength(request);
    if (!reviewPlainText(request) || chars < 1) {
      throw new AuthError("Напишите, чем вы занимаетесь.", "VALIDATION");
    }
    if (chars > BECOME_TRAINER_MAX) {
      throw new AuthError("Запрос не длиннее 1000 символов.", "VALIDATION");
    }
    const ip = clientIpFromHeaders(getRequest().headers.get("x-real-ip"));
    const byUser = consumeRateLimit(`support:become:${context.user.id}`, 60 * 60_000, 5);
    const byIp = byUser.ok ? consumeRateLimit(`support:become:ip:${ip}`, 60 * 60_000, 8) : byUser;
    if (!byUser.ok || !byIp.ok) {
      void writeLog({
        level: "warn",
        domain: "form",
        action: "form.become_trainer",
        outcome: "denied",
        message: RATE_LIMITED_MESSAGE,
        actorUserId: context.user.id,
        subject: context.user.email,
      });
      throw new AuthError(RATE_LIMITED_MESSAGE, "RATE_LIMITED");
    }
    const name = joinTrainerName(context.user.firstName, context.user.lastName) || context.user.email;
    const letter = renderLetter({
      title: "Запрос в поддержку",
      lead: "Стать тренером",
      service: true,
      lines: [
        `Кто: ${name}`,
        `Почта: ${context.user.email}`,
      ],
      quote: request,
    });
    try {
      await sendMail({
        to: [SITE_EMAIL],
        subject: "[SUPPORT REQUEST]",
        text: letter.text,
        html: letter.html,
      });
    } catch (error) {
      void writeLog({
        level: "error",
        domain: "form",
        action: "form.become_trainer",
        outcome: "failure",
        message: "Заявка стать тренером не отправилась.",
        actorUserId: context.user.id,
        subject: context.user.email,
        error,
      });
      const failure = new AuthError("Не удалось отправить запрос. Попробуйте ещё раз.", "VALIDATION");
      markLogged(failure);
      throw failure;
    }
    void writeLog({
      level: "info",
      domain: "form",
      action: "form.become_trainer",
      outcome: "success",
      message: "Заявка стать тренером отправлена.",
      actorUserId: context.user.id,
      subject: context.user.email,
      context: { chars },
    });
    return { ok: true as const, message: "Запрос отправлен. Мы ответим на почту." };
  });
