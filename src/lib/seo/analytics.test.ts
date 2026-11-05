import assert from "node:assert/strict";
import test from "node:test";

import {
  GA_MEASUREMENT_ID,
  YM_COUNTER_ID,
  googleAnalyticsSnippet,
  yandexMetrikaSnippet,
} from "@/lib/seo/analytics";

test("one GA4 tag and one Metrika counter, without Webvisor", () => {
  assert.equal(GA_MEASUREMENT_ID, "G-DYGP8VFTHC");
  assert.equal(YM_COUNTER_ID, 114087488);
  const ga = googleAnalyticsSnippet();
  assert.match(ga, /gtag\('config','G-DYGP8VFTHC'\)/);
  assert.equal(ga.includes("GTM-"), false);
  const ym = yandexMetrikaSnippet();
  assert.match(ym, /mc\.yandex\.ru\/metrika\/tag\.js/);
  assert.match(ym, /ym\(114087488,"init"/);
  assert.match(ym, /webvisor:false/);
  assert.equal(ym.includes("webvisor:true"), false);
});
