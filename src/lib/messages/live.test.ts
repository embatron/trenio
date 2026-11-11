import assert from "node:assert/strict";
import { mock, test } from "node:test";

import { CABINET_HINT_MS } from "@/lib/cabinet/live";
import { shouldReceiveThread, shouldReceiveTyping } from "@/lib/messages/live";
import { attachLiveSocket, publishCabinet, publishThread, publishTyping } from "@/lib/messages/live-hub";

test("a thread update reaches both people and a staff reader", () => {
  const party = ["client", "trainer"];
  assert.equal(shouldReceiveThread("client", false, party), true);
  assert.equal(shouldReceiveThread("trainer", false, party), true);
  assert.equal(shouldReceiveThread("admin", true, party), true);
  assert.equal(shouldReceiveThread("stranger", false, party), false);
});

test("typing reaches only the other participant", () => {
  const party = ["client", "trainer"];
  assert.equal(shouldReceiveTyping("trainer", "client", party), true);
  assert.equal(shouldReceiveTyping("client", "client", party), false);
  assert.equal(shouldReceiveTyping("admin", "client", party), false);
});

test("the hub keeps the message text off the socket", () => {
  const sent: Record<string, string[]> = { client: [], trainer: [], admin: [] };
  const detach = [
    attachLiveSocket({ userId: "client", roles: ["user"], send: (payload) => sent.client.push(payload) }),
    attachLiveSocket({ userId: "trainer", roles: ["trainer"], send: (payload) => sent.trainer.push(payload) }),
    attachLiveSocket({ userId: "admin", roles: ["admin"], send: (payload) => sent.admin.push(payload) }),
  ];
  publishTyping("conv", ["client", "trainer"], "client", true);
  publishThread("conv", ["client", "trainer"]);
  for (const stop of detach) stop();
  assert.deepEqual(sent.client.filter((payload) => payload.includes("typing")), []);
  assert.equal(sent.trainer.filter((payload) => payload.includes("typing")).length, 1);
  assert.deepEqual(sent.admin.filter((payload) => payload.includes("typing")), []);
  assert.equal(sent.admin.filter((payload) => payload.includes('"thread"')).length, 1);
  assert.equal(sent.admin.filter((payload) => payload.includes('"unread"')).length, 0);
  assert.equal(sent.client.filter((payload) => payload.includes('"unread"')).length, 1);
  assert.equal(sent.trainer.filter((payload) => payload.includes('"unread"')).length, 1);
});

test("a cabinet hint collapses a burst into one frame", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const sent: string[] = [];
    const detach = attachLiveSocket({
      userId: "trainer",
      roles: ["trainer"],
      send: (payload) => sent.push(payload),
    });
    publishCabinet(["trainer", "trainer", null]);
    publishCabinet(["trainer"]);
    publishCabinet(["ghost"]);
    assert.equal(sent.length, 0);
    mock.timers.tick(CABINET_HINT_MS);
    assert.deepEqual(sent, [JSON.stringify({ type: "cabinet" })]);
    detach();
  } finally {
    mock.timers.reset();
  }
});
