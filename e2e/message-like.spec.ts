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

async function signIn(page: Page, email: string) {
  await page.goto(`/auth/login?redirect=${encodeURIComponent("/")}`);
  const mail = page.getByPlaceholder("you@example.com");
  await mail.waitFor();
  await page.waitForFunction(() => {
    const input = document.querySelector('input[placeholder="you@example.com"]');
    return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
  });
  await mail.pressSequentially(email);
  await page.getByPlaceholder("Введите пароль").pressSequentially("Pa55word!");
  await page.locator("form.auth-form").getByRole("button", { name: "Войти" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

test("a like fills the thumb and reaches the other open dialog", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const hash = legacyPasswordHash("Pa55word!");
  const clientEmail = `like.client.${tag}@example.com`;
  const ownerEmail = `like.owner.${tag}@example.com`;
  const slug = `l${tag}`;
  let clientId: string | null = null;
  let ownerId: string | null = null;
  let profileId: string | null = null;
  const origin = baseURL ?? "http://127.0.0.1:8081";
  const ownerContext = await browser.newContext({ baseURL: origin });
  const ownerPage = await ownerContext.newPage();

  try {
    await ownerPage.route("http://trenio.local/**", async (route) => {
      const url = route.request().url().replace("http://trenio.local", origin);
      const response = await route.fetch({ url });
      await route.fulfill({ response });
    });
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${clientEmail}, ${hash}, now(), now(), 'Читатель', 'Лайк', 'active')
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${ownerEmail}, ${hash}, now(), now(), 'Тренер', 'Лайк', 'active')
      returning id
    `;
    clientId = client.id;
    ownerId = owner.id;
    await sql`insert into user_roles (user_id, role) values (${client.id}, 'user'), (${owner.id}, 'trainer')`;
    const claim = randomBytes(8).toString("hex");
    const [profile] = await sql<{ id: string }[]>`
      insert into trainer_profiles (
        slug, instagram_handle, source_url, status, owner_user_id,
        first_name, last_name, full_name, claim_token, claim_path
      )
      values (
        ${slug}, ${slug}, ${`https://instagram.com/${slug}`}, 'published', ${owner.id},
        'Тренер', 'Лайк', 'Тренер Лайк', ${claim}, ${`/hi/${claim}`}
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
      values (${conversation.id}, ${owner.id}, '<p>Короткое</p>', gen_random_uuid())
    `;

    await page.setViewportSize({ width: 1100, height: 800 });
    await ownerPage.setViewportSize({ width: 1100, height: 800 });
    await signIn(page, clientEmail);
    await signIn(ownerPage, ownerEmail);

    await page.getByRole("link", { name: /Сообщения/ }).click();
    await page.locator(`.direct-list a[href*="${conversation.id}"]`).click();
    await page.locator(".direct-log").waitFor();
    await ownerPage.goto(`/me/messages/${conversation.id}`);
    await ownerPage.locator(".direct-log").waitFor();
    await expect(ownerPage.getByLabel("Отмечено")).toHaveCount(0);

    const mark = page.getByRole("button", { name: "Отметить" });
    await mark.click();
    const on = page.getByRole("button", { name: "Убрать отметку" });
    await expect(on).toBeVisible();
    const fill = await on.evaluate((node) => {
      const path = node.querySelectorAll("path")[1] as SVGPathElement | undefined;
      const painted = path ? getComputedStyle(path).fill : "none";
      return { painted, color: getComputedStyle(node).color, pop: node.classList.contains("is-pop") };
    });
    expect(fill.painted).not.toBe("none");
    expect(fill.painted).toBe(fill.color);
    expect(fill.pop).toBe(true);

    const seen = ownerPage.getByLabel("Отмечено");
    await expect(seen).toBeVisible();
    await expect.poll(async () => seen.evaluate((node) => node.classList.contains("is-pop"))).toBe(true);
    const theirs = await seen.evaluate((node) => {
      const path = node.querySelectorAll("path")[1] as SVGPathElement | undefined;
      const painted = path ? getComputedStyle(path).fill : "none";
      return painted === getComputedStyle(node).color && painted !== "none";
    });
    expect(theirs).toBe(true);

    await on.click();
    await expect(page.getByRole("button", { name: "Отметить" })).toBeVisible();
    await expect(seen).toHaveCount(0);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    await ownerPage.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    await ownerContext.close();
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
