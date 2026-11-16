import { expect, test } from "./fixtures";

test("offline page and store files answer, and the website hides Apple", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/offline.html");
  await expect(page.getByRole("heading", { name: "Нет сети" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  const links = await page.request.get("/.well-known/assetlinks.json");
  expect(links.headers()["content-type"]).toContain("application/json");
  const body = await links.json() as Array<{ target: { package_name: string } }>;
  expect(body[0].target.package_name).toBe("by.trenio.app");

  const association = await page.request.get("/.well-known/apple-app-site-association");
  expect(association.ok()).toBeTruthy();
  expect(association.headers()["content-type"]).toContain("application/json");

  await page.goto("/open?path=/auth/login");
  await expect(page).toHaveURL(/\/auth\/login/);
  await expect(page.getByRole("button", { name: "Войти с Apple" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Войти через Google" })).toBeVisible();

  const evil = await page.request.get("/open?path=https://evil.example", { maxRedirects: 0 });
  const location = evil.headers().location ?? "";
  expect(location.startsWith("http://evil") || location.startsWith("https://evil")).toBeFalsy();
});
