import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

test("reply is an arrow and the quote is one line", async ({ page }) => {
  test.setTimeout(60_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const password = "Pa55word!";
  const email = `reply.${tag}@example.com`;
  const ownerEmail = `reply.owner.${tag}@example.com`;
  const slug = `r${tag}`;
  const claim = randomBytes(8).toString("hex");
  const quoted = "Первая реплика для ответа";
  let profileId: string | null = null;
  let clientId: string | null = null;
  let ownerId: string | null = null;

  try {
    await sql`alter table messages add column if not exists reply_to_id bigint`;
    const hash = legacyPasswordHash(password);
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${email}, ${hash}, now(), now(), 'Проверка', 'Ответа', 'active')
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
    profileId = profile.id;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, trainer_profile_id, status, last_message_at)
      values (${client.id}, ${profile.id}, 'open', now())
      returning id
    `;
    const [first] = await sql<{ id: string }[]>`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${owner.id}, ${`<p>${quoted}</p>`}, gen_random_uuid())
      returning id::text
    `;
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id, reply_to_id)
      values (${conversation.id}, ${client.id}, '<p>И следом</p>', gen_random_uuid(), ${first.id}::bigint)
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

    const quote = page.locator(".direct-quote");
    await expect(quote).toBeVisible();
    await expect(quote).toContainText(quoted);
    await expect(quote).not.toContainText("Цитата");
    const quoteBox = await quote.boundingBox();
    expect(quoteBox?.height ?? 99).toBeLessThan(28);

    const reply = page.getByRole("button", { name: "Ответить" }).first();
    await expect(reply).toBeVisible();
    await expect(reply).toHaveText("");
    await expect(reply.locator("svg")).toBeVisible();
    const replyBox = await reply.boundingBox();
    expect(replyBox?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(replyBox?.height ?? 0).toBeGreaterThanOrEqual(44);

    await reply.click();
    const banner = page.locator(".direct-banner--quote");
    await expect(banner).toBeVisible();
    await expect(banner).toContainText(quoted);
    await expect(banner).not.toContainText("Ответ:");
    const lineCount = await banner.locator("span").evaluate((node) => node.getClientRects().length);
    expect(lineCount).toBe(1);
    await page.getByRole("button", { name: "Убрать цитату" }).click();
    await expect(banner).toHaveCount(0);

    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(quote).toBeVisible();
    const wideQuote = await quote.boundingBox();
    expect(wideQuote?.height ?? 99).toBeLessThan(28);
    const wideReply = await page.getByRole("button", { name: "Ответить" }).first().boundingBox();
    expect(wideReply?.width ?? 0).toBeGreaterThanOrEqual(44);
    expect(wideReply?.height ?? 0).toBeGreaterThanOrEqual(44);
  } finally {
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
