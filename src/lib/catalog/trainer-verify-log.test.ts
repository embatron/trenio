import assert from "node:assert/strict";
import test from "node:test";

import { publishMessage, staffProof, verificationMessage } from "@/lib/catalog/trainer-verify-log";

test("a verification row names the channel and whether the actor is staff", () => {
  assert.equal(
    verificationMessage("door-letter"),
    "Верификацию включил тренер. Канал: письмо по короткой ссылке. Не сотрудник.",
  );
  assert.equal(
    verificationMessage("staff-card"),
    "Верификацию включил сотрудник. Канал: карточка сотрудника. Сотрудник.",
  );
  assert.equal(staffProof("staff-switch"), true);
  assert.equal(staffProof("sms"), false);
});

test("a publish row names who, the channel, and whether verification came with it", () => {
  assert.equal(
    publishMessage("staff-switch", true, false),
    "Опубликовал сотрудник. Канал: переключатель сотрудника. Сотрудник. Верификация не включена.",
  );
  assert.equal(
    publishMessage("cabinet", true, true),
    "Опубликовал тренер. Канал: кабинет тренера. Не сотрудник. Верификация включена.",
  );
  assert.match(publishMessage("staff-card", false, true), /^Публикацию снял сотрудник/);
});
