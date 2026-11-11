import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import postgres from "postgres";

import { scriptEnv } from "../../../e2e/app-db";
import { AuthError } from "@/lib/auth/errors";
import { messageFilePath, removeConversationFiles } from "@/lib/messages/attachment-store";
import { sendMessage, uploadMessageFile, type MessageActor } from "@/lib/messages/service";

const databaseUrl = scriptEnv().DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const pixel = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

function dataUrl(bytes: Buffer, mime: string) {
  return `data:${mime};base64,${bytes.toString("base64")}`;
}

test("twelve parallel sends keep ten, drop an invisible body, and refuse a broken picture", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomUUID().slice(0, 8);
  const slug = `u${tag}`;
  const actorId = randomUUID();
  let profileId: string | null = null;
  let conversationId: string | null = null;
  const crashes: unknown[] = [];
  const onCrash = (reason: unknown) => {
    crashes.push(reason);
  };
  process.on("unhandledRejection", onCrash);
  try {
    await assert.rejects(
      () => sendMessage({ id: actorId, roles: ["user"] }, { body: "привет", clientId: "not-a-uuid" }),
      (error: unknown) => error instanceof AuthError && error.message === "Некорректный идентификатор сообщения.",
    );

    await sql`
      insert into users (id, email, password_hash, password_set_at, email_verified_at, first_name, last_name, status, mail_messages)
      values (${actorId}, ${`rate.${tag}@example.com`}, 'x', now(), now(), 'Проверка', 'Лимита', 'active', false)
    `;
    const [profile] = await sql<{ id: string }[]>`
      insert into trainer_profiles (
        slug, instagram_handle, source_url, status, first_name, last_name, full_name, claim_token, claim_path
      ) values (
        ${slug}, ${slug}, ${`https://instagram.com/${slug}`}, 'published',
        'Тренер', 'Лимита', 'Тренер Лимита', ${tag}, ${`/hi/${tag}`}
      ) returning id
    `;
    profileId = profile.id;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, trainer_profile_id, status, last_message_at)
      values (${actorId}, ${profile.id}, 'open', now())
      returning id
    `;
    conversationId = conversation.id;
    await sql`insert into user_roles (user_id, role) values (${actorId}, 'user')`;
    const actor: MessageActor = { id: actorId, roles: ["user"] };

    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, index) =>
        sendMessage(actor, {
          conversationId: conversation.id,
          body: `ряд ${index}`,
          clientId: randomUUID(),
        }),
      ),
    );
    await new Promise((resolve) => setTimeout(resolve, 30));
    const ok = results.filter((item) => item.status === "fulfilled");
    const limited = results.filter(
      (item) => item.status === "rejected" && item.reason instanceof AuthError && item.reason.code === "RATE_LIMITED",
    );
    const other = results.filter((item) => item.status === "rejected" && !(item.reason instanceof AuthError && item.reason.code === "RATE_LIMITED"));
    assert.deepEqual(
      other.map((item) => (item.status === "rejected" && item.reason instanceof Error ? item.reason.message : "unknown")),
      [],
    );
    assert.equal(ok.length, 10);
    assert.equal(limited.length, 2);
    assert.equal(crashes.length, 0);

    await assert.rejects(
      () => sendMessage(actor, { conversationId: conversation.id, body: "\u200B\u200C\u200D\uFEFF", clientId: randomUUID() }),
      (error: unknown) => error instanceof AuthError && error.message === "Введите сообщение.",
    );
    const [stored] = await sql<{ count: number }[]>`
      select count(*)::int as count from messages where conversation_id = ${conversation.id}
    `;
    assert.equal(stored.count, 10);

    const brokenId = randomUUID();
    await assert.rejects(
      () => uploadMessageFile(actor, {
        id: brokenId,
        conversationId: conversation.id,
        clientId: randomUUID(),
        fileName: "pixel.gif",
        dataUrl: dataUrl(Buffer.from("GIF89a<script>alert(1)</script>"), "image/gif"),
      }),
      (error: unknown) => error instanceof AuthError && error.message === "Можно прикрепить фото (JPG, PNG, WEBP, GIF) или PDF.",
    );
    const [brokenRows] = await sql<{ count: number }[]>`
      select count(*)::int as count from message_attachments where id = ${brokenId}
    `;
    assert.equal(brokenRows.count, 0);
    assert.equal(existsSync(messageFilePath(conversation.id, brokenId, "gif")), false);

    const keptId = randomUUID();
    const keptClient = randomUUID();
    const saved = await uploadMessageFile(actor, {
      id: keptId,
      conversationId: conversation.id,
      clientId: keptClient,
      fileName: "pixel.gif",
      dataUrl: dataUrl(pixel, "image/gif"),
    });
    assert.equal(saved.id, keptId);
    assert.equal(existsSync(messageFilePath(conversation.id, keptId, "gif")), true);
  } finally {
    process.off("unhandledRejection", onCrash);
    if (conversationId) await removeConversationFiles(conversationId);
    if (conversationId) await sql`delete from conversations where id = ${conversationId}`;
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    await sql`delete from auth_rate_buckets where bucket_key in (${`msg:min:${actorId}`}, ${`msg:day:${actorId}`}, ${`msg:file:${actorId}`})`;
    await sql`delete from app_logs where actor_user_id = ${actorId}`;
    await sql`delete from user_roles where user_id = ${actorId}`;
    await sql`delete from users where id = ${actorId}`;
    await sql.end({ timeout: 5 });
  }
});
