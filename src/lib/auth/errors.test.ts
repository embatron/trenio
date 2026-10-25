import assert from "node:assert/strict";
import test from "node:test";

import { authErrorMessage } from "@/lib/auth/errors";

test("a Zod payload becomes the first human message", () => {
  const error = new Error(
    JSON.stringify([
      { code: "too_small", message: "Введите почту или ник", path: ["email"] },
      { code: "too_small", message: "Введите пароль", path: ["password"] },
    ]),
  );
  assert.equal(authErrorMessage(error), "Введите почту или ник");
});

test("a normal auth sentence stays as written", () => {
  assert.equal(authErrorMessage(new Error("Неверный логин или пароль.")), "Неверный логин или пароль.");
});
