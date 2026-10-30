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
    CONSTRAINT message_attachments_size CHECK (byte_size BETWEEN 1 AND 2097152),
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
