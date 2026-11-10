import assert from "node:assert/strict";
import test from "node:test";

import { keepsOwnPortrait, oauthNamePatch } from "@/auth/oauth-profile";
import { readYandexIdentity } from "@/lib/auth/yandex-identity";

const CLIENT = "6371bfd0812a449eb311318200429953";

function profile(extra: Record<string, unknown> = {}) {
  return {
    id: "1000034426",
    client_id: CLIENT,
    default_email: "Person@Yandex.by",
    emails: ["person@yandex.by"],
    first_name: "Анна",
    last_name: "Коваль",
    default_phone: { id: 1, number: "+375291112233" },
    is_avatar_empty: false,
    default_avatar_id: "131652443",
    ...extra,
  };
}

test("a Yandex profile keeps the mailbox, a Belarus phone, and the portrait", () => {
  const identity = readYandexIdentity(profile(), CLIENT);
  assert.deepEqual(identity, {
    sub: "1000034426",
    email: "person@yandex.by",
    name: "Анна",
    lastName: "Коваль",
    phone: "+375 29 111-22-33",
    avatarUrl: "https://avatars.yandex.net/get-yapic/131652443/islands-200",
  });
});

test("a foreign phone, an empty portrait, and a wrong client are dropped", () => {
  const foreign = readYandexIdentity(profile({ default_phone: { number: "+79037659418" } }), CLIENT);
  assert.equal(foreign?.phone, null);
  const stub = readYandexIdentity(profile({ is_avatar_empty: true }), CLIENT);
  assert.equal(stub?.avatarUrl, null);
  assert.equal(readYandexIdentity(profile({ client_id: "other" }), CLIENT), null);
  assert.equal(readYandexIdentity(profile({ default_email: "other@yandex.by" }), CLIENT), null);
  assert.equal(readYandexIdentity(profile({ id: "../evil" }), CLIENT), null);
});

test("a numeric Yandex portrait id and a full name still come through", () => {
  const identity = readYandexIdentity(profile({
    first_name: "",
    last_name: "",
    real_name: "Евгений Соколов",
    default_avatar_id: 131652443,
  }), CLIENT);
  assert.equal(identity?.name, "Евгений");
  assert.equal(identity?.lastName, "Соколов");
  assert.equal(identity?.avatarUrl, "https://avatars.yandex.net/get-yapic/131652443/islands-200");
});

test("a Yandex portrait id may contain a slash, and an existing photo stays", () => {
  const identity = readYandexIdentity(profile({ default_avatar_id: "20758/enc-abcdef" }), CLIENT);
  assert.equal(identity?.avatarUrl, "https://avatars.yandex.net/get-yapic/20758/enc-abcdef/islands-200");
  assert.equal(readYandexIdentity(profile({ default_avatar_id: "../evil" }), CLIENT)?.avatarUrl, null);
  assert.equal(keepsOwnPortrait("/avatars/own.jpg", []), true);
  assert.equal(keepsOwnPortrait("", ["/trainers/instagram/card.jpg"]), true);
  assert.equal(keepsOwnPortrait("", [""]), false);
});

test("a provider name fills only a placeholder", () => {
  assert.deepEqual(
    oauthNamePatch({ firstName: "Пользователь", lastName: null }, { firstName: "Евгений", lastName: "Соколов" }),
    { firstName: "Евгений", lastName: "Соколов" },
  );
  assert.deepEqual(
    oauthNamePatch({ firstName: "Анна", lastName: "Коваль" }, { firstName: "Евгений", lastName: "Соколов" }),
    {},
  );
  assert.deepEqual(
    oauthNamePatch({ firstName: "+37529.....45", lastName: null }, { firstName: "Евгений", lastName: "Соколов" }),
    { firstName: "Евгений", lastName: "Соколов" },
  );
});
