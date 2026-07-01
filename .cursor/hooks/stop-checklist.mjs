#!/usr/bin/env node
/**
 * stop — prompt agent to verify PWA/mobile compliance and sync docs before finishing.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const docsToMention = [
  "docs/README.md",
  "docs/TECH_SPEC.md",
  "docs/PRODUCT.md",
  "docs/ACCOUNT_MODEL.md",
].filter((f) => fs.existsSync(path.join(root, f)));

const followup = [
  "Before finishing this Trenio.by task, complete the closing checklist:",
  "",
  "1. **PWA (100% compatible project)** — Run trenio-pwa-audit skill: manifest/SW/offline impact, standalone mode, no SW-breaking changes.",
  "2. **Mobile-first** — Run trenio-mobile-audit skill: 320px layout, touch targets, responsive nav/forms.",
  "3. **Docs sync** — Run trenio-docs-sync skill. Update if you changed routes, auth, DB schema, env, or architecture.",
  "",
  `Docs to review: ${docsToMention.join(", ")}`,
  "",
  "If everything is already compliant and docs are current, reply briefly that the checklist passed.",
  "If not — apply fixes and doc updates now, do not defer.",
].join("\n");

console.log(JSON.stringify({ followup_message: followup }));
process.exit(0);
