import assert from "node:assert/strict";
import test from "node:test";

import { mergedStatus, syncMove, trainerRevision, type TrainerCardBody, type TrainerSyncHead } from "./trainers";

const body = {
  slug: "anna",
  sourceUrl: "https://www.instagram.com/anna/",
  claimStatus: "unclaimed",
  createdSource: "import",
  firstName: "Анна",
  lastName: "",
  fullName: "Анна",
  gender: "",
  headline: "",
  bio: "Одна карточка",
  sourceBio: "",
  about: [],
  pinnedPosts: [],
  sports: [],
  primarySport: null,
  audiences: ["adult"],
  formats: [],
  city: "Минск",
  citySlug: "minsk",
  district: "",
  trainingPlaces: [],
  address: null,
  addressLat: null,
  addressLng: null,
  geocodeStatus: null,
  priceFrom: null,
  languages: [],
  avatarPath: "",
  photos: [],
  certificates: [],
  phone: "",
  email: "",
  website: "",
  instagramUrl: "https://www.instagram.com/anna/",
  telegram: "",
  experienceYears: 0,
} satisfies TrainerCardBody;

function head(patch: Partial<TrainerSyncHead> = {}): TrainerSyncHead {
  return {
    handle: "anna",
    status: "draft",
    updatedAt: "2026-11-01T00:00:00.000Z",
    outreachSentAt: null,
    inviteSentAt: null,
    doorEnteredAt: null,
    revision: trainerRevision(body),
    ...patch,
  };
}

test("the card hash ignores status and message marks", () => {
  const revision = trainerRevision(body);
  assert.equal(revision, trainerRevision({ ...body }));
  assert.notEqual(revision, trainerRevision({ ...body, bio: "Другая карточка" }));
  assert.equal(head().revision, head({ status: "published", outreachSentAt: "2026-11-02T00:00:00.000Z" }).revision);
});

test("a trainer who exists on one side only is copied that way", () => {
  assert.equal(syncMove(head(), null).pushCard, true);
  assert.equal(syncMove(null, head()).pullCard, true);
  assert.equal(syncMove(null, null).pushCard, false);
});

test("a newer card moves, and an equal clock keeps the live card", () => {
  const local = head({ updatedAt: "2026-11-06T00:00:00.000Z" });
  const remote = head({ updatedAt: "2026-11-01T00:00:00.000Z", revision: trainerRevision({ ...body, bio: "Старее" }) });
  assert.equal(syncMove(local, remote).pushCard, true);
  assert.equal(syncMove(local, remote).pullCard, false);
  const tie = syncMove(head({ revision: "local-hash" }), head({ revision: "live-hash" }));
  assert.equal(tie.pullCard, true);
  assert.equal(tie.pushCard, false);
});

test("message marks fill the empty side and do not move the card", () => {
  const sent = "2026-11-06T08:00:00.000Z";
  const local = syncMove(head({ outreachSentAt: sent }), head());
  assert.equal(local.pushMarks, true);
  assert.equal(local.pullMarks, false);
  assert.equal(local.pushCard, false);
  const live = syncMove(head(), head({ doorEnteredAt: sent }));
  assert.equal(live.pullMarks, true);
  assert.equal(live.pushMarks, false);
  const localVisit = syncMove(head({ doorEnteredAt: sent }), head());
  assert.equal(localVisit.pushMarks, false);
  assert.equal(localVisit.pullMarks, false);
});

test("a catalog status replaces draft, and two catalog statuses follow the newer card", () => {
  const published = syncMove(head(), head({ status: "published" }));
  assert.equal(published.pullStatus, true);
  assert.equal(published.pushStatus, false);
  assert.equal(published.pullCard, false);
  const hidden = syncMove(
    head({ status: "hidden", updatedAt: "2026-11-06T00:00:00.000Z" }),
    head({ status: "published", updatedAt: "2026-11-01T00:00:00.000Z" }),
  );
  assert.equal(hidden.pushStatus, true);
  assert.equal(mergedStatus("draft", "published", head().updatedAt, head().updatedAt, "existing"), "published");
  assert.equal(mergedStatus("published", "draft", head().updatedAt, head().updatedAt, "incoming"), "published");
});
