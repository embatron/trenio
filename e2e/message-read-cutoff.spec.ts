import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";
import type { Page } from "@playwright/test";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 900, height: 1024 },
  { name: "desktop", width: 1280, height: 800 },
] as const;

type Cutoff = { seen: number | null; hanging: number | null };

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
  await page.waitForURL(`**${redirect}`);
}

async function cutoff(page: Page): Promise<Cutoff> {
  return page.locator(".direct-log").evaluate((el) => {
    const edge = el.getBoundingClientRect().bottom + 8;
    let seen: number | null = null;
    let hanging: number | null = null;
    for (const node of el.querySelectorAll("[data-message-id]")) {
      if (!(node instanceof HTMLElement)) continue;
      const id = Number(node.dataset.messageId);
      if (!Number.isFinite(id) || id <= 0) continue;
      const bottom = node.getBoundingClientRect().bottom;
      if (bottom <= edge) {
        if (seen == null || id > seen) seen = id;
      } else if (hanging == null || id < hanging) {
        hanging = id;
      }
    }
    return { seen, hanging };
  });
}

async function readCursor(sql: postgres.Sql, conversationId: string, userId: string) {
  const [row] = await sql<{ id: string | null }[]>`
    select last_read_message_id::text as id
    from conversation_reads
    where conversation_id = ${conversationId} and user_id = ${userId}
  `;
  return row?.id == null ? null : Number(row.id);
}

async function settleCursor(sql: postgres.Sql, conversationId: string, userId: string) {
  let last: number | null | undefined;
  let stable = 0;
  const start = Date.now();
  while (Date.now() - start < 5000) {
    const current = await readCursor(sql, conversationId, userId);
    if (current === last) stable += 1;
    else {
      last = current;
      stable = 0;
    }
    if (stable >= 3 && Date.now() - start > 700) return current ?? null;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  return last ?? null;
}

/** Wheel over the log until that message's bottom crosses the visible edge. */
async function revealBottom(page: Page, messageId: number) {
  const log = page.locator(".direct-log");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const gap = await log.evaluate((el, id) => {
      const row = el.querySelector(`[data-message-id="${id}"]`);
      if (!(row instanceof HTMLElement)) return 9999;
      return row.getBoundingClientRect().bottom - (el.getBoundingClientRect().bottom + 8);
    }, messageId);
    if (gap <= 0) return;
    const box = await log.boundingBox();
    if (!box) throw new Error("the log has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + Math.min(box.height / 2, 200));
    await page.mouse.wheel(0, Math.min(Math.max(gap, 80), 480));
    await page.waitForTimeout(40);
  }
  throw new Error("the message bottom stayed below the log");
}

test("a message is read only after its bottom enters the log", async ({ page }) => {
  test.setTimeout(180_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const password = "Pa55word!";
  const clientEmail = `read.client.${tag}@example.com`;
  const ownerEmail = `read.owner.${tag}@example.com`;
  const hash = legacyPasswordHash(password);
  const longBody = "<p>Нижняя граница этого сообщения ещё ниже окна.</p>".repeat(40);
  let clientId: string | null = null;
  let ownerId: string | null = null;
  const profileIds: string[] = [];

  try {
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${clientEmail}, ${hash}, now(), now(), 'Читатель', 'Проверки', 'active')
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${ownerEmail}, ${hash}, now(), now(), 'Тренер', 'Проверки', 'active')
      returning id
    `;
    clientId = client.id;
    ownerId = owner.id;
    await sql`insert into user_roles (user_id, role) values (${client.id}, 'user'), (${owner.id}, 'trainer')`;

    const threads: { conversationId: string; shortId: number; longId: number }[] = [];
    for (const viewport of VIEWPORTS) {
      const slug = `r${tag}${viewport.name.slice(0, 1)}`;
      const claim = randomBytes(8).toString("hex");
      const [profile] = await sql<{ id: string }[]>`
        insert into trainer_profiles (
          slug, instagram_handle, source_url, status, owner_user_id,
          first_name, last_name, full_name, claim_token, claim_path
        )
        values (
          ${slug}, ${slug}, ${`https://instagram.com/${slug}`}, 'published', ${owner.id},
          'Тренер', 'Проверки', 'Тренер Проверки', ${claim}, ${`/hi/${claim}`}
        )
        returning id
      `;
      profileIds.push(profile.id);
      const [conversation] = await sql<{ id: string }[]>`
        insert into conversations (user_id, trainer_profile_id, status, last_message_at)
        values (${client.id}, ${profile.id}, 'open', now())
        returning id
      `;
      const [short] = await sql<{ id: string }[]>`
        insert into messages (conversation_id, sender_id, body, client_id)
        values (${conversation.id}, ${owner.id}, '<p>Короткое</p>', gen_random_uuid())
        returning id::text
      `;
      const [long] = await sql<{ id: string }[]>`
        insert into messages (conversation_id, sender_id, body, client_id)
        values (${conversation.id}, ${owner.id}, ${longBody}, gen_random_uuid())
        returning id::text
      `;
      threads.push({
        conversationId: conversation.id,
        shortId: Number(short.id),
        longId: Number(long.id),
      });
    }

    const browser = page.context().browser();
    expect(browser).toBeTruthy();
    const ownerContext = await browser!.newContext({
      baseURL: "http://127.0.0.1:8081",
      viewport: { width: 390, height: 844 },
    });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.route("http://trenio.local/**", async (route) => {
      const url = route.request().url().replace("http://trenio.local", "http://127.0.0.1:8081");
      const response = await route.fetch({ url });
      await route.fulfill({ response });
    });

    await login(page, clientEmail, `/account/messages/${threads[0].conversationId}`);
    await login(ownerPage, ownerEmail, `/me/messages/${threads[0].conversationId}`);

    for (let index = 0; index < VIEWPORTS.length; index += 1) {
      const viewport = VIEWPORTS[index];
      const thread = threads[index];
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await ownerPage.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`/account/messages/${thread.conversationId}`);
      await page.locator(".direct-log").waitFor();
      await expect(page.locator(`[data-message-id="${thread.shortId}"]`)).toBeVisible();

      const opened = await cutoff(page);
      expect(opened.hanging, `${viewport.name} keeps the long message below the log`).toBe(thread.longId);
      const motion = await page.locator(".direct.is-thread").evaluate((sheet) => {
        const pane = sheet.querySelector(".direct-thread__pane");
        const header = document.querySelector(".site-header");
        if (!(pane instanceof HTMLElement) || !(header instanceof HTMLElement)) return null;
        return {
          pane: getComputedStyle(pane).animationName,
          top: Math.round(sheet.getBoundingClientRect().top),
          header: Math.round(header.getBoundingClientRect().height),
          fixed: getComputedStyle(sheet).position,
        };
      });
      if (viewport.width < 768) {
        expect(motion?.pane, `${viewport.name} pane`).toBe("none");
        expect(motion?.fixed).toBe("fixed");
        expect(motion?.top).toBe(motion?.header);
      } else {
        expect(motion?.fixed, `${viewport.name} stays in the page`).not.toBe("fixed");
      }
      const cursor = await settleCursor(sql, thread.conversationId, client.id);
      expect(cursor, `${viewport.name} read cursor`).toBe(opened.seen);

      await ownerPage.goto(`/me/messages/${thread.conversationId}`);
      await expect(ownerPage.locator(`[data-message-id="${thread.longId}"] .direct-bubble__state`)).toHaveText("Доставлено");
      if (opened.seen === thread.shortId) {
        await expect(ownerPage.locator(`[data-message-id="${thread.shortId}"] .direct-bubble__state.is-read`)).toHaveText("Прочитано");
      }
      const listMark = ownerPage.locator(".direct-list a.is-active .direct-receipt");
      await expect(listMark).not.toHaveClass(/is-read/);

      await revealBottom(page, thread.longId);
      const revealed = await cutoff(page);
      expect(revealed.hanging, `${viewport.name} after the bottom enters`).toBeNull();
      expect(revealed.seen).toBe(thread.longId);
      await expect.poll(() => readCursor(sql, thread.conversationId, client.id), { timeout: 8_000 }).toBe(thread.longId);

      await ownerPage.reload();
      const receipt = ownerPage.locator(`[data-message-id="${thread.longId}"] .direct-bubble__state.is-read`);
      await expect(receipt).toHaveText("Прочитано");
      const fit = await receipt.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const bubble = el.closest(".direct-bubble")?.getBoundingClientRect();
        const log = el.closest(".direct-log")?.getBoundingClientRect();
        return {
          right: rect.right,
          bubbleRight: bubble?.right ?? 0,
          logRight: log?.right ?? 0,
          width: rect.width,
          viewport: window.innerWidth,
          shell: el.closest(".direct")?.className ?? "",
        };
      });
      expect(fit.right, `${viewport.name} receipt stays inside the bubble ${JSON.stringify(fit)}`).toBeLessThanOrEqual(fit.bubbleRight + 1);
      expect(fit.right, `${viewport.name} receipt stays inside the log ${JSON.stringify(fit)}`).toBeLessThanOrEqual(fit.logRight + 1);
      expect(fit.width, `${viewport.name} receipt has a visible width`).toBeGreaterThan(40);
      await expect(ownerPage.locator(".direct-list a.is-active .direct-receipt")).toHaveClass(/is-read/);
      await ownerPage.screenshot({ path: `/tmp/trenio-read-${viewport.name}.png`, fullPage: false });
      if (viewport.name === "phone") {
        await page.goto("/account/messages");
        await expect(page.locator(`a[href*="${thread.conversationId}"] .direct-unread`)).toHaveCount(0);
        await expect(page.locator(".direct-unread")).toHaveCount(2);
        await expect(page.locator(".message-count .favorite-count__n")).toHaveText("4");
      }
    }

    await ownerContext.close();
  } finally {
    for (const profileId of profileIds) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});

test("a reply clears the icon, the menu, and the dialog count", async ({ page }) => {
  test.setTimeout(90_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const hash = legacyPasswordHash("Pa55word!");
  const clientEmail = `reply.client.${tag}@example.com`;
  const ownerEmail = `reply.owner.${tag}@example.com`;
  const longBody = "<p>Это сообщение ещё не дочитано до нижнего края.</p>".repeat(40);
  let clientId: string | null = null;
  let ownerId: string | null = null;
  let profileId: string | null = null;

  try {
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${clientEmail}, ${hash}, now(), now(), 'Читатель', 'Ответа', 'active')
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${ownerEmail}, ${hash}, now(), now(), 'Тренер', 'Ответа', 'active')
      returning id
    `;
    clientId = client.id;
    ownerId = owner.id;
    await sql`insert into user_roles (user_id, role) values (${client.id}, 'user'), (${owner.id}, 'trainer')`;
    const slug = `q${tag}`;
    const claim = randomBytes(8).toString("hex");
    const [profile] = await sql<{ id: string }[]>`
      insert into trainer_profiles (
        slug, instagram_handle, source_url, status, owner_user_id,
        first_name, last_name, full_name, claim_token, claim_path
      )
      values (
        ${slug}, ${slug}, ${`https://instagram.com/${slug}`}, 'published', ${owner.id},
        'Тренер', 'Ответа', 'Тренер Ответа', ${claim}, ${`/hi/${claim}`}
      )
      returning id
    `;
    profileId = profile.id;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, trainer_profile_id, status, last_message_at)
      values (${client.id}, ${profile.id}, 'open', now())
      returning id
    `;
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${owner.id}, ${longBody}, gen_random_uuid())
    `;

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, clientEmail, `/account/messages/${conversation.id}`);
    await page.locator(".direct-log").waitFor();
    const hanging = await cutoff(page);
    expect(hanging.hanging, "the reply is what clears a message still below the log").not.toBeNull();
    await expect(page.locator(".message-count .favorite-count__n")).toHaveText("1");
    await expect(page.locator(".cabinet-nav__badge.is-hot")).toHaveText("1");

    const field = page.locator(".direct-field");
    await field.click();
    await field.pressSequentially("Отвечаю");
    await page.locator(".direct-composer__send").click();
    await expect(page.locator(".direct-log").getByText("Отвечаю")).toBeVisible();
    await expect.poll(() => readCursor(sql, conversation.id, client.id), { timeout: 8_000 }).not.toBeNull();
    await expect(page.locator(".message-count .favorite-count__n")).toHaveText("0");
    await expect(page.locator(".cabinet-nav__badge.is-hot")).toHaveCount(0);

    await page.goto("/account/messages");
    await expect(page.locator(`a[href*="${conversation.id}"] .direct-unread`)).toHaveCount(0);
    await expect(page.locator(".message-count .favorite-count__n")).toHaveText("0");
    await expect(page.locator(".cabinet-nav__badge.is-hot")).toHaveCount(0);
  } finally {
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
