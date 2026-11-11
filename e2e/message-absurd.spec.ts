import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

test("a poisoned thread stays text, search stays a search, and the counter stops a novel", async ({ page }) => {
  test.setTimeout(60_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const password = "Pa55word!";
  const email = `absurd.ui.${tag}@example.com`;
  const ownerEmail = `absurd.ui.owner.${tag}@example.com`;
  const slug = `u${tag}`;
  const claim = randomBytes(8).toString("hex");
  const marker = `видимый${tag}`;
  let profileId: string | null = null;
  let clientId: string | null = null;
  let ownerId: string | null = null;
  const pageErrors: string[] = [];
  let dialog = false;
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", async (popup) => {
    dialog = true;
    await popup.dismiss();
  });

  try {
    const hash = legacyPasswordHash(password);
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status, mail_messages)
      values (${email}, ${hash}, now(), now(), 'Проверка', 'Экрана', 'active', false)
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status, mail_messages)
      values (${ownerEmail}, ${hash}, now(), now(), 'Тренер', 'Экрана', 'active', false)
      returning id
    `;
    clientId = client.id;
    ownerId = owner.id;
    await sql`insert into user_roles (user_id, role) values (${client.id}, 'user'), (${owner.id}, 'trainer')`;
    const [profile] = await sql<{ id: string }[]>`
      insert into trainer_profiles (
        slug, instagram_handle, source_url, status, owner_user_id,
        first_name, last_name, full_name, claim_token, claim_path
      ) values (
        ${slug}, ${slug}, ${`https://instagram.com/${slug}`}, 'published', ${owner.id},
        'Тренер', 'Экрана', 'Тренер Экрана', ${claim}, ${`/hi/${claim}`}
      ) returning id
    `;
    profileId = profile.id;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, trainer_profile_id, status, last_message_at)
      values (${client.id}, ${profile.id}, 'open', now())
      returning id
    `;
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (
        ${conversation.id},
        ${owner.id},
        ${`<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">ловушка</a><p>${marker}</p>`},
        gen_random_uuid()
      )
    `;

    await page.goto(`/auth/login?redirect=${encodeURIComponent(`/account/messages/${conversation.id}`)}`);
    const mail = page.getByPlaceholder("you@example.com");
    await mail.waitFor();
    await page.waitForFunction(() => {
      const input = document.querySelector('input[placeholder="you@example.com"]');
      return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
    });
    await mail.pressSequentially(email);
    await page.getByPlaceholder("Введите пароль").pressSequentially(password);
    await page.locator("form.auth-form").getByRole("button", { name: "Войти" }).click();
    await page.waitForURL(`**/account/messages/${conversation.id}`);

    const bubble = page.locator(".direct-bubble__text");
    await expect(bubble.getByText(marker, { exact: true })).toBeVisible();
    await expect(bubble.locator("a, script, img")).toHaveCount(0);
    await expect(page.locator("img[onerror], a[href^='javascript']")).toHaveCount(0);
    expect(dialog).toBe(false);
    await expect(page.getByRole("button", { name: "Жирный" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Прикрепить файл" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Эмодзи" })).toBeVisible();

    const editor = page.locator(".direct-composer [contenteditable='true']");
    await editor.click();
    await editor.pressSequentially("**жирный**");
    await expect(editor.locator("strong")).toHaveText("жирный");
    await page.getByRole("button", { name: "Эмодзи" }).click();
    await expect(page.getByPlaceholder("Поиск")).toBeVisible();
    await page.keyboard.press("Escape");
    await editor.evaluate((field) => {
      field.textContent = "";
      field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    });
    await editor.click();
    await editor.evaluate((field, text) => {
      field.textContent = text;
      field.dispatchEvent(new InputEvent("input", { bubbles: true }));
    }, "я".repeat(1001));
    await expect(page.locator(".direct-composer__count.is-over")).toBeVisible();
    await expect(page.getByRole("button", { name: "Отправить" })).toBeDisabled();

    await page.goto("/account/messages");
    const search = page.getByPlaceholder("Имя или текст");
    await search.waitFor();
    await page.waitForFunction(() => {
      const input = document.querySelector('input[placeholder="Имя или текст"]');
      return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
    });
    await search.fill(`%%' OR 1=1 -- ${tag}`);
    await expect(page.getByText("Ничего не найдено")).toBeVisible();
    expect(pageErrors).toEqual([]);
  } finally {
    if (clientId) await sql`delete from app_logs where actor_user_id = ${clientId}`;
    if (ownerId) await sql`delete from app_logs where actor_user_id = ${ownerId}`;
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
