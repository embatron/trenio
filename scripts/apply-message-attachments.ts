import postgres from "postgres";

const STATEMENTS = [
  "ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_body_len",
  "ALTER TABLE messages ADD CONSTRAINT messages_body_len CHECK (char_length(btrim(body)) <= 12000)",
  `CREATE TABLE IF NOT EXISTS message_attachments (
    id uuid PRIMARY KEY,
    message_id bigint REFERENCES messages(id) ON DELETE CASCADE,
    conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    uploader_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id uuid NOT NULL,
    original_name text NOT NULL,
    mime text NOT NULL,
    byte_size integer NOT NULL,
    ext text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT message_attachments_size CHECK (byte_size BETWEEN 1 AND 5242880),
    CONSTRAINT message_attachments_name_len CHECK (char_length(original_name) BETWEEN 1 AND 180)
  )`,
  "CREATE INDEX IF NOT EXISTS message_attachments_message_idx ON message_attachments (message_id)",
  "CREATE INDEX IF NOT EXISTS message_attachments_client_idx ON message_attachments (conversation_id, client_id)",
  "ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE",
  `UPDATE message_reports AS report
   SET conversation_id = message.conversation_id
   FROM messages AS message
   WHERE report.message_id = message.id AND report.conversation_id IS NULL`,
  "ALTER TABLE message_reports ALTER COLUMN message_id DROP NOT NULL",
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM message_reports WHERE conversation_id IS NULL) THEN
       ALTER TABLE message_reports ALTER COLUMN conversation_id SET NOT NULL;
     END IF;
   END $$`,
  "CREATE UNIQUE INDEX IF NOT EXISTS message_reports_conversation_reporter_unique ON message_reports (conversation_id, reporter_id)",
  "ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS comment text",
  "ALTER TABLE message_reports ADD COLUMN IF NOT EXISTS reporter_side text",
  `UPDATE message_reports
   SET comment = 'Без комментария'
   WHERE comment IS NULL OR btrim(comment) = ''`,
  `UPDATE message_reports AS report
   SET reporter_side = CASE WHEN report.reporter_id = conversation.user_id THEN 'client' ELSE 'trainer' END
   FROM conversations AS conversation
   WHERE report.conversation_id = conversation.id
     AND report.reporter_side IS NULL`,
  `DO $$
   BEGIN
     IF NOT EXISTS (SELECT 1 FROM message_reports WHERE comment IS NULL OR reporter_side IS NULL) THEN
       ALTER TABLE message_reports ALTER COLUMN comment SET NOT NULL;
       ALTER TABLE message_reports ALTER COLUMN reporter_side SET NOT NULL;
     END IF;
   END $$`,
  "ALTER TABLE message_reports DROP CONSTRAINT IF EXISTS message_reports_comment_len",
  "ALTER TABLE message_reports ADD CONSTRAINT message_reports_comment_len CHECK (char_length(btrim(comment)) BETWEEN 1 AND 2000)",
  "ALTER TABLE message_reports DROP CONSTRAINT IF EXISTS message_reports_reporter_side",
  "ALTER TABLE message_reports ADD CONSTRAINT message_reports_reporter_side CHECK (reporter_side IN ('client', 'trainer'))",
  "COMMENT ON TABLE message_reports IS 'Жалоба на всю переписку. Одна строка на участника.'",
  "COMMENT ON COLUMN message_reports.conversation_id IS 'Переписка, на которую жалуются.'",
  "COMMENT ON COLUMN message_reports.reporter_id IS 'Аккаунт, который отправил жалобу.'",
  "COMMENT ON COLUMN message_reports.reporter_side IS 'client — клиент, открывший диалог. trainer — владелец профиля.'",
  "COMMENT ON COLUMN message_reports.reason IS 'Причина по-русски: Спам, Оскорбление, Нежелательный контакт, Другое.'",
  "COMMENT ON COLUMN message_reports.comment IS 'Комментарий того, кто пожаловался. Это не текст сообщения из чата.'",
  "COMMENT ON COLUMN message_reports.status IS 'new — новая, reviewed — разобрана, dismissed — отклонена.'",
  "COMMENT ON COLUMN message_reports.message_id IS 'Старая жалоба на одно сообщение. У жалобы на всю переписку пусто.'",
  "ALTER TABLE conversations ALTER COLUMN trainer_profile_id DROP NOT NULL",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS host_user_id uuid REFERENCES users(id) ON DELETE CASCADE",
  `UPDATE conversations AS conversation
   SET host_user_id = profile.owner_user_id,
       trainer_profile_id = NULL
   FROM trainer_profiles AS profile
   WHERE conversation.trainer_profile_id = profile.id
     AND profile.slug = 'trenioby'
     AND profile.owner_user_id IS NOT NULL`,
  "ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_party",
  `ALTER TABLE conversations ADD CONSTRAINT conversations_party CHECK (
     (trainer_profile_id IS NOT NULL AND host_user_id IS NULL)
     OR (trainer_profile_id IS NULL AND host_user_id IS NOT NULL)
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS conversations_open_portal_unique
   ON conversations (user_id, host_user_id)
   WHERE status = 'open' AND host_user_id IS NOT NULL`,
  "DELETE FROM trainer_profiles WHERE slug = 'trenioby'",
  `CREATE OR REPLACE FUNCTION reject_trenioby_trainer_slug() RETURNS trigger AS $$
   BEGIN
     IF NEW.slug = 'trenioby' THEN
       RAISE EXCEPTION 'trainer slug trenioby is reserved';
     END IF;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql`,
  "DROP TRIGGER IF EXISTS trainer_profiles_reject_trenioby ON trainer_profiles",
  `CREATE TRIGGER trainer_profiles_reject_trenioby
   BEFORE INSERT OR UPDATE OF slug ON trainer_profiles
   FOR EACH ROW EXECUTE FUNCTION reject_trenioby_trainer_slug()`,
  "COMMENT ON COLUMN conversations.host_user_id IS 'Админ портала в приветственном диалоге. Карточки тренера у этого диалога нет.'",
  "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_id bigint REFERENCES messages(id) ON DELETE SET NULL",
  "CREATE INDEX IF NOT EXISTS messages_reply_to_idx ON messages (reply_to_id)",
  "COMMENT ON COLUMN messages.reply_to_id IS 'Цитата: сообщение того же диалога, на которое ответили.'",
  `DELETE FROM conversations AS card
   WHERE card.trainer_profile_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM messages AS message WHERE message.conversation_id = card.id)
     AND NOT EXISTS (SELECT 1 FROM message_attachments AS file WHERE file.conversation_id = card.id)
     AND NOT EXISTS (SELECT 1 FROM message_reports AS report WHERE report.conversation_id = card.id)
     AND EXISTS (
       SELECT 1
       FROM conversations AS portal
       JOIN trainer_profiles AS profile ON profile.id = card.trainer_profile_id
       WHERE portal.host_user_id = card.user_id
         AND portal.user_id = profile.owner_user_id
         AND portal.status = 'open'
         AND portal.id <> card.id
     )`,
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_deleted_at timestamptz",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS peer_deleted_at timestamptz",
  "COMMENT ON COLUMN conversations.user_deleted_at IS 'Клиент удалил переписку у себя. У собеседника она остаётся.'",
  "COMMENT ON COLUMN conversations.peer_deleted_at IS 'Владелец профиля или админ портала удалил переписку у себя. У собеседника она остаётся.'",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS user_revived_at timestamptz",
  "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS peer_revived_at timestamptz",
  "COMMENT ON COLUMN conversations.user_revived_at IS 'Клиент снова открыл диалог после удаления у себя. Старые сообщения скрыты.'",
  "COMMENT ON COLUMN conversations.peer_revived_at IS 'Владелец профиля или админ портала снова открыл диалог после удаления у себя.'",
  `CREATE TABLE IF NOT EXISTS user_presence (
     user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     last_seen_at timestamptz NOT NULL,
     visible boolean NOT NULL DEFAULT false
   )`,
  "COMMENT ON TABLE user_presence IS 'Last open-page signal. Green is a visible tab, orange is hidden or seen within 10 minutes, gray is offline.'",
  "ALTER TABLE message_attachments DROP CONSTRAINT IF EXISTS message_attachments_size",
  "ALTER TABLE message_attachments ADD CONSTRAINT message_attachments_size CHECK (byte_size BETWEEN 1 AND 5242880)",
  `CREATE TABLE IF NOT EXISTS message_notices (
     conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
     recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     channel text NOT NULL,
     message_id bigint NOT NULL,
     due_at timestamptz NOT NULL,
     PRIMARY KEY (conversation_id, recipient_id, channel),
     CONSTRAINT message_notices_channel CHECK (channel IN ('push', 'letter'))
   )`,
  "COMMENT ON TABLE message_notices IS 'A message letter or browser notice waiting to be sent. The row outlives a process restart.'",
  `CREATE TABLE IF NOT EXISTS message_reactions (
     message_id bigint NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
     user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at timestamptz NOT NULL DEFAULT now(),
     PRIMARY KEY (message_id, user_id)
   )`,
  "COMMENT ON TABLE message_reactions IS 'One thumb from one account on one message. The sender does not mark their own text.'",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    for (const statement of STATEMENTS) await sql.unsafe(statement);
    console.info("message_attachments is ready.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
