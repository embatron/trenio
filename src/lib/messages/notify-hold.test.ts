import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

import { scriptEnv } from "../../../e2e/app-db";
import { deliverMessageNotice } from "@/lib/messages/notify";
import { forgetPresence, presenceFor, recordPresence } from "@/lib/messages/presence";
import { sendMessage, type MessageActor } from "@/lib/messages/service";

const databaseUrl = scriptEnv().DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

const WAITING = "Письмо о сообщении ждёт, пока человек не выйдет из сети.";
const UNVERIFIED = "Письмо о сообщении не отправлено: почта не подтверждена.";
const PUSH_OFF = "Уведомление в браузере не отправлено: выключено в настройках.";

async function logCount(sql: postgres.Sql, target: string, message: string) {
  const [row] = await sql<{ count: number }[]>`
    select count(*)::int as count from app_logs where target = ${target} and message = ${message}
  `;
  return row?.count ?? 0;
}

async function waitForLog(sql: postgres.Sql, target: string, message: string) {
  const started = Date.now();
  while (Date.now() - started < 4_000) {
    if (await logCount(sql, target, message)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.fail(`journal row missing: ${message}`);
}

test("a letter and a browser notice wait while the person is online, and a reply marks the thread read", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomUUID().slice(0, 8);
  const hostId = randomUUID();
  const trainerId = randomUUID();
  const awayId = randomUUID();
  const socket = {};
  let conversationId: string | null = null;
  try {
    await sql`
      insert into users (id, email, password_hash, password_set_at, first_name, last_name, status, mail_messages, push_messages)
      values
        (${hostId}, ${`hold.host.${tag}@example.com`}, 'x', now(), 'Админ', 'Холд', 'active', false, false),
        (${trainerId}, ${`hold.trainer.${tag}@example.com`}, 'x', now(), 'Писарь', ${tag}, 'active', false, false),
        (${awayId}, ${`hold.away.${tag}@example.com`}, 'x', now(), 'Гость', 'Тихий', 'active', false, false)
    `;
    await sql`
      insert into user_roles (user_id, role) values
        (${hostId}, 'admin'),
        (${trainerId}, 'trainer'),
        (${awayId}, 'user')
    `;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, host_user_id, status, last_message_at)
      values (${trainerId}, ${hostId}, 'open', now())
      returning id
    `;
    conversationId = conversation.id;
    const [incoming] = await sql<{ id: string }[]>`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${trainerId}, '<p>Первая строка</p>', ${randomUUID()})
      returning id
    `;
    const incomingId = Number(incoming.id);

    recordPresence(hostId, socket, true);
    assert.equal((await presenceFor([hostId])).get(hostId), "online");
    await deliverMessageNotice({
      conversationId: conversation.id,
      messageId: incomingId,
      recipientId: hostId,
      channel: "letter",
    });
    await deliverMessageNotice({
      conversationId: conversation.id,
      messageId: incomingId,
      recipientId: hostId,
      channel: "push",
    });
    await waitForLog(sql, conversation.id, WAITING);
    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(await logCount(sql, conversation.id, PUSH_OFF), 0);
    assert.equal(await logCount(sql, conversation.id, UNVERIFIED), 0);

    const host: MessageActor = { id: hostId, roles: ["admin"] };
    const sent = await sendMessage(host, {
      conversationId: conversation.id,
      body: "Ответ администратора",
      clientId: randomUUID(),
    });
    const [cursor] = await sql<{ messageId: string }[]>`
      select last_read_message_id as "messageId"
      from conversation_reads
      where conversation_id = ${conversation.id} and user_id = ${hostId}
    `;
    assert.ok(cursor);
    assert.equal(Number(cursor.messageId), sent.message.id);
    assert.ok(Number(cursor.messageId) >= incomingId);

    const [quiet] = await sql<{ id: string }[]>`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${trainerId}, '<p>Уже прочитано</p>', ${randomUUID()})
      returning id
    `;
    const quietId = Number(quiet.id);
    await sql`
      insert into conversation_reads (conversation_id, user_id, last_read_message_id)
      values (${conversation.id}, ${awayId}, ${quietId})
    `;
    const before = await logCount(sql, conversation.id, UNVERIFIED);
    await deliverMessageNotice({
      conversationId: conversation.id,
      messageId: quietId,
      recipientId: awayId,
      channel: "letter",
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await logCount(sql, conversation.id, UNVERIFIED), before);

    const [fresh] = await sql<{ id: string }[]>`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${trainerId}, '<p>Человека нет</p>', ${randomUUID()})
      returning id
    `;
    await deliverMessageNotice({
      conversationId: conversation.id,
      messageId: Number(fresh.id),
      recipientId: awayId,
      channel: "letter",
    });
    await waitForLog(sql, conversation.id, UNVERIFIED);
  } finally {
    forgetPresence(hostId, socket);
    if (conversationId) await sql`delete from conversations where id = ${conversationId}`;
    await sql`delete from users where id in (${hostId}, ${trainerId}, ${awayId})`;
    await sql.end({ timeout: 5 });
  }
});
