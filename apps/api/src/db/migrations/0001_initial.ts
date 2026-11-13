import { sql, type Kysely } from 'kysely';

/**
 * Initial schema. Every statement is idempotent (IF NOT EXISTS / guarded DO blocks)
 * so the migration can be re-run safely even without Kysely's bookkeeping table.
 * Enumerations are text + CHECK rather than Postgres enum types.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$ LANGUAGE plpgsql;

-- Better Auth (admin plugin). Column names follow Better Auth's camelCase defaults.
CREATE TABLE IF NOT EXISTS "user" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  image text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  banned boolean NOT NULL DEFAULT false,
  "banReason" text,
  "banExpires" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  "expiresAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "impersonatedBy" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS session_user_idx ON session ("userId");
CREATE TABLE IF NOT EXISTS account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  password text,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  scope text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS account_user_idx ON account ("userId");
CREATE TABLE IF NOT EXISTS verification (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier text NOT NULL,
  value text NOT NULL,
  "expiresAt" timestamptz NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "rateLimit" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  "lastRequest" bigint NOT NULL
);

-- Content
CREATE TABLE IF NOT EXISTS exhibitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text NOT NULL DEFAULT 'exhibition' CHECK (kind IN ('exhibition','fair')),
  artists_line text NOT NULL DEFAULT '',
  title text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Chicago',
  hours_text text,
  venue_text text,
  hero_image text,
  hero_alt text,
  thumbnail text,
  press_release_url text,
  works_available boolean NOT NULL DEFAULT false,
  content jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb
    CHECK (jsonb_typeof(content) = 'object' AND content->>'type' = 'doc'),
  seo_title text,
  seo_description text,
  og_image text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exhibitions_dates_chk CHECK (ends_on >= starts_on)
);
CREATE INDEX IF NOT EXISTS exhibitions_list_idx ON exhibitions (kind, published, starts_on DESC);

CREATE TABLE IF NOT EXISTS exhibition_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id uuid NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  label text NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT exhibition_events_time_chk CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS exhibition_events_idx ON exhibition_events (exhibition_id, position);

CREATE TABLE IF NOT EXISTS artworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exhibition_id uuid NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  position integer NOT NULL,
  image text NOT NULL,
  alt text NOT NULL DEFAULT '',
  author text,
  title text,
  date_text text,
  dimensions text,
  media text,
  credit text,
  hidden boolean NOT NULL DEFAULT false,
  available boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE artworks ADD CONSTRAINT artworks_position_uq
    UNIQUE (exhibition_id, position) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS news_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  body_html text NOT NULL DEFAULT '',
  seo_title text,
  seo_description text,
  og_image text,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS news_list_idx ON news_posts (published, published_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS press_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet text NOT NULL,
  title text NOT NULL,
  url text NOT NULL UNIQUE,
  published_on date NOT NULL,
  issue_label text,
  byline text,
  exhibition_id uuid REFERENCES exhibitions(id) ON DELETE SET NULL,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS press_list_idx ON press_items (published, published_on DESC, id DESC);
CREATE INDEX IF NOT EXISTS press_exhibition_idx ON press_items (exhibition_id);

CREATE TABLE IF NOT EXISTS home_page (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bg_image text NOT NULL,
  bg_image_mobile text,
  bg_focal_point text NOT NULL DEFAULT '50% 50%',
  headline text NOT NULL DEFAULT '',
  subline text NOT NULL DEFAULT '',
  extra_text text,
  starts_on date,
  ends_on date,
  text_color text NOT NULL DEFAULT 'black' CHECK (text_color IN ('black','white')),
  link_exhibition_id uuid REFERENCES exhibitions(id) ON DELETE SET NULL,
  seo_title text,
  seo_description text,
  og_image text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ops
CREATE TABLE IF NOT EXISTS content_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity text NOT NULL CHECK (entity IN ('exhibition','exhibition_event','artwork','news_post','press_item','home_page')),
  entity_id uuid,
  action text NOT NULL CHECK (action IN ('create','update','delete','restore')),
  snapshot jsonb NOT NULL,
  user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS revisions_entity_idx ON content_revisions (entity, entity_id, created_at DESC);

CREATE TABLE IF NOT EXISTS seed_state (
  key text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['exhibitions','exhibition_events','artworks','news_posts','press_items','home_page'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$s_updated_at ON %1$I', t);
    EXECUTE format('CREATE TRIGGER %1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
DROP TABLE IF EXISTS seed_state, content_revisions, home_page, press_items, news_posts,
  artworks, exhibition_events, exhibitions, "rateLimit", verification, account, session, "user" CASCADE;
DROP FUNCTION IF EXISTS set_updated_at();
`.execute(db);
}
