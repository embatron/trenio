import assert from "node:assert/strict";
import test from "node:test";

import { AuthError } from "@/lib/auth/errors";
import { assertConversationAccess, canMessage, getCounterparty, type ConversationAccess, type MessageActor } from "@/lib/messages/service";

const userId = "11111111-1111-4111-8111-111111111111";
const ownerId = "22222222-2222-4222-8222-222222222222";
const strangerId = "33333333-3333-4333-8333-333333333333";
const staffId = "44444444-4444-4444-8444-444444444444";

const openRow: ConversationAccess = {
  userId,
  ownerUserId: ownerId,
  status: "open",
  blocked: false,
  published: true,
};

function actor(id: string, roles: MessageActor["roles"]): MessageActor {
  return { id, roles };
}

test("participant reads and writes an open published thread", () => {
  assert.doesNotThrow(() => assertConversationAccess(actor(userId, ["user"]), openRow, "read"));
  assert.doesNotThrow(() => assertConversationAccess(actor(ownerId, ["trainer"]), openRow, "write"));
});

test("a stranger cannot read or write another conversation", () => {
  assert.throws(() => assertConversationAccess(actor(strangerId, ["user"]), openRow, "read"), (error: unknown) => {
    assert.ok(error instanceof AuthError);
    assert.equal(error.code, "FORBIDDEN");
    return true;
  });
  assert.throws(() => assertConversationAccess(actor(strangerId, ["trainer"]), openRow, "write"), AuthError);
});

test("staff can read any thread and cannot write into it", () => {
  assert.doesNotThrow(() => assertConversationAccess(actor(staffId, ["admin"]), openRow, "read"));
  assert.throws(() => assertConversationAccess(actor(staffId, ["superadmin"]), openRow, "write"), AuthError);
});

test("closed, blocked and unpublished threads reject new messages", () => {
  assert.throws(
    () => assertConversationAccess(actor(userId, ["user"]), { ...openRow, status: "closed" }, "write"),
    /закрыта/,
  );
  assert.throws(
    () => assertConversationAccess(actor(ownerId, ["trainer"]), { ...openRow, blocked: true }, "write"),
    /недоступна/,
  );
  assert.throws(
    () => assertConversationAccess(actor(userId, ["user"]), { ...openRow, published: false }, "write"),
    /не принимает/,
  );
});

test("only the profile owner and staff can close; only staff can reopen or block", () => {
  assert.throws(() => assertConversationAccess(actor(userId, ["user"]), openRow, "close"), AuthError);
  assert.doesNotThrow(() => assertConversationAccess(actor(ownerId, ["club"]), openRow, "close"));
  assert.doesNotThrow(() => assertConversationAccess(actor(staffId, ["admin"]), openRow, "close"));
  assert.throws(() => assertConversationAccess(actor(ownerId, ["trainer"]), openRow, "reopen"), AuthError);
  assert.doesNotThrow(() => assertConversationAccess(actor(staffId, ["superadmin"]), openRow, "reopen"));
  assert.throws(() => assertConversationAccess(actor(ownerId, ["trainer"]), openRow, "block"), AuthError);
  assert.doesNotThrow(() => assertConversationAccess(actor(staffId, ["admin"]), openRow, "block"));
});

test("canMessage rejects self, unpublished and blocked profiles", () => {
  assert.deepEqual(canMessage({ actorId: ownerId, ownerUserId: ownerId, published: true, blocked: false }).ok, false);
  assert.equal(canMessage({ actorId: userId, ownerUserId: ownerId, published: false, blocked: false }).ok, false);
  assert.equal(canMessage({ actorId: userId, ownerUserId: ownerId, published: true, blocked: true }).ok, false);
  assert.equal(canMessage({ actorId: userId, ownerUserId: null, published: true, blocked: false }).ok, true);
});

test("getCounterparty shows the trainer to the initiator and the user to everyone else", () => {
  const base = {
    conversationUserId: userId,
    userName: "Анна",
    userFirstName: "Анна",
    userLastName: "",
    userAvatarPath: "/avatars/a.jpg",
    trainerName: "Иван",
    trainerFirstName: "Иван",
    trainerLastName: "",
    trainerAvatarPath: "/trainers/i.jpg",
    trainerSlug: "ivan",
  };
  assert.equal(getCounterparty({ ...base, viewerId: userId }).kind, "trainer");
  assert.equal(getCounterparty({ ...base, viewerId: userId }).slug, "ivan");
  assert.equal(getCounterparty({ ...base, viewerId: ownerId }).kind, "user");
  assert.equal(getCounterparty({ ...base, viewerId: staffId }).name, "Анна");
});
