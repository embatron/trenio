import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";
import type { Browser, Page } from "@playwright/test";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

async function login(page: Page, email: string, redirect: string) {
  await page.goto(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
  const mail = page.getByPlaceholder("you@example.com");
  await mail.waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="you@example.com"]');
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  await mail.pressSequentially(email);
  await page.getByPlaceholder("Введите пароль").pressSequentially("Pa55word!");
  await page.locator("form.auth-form").getByRole("button", { name: "Войти" }).click();
  await page.waitForURL((url) => url.pathname === redirect);
}

function headerCount(page: Page) {
  return page.locator(".message-count .favorite-count__n");
}

function sideCount(page: Page) {
  return page.locator(".cabinet-nav__items a", { hasText: "Сообщения" }).locator(".cabinet-nav__badge");
}

function dialogRow(page: Page, name: string) {
  return page.locator(".direct-list__row", { hasText: name });
}

async function removeAccounts(sql: postgres.Sql, ids: string[]) {
  for (const id of ids) {
    await sql`delete from conversations where user_id = ${id} or host_user_id = ${id}`;
    await sql`delete from users where id = ${id}`;
  }
}

test("opening a welcome dialog clears the admin header, the sidebar, and that row", async ({ page }) => {
  test.setTimeout(90_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const hash = legacyPasswordHash("Pa55word!");
  const adminEmail = `read.admin.${tag}@example.com`;
  const trainerEmail = `read.trainer.${tag}@example.com`;
  const trainerName = `Чтец${tag}`;
  let adminId: string | null = null;
  let trainerId: string | null = null;

  try {
    const [admin] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${adminEmail}, ${hash}, now(), now(), 'Админ', ${tag}, 'active')
      returning id
    `;
    const [trainer] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${trainerEmail}, ${hash}, now(), now(), 'Чтец', ${tag}, 'active')
      returning id
    `;
    adminId = admin.id;
    trainerId = trainer.id;
    await sql`
      insert into user_roles (user_id, role) values
        (${admin.id}, 'admin'),
        (${trainer.id}, 'trainer')
    `;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, host_user_id, status, last_message_at)
      values (${trainer.id}, ${admin.id}, 'open', now())
      returning id
    `;
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${trainer.id}, '<p>Спасибо, принято</p>', gen_random_uuid())
    `;

    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, adminEmail, "/admin/messages");
    const row = dialogRow(page, trainerName);
    let sawUnread = false;
    await expect.poll(async () => {
      const header = (await headerCount(page).innerText().catch(() => "")).trim();
      const side = (await sideCount(page).innerText().catch(() => "")).trim();
      const badge = await row.locator(".direct-unread").count();
      if (header === "1" || side === "1" || badge > 0) sawUnread = true;
      if (sawUnread && header === "0" && side === "0" && badge === 0) return "cleared";
      return `${header}/${side}/${badge}`;
    }, { timeout: 8_000 }).toBe("cleared");
    await expect(page.locator(".direct-thread__head")).toContainText(trainerName);
    await expect(sideCount(page)).not.toHaveClass(/is-hot/);
    await expect(row).toContainText("Прочитано");

    await page.setViewportSize({ width: 390, height: 844 });
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${trainer.id}, '<p>И ещё одна строка</p>', gen_random_uuid())
    `;
    await sql`update conversations set last_message_at = now() where id = ${conversation.id}`;
    await page.goto("/admin/messages", { waitUntil: "commit" });
    await expect(dialogRow(page, trainerName).locator(".direct-unread")).toHaveText("1");
    await expect(page.locator(".direct-log")).toBeHidden();
    await dialogRow(page, trainerName).click();
    await expect(page.locator(".direct-thread__head")).toContainText(trainerName);
    await expect.poll(async () => headerCount(page).innerText(), { timeout: 8_000 }).toBe("0");
    await page.getByRole("button", { name: "К списку" }).click();
    await expect(dialogRow(page, trainerName).locator(".direct-unread")).toHaveCount(0);
    await expect(dialogRow(page, trainerName)).toContainText("И ещё одна строка");
    await expect(headerCount(page)).toHaveText("0");
    await expect(sideCount(page)).toHaveText("0");
  } finally {
    await removeAccounts(sql, [trainerId, adminId].filter((id): id is string => id != null));
    await sql.end({ timeout: 5 });
  }
});

test("a dialog shows online, then away after that browser closes", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const hash = legacyPasswordHash("Pa55word!");
  const adminEmail = `here.admin.${tag}@example.com`;
  const trainerEmail = `here.trainer.${tag}@example.com`;
  const trainerName = `Писарь${tag}`;
  let adminId: string | null = null;
  let trainerId: string | null = null;
  let trainerPage: Page | null = null;

  try {
    const [admin] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${adminEmail}, ${hash}, now(), now(), 'Админ', ${tag}, 'active')
      returning id
    `;
    const [trainer] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${trainerEmail}, ${hash}, now(), now(), 'Писарь', ${tag}, 'active')
      returning id
    `;
    adminId = admin.id;
    trainerId = trainer.id;
    await sql`
      insert into user_roles (user_id, role) values
        (${admin.id}, 'admin'),
        (${trainer.id}, 'trainer')
    `;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, host_user_id, status, last_message_at)
      values (${trainer.id}, ${admin.id}, 'open', now())
      returning id
    `;
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${trainer.id}, '<p>Я на сайте</p>', gen_random_uuid())
    `;

    trainerPage = await openTrainer(browser, trainerEmail);
    await page.setViewportSize({ width: 1280, height: 800 });
    await login(page, adminEmail, "/admin/messages");
    let reloaded = 0;
    await expect.poll(async () => {
      const row = dialogRow(page, trainerName);
      if ((await row.count()) === 0) return "no-row";
      const label = (await row.locator(".presence").getAttribute("aria-label")) ?? "no-dot";
      if (label !== "В сети" && reloaded < 3) {
        reloaded += 1;
        await page.reload({ waitUntil: "domcontentloaded" });
        return "reload";
      }
      return label;
    }, { timeout: 12_000 }).toBe("В сети");

    await trainerPage.close();
    trainerPage = null;
    await expect.poll(async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      const row = dialogRow(page, trainerName);
      await row.waitFor();
      return (await row.locator(".presence").getAttribute("aria-label")) ?? "no-dot";
    }, { timeout: 12_000 }).toBe("Был недавно");
  } finally {
    await trainerPage?.close();
    await removeAccounts(sql, [trainerId, adminId].filter((id): id is string => id != null));
    await sql.end({ timeout: 5 });
  }
});

async function openTrainer(browser: Browser, email: string) {
  const context = await browser.newContext({
    baseURL: "http://127.0.0.1:8081",
    viewport: { width: 1280, height: 800 },
  });
  const trainerPage = await context.newPage();
  await trainerPage.route("http://trenio.local/**", async (route) => {
    const url = route.request().url().replace("http://trenio.local", "http://127.0.0.1:8081");
    const response = await route.fetch({ url });
    await route.fulfill({ response });
  });
  const live = trainerPage.waitForEvent("websocket", (ws) => ws.url().includes("/messages/live"));
  await login(trainerPage, email, "/");
  await live;
  await trainerPage.waitForLoadState("domcontentloaded");
  await trainerPage.waitForTimeout(800);
  return trainerPage;
}
