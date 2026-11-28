import assert from "node:assert/strict";
import test from "node:test";

import { omitHiddenContacts } from "@/lib/catalog/trainer-contacts";

const contacts = {
  phone: "+375 29 111-22-33",
  instagram: "https://instagram.com/coach",
  telegram: "@coach",
  threads: "https://www.threads.com/@coach",
  email: "coach@example.com",
};

test("a hidden contact leaves the public page and the others stay", () => {
  const next = omitHiddenContacts(contacts, {
    phone: true,
    instagram: false,
    telegram: true,
    threads: true,
    email: false,
  });
  assert.equal(next.phone, "");
  assert.equal(next.telegram, "");
  assert.equal(next.threads, "");
  assert.equal(next.instagram, contacts.instagram);
  assert.equal(next.email, contacts.email);
});

test("every contact stays when the switches are off", () => {
  const next = omitHiddenContacts(contacts, {
    phone: false,
    instagram: false,
    telegram: false,
    threads: false,
    email: false,
  });
  assert.deepEqual(next, contacts);
});
