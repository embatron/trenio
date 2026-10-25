import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

export type JournalReport = {
  rows: Array<{
    action: string;
    outcome: string | null;
    message: string | null;
    subject: string | null;
    target: string | null;
    route: string | null;
    context: Record<string, unknown> | null;
  }>;
};

export async function diagnose(args: string[]): Promise<JournalReport> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--env-file=.env", "node_modules/tsx/dist/cli.mjs", "scripts/logs-diagnose.ts", ...args],
    { cwd: root, timeout: 20_000 },
  );
  const json = stdout.slice(stdout.indexOf("{"));
  return JSON.parse(json) as JournalReport;
}

export async function readWelcomePhones(phone: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--env-file=.env", "node_modules/tsx/dist/cli.mjs", "scripts/read-welcome-phone.ts", phone],
    { cwd: root, timeout: 20_000 },
  );
  const json = stdout.slice(stdout.indexOf("{"));
  const parsed = JSON.parse(json) as { phones: Array<string | null> };
  return parsed.phones.filter((value): value is string => typeof value === "string");
}

export async function deleteWelcome(handle: string, field: "instagram" | "telegram" | "phone" = "instagram"): Promise<void> {
  const args = ["--env-file=.env", "node_modules/tsx/dist/cli.mjs", "scripts/delete-welcome-row.ts"];
  if (field === "telegram") args.push("--telegram");
  if (field === "phone") args.push("--phone");
  args.push(handle);
  await execFileAsync(process.execPath, args, { cwd: root, timeout: 20_000 });
}

export async function waitForJournal(args: string[], ready: (report: JournalReport) => boolean): Promise<JournalReport> {
  let last: JournalReport = { rows: [] };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    last = await diagnose(args);
    if (ready(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return last;
}
