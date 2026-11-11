import assert from "node:assert/strict";
import test from "node:test";

import {
  CABINET_LIVE_MAX_MS,
  CABINET_LIVE_MS,
  cabinetLiveDelay,
  cabinetLiveDetail,
  isCabinetPath,
  mergeCabinetInterest,
  sameList,
} from "@/lib/cabinet/live";

test("a healthy cabinet waits twenty seconds and a failure backs off", () => {
  assert.equal(cabinetLiveDelay(0), CABINET_LIVE_MS);
  assert.equal(cabinetLiveDelay(1), 5_000);
  assert.equal(cabinetLiveDelay(2), 10_000);
  assert.equal(cabinetLiveDelay(3), 20_000);
  assert.equal(cabinetLiveDelay(8), CABINET_LIVE_MAX_MS);
});

test("cabinet paths are the three personal cabinets", () => {
  assert.equal(isCabinetPath("/me"), true);
  assert.equal(isCabinetPath("/me/stats"), true);
  assert.equal(isCabinetPath("/account/favorites"), true);
  assert.equal(isCabinetPath("/admin/messages"), true);
  assert.equal(isCabinetPath("/menu"), false);
  assert.equal(isCabinetPath("/trainers/test"), false);
  assert.equal(cabinetLiveDetail("/me/likes"), true);
  assert.equal(cabinetLiveDetail("/account"), false);
  assert.equal(cabinetLiveDetail("/admin"), false);
});

test("a live interest patch keeps the review average and replaces the counters", () => {
  const ratings = { card: { rating: "4.5", reviews: 3, likes: 1, views: 0 } };
  const same = mergeCabinetInterest(ratings, null, { likes: 9 });
  assert.equal(same, ratings);
  const next = mergeCabinetInterest(ratings, "card", { likes: 9, views: 4 });
  assert.equal(next.card.rating, "4.5");
  assert.equal(next.card.reviews, 3);
  assert.equal(next.card.likes, 9);
  assert.equal(next.card.views, 4);
  assert.equal(sameList(["a", "b"], ["a", "b"]), true);
  assert.equal(sameList(["a"], ["b"]), false);
});
