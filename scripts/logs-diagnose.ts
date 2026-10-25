import { closeDb } from "../src/db/index";
import { installAppLogs } from "../src/lib/log/purge";
import { diagnoseLogs, type LogFilter } from "../src/lib/log/query";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function main() {
  await installAppLogs();
  const hours = Number(flag("--hours") ?? "24");
  const filter: LogFilter = {
    hours: Number.isFinite(hours) ? hours : 24,
    domain: flag("--domain"),
    level: flag("--level"),
    subject: flag("--email") ?? flag("--subject"),
    actorUserId: flag("--user"),
    action: flag("--action"),
    target: flag("--target"),
    requestId: flag("--request"),
    query: flag("--q"),
    limit: 40,
  };
  const report = await diagnoseLogs(filter);
  console.info(JSON.stringify({ filter, since: report.since, groups: report.groups, rows: report.rows }, null, 2));
  await closeDb();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
