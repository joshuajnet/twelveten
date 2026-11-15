import { sql, type Kysely } from 'kysely';

/**
 * Viewing rooms (private hashed links to a set of works, with per-visitor engagement tracking),
 * alias emails for people, and dismissed duplicate pairs. Idempotent like the earlier migrations.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Extra emails a person is known by (merged duplicates, viewing-room sign-ups, typed by hand).
CREATE TABLE IF NOT EXISTS person_emails (
  email text PRIMARY KEY CHECK (email = lower(btrim(email)) AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','merge','viewing_room')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS person_emails_person_idx ON person_emails (person_id);

CREATE INDEX IF NOT EXISTS persons_email_lower_idx ON persons (lower(btrim(email))) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS persons_name_trgm_idx ON persons USING gin (lower(name) gin_trgm_ops);

-- Pairs an admin marked "not the same person" (a_id < b_id).
CREATE TABLE IF NOT EXISTS person_duplicate_dismissals (
  a_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  b_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (a_id, b_id),
  CHECK (a_id < b_id)
);

CREATE TABLE IF NOT EXISTS viewing_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE CHECK (token ~ '^[A-Za-z0-9_-]{43}$'),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  intro jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  show_prices boolean NOT NULL DEFAULT false,
  hide_unavailable boolean NOT NULL DEFAULT false,
  inquiry_email text CHECK (inquiry_email IS NULL OR inquiry_email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  created_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (opens_at IS NULL OR closes_at IS NULL OR closes_at > opens_at)
);
CREATE INDEX IF NOT EXISTS viewing_rooms_list_idx ON viewing_rooms (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS viewing_room_works (
  room_id uuid NOT NULL REFERENCES viewing_rooms(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE RESTRICT,
  position integer NOT NULL,
  show_price boolean,                        -- null: the room's show_prices
  hidden boolean NOT NULL DEFAULT false,
  PRIMARY KEY (room_id, work_id),
  CONSTRAINT viewing_room_works_position_uq UNIQUE (room_id, position) DEFERRABLE INITIALLY IMMEDIATE
);
CREATE INDEX IF NOT EXISTS viewing_room_works_work_idx ON viewing_room_works (work_id);

CREATE TABLE IF NOT EXISTS viewing_room_artists (
  room_id uuid NOT NULL REFERENCES viewing_rooms(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artist_profiles(person_id) ON DELETE CASCADE,
  position integer NOT NULL,
  show_bio boolean NOT NULL DEFAULT true,
  show_cv boolean NOT NULL DEFAULT true,
  show_press boolean NOT NULL DEFAULT true,
  hidden_press_ids uuid[] NOT NULL DEFAULT '{}',
  PRIMARY KEY (room_id, artist_id)
);

CREATE TABLE IF NOT EXISTS viewing_room_visitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES viewing_rooms(id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  entered_name text NOT NULL,
  entered_email text NOT NULL,
  match text NOT NULL CHECK (match IN ('email','alias','new')),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  visit_count integer NOT NULL DEFAULT 0,
  active_ms bigint NOT NULL DEFAULT 0,
  engagement integer NOT NULL DEFAULT 0 CHECK (engagement BETWEEN 0 AND 100),
  CONSTRAINT viewing_room_visitors_uq UNIQUE (room_id, person_id)
);
CREATE INDEX IF NOT EXISTS viewing_room_visitors_person_idx ON viewing_room_visitors (person_id);

-- Browsers remembered for a visitor (only a hash of the cookie is stored).
CREATE TABLE IF NOT EXISTS viewing_room_cookies (
  hash text PRIMARY KEY,
  visitor_id uuid NOT NULL REFERENCES viewing_room_visitors(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS viewing_room_cookies_visitor_idx ON viewing_room_cookies (visitor_id);

CREATE TABLE IF NOT EXISTS viewing_room_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL REFERENCES viewing_room_visitors(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  active_ms bigint NOT NULL DEFAULT 0,
  user_agent text
);
CREATE INDEX IF NOT EXISTS viewing_room_visits_visitor_idx ON viewing_room_visits (visitor_id, started_at DESC);

CREATE TABLE IF NOT EXISTS viewing_room_work_stats (
  visitor_id uuid NOT NULL REFERENCES viewing_room_visitors(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  view_ms bigint NOT NULL DEFAULT 0,
  hover_ms bigint NOT NULL DEFAULT 0,
  zoom_ms bigint NOT NULL DEFAULT 0,
  focus_count integer NOT NULL DEFAULT 0,
  zoom_count integer NOT NULL DEFAULT 0,
  max_zoom real NOT NULL DEFAULT 1,
  clicks integer NOT NULL DEFAULT 0,
  inquiries integer NOT NULL DEFAULT 0,
  visits_seen integer NOT NULL DEFAULT 0,
  last_visit_id uuid,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (visitor_id, work_id)
);

CREATE TABLE IF NOT EXISTS viewing_room_artist_stats (
  visitor_id uuid NOT NULL REFERENCES viewing_room_visitors(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artist_profiles(person_id) ON DELETE CASCADE,
  read_ms bigint NOT NULL DEFAULT 0,
  opens integer NOT NULL DEFAULT 0,
  cv_opens integer NOT NULL DEFAULT 0,
  press_clicks integer NOT NULL DEFAULT 0,
  PRIMARY KEY (visitor_id, artist_id)
);

CREATE TABLE IF NOT EXISTS viewing_room_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visit_id uuid NOT NULL REFERENCES viewing_room_visits(id) ON DELETE CASCADE,
  work_id uuid REFERENCES works(id) ON DELETE CASCADE,
  artist_id uuid REFERENCES artist_profiles(person_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('enter','view_mode','focus','zoom','click','inquire','artist_open','cv_open','cv_pdf','press_click')),
  at timestamptz NOT NULL DEFAULT now(),
  data jsonb
);
CREATE INDEX IF NOT EXISTS viewing_room_events_visit_idx ON viewing_room_events (visit_id, at);

-- Pointer samples over a work's image: packed little-endian uint16 x, uint16 y (0..65535 of the image box), uint8 zoom×10.
CREATE TABLE IF NOT EXISTS viewing_room_pointer (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id uuid NOT NULL REFERENCES viewing_room_visitors(id) ON DELETE CASCADE,
  visit_id uuid NOT NULL REFERENCES viewing_room_visits(id) ON DELETE CASCADE,
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  points bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS viewing_room_pointer_idx ON viewing_room_pointer (visitor_id, work_id);

ALTER TABLE content_revisions DROP CONSTRAINT IF EXISTS content_revisions_entity_check;
ALTER TABLE content_revisions ADD CONSTRAINT content_revisions_entity_check CHECK (entity IN
  ('exhibition','exhibition_event','artwork','news_post','press_item','home_page','person','artist_profile','work','viewing_room'));
ALTER TABLE content_revisions DROP CONSTRAINT IF EXISTS content_revisions_action_check;
ALTER TABLE content_revisions ADD CONSTRAINT content_revisions_action_check CHECK (action IN ('create','update','delete','restore','merge'));

DROP TRIGGER IF EXISTS viewing_rooms_updated_at ON viewing_rooms;
CREATE TRIGGER viewing_rooms_updated_at BEFORE UPDATE ON viewing_rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
DROP TABLE IF EXISTS viewing_room_pointer, viewing_room_events, viewing_room_artist_stats, viewing_room_work_stats,
  viewing_room_visits, viewing_room_cookies, viewing_room_visitors, viewing_room_artists, viewing_room_works, viewing_rooms,
  person_duplicate_dismissals, person_emails CASCADE;
DROP INDEX IF EXISTS persons_email_lower_idx;
DROP INDEX IF EXISTS persons_name_trgm_idx;
DELETE FROM content_revisions WHERE entity = 'viewing_room' OR action = 'merge';
ALTER TABLE content_revisions DROP CONSTRAINT IF EXISTS content_revisions_entity_check;
ALTER TABLE content_revisions ADD CONSTRAINT content_revisions_entity_check CHECK (entity IN
  ('exhibition','exhibition_event','artwork','news_post','press_item','home_page','person','artist_profile','work'));
ALTER TABLE content_revisions DROP CONSTRAINT IF EXISTS content_revisions_action_check;
ALTER TABLE content_revisions ADD CONSTRAINT content_revisions_action_check CHECK (action IN ('create','update','delete','restore'));
`.execute(db);
}
