import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

import { scriptEnv } from "../../../e2e/app-db";
import { AuthError } from "@/lib/auth/errors";
import {
  blockPair,
  deleteConversationForViewer,
  ensureConversation,
  listConversations,
  listMessages,
  unreadSummary,
  type MessageActor,
} from "@/lib/messages/service";

const databaseUrl = scriptEnv().DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

type Sql = ReturnType<typeof postgres>;

function has(items: { id: string }[], id: string) {
  return items.some((item) => item.id === id);
}

async function fixture(sql: Sql) {
  const tag = randomUUID().slice(0, 8);
  const clientId = randomUUID();
  const trainerId = randomUUID();
  const hostId = randomUUID();
  await sql`
    insert into users (id, email, password_hash, password_set_at, email_verified_at, first_name, last_name, status, mail_messages)
    values
      (${clientId}, ${`clear.client.${tag}@example.com`}, 'x', now(), now(), 'Иван', ${`Zz${tag}`}, 'active', false),
      (${trainerId}, ${`clear.trainer.${tag}@example.com`}, 'x', now(), now(), 'Мария', 'Соколова', 'active', false),
      (${hostId}, ${`clear.host.${tag}@example.com`}, 'x', now(), now(), 'Trenioby', '', 'active', false)
  `;
  await sql`
    insert into user_roles (user_id, role) values
      (${clientId}, 'user'),
      (${trainerId}, 'trainer'),
      (${hostId}, 'admin')
  `;
  const [profile] = await sql<{ id: string }[]>`
    insert into trainer_profiles (
      slug, instagram_handle, source_url, status, owner_user_id, first_name, last_name, full_name, claim_token, claim_path
    ) values (
      ${`c${tag}`}, ${`c${tag}`}, ${`https://instagram.com/c${tag}`}, 'published', ${trainerId},
      'Мария', 'Соколова', 'Мария Соколова', ${`c${tag}`}, ${`/hi/c${tag}`}
    ) returning id
  `;
  const [clientProfile] = await sql<{ id: string }[]>`
    insert into trainer_profiles (
      slug, instagram_handle, source_url, status, owner_user_id, first_name, last_name, full_name, claim_token, claim_path
    ) values (
      ${`k${tag}`}, ${`k${tag}`}, ${`https://instagram.com/k${tag}`}, 'published', ${clientId},
      'Иван', ${`Zz${tag}`}, ${`Иван Zz${tag}`}, ${`k${tag}`}, ${`/hi/k${tag}`}
    ) returning id
  `;
  const client: MessageActor = { id: clientId, roles: ["user"] };
  const trainer: MessageActor = { id: trainerId, roles: ["trainer"] };
  const host: MessageActor = { id: hostId, roles: ["admin"] };
  const staff: MessageActor = { id: randomUUID(), roles: ["admin"] };
  return { tag, clientId, trainerId, hostId, profileId: profile.id, clientProfileId: clientProfile.id, slug: `c${tag}`, clientSlug: `k${tag}`, client, trainer, host, staff };
}

async function cleanup(sql: Sql, ids: { clientId: string; trainerId: string; hostId: string; profileId: string; clientProfileId: string }) {
  const people = [ids.clientId, ids.trainerId, ids.hostId];
  await sql`delete from messages where sender_id in ${sql(people)} or conversation_id in (select id from conversations where user_id in ${sql(people)} or host_user_id in ${sql(people)})`;
  await sql`delete from conversations where user_id in ${sql(people)} or host_user_id in ${sql(people)}`;
  await sql`delete from trainer_profiles where id in (${ids.profileId}, ${ids.clientProfileId})`;
  await sql`delete from user_roles where user_id in ${sql(people)}`;
  await sql`delete from users where id in ${sql(people)}`;
}

test("an opened empty dialog stays with the opener and never appears for the other account", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const box = await fixture(sql);
  try {
    const opened = await ensureConversation(box.client, box.slug);
    const clientList = await listConversations(box.client, { view: "own", query: box.tag });
    const trainerList = await listConversations(box.trainer, { view: "inbox", query: box.tag });
    const staffList = await listConversations(box.staff, { view: "staff", query: box.tag });
    assert.equal(has(clientList.items, opened.conversationId), true);
    assert.equal(clientList.items.find((item) => item.id === opened.conversationId)?.preview ?? "", "");
    assert.equal(has(trainerList.items, opened.conversationId), false);
    assert.equal(has(staffList.items, opened.conversationId), true);

    const clientThread = await listMessages(box.client, { conversationId: opened.conversationId });
    const trainerThread = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(clientThread.listed, true);
    assert.equal(clientThread.messages.length, 0);
    assert.equal(clientThread.deletedByCounterpart, false);
    assert.equal(trainerThread.listed, false);
    assert.equal(trainerThread.messages.length, 0);
    assert.equal(trainerThread.deletedByCounterpart, false);
    assert.equal((await unreadSummary(box.trainerId)).inbox, 0);
    assert.equal((await unreadSummary(box.clientId)).notice, null);

    await assert.rejects(
      () => deleteConversationForViewer({ id: randomUUID(), roles: ["user"] }, opened.conversationId),
      (error: unknown) => error instanceof AuthError && error.code === "FORBIDDEN",
    );
    await deleteConversationForViewer(box.client, opened.conversationId);
    await deleteConversationForViewer(box.client, opened.conversationId);

    const afterClient = await listConversations(box.client, { view: "own", query: box.tag });
    const afterTrainer = await listConversations(box.trainer, { view: "inbox", query: box.tag });
    const afterStaff = await listConversations(box.staff, { view: "staff", query: box.tag });
    assert.equal(has(afterClient.items, opened.conversationId), false);
    assert.equal(has(afterTrainer.items, opened.conversationId), false);
    assert.equal(has(afterStaff.items, opened.conversationId), true);
    const cleared = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(cleared.listed, false);
    assert.equal(cleared.deletedByCounterpart, false);
    assert.equal(cleared.messages.length, 0);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from messages where conversation_id = ${opened.conversationId}`;
    assert.equal(n, 0);

    const again = await ensureConversation(box.client, box.slug);
    assert.equal(again.conversationId, opened.conversationId);
    const [{ rows }] = await sql<{ rows: number }[]>`
      select count(*)::int as rows from conversations
      where user_id = ${box.clientId} and trainer_profile_id = ${box.profileId}
    `;
    assert.equal(rows, 1);
    assert.equal(has((await listConversations(box.client, { view: "own", query: box.tag })).items, opened.conversationId), true);
    assert.equal(has((await listConversations(box.trainer, { view: "inbox", query: box.tag })).items, opened.conversationId), false);
    const draft = await listMessages(box.client, { conversationId: opened.conversationId });
    assert.equal(draft.listed, true);
    assert.equal(draft.messages.length, 0);
    assert.equal(draft.deletedByCounterpart, false);
  } finally {
    await cleanup(sql, box);
    await sql.end({ timeout: 5 });
  }
});

test("the other account sees an empty draft only after opening that person", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const box = await fixture(sql);
  try {
    const opened = await ensureConversation(box.client, box.slug);
    assert.equal(has((await listConversations(box.trainer, { view: "inbox", query: box.tag })).items, opened.conversationId), false);
    const fromTrainer = await ensureConversation(box.trainer, box.clientSlug);
    assert.equal(fromTrainer.conversationId, opened.conversationId);
    assert.equal(has((await listConversations(box.trainer, { view: "inbox", query: box.tag })).items, opened.conversationId), true);
    const thread = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(thread.listed, true);
    assert.equal(thread.deletedByCounterpart, false);
    assert.equal(thread.messages.length, 0);

    await deleteConversationForViewer(box.client, opened.conversationId);
    const kept = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(has((await listConversations(box.trainer, { view: "inbox", query: box.tag })).items, opened.conversationId), true);
    assert.equal(kept.deletedByCounterpart, false);
    assert.equal(kept.messages.length, 0);
    assert.equal(has((await listConversations(box.client, { view: "own", query: box.tag })).items, opened.conversationId), false);
  } finally {
    await cleanup(sql, box);
    await sql.end({ timeout: 5 });
  }
});

test("clearing a thread with history keeps it for the other side and hides it from search and unread", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const box = await fixture(sql);
  const word = `klyuch${box.tag}`;
  try {
    const opened = await ensureConversation(box.client, box.slug);
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id, created_at)
      values
        (${opened.conversationId}, ${box.trainerId}, 'Ответ', ${randomUUID()}, now() - interval '10 minutes'),
        (${opened.conversationId}, ${box.clientId}, ${word}, ${randomUUID()}, now() - interval '9 minutes')
    `;
    await sql`update conversations set status = 'closed', last_message_at = now() - interval '9 minutes' where id = ${opened.conversationId}`;

    assert.equal((await unreadSummary(box.trainerId)).inbox, 1);
    assert.equal((await unreadSummary(box.clientId)).own, 1);
    assert.equal((await unreadSummary(box.trainerId)).notice?.conversationId, opened.conversationId);

    await deleteConversationForViewer(box.client, opened.conversationId);

    const clientList = await listConversations(box.client, { view: "own", query: word });
    const trainerList = await listConversations(box.trainer, { view: "inbox", query: word });
    assert.equal(has(clientList.items, opened.conversationId), false);
    assert.equal(has(trainerList.items, opened.conversationId), true);
    assert.equal(trainerList.items.find((item) => item.id === opened.conversationId)?.preview.includes(word), true);

    const clientThread = await listMessages(box.client, { conversationId: opened.conversationId });
    const trainerThread = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(clientThread.listed, false);
    assert.equal(clientThread.messages.length, 0);
    assert.equal(clientThread.deletedByCounterpart, false);
    assert.equal(trainerThread.listed, true);
    assert.equal(trainerThread.messages.length, 2);
    assert.equal(trainerThread.deletedByCounterpart, true);
    assert.equal((await unreadSummary(box.clientId)).own, 0);
    assert.equal((await unreadSummary(box.trainerId)).inbox, 1);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from messages where conversation_id = ${opened.conversationId} and deleted_at is null`;
    assert.equal(n, 2);

    await sql`
      insert into messages (conversation_id, sender_id, body, client_id, created_at)
      values (${opened.conversationId}, ${box.trainerId}, 'После', ${randomUUID()}, now())
    `;
    const fresh = await listMessages(box.client, { conversationId: opened.conversationId });
    const kept = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(has((await listConversations(box.client, { view: "own" })).items, opened.conversationId), true);
    assert.deepEqual(fresh.messages.map((item) => item.body), ["После"]);
    assert.equal(fresh.deletedByCounterpart, false);
    assert.equal(fresh.listed, true);
    assert.equal(kept.messages.length, 3);
    assert.equal(kept.deletedByCounterpart, true);
    assert.equal((await unreadSummary(box.clientId)).own, 1);
    assert.equal(has((await listConversations(box.client, { view: "own", query: word })).items, opened.conversationId), false);
    assert.equal(has((await listConversations(box.trainer, { view: "inbox", query: word })).items, opened.conversationId), true);

    await deleteConversationForViewer(box.client, opened.conversationId);
    assert.equal(has((await listConversations(box.client, { view: "own" })).items, opened.conversationId), false);
    assert.equal((await listMessages(box.client, { conversationId: opened.conversationId })).messages.length, 0);
    assert.equal((await listMessages(box.trainer, { conversationId: opened.conversationId })).messages.length, 3);

    await deleteConversationForViewer(box.trainer, opened.conversationId);
    assert.equal(has((await listConversations(box.trainer, { view: "inbox", query: word })).items, opened.conversationId), false);
    const both = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(both.messages.length, 0);
    assert.equal(both.deletedByCounterpart, false);
    assert.equal(both.listed, false);
    assert.equal((await unreadSummary(box.trainerId)).inbox, 0);

    await sql`update conversations set status = 'open' where id = ${opened.conversationId}`;
    const restored = await ensureConversation(box.trainer, box.clientSlug);
    assert.equal(restored.conversationId, opened.conversationId);
    const trainerDraft = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(trainerDraft.listed, true);
    assert.equal(trainerDraft.messages.length, 0);
    assert.equal(trainerDraft.deletedByCounterpart, false);
    assert.equal((await listMessages(box.client, { conversationId: opened.conversationId })).listed, false);
  } finally {
    await cleanup(sql, box);
    await sql.end({ timeout: 5 });
  }
});

test("the profile owner can clear a thread, and a block does not erase the other side", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const box = await fixture(sql);
  try {
    const opened = await ensureConversation(box.client, box.slug);
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${opened.conversationId}, ${box.clientId}, 'Пакет', ${randomUUID()})
    `;
    await blockPair(box.trainer, opened.conversationId);
    await deleteConversationForViewer(box.trainer, opened.conversationId);

    assert.equal(has((await listConversations(box.trainer, { view: "inbox" })).items, opened.conversationId), false);
    const clientThread = await listMessages(box.client, { conversationId: opened.conversationId });
    assert.equal(clientThread.messages.map((item) => item.body).includes("Пакет"), true);
    assert.equal(clientThread.deletedByCounterpart, true);
    assert.equal(clientThread.blocked, true);
    assert.equal(clientThread.listed, true);
    assert.equal((await unreadSummary(box.clientId)).own, 0);
  } finally {
    await cleanup(sql, box);
    await sql.end({ timeout: 5 });
  }
});

test("a message that was removed does not leave a deleted-chat notice", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const box = await fixture(sql);
  try {
    const opened = await ensureConversation(box.client, box.slug);
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id, deleted_at)
      values (${opened.conversationId}, ${box.clientId}, 'Скрыто', ${randomUUID()}, now())
    `;
    await deleteConversationForViewer(box.client, opened.conversationId);
    const trainerThread = await listMessages(box.trainer, { conversationId: opened.conversationId });
    assert.equal(has((await listConversations(box.trainer, { view: "inbox", query: box.tag })).items, opened.conversationId), false);
    assert.equal(trainerThread.listed, false);
    assert.equal(trainerThread.deletedByCounterpart, false);
    assert.equal((await unreadSummary(box.trainerId)).inbox, 0);
  } finally {
    await cleanup(sql, box);
    await sql.end({ timeout: 5 });
  }
});

test("a portal welcome cannot be cleared by either side", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const box = await fixture(sql);
  try {
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, host_user_id, status, last_message_at)
      values (${box.trainerId}, ${box.hostId}, 'open', now())
      returning id
    `;
    await sql`
      insert into messages (conversation_id, sender_id, body, client_id)
      values (${conversation.id}, ${box.hostId}, 'Страница готова', ${randomUUID()})
    `;
    assert.equal(has((await listConversations(box.trainer, { view: "inbox" })).items, conversation.id), true);
    assert.equal(has((await listConversations(box.host, { view: "inbox" })).items, conversation.id), true);
    const refused = (error: unknown) => error instanceof AuthError && error.message.includes("администратором");
    await assert.rejects(() => deleteConversationForViewer(box.host, conversation.id), refused);
    await assert.rejects(() => deleteConversationForViewer(box.trainer, conversation.id), refused);
    const trainerThread = await listMessages(box.trainer, { conversationId: conversation.id });
    const hostThread = await listMessages(box.host, { conversationId: conversation.id });
    assert.equal(trainerThread.messages.length, 1);
    assert.equal(hostThread.messages.length, 1);
    assert.equal(trainerThread.canDelete, false);
    assert.equal(hostThread.canDelete, false);
    assert.equal(has((await listConversations(box.host, { view: "inbox" })).items, conversation.id), true);
    assert.equal(has((await listConversations(box.trainer, { view: "inbox" })).items, conversation.id), true);
  } finally {
    await cleanup(sql, box);
    await sql.end({ timeout: 5 });
  }
});

test("an empty portal draft does not show up for the host", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const box = await fixture(sql);
  try {
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, host_user_id, status)
      values (${box.trainerId}, ${box.hostId}, 'open')
      returning id
    `;
    assert.equal(has((await listConversations(box.trainer, { view: "inbox" })).items, conversation.id), true);
    assert.equal(has((await listConversations(box.host, { view: "inbox" })).items, conversation.id), false);
    await assert.rejects(
      () => deleteConversationForViewer(box.trainer, conversation.id),
      (error: unknown) => error instanceof AuthError && error.message.includes("администратором"),
    );
    const hostThread = await listMessages(box.host, { conversationId: conversation.id });
    assert.equal(has((await listConversations(box.host, { view: "inbox" })).items, conversation.id), false);
    assert.equal(has((await listConversations(box.trainer, { view: "inbox" })).items, conversation.id), true);
    assert.equal(hostThread.listed, false);
    assert.equal(hostThread.deletedByCounterpart, false);
    assert.equal(hostThread.messages.length, 0);
  } finally {
    await cleanup(sql, box);
    await sql.end({ timeout: 5 });
  }
});
