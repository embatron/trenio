import assert from "node:assert/strict";
import test from "node:test";

import { publishedAuthorSlug, type AuthorProfileLink } from "./trainer-reviews";

const older = new Date("2026-01-01T00:00:00Z");
const newer = new Date("2026-06-01T00:00:00Z");

function profile(
  patch: Partial<AuthorProfileLink> & Pick<AuthorProfileLink, "slug">,
): AuthorProfileLink {
  return {
    ownerUserId: "author",
    status: "published",
    updatedAt: older,
    ...patch,
  };
}

test("a review by another published trainer links to that trainer", () => {
  const slug = publishedAuthorSlug(
    [profile({ slug: "leon1d_coach" }), profile({ slug: "kreins.power", updatedAt: newer })],
    "author",
    "leon1d_coach",
  );
  assert.equal(slug, "kreins.power");
});

test("a plain visitor and an unpublished trainer stay plain text", () => {
  assert.equal(
    publishedAuthorSlug(
      [
        profile({ slug: "draft-coach", status: "draft" }),
        profile({ slug: "hidden-coach", status: "hidden" }),
        profile({ ownerUserId: "someone-else", slug: "other" }),
      ],
      "author",
      "leon1d_coach",
    ),
    null,
  );
});

test("the profile under review is not a link to itself", () => {
  assert.equal(
    publishedAuthorSlug([profile({ slug: "leon1d_coach" })], "author", "leon1d_coach"),
    null,
  );
});
