import assert from "node:assert/strict";
import test from "node:test";

import { draftFileToImported, type DraftFile } from "@/db/import-draft-map";

function draft(extra: Partial<DraftFile> = {}): DraftFile {
  return {
    handle: "coach.name",
    slug: "coach.name",
    sourceUrl: "https://www.instagram.com/coach.name/",
    firstName: "Анна",
    lastName: "Антипенко",
    fullName: "Анна Антипенко",
    headline: "",
    bio: "",
    city: "Минск",
    ...extra,
  };
}

test("an attached Threads profile becomes the card contact", () => {
  const imported = draftFileToImported(draft({
    threadsUrl: "https://www.threads.net/@coach.name/",
  }));
  assert.equal(imported.threads, "https://www.threads.com/@coach.name");
});

test("a Threads link in the Instagram contacts is stored when no profile was attached", () => {
  const imported = draftFileToImported(draft({
    contacts: { threads: "https://www.threads.com/@coach.name" },
  }));
  assert.equal(imported.threads, "https://www.threads.com/@coach.name");
});

test("a Threads post and a missing link do not invent a contact", () => {
  assert.equal(draftFileToImported(draft()).threads, "");
  assert.equal(draftFileToImported(draft({
    threadsUrl: "https://www.threads.net/@coach.name/post/abc",
  })).threads, "");
});
