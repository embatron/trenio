import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import test from "node:test";

import { readTelegramContact } from "@/auth/telegram-contact";
import { parseTelegramWidgetUser, verifyTelegramWidgetUser } from "@/auth/telegram";
import {
  cabinetInstagram,
  decideTelegramCard,
  decideTelegramPhone,
  planSmsPhone,
  planTrainerPhoneOnly,
  planTrainerTelegramConfirm,
} from "@/lib/catalog/trainer-contact-cross";

const TOKEN = "test-bot-token";
const NOW = 1_700_000_000;

function signWebApp(fields: Record<string, string>, token = TOKEN): string {
  const pairs = Object.entries(fields)
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(pairs.join("\n")).digest("hex");
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

function signWidget(fields: Record<string, string | number>, token = TOKEN): string {
  const pairs = Object.entries(fields)
    .filter(([key]) => key !== "hash")
    .map(([key, value]) => `${key}=${value}`)
    .sort();
  const key = createHash("sha256").update(token).digest();
  return createHmac("sha256", key).update(pairs.join("\n")).digest("hex");
}

test("imported Instagram nick is shown when the URL field is empty", () => {
  assert.equal(
    cabinetInstagram({ instagramUrl: "", instagramHandle: "shum_ann", createdSource: "import" }),
    "https://instagram.com/shum_ann",
  );
  assert.equal(
    cabinetInstagram({ instagramUrl: "  ", instagramHandle: "@coach.name", createdSource: "import" }),
    "https://instagram.com/coach.name",
  );
});

test("a real Instagram URL wins over the imported nick", () => {
  assert.equal(
    cabinetInstagram({
      instagramUrl: "https://instagram.com/other.coach",
      instagramHandle: "shum_ann",
      createdSource: "import",
    }),
    "https://instagram.com/other.coach",
  );
});

test("a broken URL falls back to the imported nick, and a synthetic nick stays hidden", () => {
  assert.equal(
    cabinetInstagram({
      instagramUrl: "https://instagram.com/",
      instagramHandle: "shum_ann",
      createdSource: "import",
    }),
    "https://instagram.com/shum_ann",
  );
  for (const createdSource of ["self", "admin_created", "branch_created", ""]) {
    assert.equal(
      cabinetInstagram({ instagramUrl: "", instagramHandle: "shum_ann", createdSource }),
      "",
    );
  }
  assert.equal(
    cabinetInstagram({ instagramUrl: "@real.coach", instagramHandle: "selfabc", createdSource: "self" }),
    "@real.coach",
  );
  assert.equal(
    cabinetInstagram({ instagramUrl: "", instagramHandle: ".", createdSource: "import" }),
    "",
  );
  assert.equal(
    cabinetInstagram({ instagramUrl: "javascript:alert(1)", instagramHandle: "shum_ann", createdSource: "import" }),
    "https://instagram.com/shum_ann",
  );
});

test("Telegram phone matrix", () => {
  const cases: Array<[string, boolean, string | null, string]> = [
    ["", false, null, "ignore"],
    ["", false, "   ", "ignore"],
    ["", false, "+375", "ignore"],
    ["", false, "+375 17 123-45-67", "ignore"],
    ["", false, "+1 202 555 0100", "ignore"],
    ["", false, "37529123", "ignore"],
    ["", false, "3752912345678", "ignore"],
    ["", false, "+375 29 123-45-67", "store"],
    ["", false, "80291234567", "store"],
    ["+375 29 123-45-67", false, "375291234567", "store"],
    ["+375 29 123-45-67", true, "+375291234567", "keep"],
    ["+375 29 123-45-67", true, "+375 33 123-45-67", "keep-other"],
    ["+375 29 123-45-67", false, "+375 33 123-45-67", "store"],
    ["not a phone", false, "+375 44 123-45-67", "store"],
    ["+375 29 123-45-67", true, null, "ignore"],
  ];
  for (const [current, verified, incoming, kind] of cases) {
    assert.equal(decideTelegramPhone(current, verified, incoming).kind, kind, `${current}|${incoming}`);
  }
  const stored = decideTelegramPhone("", false, "80291234567");
  assert.equal(stored.kind, "store");
  if (stored.kind === "store") {
    assert.equal(stored.phone, "+375 29 123-45-67");
    assert.equal(stored.replacedUnverified, false);
  }
  const replaced = decideTelegramPhone("+375 29 123-45-67", false, "+375 33 765-43-21");
  if (replaced.kind === "store") assert.equal(replaced.replacedUnverified, true);
});

test("Telegram handle is written only into an empty card field", () => {
  assert.deepEqual(decideTelegramCard("", "coach_name"), { kind: "write", handle: "coach_name" });
  assert.deepEqual(decideTelegramCard("not a name", "@coach_name"), { kind: "write", handle: "coach_name" });
  assert.deepEqual(decideTelegramCard("@Coach_Name", "coach_name"), { kind: "verify", handle: "Coach_Name" });
  assert.equal(decideTelegramCard("@other_name", "https://t.me/coach_name").kind, "mismatch");
  assert.equal(decideTelegramCard("", null).kind, "missing");
  assert.equal(decideTelegramCard("", "ab").kind, "missing");
  assert.equal(decideTelegramCard("", "12345").kind, "missing");
});

test("a refused Telegram name does not adopt the phone that came with it", () => {
  const mismatch = planTrainerTelegramConfirm({
    savedTelegram: "@other_name",
    incomingUsername: "coach_name",
    currentPhone: "",
    phoneVerified: false,
    incomingPhone: "+375 29 123-45-67",
    acceptPhone: true,
  });
  assert.equal(mismatch.error, "mismatch");
  assert.equal(mismatch.phone.kind, "ignore");

  const missing = planTrainerTelegramConfirm({
    savedTelegram: "",
    incomingUsername: "",
    currentPhone: "",
    phoneVerified: false,
    incomingPhone: "+375 29 123-45-67",
    acceptPhone: true,
  });
  assert.equal(missing.error, "missing");
  assert.equal(missing.phone.kind, "ignore");
});

test("Telegram without a phone leaves the phone decision empty", () => {
  const plan = planTrainerTelegramConfirm({
    savedTelegram: "",
    incomingUsername: "@coach_name",
    currentPhone: "+375 29 123-45-67",
    phoneVerified: false,
    incomingPhone: null,
    acceptPhone: true,
  });
  assert.equal(plan.error, null);
  assert.equal(plan.decision.kind, "write");
  assert.equal(plan.phone.kind, "ignore");
});

test("an unsigned or mismatched contact does not change the phone", () => {
  const plan = planTrainerTelegramConfirm({
    savedTelegram: "",
    incomingUsername: "coach_name",
    currentPhone: "",
    phoneVerified: false,
    incomingPhone: "+375 29 123-45-67",
    acceptPhone: false,
  });
  assert.equal(plan.phone.kind, "ignore");
});

test("SMS phone never touches Telegram", () => {
  const ok = planSmsPhone("+375 29 123-45-67");
  assert.equal(ok.phone, "+375 29 123-45-67");
  assert.equal(ok.error, null);
  assert.equal(ok.touchesTelegram, false);
  const bad = planSmsPhone("+375 17 000-00-00");
  assert.equal(bad.phone, null);
  assert.equal(bad.touchesTelegram, false);
  const empty = planSmsPhone("   ");
  assert.equal(empty.touchesTelegram, false);
});

test("phone from Telegram does not plan a Telegram write", () => {
  const adopted = planTrainerPhoneOnly({
    currentPhone: "",
    phoneVerified: false,
    incomingPhone: "+375 29 123-45-67",
    proofMatchesContact: true,
  });
  assert.equal(adopted.phone.kind, "store");
  assert.equal(adopted.touchesTelegram, false);

  const foreignProof = planTrainerPhoneOnly({
    currentPhone: "",
    phoneVerified: false,
    incomingPhone: "+375 29 123-45-67",
    proofMatchesContact: false,
  });
  assert.equal(foreignProof.phone.kind, "ignore");
  assert.equal(foreignProof.touchesTelegram, false);

  const kept = planTrainerPhoneOnly({
    currentPhone: "+375 33 123-45-67",
    phoneVerified: true,
    incomingPhone: "+375 29 123-45-67",
    proofMatchesContact: true,
  });
  assert.equal(kept.phone.kind, "keep-other");
  assert.equal(kept.touchesTelegram, false);
});

test("signed Telegram contact yields the phone, and a tampered one does not", () => {
  const previous = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
  const previousName = process.env.TELEGRAM_LOGIN_BOT_USERNAME;
  process.env.TELEGRAM_LOGIN_BOT_TOKEN = TOKEN;
  process.env.TELEGRAM_LOGIN_BOT_USERNAME = "TrenioByBot";
  try {
    const contact = JSON.stringify({
      phone_number: "+375 29 123-45-67",
      first_name: "Ann",
      user_id: 42,
    });
    const query = signWebApp({ auth_date: String(NOW), contact });
    assert.deepEqual(readTelegramContact(query, NOW), { userId: 42, phone: "+375 29 123-45-67" });

    const stringId = signWebApp({
      auth_date: String(NOW),
      contact: JSON.stringify({ phone_number: "80291234567", user_id: "42" }),
    });
    assert.equal(readTelegramContact(stringId, NOW)?.userId, 42);

    const tampered = query.replace("123-45-67", "000-00-00");
    assert.equal(readTelegramContact(tampered, NOW), null);
    assert.equal(readTelegramContact(signWebApp({ auth_date: String(NOW), contact }, "other-token"), NOW), null);
    assert.equal(readTelegramContact(signWebApp({ auth_date: String(NOW - 11 * 60), contact }), NOW), null);
    assert.equal(readTelegramContact(signWebApp({ auth_date: String(NOW), contact: "{" }), NOW), null);
    assert.equal(readTelegramContact(signWebApp({ auth_date: String(NOW), contact: "[]" }), NOW), null);
    assert.equal(
      readTelegramContact(signWebApp({ auth_date: String(NOW), contact: JSON.stringify({ phone_number: "+375291234567" }) }), NOW),
      null,
    );
    assert.equal(
      readTelegramContact(signWebApp({
        auth_date: String(NOW),
        contact: JSON.stringify({ phone_number: "", user_id: 42 }),
      }), NOW),
      null,
    );
    assert.equal(
      readTelegramContact(signWebApp({
        auth_date: String(NOW),
        contact: JSON.stringify({ phone_number: "+375291234567", user_id: 0 }),
      }), NOW),
      null,
    );
    assert.equal(
      readTelegramContact(signWebApp({
        auth_date: String(NOW),
        contact: JSON.stringify({ phone_number: "+375291234567", user_id: 1.5 }),
      }), NOW),
      null,
    );
    assert.equal(readTelegramContact("", NOW), null);
    assert.equal(readTelegramContact("auth_date=1&contact={}", NOW), null);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_LOGIN_BOT_TOKEN;
    else process.env.TELEGRAM_LOGIN_BOT_TOKEN = previous;
    if (previousName === undefined) delete process.env.TELEGRAM_LOGIN_BOT_USERNAME;
    else process.env.TELEGRAM_LOGIN_BOT_USERNAME = previousName;
  }
});

test("a phone glued onto a widget after the signature is rejected", () => {
  const previous = process.env.TELEGRAM_LOGIN_BOT_TOKEN;
  const previousName = process.env.TELEGRAM_LOGIN_BOT_USERNAME;
  process.env.TELEGRAM_LOGIN_BOT_TOKEN = TOKEN;
  process.env.TELEGRAM_LOGIN_BOT_USERNAME = "TrenioByBot";
  try {
    const fields = { id: 7, auth_date: NOW, first_name: "Ann", username: "coach_name" };
    const hash = signWidget(fields);
    const signed = parseTelegramWidgetUser({ ...fields, hash });
    assert.equal(verifyTelegramWidgetUser(signed!, NOW), true);
    const extra = parseTelegramWidgetUser({ ...fields, hash, phone_number: "+375291234567" });
    assert.equal(verifyTelegramWidgetUser(extra!, NOW), false);
    const withPhone = { ...fields, phone_number: "+375291234567" };
    const phoneHash = signWidget(withPhone);
    const parsed = parseTelegramWidgetUser({ ...withPhone, hash: phoneHash });
    assert.equal(parsed?.phone_number, "+375291234567");
    assert.equal(verifyTelegramWidgetUser(parsed!, NOW), true);
  } finally {
    if (previous === undefined) delete process.env.TELEGRAM_LOGIN_BOT_TOKEN;
    else process.env.TELEGRAM_LOGIN_BOT_TOKEN = previous;
    if (previousName === undefined) delete process.env.TELEGRAM_LOGIN_BOT_USERNAME;
    else process.env.TELEGRAM_LOGIN_BOT_USERNAME = previousName;
  }
});
