import { sql, type Kysely } from 'kysely';

/**
 * Inquiries from the public site and viewing rooms (stored on the person's collector profile and
 * shown to admins until dismissed), and the site-wide "known visitor" cookie's identities.
 * Rooms no longer have an inquiry email. Idempotent like the earlier migrations.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
-- A browser that identified itself (room gate or inquiry); only a hash of the cookie is stored.
CREATE TABLE IF NOT EXISTS visitor_identities (
  hash text PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS visitor_identities_person_idx ON visitor_identities (person_id);

CREATE TABLE IF NOT EXISTS inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  source text NOT NULL CHECK (source IN ('exhibition','slide','room')),
  exhibition_id uuid REFERENCES exhibitions(id) ON DELETE SET NULL,
  artwork_id uuid REFERENCES artworks(id) ON DELETE SET NULL,
  work_id uuid REFERENCES works(id) ON DELETE SET NULL,
  room_id uuid REFERENCES viewing_rooms(id) ON DELETE SET NULL,
  item jsonb NOT NULL DEFAULT '{}'::jsonb,   -- what they saw: title, artist, date, medium, dimensions, image, price, context
  page_url text,
  note text NOT NULL DEFAULT '' CHECK (length(note) <= 1000),
  entered_name text,
  entered_email text,
  match text NOT NULL CHECK (match IN ('email','alias','new','known')),
  seen_at timestamptz,
  seen_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inquiries_unseen_idx ON inquiries (created_at DESC) WHERE seen_at IS NULL;
CREATE INDEX IF NOT EXISTS inquiries_list_idx ON inquiries (created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS inquiries_person_idx ON inquiries (person_id, created_at DESC);

ALTER TABLE viewing_rooms DROP COLUMN IF EXISTS inquiry_email;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
DROP TABLE IF EXISTS inquiries, visitor_identities;
ALTER TABLE viewing_rooms ADD COLUMN IF NOT EXISTS inquiry_email text;
`.execute(db);
}
