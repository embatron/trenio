import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

test("block sits next to report and asks before it writes", async ({ page }) => {
  test.setTimeout(60_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const password = "Pa55word!";
  const email = `block.ui.${tag}@example.com`;
  const ownerEmail = `block.ui.owner.${tag}@example.com`;
  const slug = `b${tag}`;
  const claim = randomBytes(8).toString("hex");
  let profileId: string | null = null;
  let clientId: string | null = null;
  let ownerId: string | null = null;

  try {
    const hash = legacyPasswordHash(password);
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${email}, ${hash}, now(), now(), 'Иван', 'Орлов', 'active')
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${ownerEmail}, ${hash}, now(), now(), 'Мария', 'Соколова', 'active')
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
        'Мария', 'Соколова', 'Мария Соколова', ${claim}, ${`/hi/${claim}`}
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
      values (${conversation.id}, ${client.id}, '<p>Напишите мне ещё</p>', gen_random_uuid())
    `;

    await page.goto(`/auth/login?redirect=${encodeURIComponent(`/me/messages/${conversation.id}`)}`);
    const mail = page.getByPlaceholder("you@example.com");
    await mail.waitFor();
    await page.waitForFunction(() => {
      const input = document.querySelector('input[placeholder="you@example.com"]');
      return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
    });
    await mail.pressSequentially(ownerEmail);
    await page.getByPlaceholder("Введите пароль").pressSequentially(password);
    await page.locator("form.auth-form").getByRole("button", { name: "Войти" }).click();
    await page.waitForURL(`**/me/messages/${conversation.id}`);

    await page.getByRole("button", { name: "Ещё" }).click();
    const report = page.getByRole("menuitem", { name: "Пожаловаться" });
    const block = page.getByRole("menuitem", { name: "Заблокировать" });
    await expect(report).toBeVisible();
    await expect(block).toBeVisible();
    await block.click();
    await expect(page.getByRole("heading", { name: "Заблокировать переписку" })).toBeVisible();
    await expect(page.getByText("Аккаунт останется активным для других тренеров.")).toBeVisible();
    await page.getByRole("button", { name: "Отмена" }).click();
    await expect(page.getByRole("heading", { name: "Заблокировать переписку" })).toHaveCount(0);
    const [pairs] = await sql<{ count: number }[]>`
      select count(*)::int as count from blocked_pairs where user_id = ${client.id}
    `;
    expect(pairs.count).toBe(0);
  } finally {
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
