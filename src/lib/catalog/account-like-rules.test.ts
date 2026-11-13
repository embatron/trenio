import assert from "node:assert/strict";
import test from "node:test";

import { accountLikeLabel, accountLikePersonName, canPlaceAccountLike } from "@/lib/catalog/account-like-rules";

test("only a user or a trainer can like an account", () => {
  assert.equal(canPlaceAccountLike(["user"]), true);
  assert.equal(canPlaceAccountLike(["trainer"]), true);
  assert.equal(canPlaceAccountLike(["user", "admin"]), true);
  assert.equal(canPlaceAccountLike(["trainer", "club"]), true);
  assert.equal(canPlaceAccountLike(["club"]), false);
  assert.equal(canPlaceAccountLike(["admin"]), false);
  assert.equal(canPlaceAccountLike(["superadmin"]), false);
  assert.equal(canPlaceAccountLike([]), false);
});

test("a like total follows every Russian plural", () => {
  const cases: Array<[number, string]> = [
    [0, "0 лайкосов"],
    [1, "1 лайкос"],
    [2, "2 лайкоса"],
    [3, "3 лайкоса"],
    [4, "4 лайкоса"],
    [5, "5 лайкосов"],
    [11, "11 лайкосов"],
    [12, "12 лайкосов"],
    [13, "13 лайкосов"],
    [14, "14 лайкосов"],
    [15, "15 лайкосов"],
    [21, "21 лайкос"],
    [22, "22 лайкоса"],
    [24, "24 лайкоса"],
    [25, "25 лайкосов"],
    [101, "101 лайкос"],
    [111, "111 лайкосов"],
    [112, "112 лайкосов"],
    [114, "114 лайкосов"],
    [121, "121 лайкос"],
    [122, "122 лайкоса"],
    [1001, "1001 лайкос"],
    [1002, "1002 лайкоса"],
    [1005, "1005 лайкосов"],
  ];
  for (const [count, label] of cases) assert.equal(accountLikeLabel(count), label);
});

test("a liker is named without the mailbox", () => {
  assert.equal(accountLikePersonName("Анна", "Ковалёва", "anna@example.com"), "Анна Ковалёва");
  assert.equal(accountLikePersonName("Пользователь", "", "dasafilon@mail.ru"), "dasafilon");
  assert.equal(
    accountLikePersonName("+37529.....51", "", "pending.11111111-1111-4111-8111-111111111111@users.trenio.invalid"),
    "+37529.....51",
  );
  assert.equal(accountLikePersonName("Анна", "Ковалёва", "anna@example.com", "deleted"), "Удалённый");
});
