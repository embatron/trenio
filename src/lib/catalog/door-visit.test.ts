import assert from "node:assert/strict";
import test from "node:test";

import { earliestHumanVisit, isLinkPreviewVisit } from "@/lib/catalog/door-visit";

test("Instagram's link preview is not a visit", () => {
  assert.equal(
    isLinkPreviewVisit("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)", "173.252.69.113"),
    true,
  );
  assert.equal(
    isLinkPreviewVisit("Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Mobile Safari/537.36", "34.219.53.223"),
    true,
  );
  assert.equal(
    isLinkPreviewVisit("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36", "52.34.69.104"),
    true,
  );
  assert.equal(
    isLinkPreviewVisit("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.131 Safari/537.36", "57.141.6.39"),
    true,
  );
  assert.equal(isLinkPreviewVisit("Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) Chrome/139.0.0.0 Mobile Safari/537.36", "8.8.8.8"), false);
});

test("a phone that opens the link inside Instagram is a visit", () => {
  const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 26_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/23D127 Instagram 455.0.0.35.67 (iPhone17,5; iOS 26_3; ru_BY)";
  assert.equal(isLinkPreviewVisit(iphone, "178.172.152.6"), false);
  const android = "Mozilla/5.0 (Linux; Android 16; SM-A546E Build/BP4A.251205.006; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/157.0.8103.44 Mobile Safari/537.36";
  assert.equal(isLinkPreviewVisit(android, "178.120.54.234"), false);
});

test("the visit time is the first person, and a robot-only thread has none", () => {
  const robot = new Date("2026-11-16T07:37:28.210Z");
  const person = new Date("2026-11-16T07:40:36.957Z");
  assert.equal(
    earliestHumanVisit([
      { at: robot, userAgent: "facebookexternalhit/1.1", ip: "173.252.69.113" },
      { at: person, userAgent: "Instagram 455.0.0.35.67", ip: "178.172.152.6" },
    ])?.toISOString(),
    person.toISOString(),
  );
  assert.equal(
    earliestHumanVisit([{ at: robot, userAgent: "facebookexternalhit/1.1", ip: "173.252.69.113" }]),
    null,
  );
});
