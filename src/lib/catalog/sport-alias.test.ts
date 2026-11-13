import assert from "node:assert/strict";
import test from "node:test";

import { prepareSportText, sportAliasRegex } from "@/lib/catalog/sport-alias";

test("sport alias matches an inflected form and not a longer sport", () => {
  assert.equal(sportAliasRegex("йога").test("тренер по йоге"), true);
  assert.equal(sportAliasRegex("йога").test("йогой"), true);
  assert.equal(sportAliasRegex("йога").test("йогурт"), false);
  assert.equal(sportAliasRegex("пилатес").test("по пилатесу"), true);
  assert.equal(sportAliasRegex("плавание").test("обучение плаванию"), true);
  assert.equal(sportAliasRegex("настольный теннис").test("настольному теннису"), true);
  assert.equal(sportAliasRegex("фигурное катание").test("фигурному катанию"), true);
  assert.equal(sportAliasRegex("бокс").test("кикбоксинг"), false);
  assert.equal(sportAliasRegex("футбол").test("футбольный тренер"), true);
  assert.equal(sportAliasRegex("бокс").test("бокс"), true);
});

test("a glued hashtag splits into the sport and the city", () => {
  assert.equal(
    prepareSportText("Тренер #пилатесминск", ["Минск"], ["пилатес", "йога"]),
    "Тренер  пилатес минск ",
  );
  assert.equal(prepareSportText("йога", ["Минск"], ["йога"]), "йога");
});
