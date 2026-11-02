import assert from "node:assert/strict";
import test from "node:test";

import { AuthError, authErrorMessage, isAuthorizationRequired } from "@/lib/auth/errors";
import { loginHref } from "@/lib/auth/return-path";

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

test("a missing session is recognized and stays written when there is no browser", () => {
  const error = new Error("Требуется авторизация.");
  assert.equal(isAuthorizationRequired(error), true);
  assert.equal(isAuthorizationRequired({ message: "Требуется авторизация." }), true);
  assert.equal(authErrorMessage(error), "Требуется авторизация.");
});

test("a closed account is not treated as a missing session", () => {
  const error = new AuthError("Аккаунт недоступен.", "UNAUTHORIZED");
  assert.equal(isAuthorizationRequired(error), false);
  assert.equal(authErrorMessage(error), "Аккаунт недоступен.");
});

test("login keeps a same-site return path", () => {
  assert.equal(loginHref("/account/settings"), "/auth/login?redirect=%2Faccount%2Fsettings");
  assert.equal(loginHref("/auth/signup"), "/auth/login");
  assert.equal(loginHref("https://evil.example"), "/auth/login");
});
