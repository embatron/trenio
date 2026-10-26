import assert from "node:assert/strict";
import test from "node:test";
import { categoryAbout } from "./category-copy";
import { listPublishedSportCategories } from "./sport-taxonomy";

test("every published category has one or two about paragraphs", () => {
  const keys: Array<{ parent: string; child?: string }> = [];
  for (const category of listPublishedSportCategories()) {
    keys.push({ parent: category.slug });
    for (const child of category.children) keys.push({ parent: category.slug, child: child.slug });
  }

  assert.ok(keys.length > 50);
  for (const key of keys) {
    const label = key.child ? `${key.parent}/${key.child}` : key.parent;
    const paragraphs = categoryAbout(key.parent, key.child);
    assert.ok(paragraphs.length >= 1 && paragraphs.length <= 2, `${label}: ${paragraphs.length} paragraphs`);
    for (const paragraph of paragraphs) {
      assert.ok(paragraph.trim().length >= 80, `${label}: short paragraph`);
      assert.equal(paragraph.includes("О направлении"), false, label);
    }
  }
});
