import { and, count, eq, gte, inArray, or, sql } from "drizzle-orm";
import { createServerFn } from "@tanstack/react-start";

import { requireAuthMiddleware } from "@/auth/middleware";
import { getDb } from "@/db";
import {
  conversations,
  messages,
  trainerJournal,
  trainerProfileViews,
  trainerProfiles,
  trainerReviews,
  userRoles,
  users,
} from "@/db/schema";
import { assertStaff, hiddenStaffIds } from "@/lib/admin/access";
import {
  countPulse,
  distinctPulse,
  visitLeaderPulse,
  type VisitLeaderPeriod,
} from "@/lib/admin/overview-pulse";
import { PUBLISHED_TRAINERS } from "@/lib/catalog/published-trainers";
import { trainerNameParts, joinTrainerName } from "@/lib/catalog/trainer-name";
import { minskDayStart, minskToday, periodSpans } from "@/lib/catalog/trainer-periods";
import { storedGivenName } from "@/lib/auth/login-name";
import { phoneSignatureName } from "@/lib/auth/phone-label";
import { listOnlineUserIds } from "@/lib/messages/presence";

export type AdminOverviewLeader = {
  slug: string;
  name: string;
  published: boolean;
  visits: number;
};

export type AdminOverviewLeaderPeriod = {
  trainers: AdminOverviewLeader[];
  visits: number;
  previous: number;
};

export type AdminOnlinePerson = {
  id: string;
  name: string;
  kind: "public" | "trainer" | "account";
  slug: string;
};

function namedLeaders(
  period: VisitLeaderPeriod,
  people: Map<string, AdminOverviewLeader>,
): AdminOverviewLeaderPeriod {
  const trainers = period.leaders
    .map((leader) => {
      const person = people.get(leader.profileId);
      return person
        ? { ...person, visits: leader.visits }
        : { slug: "", name: "Тренер", published: false, visits: leader.visits };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru") || a.slug.localeCompare(b.slug));
  return { trainers, visits: period.visits, previous: period.previous };
}

/** A portal thread has no card. An admin or superadmin on either side stays out. */
function staffList(staffIds: string[]) {
  return sql.join(staffIds.map((id) => sql`${id}::uuid`), sql`, `);
}

function outsideStaff(staffIds: string[]) {
  if (staffIds.length === 0) return undefined;
  return and(
    sql`${messages.senderId} not in (${staffList(staffIds)})`,
    sql`${conversations.userId} not in (${staffList(staffIds)})`,
    sql`(${trainerProfiles.ownerUserId} is null or ${trainerProfiles.ownerUserId} not in (${staffList(staffIds)}))`,
  );
}

export const getAdminOverviewFn = createServerFn({ method: "GET" })
  .middleware([requireAuthMiddleware])
  .handler(async ({ context }) => {
    assertStaff(context.user.roles);
    const db = getDb();
    const today = minskToday();
    const earliest = periodSpans(today).month.previous.start;
    const since = new Date(minskDayStart(earliest));

    const staffRows = await db
      .select({ userId: userRoles.userId })
      .from(userRoles)
      .where(or(eq(userRoles.role, "admin"), eq(userRoles.role, "superadmin")));
    const staffIds = [...new Set(staffRows.map((row) => row.userId))];
    const staff = new Set(staffIds);
    const messageWhere = and(gte(messages.createdAt, since), outsideStaff(staffIds));

    const [accountCount, reviewCount, pendingRows, profileSlugs, viewRows, messageRows, reviewRows, appearRows] = await Promise.all([
      db.select({ n: count() }).from(users),
      db.select({ n: count() }).from(trainerReviews),
      db.select({ userId: trainerReviews.userId }).from(trainerReviews).where(eq(trainerReviews.status, "pending")),
      db.select({ slug: trainerProfiles.slug }).from(trainerProfiles),
      db
        .select({
          profileId: trainerProfileViews.profileId,
          day: trainerProfileViews.day,
          total: count(),
        })
        .from(trainerProfileViews)
        .where(gte(trainerProfileViews.day, earliest))
        .groupBy(trainerProfileViews.profileId, trainerProfileViews.day),
      db
        .select({ createdAt: messages.createdAt })
        .from(messages)
        .innerJoin(conversations, eq(messages.conversationId, conversations.id))
        .innerJoin(trainerProfiles, eq(conversations.trainerProfileId, trainerProfiles.id))
        .where(messageWhere),
      db
        .select({ createdAt: trainerReviews.createdAt, userId: trainerReviews.userId })
        .from(trainerReviews)
        .where(gte(trainerReviews.createdAt, since)),
      db
        .select({
          profileId: trainerJournal.profileId,
          target: trainerJournal.target,
          createdAt: trainerJournal.createdAt,
        })
        .from(trainerJournal)
        .where(and(eq(trainerJournal.action, "trainer.appear"), gte(trainerJournal.createdAt, since))),
    ]);

    const leaders = visitLeaderPulse(
      viewRows.map((row) => ({ profileId: row.profileId, day: row.day, total: Number(row.total) })),
      today,
    );
    const leaderIds = [...new Set(
      [leaders.day, leaders.week, leaders.month].flatMap((period) => period.leaders.map((leader) => leader.profileId)),
    )];
    const leaderRows = leaderIds.length
      ? await db
        .select({
          id: trainerProfiles.id,
          slug: trainerProfiles.slug,
          firstName: trainerProfiles.firstName,
          lastName: trainerProfiles.lastName,
          fullName: trainerProfiles.fullName,
          status: trainerProfiles.status,
        })
        .from(trainerProfiles)
        .where(inArray(trainerProfiles.id, leaderIds))
      : [];
    const people = new Map(leaderRows.map((row) => {
      const name = trainerNameParts(row.firstName, row.lastName, row.fullName);
      return [row.id, {
        slug: row.slug,
        name: name.fullName || row.slug,
        published: row.status === "published",
        visits: 0,
      }] as const;
    }));

    const known = new Set(profileSlugs.map((row) => row.slug));
    const catalogOnly = PUBLISHED_TRAINERS.filter((trainer) => !known.has(trainer.slug)).length;
    const hidden = await hiddenStaffIds(context.user.roles);
    const online = await onlinePeople(hidden);

    return {
      accountsTotal: Math.max(0, Number(accountCount[0]?.n ?? 0) - hidden.size),
      trainersTotal: profileSlugs.length + catalogOnly,
      reviewsTotal: Number(reviewCount[0]?.n ?? 0),
      reviewsPending: pendingRows.filter((row) => !hidden.has(row.userId)).length,
      popular: {
        day: namedLeaders(leaders.day, people),
        week: namedLeaders(leaders.week, people),
        month: namedLeaders(leaders.month, people),
      },
      messages: countPulse(messageRows.map((row) => row.createdAt.getTime()), today),
      reviews: countPulse(
        reviewRows.filter((row) => !staff.has(row.userId)).map((row) => row.createdAt.getTime()),
        today,
      ),
      published: distinctPulse(
        appearRows.map((row) => ({ id: row.profileId ?? row.target ?? "", at: row.createdAt.getTime() })),
        today,
      ),
      online,
    };
  });

function accountName(row: { firstName: string; lastName: string | null; email: string; phone: string | null }) {
  const given = phoneSignatureName(row.firstName, row.phone) ?? storedGivenName(row.firstName, row.email);
  return joinTrainerName(given, row.lastName) || given;
}

async function onlinePeople(hidden: Set<string>): Promise<{ trainers: AdminOnlinePerson[]; users: AdminOnlinePerson[] }> {
  const ids = (await listOnlineUserIds()).filter((id) => !hidden.has(id));
  if (ids.length === 0) return { trainers: [], users: [] };
  const db = getDb();
  const [people, roles, cards] = await Promise.all([
    db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
        phone: users.phone,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(inArray(users.id, ids)),
    db
      .select({ userId: userRoles.userId, role: userRoles.role })
      .from(userRoles)
      .where(inArray(userRoles.userId, ids)),
    db
      .select({
        ownerUserId: trainerProfiles.ownerUserId,
        slug: trainerProfiles.slug,
        firstName: trainerProfiles.firstName,
        lastName: trainerProfiles.lastName,
        fullName: trainerProfiles.fullName,
        status: trainerProfiles.status,
      })
      .from(trainerProfiles)
      .where(inArray(trainerProfiles.ownerUserId, ids)),
  ]);
  const trainerIds = new Set(roles.filter((row) => row.role === "trainer" || row.role === "club").map((row) => row.userId));
  const cardByOwner = new Map(cards.flatMap((row) => (row.ownerUserId ? [[row.ownerUserId, row] as const] : [])));
  const trainers: AdminOnlinePerson[] = [];
  const plain: AdminOnlinePerson[] = [];
  for (const person of people) {
    if (person.deletedAt) continue;
    const card = cardByOwner.get(person.id);
    const isTrainer = trainerIds.has(person.id) || Boolean(card);
    const cardName = card ? trainerNameParts(card.firstName, card.lastName, card.fullName).fullName : "";
    const name = (isTrainer && cardName) ? cardName : accountName(person);
    const item: AdminOnlinePerson = isTrainer && card
      ? {
        id: person.id,
        name,
        kind: card.status === "published" ? "public" : "trainer",
        slug: card.slug,
      }
      : { id: person.id, name, kind: "account", slug: "" };
    (isTrainer ? trainers : plain).push(item);
  }
  const byName = (a: AdminOnlinePerson, b: AdminOnlinePerson) => a.name.localeCompare(b.name, "ru") || a.id.localeCompare(b.id);
  trainers.sort(byName);
  plain.sort(byName);
  return { trainers, users: plain };
}
