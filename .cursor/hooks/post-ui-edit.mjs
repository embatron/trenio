#!/usr/bin/env node
/**
 * postToolUse — remind about PWA + mobile-first after UI file edits.
 */
import fs from "node:fs";

let input = "";
for await (const chunk of process.stdin) input += chunk;

let payload;
try {
  payload = JSON.parse(input || "{}");
} catch {
  process.exit(0);
}

const toolName = payload.tool_name ?? payload.toolName ?? "";
const toolInput = payload.tool_input ?? payload.toolInput ?? payload.arguments ?? {};

const filePath =
  toolInput.path ??
  toolInput.file_path ??
  toolInput.target_file ??
  toolInput.filePath ??
  "";

if (!filePath || !/\.(tsx|css)$/.test(filePath)) {
  process.exit(0);
}

const isUiPath =
  filePath.includes("src/routes/") ||
  filePath.includes("src/components/") ||
  filePath.endsWith("src/styles.css");

if (!isUiPath) {
  process.exit(0);
}

const context = [
  "## Post-edit reminder (Trenio.by)",
  "",
  `File touched: \`${filePath}\` via ${toolName}.`,
  "",
  "**PWA check:** Does this change remain compatible with installable PWA (offline fallback, no SW-breaking patterns, public/ assets)?",
  "**Mobile check:** Verify layout at 320px, touch targets ≥44px, no hover-only critical actions.",
  "",
  "Skills: trenio-pwa-audit, trenio-mobile-audit. Rules: pwa-requirements.mdc, mobile-first.mdc.",
].join("\n");

console.log(JSON.stringify({ additional_context: context }));
process.exit(0);
