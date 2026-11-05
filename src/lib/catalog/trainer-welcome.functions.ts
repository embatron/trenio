import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { maskPhone, writeLog } from "@/lib/log/logger";
import { consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/auth/rate-limit";
import { getDb } from "@/db";
import { trainerWelcomes } from "@/db/schema";
import { optionalBelarusPhone, parseInstagramHandle, parseTelegramHandle } from "@/lib/catalog/trainer-welcome";
import { renderLetter } from "@/lib/mail/letter";
import { sendMail } from "@/lib/mail/send.server";
import { SITE_EMAIL } from "@/lib/seo/site";

const welcomeSchema = z.object({
  channel: z.enum(["instagram", "other"]),
  instagram: z.string().max(300).optional().default(""),
  telegram: z.string().max(300).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  honeypot: z.string().max(200).optional().default(""),
});

export type TrainerWelcomeChannel = "instagram" | "other";

export type TrainerWelcomeResult =
  | { ok: true; channel: TrainerWelcomeChannel }
  | { ok: false; message: string };

const WELCOME_MAIL_FAILED = "Не получилось отправить. Попробуйте ещё раз.";

/** Service letter to the public mailbox. The journal does not store this text. */
async function mailWelcome(input: { instagram: string | null; telegram: string | null; phone: string | null }) {
  const lines = [
    input.instagram ? `Instagram: ${input.instagram}` : "",
    input.telegram ? `Telegram: @${input.telegram}` : "",
    input.phone ? `Телефон: ${input.phone}` : "",
  ].filter(Boolean);
  const letter = renderLetter({
    title: "Заявка тренера",
    lead: "Стать тренером",
    service: true,
    lines,
  });
  return sendMail({
    to: [SITE_EMAIL],
    subject: "Заявка со страницы «Стать тренером»",
    text: letter.text,
    html: letter.html,
  });
}

function readTelegram(raw: string): { telegram: string | null } | { message: string } {
  const value = raw.trim();
  if (!value) return { telegram: null };
  const telegram = parseTelegramHandle(value);
  if (!telegram) return { message: "Укажи имя в Telegram или ссылку t.me/…" };
  return { telegram };
}

export const submitTrainerWelcomeFn = createServerFn({ method: "POST" })
  .validator(welcomeSchema)
  .handler(async ({ data }): Promise<TrainerWelcomeResult> => {
    if (data.honeypot.trim()) {
      await writeLog({
        level: "warn",
        domain: "form",
        action: "form.welcome",
        outcome: "denied",
        message: "Заявка тренера отклонена.",
        route: "/join/trainer",
        context: { reason: "honeypot" },
      });
      return { ok: true, channel: data.channel };
    }

    const request = getRequest();
    const ip = clientIpFromHeaders(request.headers.get("x-real-ip"));
    const limit = await consumeRateLimit(`welcome:${ip}`, 15 * 60_000, 8);
    if (!limit.ok) return { ok: false, message: RATE_LIMITED_MESSAGE };

    try {
      const telegram = readTelegram(data.telegram);
      if ("message" in telegram) return { ok: false, message: telegram.message };
      const phone = optionalBelarusPhone(data.phone);
      if (phone.error) return { ok: false, message: "Укажи мобильный номер РБ: +375 25/29/33/44 …" };

      if (data.channel === "other") {
        if (!telegram.telegram && !phone.phone) {
          return { ok: false, message: "Оставь Telegram или номер телефона." };
        }
        const mailed = await mailWelcome({ instagram: null, telegram: telegram.telegram, phone: phone.phone });
        if (!mailed) {
          await writeLog({
            level: "error",
            domain: "form",
            action: "form.welcome",
            outcome: "failure",
            message: "Письмо заявки не ушло.",
            subject: maskPhone(phone.phone),
            target: telegram.telegram,
            route: "/join/trainer",
            context: { channel: "other" },
          });
          return { ok: false, message: WELCOME_MAIL_FAILED };
        }
        await getDb().insert(trainerWelcomes).values({
          channel: "other",
          instagram: null,
          telegram: telegram.telegram,
          phone: phone.phone,
        });
        await writeLog({
          level: "info",
          domain: "form",
          action: "form.welcome",
          outcome: "success",
          message: "Заявка тренера принята.",
          subject: maskPhone(phone.phone),
          target: telegram.telegram,
          route: "/join/trainer",
          context: { channel: "other" },
        });
        return { ok: true, channel: "other" };
      }

      const instagram = parseInstagramHandle(data.instagram);
      if (!instagram) {
        return { ok: false, message: "Укажи имя в Instagram или ссылку на профиль." };
      }
      const mailed = await mailWelcome({ instagram, telegram: telegram.telegram, phone: phone.phone });
      if (!mailed) {
        await writeLog({
          level: "error",
          domain: "form",
          action: "form.welcome",
          outcome: "failure",
          message: "Письмо заявки не ушло.",
          subject: maskPhone(phone.phone),
          target: instagram,
          route: "/join/trainer",
          context: { channel: "instagram" },
        });
        return { ok: false, message: WELCOME_MAIL_FAILED };
      }
      await getDb().insert(trainerWelcomes).values({
        channel: "instagram",
        instagram,
        telegram: telegram.telegram,
        phone: phone.phone,
      });
      await writeLog({
        level: "info",
        domain: "form",
        action: "form.welcome",
        outcome: "success",
        message: "Заявка тренера принята.",
        subject: maskPhone(phone.phone),
        target: instagram,
        route: "/join/trainer",
        context: { channel: "instagram" },
      });
      return { ok: true, channel: "instagram" };
    } catch (error) {
      await writeLog({
        level: "error",
        domain: "form",
        action: "form.welcome",
        outcome: "failure",
        message: "Заявка тренера не сохранилась.",
        route: "/join/trainer",
        error,
      });
      return { ok: false, message: "Не получилось отправить. Попробуйте ещё раз." };
    }
  });
