import { ensureAuthSchema } from "../src/auth/auth-schema";
import { closeDb } from "../src/db/index";
import { claimConfirmedMailbox } from "../src/lib/catalog/cabinet-bind";
import { issueCabinetEntry } from "../src/lib/catalog/cabinet-entry-work";

function pairs(argv: string[]): Array<{ slug: string; email: string }> {
  if (argv.length === 0 || argv.length % 2 !== 0) {
    throw new Error("Usage: cabinet-link.ts <slug> <email> [<slug> <email> ...]");
  }
  const rows: Array<{ slug: string; email: string }> = [];
  for (let index = 0; index < argv.length; index += 2) {
    rows.push({ slug: argv[index], email: argv[index + 1] });
  }
  return rows;
}

async function main() {
  const rows = pairs(process.argv.slice(2));
  await ensureAuthSchema();
  const issued = [];
  for (const row of rows) {
    const claimed = await claimConfirmedMailbox(row.slug, row.email);
    const entry = await issueCabinetEntry(claimed);
    issued.push({
      slug: claimed.slug,
      name: claimed.name,
      email: claimed.email,
      status: claimed.status,
      needsPassword: claimed.needsPassword,
      created: claimed.created,
      attached: claimed.attached,
      expires: entry.expiresAt.toISOString(),
      url: entry.url,
    });
  }
  console.info(JSON.stringify(issued, null, 2));
  await closeDb();
}

main().catch(async (error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
