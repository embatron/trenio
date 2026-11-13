import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

test("a pasted screenshot becomes an attachment", async ({ page, context }) => {
  test.setTimeout(90_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const hash = legacyPasswordHash("Pa55word!");
  const clientEmail = `paste.client.${tag}@example.com`;
  const ownerEmail = `paste.owner.${tag}@example.com`;
  const slug = `p${tag}`;
  let clientId: string | null = null;
  let ownerId: string | null = null;
  let profileId: string | null = null;

  try {
    const [client] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${clientEmail}, ${hash}, now(), now(), 'Читатель', 'Снимок', 'active')
      returning id
    `;
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${ownerEmail}, ${hash}, now(), now(), 'Тренер', 'Снимок', 'active')
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
        'Тренер', 'Снимок', 'Тренер Снимок', ${claim}, ${`/hi/${claim}`}
      )
      returning id
    `;
    profileId = profile.id;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, trainer_profile_id, status, last_message_at)
      values (${client.id}, ${profile.id}, 'open', now())
      returning id
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
    await field.click();
    await page.evaluate(async (png) => {
      const blob = await (await fetch(png)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    }, PNG);
    await field.press("Meta+v");

    const draft = page.locator(".direct-draft img");
    await expect(draft).toHaveCount(1);
    await expect(field).toBeFocused();
    const inline = await field.evaluate((node) => node.querySelectorAll("img").length);
    expect(inline).toBe(0);

    await field.press("Enter");
    await expect(page.locator(".direct-bubble img")).toBeVisible();
    await expect(draft).toHaveCount(0);
  } finally {
    await page.unrouteAll({ behavior: "ignoreErrors" }).catch(() => undefined);
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (clientId) await sql`delete from users where id = ${clientId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
