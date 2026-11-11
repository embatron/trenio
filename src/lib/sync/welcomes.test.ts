import assert from "node:assert/strict";
import test from "node:test";

import { readWelcomeSync, welcomeIdentity, welcomeUpdate } from "./welcomes";

const submitted = "2026-11-11T19:18:36.000Z";

function welcome(patch: Partial<Parameters<typeof welcomeUpdate>[1]> = {}) {
  return {
    channel: "instagram" as const,
    instagram: "Anna.Fit",
    telegram: "Anna",
    phone: "+375 29 123-45-67",
    createdAt: submitted,
    linkSentAt: null,
    staffStatus: "new" as const,
    ...patch,
  };
}

test("the same application keeps one identity when the phone is written another way", () => {
  const left = welcomeIdentity(welcome());
  const right = welcomeIdentity(welcome({ instagram: "anna.fit", phone: "375291234567" }));
  assert.equal(left, right);
  assert.notEqual(left, welcomeIdentity(welcome({ createdAt: "2026-11-11T19:18:37.000Z" })));
});

test("a site application is stored only when it has a channel and a time", () => {
  assert.equal(readWelcomeSync(welcome())?.instagram, "Anna.Fit");
  assert.equal(readWelcomeSync({ ...welcome(), channel: "mail" }), null);
  assert.equal(readWelcomeSync({ ...welcome(), createdAt: "tomorrow" }), null);
  assert.equal(readWelcomeSync(welcome({ staffStatus: "done" }))?.staffStatus, "done");
});

test("a new application is inserted and a site decision fills the laptop", () => {
  assert.equal(welcomeUpdate(welcome(), welcome()), null);
  assert.deepEqual(
    welcomeUpdate(welcome(), welcome({ staffStatus: "done", linkSentAt: submitted })),
    { staffStatus: "done", linkSentAt: submitted },
  );
  assert.equal(
    welcomeUpdate(welcome({ staffStatus: "done" }), welcome({ staffStatus: "new" })),
    null,
  );
  assert.equal(
    welcomeUpdate(welcome({ linkSentAt: submitted }), welcome({ linkSentAt: null })),
    null,
  );
});
