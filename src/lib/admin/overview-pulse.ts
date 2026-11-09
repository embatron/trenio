import {
  addDays,
  countCreatedBetween,
  minskDayStart,
  periodSpans,
  type TrainerViewStats,
} from "@/lib/catalog/trainer-periods";

export type DailyVisits = {
  profileId: string;
  day: string;
  total: number;
};

export type VisitLeader = {
  profileId: string;
  visits: number;
};

export type VisitLeaderPeriod = {
  /** Every card that shares the highest visit count. Empty when nobody came. */
  leaders: VisitLeader[];
  visits: number;
  /** Highest visit count in the previous span. */
  previous: number;
};

type Span = { start: string; end: string };

function totalsBetween(rows: DailyVisits[], span: Span) {
  const totals = new Map<string, number>();
  for (const row of rows) {
    if (row.day < span.start || row.day > span.end || row.total <= 0) continue;
    totals.set(row.profileId, (totals.get(row.profileId) ?? 0) + row.total);
  }
  return totals;
}

function pickLeaders(totals: Map<string, number>): VisitLeader[] {
  let best = 0;
  for (const visits of totals.values()) {
    if (visits > best) best = visits;
  }
  if (best <= 0) return [];
  const leaders: VisitLeader[] = [];
  for (const [profileId, visits] of totals) {
    if (visits === best) leaders.push({ profileId, visits });
  }
  leaders.sort((a, b) => a.profileId.localeCompare(b.profileId));
  return leaders;
}

function leaderPeriod(rows: DailyVisits[], current: Span, previous: Span): VisitLeaderPeriod {
  const leaders = pickLeaders(totalsBetween(rows, current));
  const previousLeaders = pickLeaders(totalsBetween(rows, previous));
  return {
    leaders,
    visits: leaders[0]?.visits ?? 0,
    previous: previousLeaders[0]?.visits ?? 0,
  };
}

/** Who had the most profile visits in each Minsk span. A tie keeps every card on that count. */
export function visitLeaderPulse(rows: DailyVisits[], today: string) {
  const spans = periodSpans(today);
  return {
    day: leaderPeriod(rows, spans.day.current, spans.day.previous),
    week: leaderPeriod(rows, spans.week.current, spans.week.previous),
    month: leaderPeriod(rows, spans.month.current, spans.month.previous),
  };
}

function countedPeriod(pick: (span: Span) => number, current: Span, previous: Span) {
  return { current: pick(current), previous: pick(previous) };
}

/** How many events fell in the current and previous Minsk spans. */
export function countPulse(times: number[], today: string): TrainerViewStats {
  const spans = periodSpans(today);
  const pick = (span: Span) => countCreatedBetween(times, span.start, span.end);
  return {
    day: countedPeriod(pick, spans.day.current, spans.day.previous),
    week: countedPeriod(pick, spans.week.current, spans.week.previous),
    month: countedPeriod(pick, spans.month.current, spans.month.previous),
  };
}

/** How many different ids appeared in each span. A repeat in the same span counts once. */
export function distinctPulse(events: Array<{ id: string; at: number }>, today: string): TrainerViewStats {
  const spans = periodSpans(today);
  const pick = (span: Span) => {
    const from = minskDayStart(span.start);
    const to = minskDayStart(addDays(span.end, 1));
    const ids = new Set<string>();
    for (const event of events) {
      if (event.id && event.at >= from && event.at < to) ids.add(event.id);
    }
    return ids.size;
  };
  return {
    day: countedPeriod(pick, spans.day.current, spans.day.previous),
    week: countedPeriod(pick, spans.week.current, spans.week.previous),
    month: countedPeriod(pick, spans.month.current, spans.month.previous),
  };
}
