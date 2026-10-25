import { createServerFn } from "@tanstack/react-start";
import { getCookie, setCookie } from "@tanstack/react-start/server";
import { and, count, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { getSessionUserFromToken } from "@/auth/service";
import { readSessionToken } from "@/auth/session";
import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import { trainerProfileViews, trainerProfiles } from "@/db/schema";

const VISITOR_COOKIE = "trenio_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 400;

export type TrainerViewPeriod = {
  current: number;
  previous: number;
};

export type TrainerViewStats = {
  day: TrainerViewPeriod;
  week: TrainerViewPeriod;
  month: TrainerViewPeriod;
};

const emptyStats: TrainerViewStats = {
  day: { current: 0, previous: 0 },
  week: { current: 0, previous: 0 },
  month: { current: 0, previous: 0 },
};

function minskToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Minsk",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function addDays(iso: string, days: number) {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function mondayOffset(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  const sunday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (sunday + 6) % 7;
}

function sumBetween(rows: Array<{ day: string; total: number }>, start: string, end: string) {
  return rows.reduce((sum, row) => (row.day >= start && row.day <= end ? sum + row.total : sum), 0);
}

function visitorId() {
  const current = getCookie(VISITOR_COOKIE);
  if (current && /^[0-9a-f-]{36}$/i.test(current)) return current;
  const next = crypto.randomUUID();
  setCookie(VISITOR_COOKIE, next, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
  });
  return next;
}

/** One visit per browser per Minsk day. The profile owner is not counted. */
export const recordTrainerProfileViewFn = createServerFn({ method: "POST" })
  .validator(z.object({ slug: z.string().trim().min(1).max(40) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const [profile] = await db
      .select({
        id: trainerProfiles.id,
        ownerUserId: trainerProfiles.ownerUserId,
        status: trainerProfiles.status,
      })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.slug, data.slug))
      .limit(1);
    if (!profile || profile.status !== "published") return { ok: true as const };

    const session = await getSessionUserFromToken(readSessionToken());
    if (session && profile.ownerUserId && session.id === profile.ownerUserId) return { ok: true as const };

    await db
      .insert(trainerProfileViews)
      .values({ profileId: profile.id, visitorId: visitorId(), day: minskToday() })
      .onConflictDoNothing();
    return { ok: true as const };
  });

export const getOwnTrainerViewStatsFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }): Promise<TrainerViewStats> => {
    const db = getDb();
    const [profile] = await db
      .select({ id: trainerProfiles.id })
      .from(trainerProfiles)
      .where(eq(trainerProfiles.ownerUserId, context.user.id))
      .limit(1);
    if (!profile) return emptyStats;

    const today = minskToday();
    const weekStart = addDays(today, -mondayOffset(today));
    const monthStart = `${today.slice(0, 8)}01`;
    const previousMonthEnd = addDays(monthStart, -1);
    const previousMonthStart = `${previousMonthEnd.slice(0, 8)}01`;
    const rows = await db
      .select({ day: trainerProfileViews.day, total: count() })
      .from(trainerProfileViews)
      .where(and(eq(trainerProfileViews.profileId, profile.id), gte(trainerProfileViews.day, previousMonthStart)))
      .groupBy(trainerProfileViews.day);

    const counts = rows.map((row) => ({ day: row.day, total: Number(row.total) }));
    return {
      day: { current: sumBetween(counts, today, today), previous: sumBetween(counts, addDays(today, -1), addDays(today, -1)) },
      week: {
        current: sumBetween(counts, weekStart, today),
        previous: sumBetween(counts, addDays(weekStart, -7), addDays(weekStart, -1)),
      },
      month: {
        current: sumBetween(counts, monthStart, today),
        previous: sumBetween(counts, previousMonthStart, previousMonthEnd),
      },
    };
  });
