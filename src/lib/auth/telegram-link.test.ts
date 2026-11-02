import assert from "node:assert/strict";
import test from "node:test";

import { cleanTelegramUsername, decideTelegramBind } from "./telegram-link";

const userId = "account-a";

test("a free Telegram id links, and the same id stays on this account", () => {
  assert.equal(
    decideTelegramBind({ userId, incomingId: 10, currentId: null, ownerId: null }),
    "link",
  );
  assert.equal(
    decideTelegramBind({ userId, incomingId: 10, currentId: 10, ownerId: userId }),
    "same",
  );
});

test("a Telegram id owned by someone else is refused", () => {
  assert.equal(
    decideTelegramBind({ userId, incomingId: 10, currentId: null, ownerId: "account-b" }),
    "taken",
  );
});

test("a second Telegram id does not replace the one already stored", () => {
  assert.equal(
    decideTelegramBind({ userId, incomingId: 11, currentId: 10, ownerId: null }),
    "replace-blocked",
  );
});

test("a public username is stored without @", () => {
  assert.equal(cleanTelegramUsername(" @Trenio "), "Trenio");
  assert.equal(cleanTelegramUsername("   "), null);
});
