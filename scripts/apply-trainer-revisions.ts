import postgres from "postgres";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS trainer_revisions (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    profile_id uuid NOT NULL,
    slug varchar(30) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    actor_user_id uuid,
    source varchar(16) NOT NULL,
    kind varchar(8) NOT NULL,
    snapshot jsonb NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS trainer_revisions_profile_idx ON trainer_revisions (profile_id, id DESC)`,
  `CREATE OR REPLACE FUNCTION trainer_revision_snapshot(card trainer_profiles)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $fn$
  SELECT jsonb_build_object(
    'slug', card.slug,
    'instagram', card.instagram_handle,
    'status', CASE card.status
      WHEN 'draft' THEN 'черновик'
      WHEN 'published' THEN 'опубликована'
      WHEN 'hidden' THEN 'скрыта'
      WHEN 'archived' THEN 'снята'
      WHEN 'declined' THEN 'отказана'
      ELSE card.status::text
    END,
    'verified', CASE WHEN card.verified THEN 'да' ELSE 'нет' END,
    'unclear', CASE WHEN card.unclear_hold THEN 'да' ELSE 'нет' END,
    'firstName', card.first_name,
    'lastName', card.last_name,
    'headline', card.headline,
    'bio', card.bio,
    'sourceBio', card.source_bio,
    'about', coalesce((
      SELECT string_agg(item, E'\\n' ORDER BY ord)
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(card.about) = 'array' THEN card.about ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'pinned', coalesce((
      SELECT string_agg(coalesce(nullif(item->>'caption', ''), item->>'url', ''), E'\\n' ORDER BY ord)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(card.pinned_posts) = 'array' THEN card.pinned_posts ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'sports', coalesce((
      SELECT string_agg(coalesce(nullif(item->>'label', ''), item->>'slug', ''), ', ' ORDER BY ord)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(card.sports) = 'array' THEN card.sports ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'city', card.city,
    'district', card.district,
    'places', coalesce((
      SELECT string_agg(concat_ws(', ', nullif(item->>'city', ''), nullif(item->>'district', ''), nullif(item->>'address', '')), E'\\n' ORDER BY ord)
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(card.training_places) = 'array' THEN card.training_places ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'price', CASE WHEN card.price_from IS NULL THEN '' ELSE card.price_from::text END,
    'experience', card.experience_years::text,
    'phone', card.phone,
    'email', card.email,
    'instagramUrl', card.instagram_url,
    'telegram', card.telegram,
    'website', card.website,
    'formats', coalesce((
      SELECT string_agg(CASE item WHEN 'individual' THEN 'индивидуально' WHEN 'group' THEN 'группа' ELSE item END, ', ' ORDER BY ord)
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(card.formats) = 'array' THEN card.formats ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'audiences', coalesce((
      SELECT string_agg(CASE item WHEN 'adult' THEN 'для себя' WHEN 'teen' THEN 'подростки' WHEN 'kid' THEN 'дети' ELSE item END, ', ' ORDER BY ord)
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(card.audiences) = 'array' THEN card.audiences ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'languages', coalesce((
      SELECT string_agg(item, ', ' ORDER BY ord)
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(card.languages) = 'array' THEN card.languages ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'gender', CASE card.gender WHEN 'male' THEN 'мужской' WHEN 'female' THEN 'женский' ELSE '' END,
    'hidePhone', CASE WHEN card.hide_phone THEN 'да' ELSE 'нет' END,
    'hideInstagram', CASE WHEN card.hide_instagram THEN 'да' ELSE 'нет' END,
    'hideTelegram', CASE WHEN card.hide_telegram THEN 'да' ELSE 'нет' END,
    'hideEmail', CASE WHEN card.hide_email THEN 'да' ELSE 'нет' END,
    'photos', coalesce((
      SELECT string_agg(regexp_replace(item, '^.*/', ''), E'\\n' ORDER BY ord)
      FROM jsonb_array_elements_text(CASE WHEN jsonb_typeof(card.photos) = 'array' THEN card.photos ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), ''),
    'certificates', coalesce((
      SELECT string_agg(
        CASE
          WHEN jsonb_typeof(item) = 'string' THEN regexp_replace(item #>> '{}', '^.*/', '')
          ELSE coalesce(nullif(item->>'caption', ''), regexp_replace(coalesce(item->>'path', ''), '^.*/', ''))
        END,
        E'\\n' ORDER BY ord
      )
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(card.certificates) = 'array' THEN card.certificates ELSE '[]'::jsonb END)
        WITH ORDINALITY AS listed(item, ord)
    ), '')
  );
$fn$`,
  `CREATE OR REPLACE FUNCTION trainer_revision_capture()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  next_snapshot jsonb;
  prev_snapshot jsonb;
  actor_text text;
  actor uuid;
  src text;
  changed text[] := ARRAY[]::text[];
  field_key text;
  kind_text text;
  note text;
BEGIN
  IF to_regclass('public.trainer_revisions') IS NULL THEN
    RETURN NEW;
  END IF;

  next_snapshot := trainer_revision_snapshot(NEW);
  IF TG_OP = 'UPDATE' THEN
    prev_snapshot := trainer_revision_snapshot(OLD);
    IF next_snapshot IS NOT DISTINCT FROM prev_snapshot THEN
      RETURN NEW;
    END IF;
  END IF;

  src := current_setting('trenio.revision_source', true);
  IF src IS NULL OR src NOT IN ('admin', 'cabinet', 'sync', 'import', 'door') THEN
    src := 'write';
  END IF;

  actor_text := current_setting('trenio.revision_actor', true);
  IF actor_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    actor := actor_text::uuid;
  ELSE
    actor := NULL;
  END IF;

  kind_text := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
  IF TG_OP = 'INSERT' THEN
    FOR field_key IN SELECT jsonb_object_keys(next_snapshot) LOOP
      IF coalesce(next_snapshot ->> field_key, '') <> ''
        AND next_snapshot ->> field_key <> 'нет'
        AND next_snapshot ->> field_key <> '0' THEN
        changed := changed || field_key;
      END IF;
    END LOOP;
  ELSE
    FOR field_key IN SELECT jsonb_object_keys(next_snapshot) LOOP
      IF coalesce(prev_snapshot ->> field_key, '') IS DISTINCT FROM coalesce(next_snapshot ->> field_key, '') THEN
        changed := changed || field_key;
      END IF;
    END LOOP;
  END IF;

  INSERT INTO trainer_revisions (profile_id, slug, actor_user_id, source, kind, snapshot)
  VALUES (NEW.id, NEW.slug, actor, src, kind_text, next_snapshot);

  DELETE FROM trainer_revisions
  WHERE profile_id = NEW.id
    AND id NOT IN (
      SELECT id FROM trainer_revisions
      WHERE profile_id = NEW.id
      ORDER BY id DESC
      LIMIT 12
    );

  note := CASE src
    WHEN 'admin' THEN 'Карточка изменена в админке.'
    WHEN 'cabinet' THEN 'Карточка изменена в кабинете.'
    WHEN 'sync' THEN 'Карточка изменена синхронизацией.'
    WHEN 'import' THEN 'Карточка изменена импортом.'
    WHEN 'door' THEN 'Карточка изменена по короткой ссылке.'
    ELSE 'Карточка изменена.'
  END;

  IF to_regclass('public.app_logs') IS NOT NULL THEN
    BEGIN
      INSERT INTO app_logs (level, domain, action, outcome, message, actor_user_id, target, context)
      VALUES (
        'info', 'catalog', 'trainer.revision', 'success', note, actor, left(NEW.slug, 80),
        jsonb_build_object('source', src, 'kind', kind_text, 'fields', to_jsonb(changed))
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  IF to_regclass('public.trainer_journal') IS NOT NULL THEN
    BEGIN
      INSERT INTO trainer_journal (profile_id, actor_user_id, target, domain, action, outcome, level, message, context)
      VALUES (
        NEW.id, actor, left(NEW.slug, 80), 'catalog', 'trainer.revision', 'success', 'info', note,
        jsonb_build_object('source', src, 'kind', kind_text, 'fields', to_jsonb(changed))
      );
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$fn$`,
  `DROP TRIGGER IF EXISTS trainer_profiles_revision_trg ON trainer_profiles`,
  `CREATE TRIGGER trainer_profiles_revision_trg
    AFTER INSERT OR UPDATE ON trainer_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trainer_revision_capture()`,
  `INSERT INTO trainer_revisions (profile_id, slug, source, kind, snapshot)
   SELECT card.id, card.slug, 'write', 'baseline', trainer_revision_snapshot(card)
   FROM trainer_profiles AS card
   WHERE NOT EXISTS (
     SELECT 1 FROM trainer_revisions AS kept WHERE kept.profile_id = card.id
   )`,
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const sql = postgres(url, { max: 1 });
  try {
    for (const statement of STATEMENTS) {
      await sql.unsafe(statement);
    }
    console.info("trainer revisions keep 12 snapshots per card.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  console.error(message);
  process.exit(1);
});
