import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { closeDb, getDb } from "../src/db/index";
import { appLogs } from "../src/db/schema";
import { fileHasLoggingGap, isLoggingGapPath } from "../src/lib/log/gaps";
import { LOG_DOMAINS } from "../src/lib/log/policy";
import { installAppLogs } from "../src/lib/log/purge";
import { writeLog } from "../src/lib/log/logger";

const root = path.resolve(import.meta.dirname, "..");

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
      files.push(...(await walk(full)));
      continue;
    }
    if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) files.push(full);
  }
  return files;
}

async function gaps(): Promise<string[]> {
  const found: string[] = [];
  for (const file of await walk(path.join(root, "src"))) {
    const relative = path.relative(root, file);
    if (!isLoggingGapPath(relative)) continue;
    const source = await readFile(file, "utf8");
    if (fileHasLoggingGap(source)) found.push(relative);
  }
  return found.sort();
}

async function probe(): Promise<void> {
  await installAppLogs();
  const marker = `probe-${crypto.randomUUID()}`;
  await writeLog({
    level: "info",
    domain: "system",
    action: "system.probe",
    outcome: "success",
    message: "Проверка журнала.",
    target: marker,
    context: { password: "secret", email: "probe@example.com", slug: "probe" },
  });
  const [row] = await getDb().select().from(appLogs).where(eq(appLogs.target, marker)).limit(1);
  if (!row) throw new Error("probe row was not stored");
  const context = row.context as { password?: string; email?: string } | null;
  if (context?.password !== "[redacted]") throw new Error("password was stored in context");
  if (context?.email !== "probe@example.com") throw new Error("email was dropped from context");
  if (row.expiresAt.getTime() - row.createdAt.getTime() < 29 * 24 * 60 * 60 * 1000) {
    throw new Error("expiry is shorter than 30 days");
  }
  await getDb().delete(appLogs).where(eq(appLogs.id, row.id));
  console.info(`probe ok (domains: ${LOG_DOMAINS.join(", ")})`);
}

async function main() {
  const missing = await gaps();
  if (missing.length === 0) console.info("gap scan: no console.error/warn outside the logger");
  else {
    console.info(`gap scan: ${missing.length} file(s)`);
    for (const file of missing) console.info(`  ${file}`);
  }

  if (!process.env.DATABASE_URL) {
    console.info("probe skipped: DATABASE_URL is not set");
    process.exit(missing.length === 0 ? 0 : 1);
  }

  try {
    await probe();
  } finally {
    await closeDb();
  }
  process.exit(missing.length === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
