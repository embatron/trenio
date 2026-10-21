import { readFile } from "node:fs/promises";
import path from "node:path";

import { AuthError } from "@/lib/auth/errors";

let names: Set<string> | null = null;

async function settlements() {
  if (names) return names;
  const file = path.join(process.cwd(), "public/data/belarus-settlements.json");
  const payload = JSON.parse(await readFile(file, "utf8")) as { settlements?: string[] };
  names = new Set(payload.settlements ?? []);
  return names;
}

/** Empty is allowed. Any other value must be an official Belarus settlement name. */
export async function assertBelarusCity(city: string) {
  const trimmed = city.trim();
  if (!trimmed) return trimmed;
  const known = await settlements();
  if (!known.has(trimmed)) {
    throw new AuthError("Выберите город из списка населённых пунктов Беларуси.", "VALIDATION");
  }
  return trimmed;
}
