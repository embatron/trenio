import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  (page as { __pageErrors?: string[] }).__pageErrors = errors;
});

async function pageErrors(page: import("@playwright/test").Page): Promise<string[]> {
  return (page as { __pageErrors?: string[] }).__pageErrors ?? [];
}

async function noHorizontalScroll(page: import("@playwright/test").Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("home renders and does not scroll sideways", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
  await noHorizontalScroll(page);
  expect(await pageErrors(page)).toEqual([]);
});

test("categories index renders", async ({ page }) => {
  await page.goto("/categories");
  await expect(page.locator("body")).toBeVisible();
  await noHorizontalScroll(page);
});

test("unknown URL shows the 404 screen", async ({ page }) => {
  await page.goto("/no-such-page-trenio");
  await expect(page.getByText("Мяч ушёл за линию")).toBeVisible();
});

test("login does not echo the password and hides the honeypot", async ({ page }) => {
  await page.goto("/auth/login");
  const email = page.getByPlaceholder("you@example.com или nick");
  await email.waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="you@example.com или nick"]');
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  const menu = page.getByRole("dialog", { name: "Меню" });
  if (await menu.isVisible()) await page.keyboard.press("Escape");
  const form = page.locator("form.auth-form");
  await email.pressSequentially("nobody@example.com");
  await page.getByPlaceholder("Введите пароль").pressSequentially("Wrongpass1");
  await expect(email).toHaveValue("nobody@example.com");
  await form.getByRole("button", { name: "Войти" }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("Неверный логин или пароль.");
  await expect(alert).not.toContainText("Wrongpass1");
  await expect(alert).not.toContainText("too_small");
  const box = await page.locator("input[name=company_website]").boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(2);
  expect(await pageErrors(page)).toEqual([]);
});

test("map page renders without sideways scroll", async ({ page }) => {
  await page.goto("/map");
  await expect(page.locator("body")).toBeVisible();
  await noHorizontalScroll(page);
});
