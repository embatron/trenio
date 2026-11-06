import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";

export type DoorMirror = {
  handle: string;
  token: string;
  outreachAt?: string;
  linkAt?: string;
};

export type DoorMirrorResult = { token: string; mirrored: boolean; reason: "local" | "ok" | "failed" };

function productionHost() {
  try {
    const text = readFileSync(".cursor/skills/trenio-vps/SKILL.md", "utf8");
    return text.match(/ssh[^\n]*\broot@(\d+\.\d+\.\d+\.\d+)/)?.[1] ?? "";
  } catch {
    return "";
  }
}

function quote(value: string) {
  if (!/^[\w.@:-]*$/.test(value)) throw new Error("outreach mirror value");
  return `'${value}'`;
}

function run(command: string, args: string[]): Promise<{ code: number; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout }));
  });
}

/**
 * Keep the live short code. This process is the laptop, so the same code is
 * written to production. An existing live code is kept and returned.
 * On the production host the database is already the live one.
 */
export async function mirrorDoorToProduction(input: DoorMirror): Promise<DoorMirrorResult> {
  if (process.env.NODE_ENV === "production") return { token: input.token, mirrored: false, reason: "local" };
  const host = productionHost();
  if (!host) return { token: input.token, mirrored: false, reason: "local" };
  const target = `root@${host}`;
  const copied = await run("scp", [
    "-o", "BatchMode=yes",
    "-o", "ConnectTimeout=15",
    "scripts/outreach-apply.mjs",
    `${target}:/var/www/html/trenio/scripts/outreach-apply.mjs`,
  ]);
  if (copied.code !== 0) return { token: input.token, mirrored: false, reason: "failed" };
  const remote = [
    "cd /var/www/html/trenio &&",
    `OUTREACH_HANDLE=${quote(input.handle)}`,
    `OUTREACH_TOKEN=${quote(input.token)}`,
    `OUTREACH_AT=${quote(input.outreachAt ?? "")}`,
    `LINK_AT=${quote(input.linkAt ?? "")}`,
    "node --env-file=.env scripts/outreach-apply.mjs",
  ].join(" ");
  const result = await run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", target, remote]);
  if (result.code !== 0) return { token: input.token, mirrored: false, reason: "failed" };
  const line = result.stdout.trim().split("\n").find((item) => item.startsWith("{"));
  if (!line) return { token: input.token, mirrored: false, reason: "failed" };
  const parsed = JSON.parse(line) as { ok?: boolean; token?: string };
  return { token: parsed.token || input.token, mirrored: Boolean(parsed.ok), reason: parsed.ok ? "ok" : "failed" };
}
