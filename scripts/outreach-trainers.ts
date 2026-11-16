import "dotenv/config";

import { closeDb } from "../src/db";
import { claimOutreachText, listUnsentOutreach, markOutreachSent, readyOutreachText, resolveOutreachScope } from "../src/lib/catalog/trainer-outreach";

const command = process.argv[2] || "list";
const handle = process.argv[3] || "";

function accountReady() {
  if (process.env.IG_ACCOUNT === "trenioby") return true;
  console.log(JSON.stringify({ ok: false, reason: "account" }));
  process.exitCode = 2;
  return false;
}

async function main() {
  if (!accountReady()) return;
  if (command === "list") {
    const requested = process.argv.slice(3);
    const rows = requested.length ? await resolveOutreachScope(requested) : await listUnsentOutreach();
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (command === "text") {
    if (!handle) throw new Error("Pass the Instagram handle.");
    const kind = process.argv[4] || "claim";
    if (kind !== "claim" && kind !== "ready") throw new Error("Use text <handle> or text <handle> ready.");
    const result = kind === "ready" ? await readyOutreachText(handle) : await claimOutreachText(handle);
    console.log(result.ok ? result.text : JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  if (command === "mark") {
    if (!handle) throw new Error("Pass the Instagram handle.");
    const flag = process.argv[4];
    if (flag && flag !== "claim" && flag !== "ready") {
      throw new Error("Use mark <handle>, mark <handle> claim, or mark <handle> ready.");
    }
    const result = await markOutreachSent(handle, { link: flag === "claim" || flag === "ready" });
    console.log(JSON.stringify(result));
    return;
  }
  throw new Error("Use list, text <handle>, or mark <handle>.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
