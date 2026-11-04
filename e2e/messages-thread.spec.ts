import { expect, test } from "./fixtures";

const GIVEN = "Александра-Мария-Константиновна";
const FAMILY = "Христорождественская-Преображенская";

test("a long name stays clear of the phone thread header", async ({ page }) => {
  await page.goto("/auth/login?redirect=/admin/messages");
  const email = page.getByPlaceholder("you@example.com");
  await email.waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="you@example.com"]');
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  await email.pressSequentially("admin@trenio.by");
  await page.getByPlaceholder("Введите пароль").pressSequentially("Pa55word!");
  await page.locator("form.auth-form").getByRole("button", { name: "Войти" }).click();
  await page.waitForURL("**/admin/messages");

  const row = page.locator(".direct-list button.direct-list__row").first();
  await row.waitFor();
  await row.evaluate((node, names) => {
    const lines = node.querySelectorAll(".trainer-name__line");
    if (lines[0]) lines[0].textContent = names.given;
    if (lines[1]) lines[1].textContent = names.family;
  }, { given: GIVEN, family: FAMILY });
  const listClash = await row.evaluate((node) => {
    const name = node.querySelector(".trainer-name");
    const meta = node.querySelector(".direct-list__meta");
    if (!(name instanceof HTMLElement) || !(meta instanceof HTMLElement)) return "missing";
    const nameBox = name.getBoundingClientRect();
    const metaBox = meta.getBoundingClientRect();
    const rowBox = node.getBoundingClientRect();
    if (nameBox.right > metaBox.left + 1) return "name covers the date";
    if (nameBox.right > rowBox.right + 1 || nameBox.left < rowBox.left - 1) return "name leaves the row";
    if (nameBox.height > 32) return "name wraps onto a second line";
    return "";
  });
  expect(listClash).toBe("");

  await row.click();
  const sheet = page.locator(".direct.is-mobile.is-thread");
  await sheet.waitFor();
  await expect(page.getByRole("button", { name: "Предыдущий диалог" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Следующий диалог" })).toBeHidden();
  await expect(sheet).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(page.locator(".direct-log")).toHaveCSS("background-color", "rgb(255, 255, 255)");

  const clash = await page.locator(".direct-thread__head").evaluate((head, names) => {
    const lines = head.querySelectorAll(".direct-thread__who .trainer-name__line");
    if (lines[0]) lines[0].textContent = names.given;
    if (lines[1]) lines[1].textContent = names.family;
    const trainer = head.querySelector(".direct-thread__trainer strong");
    if (trainer) trainer.textContent = `Тренер: ${names.given} ${names.family}`;
    const box = (selector: string) => {
      const el = head.querySelector(selector);
      if (!(el instanceof HTMLElement)) return null;
      const rect = el.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    };
    const overlaps = (a: { left: number; right: number; top: number; bottom: number } | null, b: { left: number; right: number; top: number; bottom: number } | null) =>
      !!a && !!b && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
    const name = box(".trainer-name");
    const back = box(".direct-back");
    const more = box(".direct-menu__btn");
    const mark = box(".cabinet-id__open");
    const who = box(".direct-thread__who");
    const headBox = head.getBoundingClientRect();
    if (!name || !who) return "name is missing";
    if (name.height > 32) return "name wraps onto a second line";
    if (name.right > who.right + 1 || name.left < who.left - 1) return "name leaves its column";
    if (overlaps(name, back)) return "name covers the back button";
    if (overlaps(name, more)) return "name covers the menu";
    if (overlaps(name, mark)) return "name covers the new-tab mark";
    if (mark && (mark.right > headBox.right + 1 || mark.left < headBox.left)) return "new-tab mark leaves the header";
    if (more && (more.right > headBox.right + 1 || more.left < who.right - 1)) return "menu collides with the name column";
    return "";
  }, { given: GIVEN, family: FAMILY });
  expect(clash).toBe("");
});
