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

async function expectDialogList(page: Page) {
  await expect.poll(() => new URL(page.url()).pathname).toBe("/account/messages");
  await expect(page.locator(".direct.is-thread")).toHaveCount(0);
  await expect(page.locator(".direct-list")).toBeVisible();
}

test("phone back from a dialog opens the dialog list", async ({ page }) => {
  test.setTimeout(90_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const hash = legacyPasswordHash("Pa55word!");
  const clientEmail = `back.client.${tag}@example.com`;
  const ownerEmail = `back.owner.${tag}@example.com`;
  const slug = `b${tag}`;
  let clientId: string | null = null;
  let ownerId: string | null = null;
  let profileId: string | null = null;

  try {
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${clientEmail}, ${hash}, now(), now(), 'Читатель', 'Назад', 'active')
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${ownerEmail}, ${hash}, now(), now(), 'Тренер', 'Назад', 'active')
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
        'Тренер', 'Назад', 'Тренер Назад', ${claim}, ${`/hi/${claim}`}
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

    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, clientEmail, "/");

    await page.goto(`/account/messages/${conversation.id}`, { waitUntil: "commit" });
    await page.locator(".direct-log").waitFor();
    await page.goBack({ waitUntil: "commit" });
    await expectDialogList(page);
    await page.goBack({ waitUntil: "commit" });
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");

    await page.goto("/account/messages", { waitUntil: "commit" });
    await page.locator(`.direct-list a[href*="${conversation.id}"]`).click();
    await page.waitForURL(`**/account/messages/${conversation.id}`);
    await page.goBack({ waitUntil: "commit" });
    await expectDialogList(page);
    await page.goBack({ waitUntil: "commit" });
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");

    await page.goto(`/account/messages?trainer=${slug}`, { waitUntil: "commit" });
    await page.waitForURL(`**/account/messages/${conversation.id}`);
    await page.goBack({ waitUntil: "commit" });
    await expectDialogList(page);
    await page.waitForTimeout(600);
    await expect(page.locator(".direct.is-thread")).toHaveCount(0);
    await page.goBack({ waitUntil: "commit" });
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
  } finally {
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
