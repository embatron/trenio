import assert from "node:assert/strict";
import test from "node:test";

import { catalogPagePhrase, catalogSportById, linkedSportCities, listCatalogSports, sportCrowdPhrase, trainersInCityPhrase } from "@/lib/catalog/catalog-sports";
import { trainerSportRoles } from "@/lib/catalog/sport-taxonomy";
import { cityCatalogBySlug, listCityCatalogPages } from "@/lib/catalog/city-pages";

test("the city link uses the catalog case", () => {
  const minsk = cityCatalogBySlug("minsk");
  const grodno = cityCatalogBySlug("grodno");
  const boxing = catalogSportById("boks");
  const gym = catalogSportById("trenazherka");
  const ofp = catalogSportById("ofp");
  assert.ok(minsk && grodno && boxing && gym && ofp);

  const fitness = catalogSportById("fitnes");
  const yoga = catalogSportById("yoga/yoga") ?? catalogSportById("yoga");
  const jumping = catalogSportById("dzhamping");
  const lfk = catalogSportById("lfk");
  assert.ok(fitness && yoga && jumping && lfk);

  assert.equal(trainersInCityPhrase(boxing, minsk), "Тренеры по боксу в Минске");
  assert.equal(trainersInCityPhrase(boxing, grodno), "Тренеры по боксу в Гродно");
  assert.equal(trainersInCityPhrase(gym, minsk), "Инструкторы по тренажёрному залу в Минске");
  assert.equal(trainersInCityPhrase(fitness, minsk), "Инструкторы по фитнесу в Минске");
  assert.equal(trainersInCityPhrase(yoga, minsk), "Инструкторы по йоге в Минске");
  assert.equal(trainersInCityPhrase(jumping, grodno), "Инструкторы по джампингу в Гродно");
  assert.equal(trainersInCityPhrase(lfk, minsk), "Инструкторы ЛФК в Минске");
  assert.equal(trainersInCityPhrase(ofp, minsk), "Тренеры по общефизической подготовке в Минске");
  assert.equal(sportCrowdPhrase(gym), "Инструкторы по тренажёрному залу");
  assert.equal(sportCrowdPhrase(fitness), "Инструкторы по фитнесу");
  assert.equal(sportCrowdPhrase(boxing), "Тренеры по боксу");
  assert.equal(catalogPagePhrase(minsk, gym), "Найти инструктора по тренажёрному залу в Минске");
  assert.equal(catalogPagePhrase(minsk, fitness), "Найти инструктора по фитнесу в Минске");
  assert.equal(catalogPagePhrase(minsk, yoga), "Найти инструктора по йоге в Минске");
  assert.equal(catalogPagePhrase(minsk, boxing), "Найти тренера по боксу в Минске");
  const massage = catalogSportById("massazh");
  const trx = catalogSportById("trx");
  const lfkSport = catalogSportById("lfk");
  assert.ok(massage && trx && lfkSport);
  assert.equal(catalogPagePhrase(minsk, massage), "Найти массажиста в Минске");
  assert.equal(catalogPagePhrase(minsk, trx), "Найти инструктора TRX в Минске");
  assert.equal(catalogPagePhrase(minsk, lfkSport), "Найти инструктора по лечебной физической культуре в Минске");
});

test("an instructor sport does not invite a trainer", () => {
  const minsk = cityCatalogBySlug("minsk");
  assert.ok(minsk);
  for (const sport of listCatalogSports()) {
    const role = trainerSportRoles([{ slug: sport.slug, label: sport.label }])[0];
    const instructor = role?.lead === "Инструктор" || role?.text.toLocaleLowerCase("ru").startsWith("инструктор");
    if (!instructor && !(sport.level === 1 && sport.slug === "fitnes")) continue;
    const phrase = catalogPagePhrase(minsk, sport);
    assert.equal(phrase.includes("тренера"), false, sport.id);
    assert.equal(phrase.includes("инструктора"), true, sport.id);
  }
});

test("a sport page links three to five other cities that already have a trainer", () => {
  const boxing = catalogSportById("boks");
  assert.ok(boxing);
  const trainers = listCityCatalogPages().slice(0, 10).map((city) => ({
    city: city.name,
    sportSlugs: ["boks"],
    sportParents: ["edinoborstva"],
  }));

  const first = linkedSportCities(trainers, boxing, "minsk");
  const again = linkedSportCities(trainers, boxing, "minsk");
  assert.deepEqual(again.map((city) => city.slug), first.map((city) => city.slug));
  assert.ok(first.length >= 3 && first.length <= 5);
  assert.equal(first.some((city) => city.slug === "minsk"), false);
  assert.ok(first.every((city) => trainers.some((trainer) => trainer.city === city.name)));

  const none = linkedSportCities([], boxing, null);
  assert.deepEqual(none, []);
});
