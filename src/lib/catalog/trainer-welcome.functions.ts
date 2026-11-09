import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq, or, sql } from "drizzle-orm";
import { z } from "zod";

import { clientIpFromHeaders } from "@/auth/request-meta";
import { readSessionToken } from "@/auth/session";
import { getSessionUserFromToken } from "@/auth/service";
import { maskPhone, writeLog } from "@/lib/log/logger";
import { consumeRateLimit, RATE_LIMITED_MESSAGE } from "@/auth/rate-limit";
import { getDb } from "@/db";
import { trainerProfiles, trainerWelcomes, users } from "@/db/schema";
import { ensureLocalDoorCode } from "@/lib/catalog/trainer-outreach";
import { instagramProfileSlug } from "@/lib/catalog/trainer-slugs";
import {
  knownWelcomeDestination,
  ownerLoginEmail,
  optionalBelarusPhone,
  parseInstagramHandle,
  parseTelegramHandle,
  type TrainerCardStatus,
} from "@/lib/catalog/trainer-welcome";
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
  | { ok: true; channel: "instagram"; existing: "draft"; door: string }
  | {
      ok: true;
      channel: "instagram";
      existing: "account";
      status: TrainerCardStatus;
      email: string | null;
      slug: string;
      hasAccount: boolean;
      /** Set only when the signed-in person already owns this card. */
      home: "/me" | null;
    }
  | { ok: false; message: string };

const DOOR_PATH = /^\/hi\/[23456789abcdefghijkmnpqrstuvwxyz]{8}$/;

async function viewerId(): Promise<string | null> {
  try {
    const token = readSessionToken();
    if (!token) return null;
    const viewer = await getSessionUserFromToken(token);
    return viewer?.id ?? null;
  } catch {
    return null;
  }
}

async function knownInstagram(handle: string, viewer: string | null): Promise<TrainerWelcomeResult | null> {
  const needle = instagramProfileSlug(handle);
  if (!needle) return null;
  const rows = await getDb()
    .select({
      id: trainerProfiles.id,
      slug: trainerProfiles.slug,
      handle: trainerProfiles.instagramHandle,
      status: trainerProfiles.status,
      previewToken: trainerProfiles.previewToken,
      ownerUserId: trainerProfiles.ownerUserId,
      accountEmail: users.email,
    })
    .from(trainerProfiles)
    .leftJoin(users, eq(users.id, trainerProfiles.ownerUserId))
    .where(or(
      sql`lower(${trainerProfiles.instagramHandle}) = ${needle}`,
      sql`lower(split_part(split_part(regexp_replace(${trainerProfiles.instagramUrl}, '^https?://(www\\.)?instagram\\.com/', '', 'i'), '/', 1), '?', 1)) = ${needle}`,
    ))
    .limit(2);
  const row = rows.find((item) => item.handle.toLowerCase() === needle) ?? rows[0];
  if (!row) return null;

  const hasOwner = Boolean(row.ownerUserId);
  const destination = knownWelcomeDestination({
    status: row.status,
    hasOwner,
    viewerOwns: Boolean(viewer && row.ownerUserId === viewer),
  });
  if (destination === "door") {
    const code = await ensureLocalDoorCode(row.id, row.previewToken);
    const door = code ? `/hi/${code}` : "";
    if (!DOOR_PATH.test(door)) {
      await writeLog({
        level: "error",
        domain: "form",
        action: "form.welcome",
        outcome: "failure",
        message: "Короткая ссылка черновика не открылась.",
        target: row.slug,
        route: "/join/trainer",
        context: { channel: "instagram", existing: "draft" },
      });
      return { ok: false, message: "Не получилось открыть профиль. Попробуйте ещё раз." };
    }
    await writeLog({
      level: "info",
      domain: "form",
      action: "form.welcome",
      outcome: "success",
      message: "Заявка открыла уже собранный черновик.",
      target: row.slug,
      route: "/join/trainer",
      context: { channel: "instagram", existing: "draft" },
    });
    return { ok: true, channel: "instagram", existing: "draft", door };
  }

  const email = destination === "login" || destination === "cabinet" ? ownerLoginEmail(row.ownerUserId, row.accountEmail) : null;
  await writeLog({
    level: "info",
    domain: "form",
    action: "form.welcome",
    outcome: "success",
    message: destination === "cabinet"
      ? "Заявка открыла кабинет владельца."
      : "Заявка узнала уже существующий профиль.",
    subject: email,
    target: row.slug,
    route: "/join/trainer",
    context: { channel: "instagram", existing: destination, status: row.status },
  });
  return {
    ok: true,
    channel: "instagram",
    existing: "account",
    status: row.status,
    email,
    slug: row.slug,
    hasAccount: hasOwner,
    home: destination === "cabinet" ? "/me" : null,
  };
}

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

      const instagram = parseInstagramHandle(data.instagram);
      if (instagram) {
        const known = await knownInstagram(instagram, await viewerId());
        if (known) return known;
      }

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
