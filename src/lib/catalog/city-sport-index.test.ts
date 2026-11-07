import assert from "node:assert/strict";
import test from "node:test";

import {
  catalogPathsForSitemap,
  catalogSportById,
  citySportHasTrainer,
  indexableCitySportPaths,
} from "@/lib/catalog/catalog-sports";
import { cityCatalogBySlug } from "@/lib/catalog/city-pages";
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

test("two taps a moment apart count as one click", () => {
  assert.equal(contactClickIsRepeat(1_000, 2_000), true);
  assert.equal(contactClickIsRepeat(1_000, 4_000), false);
  assert.equal(contactClickIsRepeat(null, 4_000), false);
});
