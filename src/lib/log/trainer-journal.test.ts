import assert from "node:assert/strict";
import test from "node:test";

import { trainerJournalKind } from "@/lib/log/trainer-journal";

test("trainer addition and appearance stay in the permanent journal", () => {
  assert.equal(trainerJournalKind("trainer.add"), "always");
  assert.equal(trainerJournalKind("trainer.sync"), "always");
  assert.equal(trainerJournalKind("trainer.appear"), "always");
  assert.equal(trainerJournalKind("trainer.withdraw"), "always");
  assert.equal(trainerJournalKind("form.trainer_profile"), "always");
  assert.equal(trainerJournalKind("admin.trainer_remove"), "always");
  assert.equal(trainerJournalKind("account.claim"), "always");
  assert.equal(trainerJournalKind("account.password"), "always");
});

test("trainer account actions are kept only when the actor is a trainer", () => {
  assert.equal(trainerJournalKind("auth.login"), "account");
  assert.equal(trainerJournalKind("account.password.change"), "account");
  assert.equal(trainerJournalKind("account.delete"), "account");
  assert.equal(trainerJournalKind("email.notice"), "account");
});

test("catalog noise and message polls are not a trainer account journal", () => {
  assert.equal(trainerJournalKind("map.area"), "no");
  assert.equal(trainerJournalKind("catalog.list"), "no");
  assert.equal(trainerJournalKind("message.list"), "no");
  assert.equal(trainerJournalKind("message.send"), "no");
  assert.equal(trainerJournalKind("system.purge"), "no");
});
