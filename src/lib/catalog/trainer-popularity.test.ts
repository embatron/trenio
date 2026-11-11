import assert from "node:assert/strict";
import test from "node:test";

import {
  POPULARITY_LIMITS,
  compareByPopularity,
  contactPoints,
  imputeWindow,
  popularityParts,
  popularityScore,
  recentReviewStart,
  ratingPoints,
  responsePoints,
} from "./trainer-popularity.ts";

function quality(stars: number[]) {
  const average = stars.length > 0
    ? stars.reduce((sum, star) => sum + star, 0) / stars.length
    : 0;
  const parts = popularityParts({
    rating: String(average),
    reviews: stars.length,
    positiveReviews: stars.filter((star) => star >= 4).length,
    recentPositiveReviews: stars.filter((star) => star >= 4).length,
  });
  return parts.rating + parts.reviews + parts.recentReviews;
}

test("all part limits add up to exactly 100", () => {
  const limits = POPULARITY_LIMITS;
  const sum = limits.card + limits.contacts + limits.rating + limits.reviews + limits.recentReviews
    + limits.views + limits.saves + limits.likes + limits.likePace;
  assert.equal(sum, 100);
  assert.equal(limits.self, limits.card + limits.contacts);
  assert.equal(limits.card, 18);
  assert.equal(limits.rating, 20);
  assert.equal(limits.reviews + limits.recentReviews, 26);
  assert.equal(limits.recentReviews, 3);
  assert.equal(limits.views, 11);
  assert.equal(limits.likes + limits.likePace, 16);
  assert.equal(limits.saves, 4);
  assert.equal(limits.responseWindowDays, 90);
  assert.equal(limits.likePaceDays, 20);
});

test("a profile that reaches every cap scores exactly 100", () => {
  const limits = POPULARITY_LIMITS;
  const full = popularityParts({
    rating: "5",
    reviews: 200,
    positiveReviews: 200,
    recentPositiveReviews: 200,
    views: 80,
    engaged: 40,
    saves: 100,
    likes: 100,
    likePace: 100,
    cardFilled: 10,
    contactsFilled: 4,
  });
  assert.equal(full.total, 100);
  assert.equal(full.card, limits.card);
  assert.equal(full.contacts, 5);
  assert.equal(full.rating, limits.rating);
  assert.equal(full.reviews, limits.reviews);
  assert.equal(full.recentReviews, limits.recentReviews);
  assert.equal(full.views, limits.views);
  assert.equal(full.saves, limits.saves);
  assert.equal(full.likes, limits.likes);
  assert.equal(full.likePace, limits.likePace);
  assert.equal(contactPoints(1), 2);
  assert.equal(contactPoints(2), 3);
  assert.equal(contactPoints(3), 4);
});

test("one five-star review does not take the star ceiling, and a long sample does", () => {
  const lone = popularityParts({ rating: "5", reviews: 1, positiveReviews: 1 });
  const crowd = popularityParts({ rating: "4.9", reviews: 30, positiveReviews: 30 });
  assert.equal(ratingPoints(5, 0), 0);
  assert.equal(ratingPoints(1, 8), 0);
  assert.equal(ratingPoints(2.9, 40), 0);
  assert.ok(lone.rating > 0);
  assert.ok(lone.rating < POPULARITY_LIMITS.rating / 2 + 2);
  assert.ok(crowd.rating > lone.rating);
  assert.ok(crowd.reviews > lone.reviews);
  assert.ok(crowd.total > lone.total);
});

test("reviews rated 1–3 never add review-volume points", () => {
  for (const star of [1, 2, 3]) {
    const parts = popularityParts({
      rating: String(star),
      reviews: 20,
      positiveReviews: 0,
    });
    assert.equal(parts.reviews, 0);
    if (star < 3) assert.equal(parts.rating, 0);
    assert.equal(parts.total, parts.rating);
  }
});

test("a wave of one-star reviews can never increase quality points", () => {
  const baselines = [
    [5],
    [5, 5, 5, 5, 5],
    [4, 4, 4, 4, 4],
    [5, 4, 5, 4, 5, 4],
    [5, 5, 4, 3],
  ];
  for (const original of baselines) {
    const stars = [...original];
    let previous = quality(stars);
    for (let index = 0; index < 50; index += 1) {
      stars.push(1);
      const next = quality(stars);
      assert.ok(
        next <= previous,
        `${original.join(",")} plus ${index + 1} one-star reviews grew from ${previous} to ${next}`,
      );
      previous = next;
    }
  }
});

test("positive volume uses only 4–5 ratings and is capped by total reviews", () => {
  const mixed = popularityParts({ rating: "3.6", reviews: 5, positiveReviews: 2 });
  const allPositive = popularityParts({ rating: "5", reviews: 5, positiveReviews: 5 });
  const impossible = popularityParts({ rating: "5", reviews: 5, positiveReviews: 999 });
  assert.ok(mixed.reviews > 0);
  assert.ok(mixed.reviews < allPositive.reviews);
  assert.equal(impossible.reviews, allPositive.reviews);
});

test("old positive reviews keep their lifetime points while recent positives add only a small bonus", () => {
  const old = popularityParts({ rating: "5", reviews: 20, positiveReviews: 20, recentPositiveReviews: 0 });
  const fresh = popularityParts({ rating: "5", reviews: 20, positiveReviews: 20, recentPositiveReviews: 5 });
  const impossible = popularityParts({ rating: "5", reviews: 2, positiveReviews: 2, recentPositiveReviews: 999 });
  assert.equal(old.reviews, POPULARITY_LIMITS.reviews);
  assert.equal(old.recentReviews, 0);
  assert.equal(fresh.reviews, old.reviews);
  assert.equal(fresh.recentReviews, POPULARITY_LIMITS.recentReviews);
  assert.ok(fresh.total - old.total <= 3);
  assert.ok(impossible.recentReviews < POPULARITY_LIMITS.recentReviews);
});

test("opens without a contact score nothing, and one converted open stays small", () => {
  assert.equal(responsePoints(500, 0), 0);
  assert.equal(responsePoints(0, 4), 0);
  const once = responsePoints(1, 1);
  assert.ok(once <= 2);
  assert.equal(responsePoints(80, 40), POPULARITY_LIMITS.views);
});

test("fresh likes have more weight than saves and a stale like pile", () => {
  const stale = popularityParts({ rating: "0", reviews: 0, likes: 10, likePace: 0 });
  const hot = popularityParts({ rating: "0", reviews: 0, likes: 2, likePace: 12 });
  const saves = popularityParts({ rating: "0", reviews: 0, saves: 5 });
  assert.equal(stale.likePace, 0);
  assert.equal(hot.likePace, POPULARITY_LIMITS.likePace);
  assert.ok(hot.total > stale.total);
  assert.ok(hot.total > saves.total);
  const recent = popularityParts({ rating: "0", reviews: 0, likes: 10 });
  const aged = popularityParts({ rating: "0", reviews: 0, likes: 5 });
  assert.ok(recent.likes > aged.likes);
});

test("card, contacts, saves, likes, and response grow monotonically and stop at their caps", () => {
  let previousCard = -1;
  for (let filled = 0; filled <= 20; filled += 1) {
    const part = popularityParts({ rating: "0", reviews: 0, cardFilled: filled }).card;
    assert.ok(part >= previousCard);
    assert.ok(part <= POPULARITY_LIMITS.card);
    previousCard = part;
  }
  assert.equal(previousCard, POPULARITY_LIMITS.card);

  let previousLike = -1;
  for (let likes = 0; likes <= 100; likes += 1) {
    const part = popularityParts({ rating: "0", reviews: 0, likes }).likes;
    assert.ok(part >= previousLike);
    assert.ok(part <= POPULARITY_LIMITS.likes);
    previousLike = part;
  }
  assert.equal(previousLike, POPULARITY_LIMITS.likes);

  assert.equal(popularityParts({ rating: "0", reviews: 0, contactsFilled: 99 }).contacts, POPULARITY_LIMITS.contacts);
  assert.equal(popularityParts({ rating: "0", reviews: 0, saves: 999 }).saves, POPULARITY_LIMITS.saves);
  assert.equal(responsePoints(1_000_000, 1_000_000), POPULARITY_LIMITS.views);
});

test("a new card borrows the catalog average only for days missing from each window", () => {
  assert.equal(imputeWindow(0, 90, 0), 90);
  assert.equal(imputeWindow(10, 90, 30), 70);
  assert.equal(imputeWindow(10, 90, 60), 10);
  assert.equal(imputeWindow(10, 90, null), 10);
  assert.equal(imputeWindow(0, 20, 0, POPULARITY_LIMITS.likePaceDays), 20);
  assert.equal(imputeWindow(4, 20, 10, POPULARITY_LIMITS.likePaceDays), 14);
  assert.equal(imputeWindow(4, 20, 20, POPULARITY_LIMITS.likePaceDays), 4);
  assert.equal(imputeWindow(4, 20, 60, POPULARITY_LIMITS.likePaceDays), 4);
});

test("the recent review bonus uses a rolling 180-day window", () => {
  const now = new Date("2026-11-11T18:00:00.000Z");
  assert.equal(recentReviewStart(now).toISOString(), "2026-05-15T18:00:00.000Z");
});

test("star points are zero at 3.0 after a long sample and half at a trusted 4.0", () => {
  assert.equal(ratingPoints(4, 1), POPULARITY_LIMITS.rating / 2);
  assert.ok(ratingPoints(3, 100) <= 1);
  assert.equal(ratingPoints(5, 200), POPULARITY_LIMITS.rating);
});

test("negative, non-finite, fractional, and contradictory input stays finite and bounded", () => {
  const absurd = [
    {
      rating: "NaN",
      reviews: Number.NaN,
      positiveReviews: Number.POSITIVE_INFINITY,
      recentPositiveReviews: Number.NEGATIVE_INFINITY,
      views: Number.NEGATIVE_INFINITY,
      engaged: Number.NaN,
      saves: -100,
      likes: Number.POSITIVE_INFINITY,
      likePace: -1,
      cardFilled: Number.NaN,
      contactsFilled: Number.POSITIVE_INFINITY,
    },
    {
      rating: "Infinity",
      reviews: -99,
      positiveReviews: 500,
      recentPositiveReviews: 500,
      views: -1,
      engaged: 500,
      saves: Number.NaN,
      likes: -10,
      likePace: Number.NaN,
      cardFilled: -4,
      contactsFilled: -4,
    },
    {
      rating: "999999999",
      reviews: 1.9,
      positiveReviews: 9.9,
      recentPositiveReviews: 1e300,
      views: 1e300,
      engaged: 1e300,
      saves: 1e300,
      likes: 1e300,
      likePace: 1e300,
      cardFilled: 1e300,
      contactsFilled: 1e300,
    },
  ];
  for (const input of absurd) {
    const parts = popularityParts(input);
    for (const value of Object.values(parts)) {
      assert.ok(Number.isFinite(value), JSON.stringify(parts));
      assert.ok(value >= 0, JSON.stringify(parts));
    }
    assert.ok(parts.total <= 100, JSON.stringify(parts));
  }
});

test("catalog sorting uses the recalibrated total and remains deterministic on a tie", () => {
  const liked = {
    name: "Бета",
    rating: "0",
    reviews: 0,
    likes: 10,
    likePace: 12,
    saves: 0,
  };
  const saved = {
    name: "Альфа",
    rating: "0",
    reviews: 0,
    saves: 5,
    likes: 0,
    likePace: 0,
  };
  assert.ok(popularityScore(liked) > popularityScore(saved));
  assert.ok(compareByPopularity(liked, saved) < 0);
  assert.ok(compareByPopularity({ ...liked, name: "А" }, { ...liked, name: "Б" }) < 0);
});
