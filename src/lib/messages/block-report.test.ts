import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import test from "node:test";

import postgres from "postgres";

import { scriptEnv } from "../../../e2e/app-db";
import { AuthError } from "@/lib/auth/errors";
import { blockPair, listReports, reportMessage, sendMessage, unblockPair, type MessageActor } from "@/lib/messages/service";

const databaseUrl = scriptEnv().DATABASE_URL;
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;

test("reports from both sides survive a burst, and a block stops only that trainer", async () => {
  assert.ok(databaseUrl, "the dev server database");
  const sql = postgres(databaseUrl!, { max: 1 });
  const tag = randomUUID().slice(0, 8);
  const clientId = randomUUID();
  const trainerId = randomUUID();
  const otherTrainerId = randomUUID();
  const ids = [clientId, trainerId, otherTrainerId];
  let profileId: string | null = null;
  let otherProfileId: string | null = null;
  let conversationId: string | null = null;
  let otherConversationId: string | null = null;
  const crashes: unknown[] = [];
  const onCrash = (reason: unknown) => {
    crashes.push(reason);
  };
  process.on("unhandledRejection", onCrash);
  try {
    await sql`
      insert into users (id, email, password_hash, password_set_at, email_verified_at, first_name, last_name, status, mail_messages)
      values
        (${clientId}, ${`block.client.${tag}@example.com`}, 'x', now(), now(), 'Иван', 'Орлов', 'active', false),
        (${trainerId}, ${`block.trainer.${tag}@example.com`}, 'x', now(), now(), 'Мария', 'Соколова', 'active', false),
        (${otherTrainerId}, ${`block.other.${tag}@example.com`}, 'x', now(), now(), 'Ольга', 'Лебедева', 'active', false)
    `;
    await sql`
      insert into user_roles (user_id, role) values
        (${clientId}, 'user'),
        (${trainerId}, 'trainer'),
        (${otherTrainerId}, 'trainer')
    `;
    const [profile] = await sql<{ id: string }[]>`
      insert into trainer_profiles (
        slug, instagram_handle, source_url, status, owner_user_id, first_name, last_name, full_name, claim_token, claim_path
      ) values (
        ${`m${tag}`}, ${`m${tag}`}, ${`https://instagram.com/m${tag}`}, 'published', ${trainerId},
        'Мария', 'Соколова', 'Мария Соколова', ${`m${tag}`}, ${`/hi/m${tag}`}
      ) returning id
    `;
    const [otherProfile] = await sql<{ id: string }[]>`
      insert into trainer_profiles (
        slug, instagram_handle, source_url, status, owner_user_id, first_name, last_name, full_name, claim_token, claim_path
      ) values (
        ${`o${tag}`}, ${`o${tag}`}, ${`https://instagram.com/o${tag}`}, 'published', ${otherTrainerId},
        'Ольга', 'Лебедева', 'Ольга Лебедева', ${`o${tag}`}, ${`/hi/o${tag}`}
      ) returning id
    `;
    profileId = profile.id;
    otherProfileId = otherProfile.id;
    const [conversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, trainer_profile_id, status, last_message_at)
      values (${clientId}, ${profile.id}, 'open', now())
      returning id
    `;
    const [otherConversation] = await sql<{ id: string }[]>`
      insert into conversations (user_id, trainer_profile_id, status, last_message_at)
      values (${clientId}, ${otherProfile.id}, 'open', now())
      returning id
    `;
    conversationId = conversation.id;
    otherConversationId = otherConversation.id;

    const client: MessageActor = { id: clientId, roles: ["user"] };
    const trainer: MessageActor = { id: trainerId, roles: ["trainer"] };
    const staff: MessageActor = { id: randomUUID(), roles: ["admin"] };
    const stranger: MessageActor = { id: randomUUID(), roles: ["user"] };

    const clientComment = "После отказа он пишет дальше. %% «хватит»";
    const trainerComment = "Он не останавливается, хотя я просила прекратить";
    const [clientBurst, trainerBurst] = await Promise.all([
      Promise.allSettled(Array.from({ length: 20 }, () => reportMessage(client, {
        conversationId: conversation.id,
        reason: "contact",
        comment: clientComment,
      }))),
      Promise.allSettled(Array.from({ length: 20 }, () => reportMessage(trainer, {
        conversationId: conversation.id,
        reason: "abuse",
        comment: trainerComment,
      }))),
    ]);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(clientBurst.filter((item) => item.status === "rejected").length, 0);
    assert.equal(trainerBurst.filter((item) => item.status === "rejected").length, 0);
    const fresh = [...clientBurst, ...trainerBurst].filter((item) => item.status === "fulfilled" && item.value.duplicate === false);
    assert.equal(fresh.length, 2);

    const queued = (await listReports(staff)).filter((row) => row.conversationId === conversation.id);
    assert.equal(queued.length, 2);
    assert.deepEqual(queued.map((row) => row.reporterSide).sort(), ["client", "trainer"]);
    assert.equal(queued.every((row) => row.status === "new" && row.messageId == null), true);
    assert.equal(queued.some((row) => row.comment === clientComment && row.reason === "Нежелательный контакт"), true);
    assert.equal(queued.some((row) => row.comment === trainerComment && row.reason === "Оскорбление" && row.trainerName === "Мария Соколова"), true);

    await assert.rejects(
      () => blockPair(stranger, conversation.id),
      (error: unknown) => error instanceof AuthError && error.code === "FORBIDDEN",
    );
    const blocks = await Promise.allSettled([
      ...Array.from({ length: 15 }, () => blockPair(trainer, conversation.id)),
      ...Array.from({ length: 5 }, () => blockPair(client, conversation.id)),
    ]);
    assert.equal(blocks.filter((item) => item.status === "rejected").length, 0);
    assert.equal(crashes.length, 0);

    const pairs = await sql<{ trainer_profile_id: string }[]>`
      select trainer_profile_id from blocked_pairs where user_id = ${clientId}
    `;
    assert.deepEqual(pairs.map((row) => row.trainer_profile_id), [profile.id]);
    const [clientRow] = await sql<{ status: string }[]>`select status from users where id = ${clientId}`;
    const [trainerRow] = await sql<{ status: string }[]>`select status from users where id = ${trainerId}`;
    assert.equal(clientRow.status, "active");
    assert.equal(trainerRow.status, "active");
    const [closed] = await sql<{ status: string }[]>`select status from conversations where id = ${conversation.id}`;
    const [stillOpen] = await sql<{ status: string }[]>`select status from conversations where id = ${otherConversation.id}`;
    assert.equal(closed.status, "closed");
    assert.equal(stillOpen.status, "open");
    const reviewed = (await listReports(staff)).filter((row) => row.conversationId === conversation.id);
    assert.equal(reviewed.length, 2);
    assert.equal(reviewed.every((row) => row.status === "reviewed"), true);

    await assert.rejects(
      () => sendMessage(client, { conversationId: conversation.id, body: "ещё одно", clientId: randomUUID() }),
      (error: unknown) => error instanceof AuthError,
    );
    await assert.rejects(
      () => sendMessage(trainer, { conversationId: conversation.id, body: "ответ", clientId: randomUUID() }),
      (error: unknown) => error instanceof AuthError,
    );
    const delivered = await sendMessage(client, {
      conversationId: otherConversation.id,
      body: "здравствуйте",
      clientId: randomUUID(),
    });
    assert.equal(delivered.duplicate, false);
    const [kept] = await sql<{ count: number }[]>`
      select count(*)::int as count from messages where conversation_id = ${conversation.id}
    `;
    const [otherKept] = await sql<{ count: number }[]>`
      select count(*)::int as count from messages where conversation_id = ${otherConversation.id}
    `;
    assert.equal(kept.count, 0);
    assert.equal(otherKept.count, 1);
    await unblockPair(trainer, conversation.id);
    const [openAgain] = await sql<{ status: string }[]>`
      select status from conversations where id = ${conversation.id}
    `;
    const [pairsLeft] = await sql<{ count: number }[]>`
      select count(*)::int as count from blocked_pairs where user_id = ${clientId}
    `;
    assert.equal(openAgain.status, "open");
    assert.equal(pairsLeft.count, 0);
    const resumed = await sendMessage(client, {
      conversationId: conversation.id,
      body: "можно снова",
      clientId: randomUUID(),
    });
    assert.equal(resumed.duplicate, false);
  } finally {
    process.off("unhandledRejection", onCrash);
    if (conversationId) await sql`delete from conversations where id = ${conversationId}`;
    if (otherConversationId) await sql`delete from conversations where id = ${otherConversationId}`;
    if (profileId) await sql`delete from trainer_profiles where id = ${profileId}`;
    if (otherProfileId) await sql`delete from trainer_profiles where id = ${otherProfileId}`;
    await sql`delete from auth_rate_buckets where bucket_key in (${`msg:min:${clientId}`}, ${`msg:day:${clientId}`}, ${`msg:min:${trainerId}`}, ${`msg:day:${trainerId}`})`;
    if (conversationId || otherConversationId) {
      await sql`delete from app_logs where target in (${conversationId ?? randomUUID()}, ${otherConversationId ?? randomUUID()})`;
    }
    await sql`delete from app_logs where actor_user_id in ${sql(ids)}`;
    await sql`delete from user_roles where user_id in ${sql(ids)}`;
    await sql`delete from users where id in ${sql(ids)}`;
    await sql.end({ timeout: 5 });
  }
});
