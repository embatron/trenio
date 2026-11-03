import { expect, test, type Page } from "./fixtures";

async function pageErrors(page: Page): Promise<string[]> {
  return (page as { __pageErrors?: string[] }).__pageErrors ?? [];
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  (page as { __pageErrors?: string[] }).__pageErrors = errors;
});

test("signup honeypot returns the same phrase and does not open a session", async ({ page }) => {
  await page.goto("/auth/signup");
  const email = page.getByPlaceholder("you@example.com");
  await email.waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="you@example.com"]');
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  const menu = page.getByRole("dialog", { name: "Меню" });
  if (await menu.isVisible()) await page.keyboard.press("Escape");

  await noHorizontalScroll(page);
  const password = page.getByPlaceholder("Минимум 8 символов");
  await expect(password).toHaveAttribute("type", "password");
  const box = await page.locator("input[name=company_website]").boundingBox();
  expect(box?.width ?? 0).toBeLessThanOrEqual(2);

  await email.pressSequentially("authcase-e2e@example.com");
  await password.pressSequentially("Wrongpass1");
  await page.locator("form.auth-form input[type=checkbox]").check();
  await page.locator("input[name=company_website]").evaluate((input) => {
    (input as HTMLInputElement).value = "bot-filled";
  });
  await page.locator("form.auth-form").getByRole("button", { name: "Зарегистрироваться" }).click();

  const note = page.locator(".auth-alert--note");
  await expect(note).toHaveText(
    "Если этот адрес можно использовать, мы отправили письмо со ссылкой. Откройте его и подтвердите почту.",
  );
  await expect(note).not.toContainText("Wrongpass1");
  await expect(page.getByRole("alert")).toHaveCount(0);
  const cookies = await page.context().cookies();
  expect(cookies.some((cookie) => cookie.name === "trenio_session")).toBe(false);
  expect(await pageErrors(page)).toEqual([]);
});

test("opening a confirm link does not log in, and a fake token stays logged out", async ({ page }) => {
  await page.goto("/auth/confirm-email");
  await expect(page.getByRole("heading", { name: "Ссылка недействительна" })).toBeVisible();
  await noHorizontalScroll(page);
  expect((await page.context().cookies()).some((cookie) => cookie.name === "trenio_session")).toBe(false);

  await page.goto("/auth/confirm-email?token=not-a-real-token");
  const confirm = page.getByRole("button", { name: "Подтвердить почту" });
  await confirm.waitFor();
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes("Подтвердить почту"));
    return !!button && Object.keys(button).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  await expect(page.getByRole("heading", { name: "Подтвердите почту" })).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.name === "trenio_session")).toBe(false);
  await confirm.click();
  await expect(page.getByRole("alert")).toBeVisible();
  expect((await page.context().cookies()).some((cookie) => cookie.name === "trenio_session")).toBe(false);
  expect(await pageErrors(page)).toEqual([]);
});

test("reset copy asks for a new login and auth screens do not scroll sideways", async ({ page }) => {
  await page.goto("/auth/reset-password?token=not-a-real-token");
  await expect(page.getByText("После сохранения войдите с новым паролем.")).toBeVisible();
  await expect(page.locator("body")).not.toContainText("войдёте автоматически");
  await noHorizontalScroll(page);

  for (const path of ["/auth/totp", "/auth/credentials", "/auth/password"]) {
    await page.goto(path);
    await expect(page.locator("body")).toBeVisible();
    await noHorizontalScroll(page);
    expect(await pageErrors(page)).toEqual([]);
  }
});
