import { expect, test, type Page } from "@playwright/test";

import { deleteWelcome, readWelcomePhones, waitForJournal } from "./journal";

test.describe.configure({ mode: "serial" });

async function pageErrors(page: Page): Promise<string[]> {
  return (page as { __pageErrors?: string[] }).__pageErrors ?? [];
}

async function openWelcome(page: Page) {
  await page.goto("/join/trainer");
  const instagram = page.getByPlaceholder("@имя или ссылка");
  await instagram.waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="@имя или ссылка"]');
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  const menu = page.getByRole("dialog", { name: "Меню" });
  if (await menu.isVisible()) await page.keyboard.press("Escape");
  return instagram;
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  (page as { __pageErrors?: string[] }).__pageErrors = errors;
});

test("trainer welcome logs a honeypot denial and a handle without the message", async ({ page }) => {
  test.setTimeout(60_000);
  const stamp = Date.now().toString(36);
  const trap = `trap${stamp}`;
  const hiddenHandle = `hid${stamp}`;
  const handle = `e2e${stamp}`;

  const instagram = await openWelcome(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Укажи имя в Instagram или ссылку на профиль.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Спасибо" })).toHaveCount(0);

  const before = await waitForJournal(["--action", "form.welcome", "--hours", "1"], () => true);
  const deniedBefore = before.rows.filter((row) => row.outcome === "denied" && row.context?.reason === "honeypot").length;

  await instagram.pressSequentially(hiddenHandle);
  await page.locator("input[name=company_website]").evaluate((input, value) => {
    (input as HTMLInputElement).value = String(value);
  }, trap);
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByRole("heading", { name: "Спасибо" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(trap);

  const denied = await waitForJournal(["--action", "form.welcome", "--hours", "1"], (report) => {
    const hits = report.rows.filter((row) => row.outcome === "denied" && row.context?.reason === "honeypot");
    return hits.length > deniedBefore && report.rows[0]?.outcome === "denied";
  });
  const deniedRow = denied.rows.find((row) => row.outcome === "denied" && row.context?.reason === "honeypot");
  expect(deniedRow?.message).toBe("Заявка тренера отклонена.");
  expect(deniedRow?.route).toBe("/join/trainer");
  expect(deniedRow?.target).toBeNull();
  expect(JSON.stringify(deniedRow)).not.toContain(trap);
  expect(JSON.stringify(deniedRow)).not.toContain(hiddenHandle);

  const again = await openWelcome(page);
  await again.pressSequentially(handle);
  await expect(again).toHaveValue(handle);
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByRole("heading", { name: "Спасибо" })).toBeVisible();

  try {
    const saved = await waitForJournal(["--action", "form.welcome", "--target", handle, "--hours", "1"], (report) =>
      report.rows.some((row) => row.outcome === "success" && row.target === handle),
    );
    const row = saved.rows.find((item) => item.outcome === "success" && item.target === handle);
    expect(row?.message).toBe("Заявка тренера принята.");
    expect(row?.route).toBe("/join/trainer");
    expect(row?.context).toEqual({ channel: "instagram" });
    expect(JSON.stringify(row)).not.toContain(trap);
  } finally {
    await deleteWelcome(handle);
    await deleteWelcome(hiddenHandle);
  }

  expect(await pageErrors(page)).toEqual([]);
});

test("trainer welcome without Instagram logs the Telegram name", async ({ page }) => {
  test.setTimeout(45_000);
  const telegram = `e2etg${Date.now().toString(36)}`;

  await openWelcome(page);
  await page.getByRole("button", { name: "У меня нет Instagram" }).click();
  await expect(page.getByRole("heading", { name: "Как с тобой связаться" })).toBeVisible();
  await expect(page.getByPlaceholder("@имя или ссылка")).toHaveCount(0);

  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Оставь Telegram или номер телефона.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Спасибо" })).toHaveCount(0);

  const name = page.getByPlaceholder("@имя или t.me/…");
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="@имя или t.me/…"]');
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  await name.pressSequentially(telegram);
  await expect(name).toHaveValue(telegram);
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByRole("heading", { name: "Спасибо" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(telegram);

  try {
    const saved = await waitForJournal(["--action", "form.welcome", "--target", telegram, "--hours", "1"], (report) =>
      report.rows.some((row) => row.outcome === "success" && row.target === telegram),
    );
    const row = saved.rows.find((item) => item.outcome === "success" && item.target === telegram);
    expect(row?.message).toBe("Заявка тренера принята.");
    expect(row?.route).toBe("/join/trainer");
    expect(row?.context).toEqual({ channel: "other" });
    expect(JSON.stringify(row)).not.toContain("+375");
  } finally {
    await deleteWelcome(telegram, "telegram");
  }

  expect(await pageErrors(page)).toEqual([]);
});

test("trainer welcome with only a phone logs the masked number", async ({ page }) => {
  test.setTimeout(45_000);
  const formatted = "+375 29 123-45-67";
  const masked = "375*******67";

  await openWelcome(page);
  await page.getByRole("button", { name: "У меня нет Instagram" }).click();
  const phone = page.locator("form.welcome-card input[name=phone]");
  await page.waitForFunction(() => {
    const input = document.querySelector("form.welcome-card input[name=phone]");
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  await phone.click();
  await phone.pressSequentially("291234567");
  await expect(phone).toHaveValue(formatted);
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByRole("heading", { name: "Спасибо" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(formatted);

  try {
    const saved = await waitForJournal(["--action", "form.welcome", "--subject", masked, "--hours", "1"], (report) =>
      report.rows.some((row) => row.subject === masked && row.target === null),
    );
    const row = saved.rows.find((item) => item.subject === masked && item.target === null);
    expect(row?.message).toBe("Заявка тренера принята.");
    expect(row?.route).toBe("/join/trainer");
    expect(row?.context).toEqual({ channel: "other" });
    expect(JSON.stringify(row)).not.toContain("123-45-67");
    expect(JSON.stringify(row)).not.toContain("+375");
    expect(await readWelcomePhones(formatted)).toEqual([formatted]);
  } finally {
    await deleteWelcome(formatted, "phone");
  }

  expect(await pageErrors(page)).toEqual([]);
});

test("trainer welcome refuses a Belarus landline", async ({ page }) => {
  await openWelcome(page);
  await page.getByRole("button", { name: "У меня нет Instagram" }).click();
  const phone = page.locator("form.welcome-card input[name=phone]");
  await page.waitForFunction(() => {
    const input = document.querySelector("form.welcome-card input[name=phone]");
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  await phone.click();
  await phone.pressSequentially("171234567");
  await expect(phone).toHaveValue("+375 17 123-45-67");
  await page.getByRole("button", { name: "Отправить" }).click();
  await expect(page.getByText("Укажи мобильный номер РБ: +375 25/29/33/44 …")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Спасибо" })).toHaveCount(0);
  expect(await pageErrors(page)).toEqual([]);
});
