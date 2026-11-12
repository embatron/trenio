import assert from "node:assert/strict";
import test from "node:test";

import { socketOriginAllowed } from "@/lib/messages/socket-origin";

const hosts = ["trenio.by", "www.trenio.by", "trenio.local"];

test("the live socket accepts this site and refuses another page", () => {
  assert.equal(socketOriginAllowed("https://trenio.by", hosts), true);
  assert.equal(socketOriginAllowed("https://www.trenio.by", hosts), true);
  assert.equal(socketOriginAllowed("http://trenio.local", hosts), true);
  assert.equal(socketOriginAllowed("https://evil.example", hosts), false);
  assert.equal(socketOriginAllowed("https://trenio.by.evil.example", hosts), false);
  assert.equal(socketOriginAllowed(null, hosts), false);
  assert.equal(socketOriginAllowed("not a url", hosts), false);
});
