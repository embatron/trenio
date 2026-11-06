import "dotenv/config";

import { closeDb } from "../src/db";
import { listUnsentOutreach, markOutreachSent } from "../src/lib/catalog/trainer-outreach";

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
    const rows = await listUnsentOutreach();
    console.log(JSON.stringify(rows, null, 2));
    return;
  }
  if (command === "mark") {
    if (!handle) throw new Error("Pass the Instagram handle.");
    const result = await markOutreachSent(handle);
    console.log(JSON.stringify(result));
    return;
  }
  throw new Error("Use list or mark <handle>.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDb();
  });
