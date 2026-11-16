import { randomBytes, scryptSync } from "node:crypto";

import postgres from "postgres";

import { scriptEnv } from "./app-db";
import { expect, test } from "./fixtures";

function legacyPasswordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

test("trainer contact fields stay wide enough to type on a phone", async ({ page }) => {
  test.setTimeout(60_000);
  const databaseUrl = scriptEnv().DATABASE_URL;
  expect(databaseUrl, "the dev server database").toBeTruthy();
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomBytes(3).toString("hex");
  const password = "Pa55word!";
  const email = `contacts.ui.${tag}@example.com`;
  const slug = `c${tag}`;
  const claim = randomBytes(8).toString("hex");
  let profileId: string | null = null;
  let ownerId: string | null = null;

  try {
    const hash = legacyPasswordHash(password);
    const [owner] = await sql<{ id: string }[]>`
      insert into users (email, password_hash, password_set_at, email_verified_at, first_name, last_name, status)
      values (${email}, ${hash}, now(), now(), 'Ольга', 'Котова', 'active')
      returning id
    `;
    ownerId = owner.id;
    await sql`insert into user_roles (user_id, role) values (${owner.id}, 'trainer')`;
    const [profile] = await sql<{ id: string }[]>`
      insert into trainer_profiles (
        slug, instagram_handle, source_url, status, owner_user_id,
        first_name, last_name, full_name, claim_token, claim_path
      ) values (
        ${slug}, ${slug}, ${`https://instagram.com/${slug}`}, 'published', ${owner.id},
        'Ольга', 'Котова', 'Ольга Котова', ${claim}, ${`/hi/${claim}`}
      ) returning id
    `;
    profileId = profile.id;

    await page.goto(`/auth/login?redirect=${encodeURIComponent("/me/profile")}`);
    const mail = page.getByPlaceholder("you@example.com");
    await mail.waitFor();
    await page.waitForFunction(() => {
      const input = document.querySelector('input[placeholder="you@example.com"]');
      return !!input && Object.keys(input).some((key) => key.startsWith("__reactFiber") || key.startsWith("__reactProps"));
    });
    await mail.pressSequentially(email);
    await page.getByPlaceholder("Введите пароль").pressSequentially(password);
    await page.locator("form.auth-form").getByRole("button", { name: "Войти" }).click();
    await page.waitForURL("**/me/profile");

    await page.setViewportSize({ width: 390, height: 844 });
    const block = page.locator("#trainer-contact-block");
    await block.scrollIntoViewIfNeeded();
    const phone = block.getByRole("textbox", { name: "Телефон" });
    const sms = block.getByRole("button", { name: "Подтвердить по SMS" });
    const telegram = block.getByRole("button", { name: "Добавить" });
    await expect(phone).toBeVisible();
    await expect(sms).toBeVisible();
    await expect(telegram).toBeVisible();
    await expect(block.getByText("Instagram", { exact: true })).toBeVisible();
    await expect(block.getByText("Почта", { exact: true })).toBeVisible();
    await expect(block.getByText(email)).toBeVisible();

    const phoneBox = await phone.boundingBox();
    const smsBox = await sms.boundingBox();
    expect(phoneBox, "phone field has a box").toBeTruthy();
    expect(smsBox, "sms button has a box").toBeTruthy();
    expect(phoneBox!.width, "phone field keeps room for the number").toBeGreaterThanOrEqual(220);
    expect(smsBox!.y, "the sms button sits under the phone field").toBeGreaterThanOrEqual(phoneBox!.y + phoneBox!.height - 2);
    expect(smsBox!.x + smsBox!.width, "the sms button stays inside the phone row").toBeLessThanOrEqual(phoneBox!.x + phoneBox!.width + 2);

    const contacts = page.locator("#trainer-contacts");
    await contacts.scrollIntoViewIfNeeded();
    for (const label of ["Instagram", "Telegram"]) {
      const field = contacts.getByRole("textbox", { name: new RegExp(label) });
      await expect(field).toBeVisible();
      const box = await field.boundingBox();
      expect(box!.width, `${label} field keeps room for a link`).toBeGreaterThanOrEqual(180);
    }

    await page.setViewportSize({ width: 1280, height: 800 });
    await block.scrollIntoViewIfNeeded();
    const widePhone = await phone.boundingBox();
    const wideSms = await sms.boundingBox();
    expect(widePhone!.width).toBeGreaterThanOrEqual(160);
    expect(Math.abs(wideSms!.y - widePhone!.y), "on a wide screen the button stays beside the field").toBeLessThanOrEqual(8);
  } finally {
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (ownerId) await sql`delete from users where id = ${ownerId}`;
    await sql.end({ timeout: 5 });
  }
});
