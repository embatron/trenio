import assert from "node:assert/strict";
import test from "node:test";

import {
  backShouldOpenDialogList,
  isMessageThreadPath,
  markTrainerDialogOpened,
  messageListPath,
  trainerDialogAlreadyOpened,
} from "@/lib/messages/phone-history";

test("system back from a dialog opens the list when the previous page is outside it", () => {
  assert.equal(backShouldOpenDialogList("/account/messages/11111111-1111-1111-1111-111111111111", "/trainers/anna"), true);
  assert.equal(backShouldOpenDialogList("/me/messages/11111111-1111-1111-1111-111111111111", "/me"), true);
  assert.equal(backShouldOpenDialogList("/account/messages/11111111-1111-1111-1111-111111111111", "/account/messages"), false);
  assert.equal(backShouldOpenDialogList("/account/messages/11111111-1111-1111-1111-111111111111", "/account/messages?trainer=anna"), false);
  assert.equal(backShouldOpenDialogList("/account/messages", "/"), false);
  assert.equal(isMessageThreadPath("/admin/messages"), false);
  assert.equal(messageListPath("/me/messages/abc"), "/me/messages");
});

test("a trainer link that already opened does not push the dialog again", () => {
  const marked = markTrainerDialogOpened({ __TSR_index: 2, key: "a" }, "anna");
  assert.equal(trainerDialogAlreadyOpened(marked, "anna"), true);
  assert.equal(trainerDialogAlreadyOpened(marked, "boris"), false);
  assert.equal(markTrainerDialogOpened(null, "anna"), null);
});
