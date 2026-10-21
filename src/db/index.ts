import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function getDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

type PgClient = ReturnType<typeof postgres>;
type AppDb = ReturnType<typeof drizzle<typeof schema>>;

// Vite re-evaluates this module on reload. A module-level pool would leak
// connections until Postgres refuses new clients.
const globalForDb = globalThis as typeof globalThis & {
  __trenioPg?: PgClient;
  __trenioDb?: AppDb;
};

export function getDb() {
  if (!globalForDb.__trenioDb) {
    const client = postgres(getDatabaseUrl(), {
      max: 10,
      idle_timeout: 20,
    });
    globalForDb.__trenioPg = client;
    globalForDb.__trenioDb = drizzle(client, { schema });
  }
  return globalForDb.__trenioDb;
}

export async function closeDb() {
  if (globalForDb.__trenioPg) {
    await globalForDb.__trenioPg.end({ timeout: 5 });
    globalForDb.__trenioPg = undefined;
    globalForDb.__trenioDb = undefined;
  }
}

export { schema };
