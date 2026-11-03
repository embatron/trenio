import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { scriptEnv } from "./app-db";
import { expect, test, type Page } from "./fixtures";

const execFileAsync = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

type DoorSeed = { code: string; token: string; email: string };
type DoorStatus = { exists: boolean; needsPassword: boolean; used: boolean };

async function doorCall<T>(args: string[]): Promise<T> {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["--env-file=.env", "node_modules/tsx/dist/cli.mjs", "scripts/door-case.ts", ...args],
    { cwd: root, timeout: 20_000, env: scriptEnv() },
  );
  const json = stdout.slice(stdout.indexOf("{"));
  return JSON.parse(json) as T;
}

async function pageErrors(page: Page): Promise<string[]> {
  return (page as { __pageErrors?: string[] }).__pageErrors ?? [];
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  (page as { __pageErrors?: string[] }).__pageErrors = errors;
});

test("a trainer door link stays unused until the button is pressed", async ({ page }) => {
  test.setTimeout(45_000);
  const seeded = await doorCall<DoorSeed>(["seed"]);
  const url = `/hi/${seeded.code}?mail=${encodeURIComponent(seeded.token)}`;

  try {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Открыть кабинет" })).toBeVisible();
    await page.goto(url);
    const button = page.getByRole("button", { name: "Открыть кабинет" });
    await button.waitFor();
    await page.waitForFunction(() => {
      const control = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Открыть кабинет"));
      return !!control && Object.keys(control).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
    });
    const before = await doorCall<DoorStatus>(["status", seeded.email]);
    expect(before).toEqual({ exists: false, needsPassword: false, used: false });
    expect((await page.context().cookies()).some((cookie) => cookie.name === "trenio_session")).toBe(false);

    await button.click();
    await page.waitForURL(/\/auth\/password|\/me/);
    expect((await page.context().cookies()).some((cookie) => cookie.name === "trenio_session")).toBe(true);
    const after = await doorCall<DoorStatus>(["status", seeded.email]);
    expect(after.exists).toBe(true);
    expect(after.needsPassword).toBe(true);
    expect(after.used).toBe(true);

    await page.goto(url);
    await expect(page.getByRole("heading", { name: "Ссылка уже не действует" })).toBeVisible();
    expect(await pageErrors(page)).toEqual([]);
  } finally {
    await doorCall(["cleanup", seeded.email, seeded.code]);
  }
});
