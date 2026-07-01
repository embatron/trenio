#!/usr/bin/env node
/**
 * sessionStart — inject Trenio.by project constraints at session start.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "docs/TECH_SPEC.md",
  "docs/PRODUCT.md",
  "AGENTS.md",
  ".cursor/rules/pwa-requirements.mdc",
  ".cursor/rules/mobile-first.mdc",
];

const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));

const context = [
  "## Trenio.by session constraints (auto-injected)",
  "",
  "- **PWA 100%**: every change must stay installable-app compatible (see docs/TECH_SPEC.md §6).",
  "- **Mobile-first**: design for <768px first; touch targets ≥44px (see §7).",
  "- **Docs sync**: after structural changes update docs/ per TECH_SPEC §12.",
  "- **Stack**: TanStack Start, routes in src/routes/, auth via createServerFn.",
  "",
  missing.length
    ? `Warning: missing project files: ${missing.join(", ")}`
    : "Project docs and rules present.",
].join("\n");

// sessionStart may accept additional_context in some Cursor versions
console.log(JSON.stringify({ additional_context: context }));
process.exit(0);
