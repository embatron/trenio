import assert from "node:assert/strict";
import test from "node:test";

import { countPulse, distinctPulse, visitLeaderPulse } from "./overview-pulse.ts";

const today = "2026-11-03";

test("the visit leader is the busiest card, and the comparison is the previous top", () => {
  const pulse = visitLeaderPulse(
    [
      { profileId: "b", day: "2026-11-03", total: 2 },
      { profileId: "a", day: "2026-11-03", total: 5 },
      { profileId: "a", day: "2026-11-02", total: 1 },
      { profileId: "a", day: "2026-10-27", total: 1 },
      { profileId: "b", day: "2026-10-15", total: 9 },
    ],
    today,
  );
  assert.deepEqual(pulse.day, { leaders: [{ profileId: "a", visits: 5 }], visits: 5, previous: 1 });
  assert.deepEqual(pulse.week, { leaders: [{ profileId: "a", visits: 6 }], visits: 6, previous: 1 });
  assert.deepEqual(pulse.month, { leaders: [{ profileId: "a", visits: 6 }], visits: 6, previous: 9 });
});

test("a tie keeps every card on the top count, and an empty span keeps the previous top", () => {
  const pulse = visitLeaderPulse(
    [
      { profileId: "b", day: "2026-11-02", total: 4 },
      { profileId: "a", day: "2026-11-02", total: 4 },
    ],
    today,
  );
  assert.deepEqual(pulse.day, { leaders: [], visits: 0, previous: 4 });
  assert.deepEqual(pulse.week.leaders, [
    { profileId: "a", visits: 4 },
    { profileId: "b", visits: 4 },
  ]);
  assert.equal(pulse.week.visits, 4);
});

test("counts use the Minsk day, and a repeated publication in one span is one trainer", () => {
  const morning = new Date("2026-11-03T08:00:00+03:00").getTime();
  const again = new Date("2026-11-03T18:00:00+03:00").getTime();
  const yesterday = new Date("2026-11-02T12:00:00+03:00").getTime();
  assert.deepEqual(countPulse([morning, yesterday], today).day, { current: 1, previous: 1 });
  assert.deepEqual(
    distinctPulse(
      [
        { id: "card", at: morning },
        { id: "card", at: again },
        { id: "other", at: yesterday },
      ],
      today,
    ).day,
    { current: 1, previous: 1 },
  );
});
