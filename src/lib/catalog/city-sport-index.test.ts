import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogPathsForSitemap,
  catalogSportById,
  citySportHasTrainer,
  indexableCitySportPaths,
  listCatalogSitemapPaths,
} from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
import { categoryChildRoute, categorySlugRoute } from "@/lib/catalog/sport-taxonomy";
import { contactClickIsRepeat } from "@/lib/catalog/trainer-contact-clicks";

test("a city and sport page opens only when a published trainer matches", () => {
  const minsk = cityCatalogBySlug("minsk");
  const gomel = cityCatalogBySlug("gomel");
  const boxing = catalogSportById("boks");
  const combat = catalogSportById("edinoborstva");
  assert.ok(minsk && gomel && boxing && combat);

  const trainer = {
    city: "Минск",
    sportSlugs: ["boks"],
    sportParents: ["edinoborstva"],
  };
  assert.equal(citySportHasTrainer([trainer], minsk, boxing), true);
  assert.equal(citySportHasTrainer([trainer], minsk, combat), true);
  assert.equal(citySportHasTrainer([trainer], gomel, boxing), false);

  const open = indexableCitySportPaths([trainer]);
  assert.ok(open.includes("/city/minsk/boks"));
  assert.ok(open.includes("/city/minsk/edinoborstva"));
  assert.equal(open.includes("/city/gomel/boks"), false);

  const paths = catalogPathsForSitemap(open);
  assert.ok(paths.includes("/city/minsk"));
  assert.ok(paths.includes("/city/minsk/boks"));
  assert.equal(paths.includes("/city/gomel/boks"), false);
  assert.ok(paths.includes("/categories"));

  const closed = catalogPathsForSitemap([]);
  assert.ok(closed.includes("/city/minsk"));
  assert.equal(closed.some((path) => path.startsWith("/city/minsk/")), false);
});

test("an unknown category slug is not a public document", () => {
  assert.deepEqual(categorySlugRoute("zzzz-not-real"), { kind: "missing" });
  assert.deepEqual(categorySlugRoute("velnes"), { kind: "missing" });
  assert.deepEqual(categorySlugRoute("meditaciya"), { kind: "missing" });
  assert.deepEqual(categorySlugRoute("fitnes"), { kind: "render" });
  assert.deepEqual(categorySlugRoute("yoga"), { kind: "render" });
  assert.deepEqual(categorySlugRoute("plavanie"), { kind: "render" });
  assert.deepEqual(categorySlugRoute("boks"), {
    kind: "child",
    parentSlug: "edinoborstva",
    childSlug: "boks",
  });
  assert.deepEqual(categorySlugRoute("ofp"), {
    kind: "child",
    parentSlug: "fitnes",
    childSlug: "ofp",
  });

  assert.deepEqual(categoryChildRoute("zzzz-not-real", "boks"), { kind: "missing" });
  assert.deepEqual(categoryChildRoute("velnes", "meditaciya"), { kind: "missing" });
  assert.deepEqual(categoryChildRoute("edinoborstva", "net-takogo"), {
    kind: "parent",
    parentSlug: "edinoborstva",
  });
  assert.deepEqual(categoryChildRoute("edinoborstva", "boks"), { kind: "render" });
  assert.deepEqual(categoryChildRoute("yoga", "yoga"), { kind: "render" });

  const paths = listCatalogSitemapPaths();
  assert.equal(paths.includes("/categories/velnes"), false);
  assert.equal(paths.includes("/categories/velnes/meditaciya"), false);
  assert.equal(paths.includes("/categories/zzzz-not-real"), false);
  assert.ok(paths.includes("/categories/fitnes"));
  assert.ok(paths.includes("/categories/edinoborstva/boks"));
  assert.ok(paths.includes("/city/minsk"));
});

test("two taps a moment apart count as one click", () => {
  assert.equal(contactClickIsRepeat(1_000, 2_000), true);
  assert.equal(contactClickIsRepeat(1_000, 4_000), false);
  assert.equal(contactClickIsRepeat(null, 4_000), false);
});
