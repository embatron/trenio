import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/** Database of the process already listening on 8081. Falls back to `.env` when none is found. */
export function scriptEnv(): NodeJS.ProcessEnv {
  const url = serverDatabaseUrl() ?? process.env.DATABASE_URL ?? fileDatabaseUrl();
  return url ? { ...process.env, DATABASE_URL: url } : process.env;
}

function fileDatabaseUrl(): string | undefined {
  try {
    const line = readFileSync(".env", "utf8")
      .split("\n")
      .find((item) => item.startsWith("DATABASE_URL="));
    if (!line) return undefined;
    let value = line.slice("DATABASE_URL=".length).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    return value || undefined;
  } catch {
    return undefined;
  }
}

function serverDatabaseUrl(): string | undefined {
  try {
    const listing = execFileSync("lsof", ["-nP", "-iTCP:8081", "-sTCP:LISTEN"], { encoding: "utf8" });
    const line = listing.split("\n").find((item) => item.includes(":8081") && item.includes("LISTEN"));
    const pid = line?.trim().split(/\s+/)[1];
    if (!pid) return undefined;
    const env = execFileSync("ps", ["eww", "-p", pid], { encoding: "utf8" });
    const match = env.match(/DATABASE_URL=(\S+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}
