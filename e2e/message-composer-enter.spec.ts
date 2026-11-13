import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

test("Enter sends, Shift+Enter breaks, and a million breaks stay small", async ({ page }) => {
  test.setTimeout(90_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const hash = legacyPasswordHash("Pa55word!");
  const clientEmail = `enter.client.${tag}@example.com`;
  const ownerEmail = `enter.owner.${tag}@example.com`;
  const slug = `e${tag}`;
  let clientId: string | null = null;
  let ownerId: string | null = null;
  let profileId: string | null = null;

  try {
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${clientEmail}, ${hash}, now(), now(), 'Читатель', 'Ввод', 'active')
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${ownerEmail}, ${hash}, now(), now(), 'Тренер', 'Ввод', 'active')
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
        'Тренер', 'Ввод', 'Тренер Ввод', ${claim}, ${`/hi/${claim}`}
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
    await page.goto(`/auth/login?redirect=${encodeURIComponent("/")}`);
    const mail = page.getByPlaceholder("you@example.com");
    await mail.waitFor();
    await page.waitForFunction(() => {
      const input = document.querySelector('input[placeholder="you@example.com"]');
      return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
    });
    await mail.pressSequentially(clientEmail);
    await page.getByPlaceholder("Введите пароль").pressSequentially("Pa55word!");
    await page.locator("form.auth-form").getByRole("button", { name: "Войти" }).click();
    await page.waitForURL((url) => url.pathname === "/");

    await page.getByRole("link", { name: /Сообщения/ }).click();
    await page.locator(`.direct-list a[href*="${conversation.id}"]`).click();
    await page.locator(".direct-log").waitFor();
    const field = page.getByRole("textbox", { name: "Написать сообщение" });
    const bubbles = page.locator(".direct-bubble");
    await expect(bubbles).toHaveCount(1);

    await field.click();
    await field.pressSequentially("Привет");
    await field.press("Shift+Enter");
    await field.press("Shift+Enter");
    await field.press("Shift+Enter");
    await field.pressSequentially("ещё");
    await expect(bubbles).toHaveCount(1);
    const draftBreaks = await field.evaluate((node) => node.querySelectorAll("br").length);
    expect(draftBreaks).toBeLessThanOrEqual(2);

    await field.press("Enter");
    await expect(page.locator(".direct-bubble").filter({ hasText: "Привет" })).toBeVisible();
    await expect(bubbles).toHaveCount(2);
    const sentBreaks = await page.locator(".direct-bubble").filter({ hasText: "Привет" }).evaluate((node) => node.querySelectorAll("br").length);
    expect(sentBreaks).toBeLessThanOrEqual(2);
    await expect(field).toHaveText("");

    await field.evaluate((node) => {
      const target = node as HTMLElement;
      target.focus();
      const data = new DataTransfer();
      data.setData("text/plain", `а${"\n".repeat(1_000_000)}б`);
      target.dispatchEvent(new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: data }));
    });
    const pasted = await field.evaluate((node) => (node as HTMLElement).innerText);
    expect(pasted.length).toBeLessThan(20);
    expect(pasted).toContain("а");
    expect(pasted).toContain("б");
    await field.press("Enter");
    const pastedBubble = page.locator(".direct-bubble").filter({ hasText: "а" }).filter({ hasText: "б" });
    await expect(pastedBubble).toBeVisible();
    const pastedBreaks = await pastedBubble.evaluate((node) => node.querySelectorAll("br").length);
    expect(pastedBreaks).toBeLessThanOrEqual(2);

    const mark = page.getByRole("button", { name: "Отметить" });
    await expect(mark).toHaveCount(1);
    await mark.click();
    await expect(page.getByRole("button", { name: "Убрать отметку" })).toHaveCount(1);
    await page.getByRole("button", { name: "Убрать отметку" }).click();
    await expect(page.getByRole("button", { name: "Отметить" })).toHaveCount(1);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
