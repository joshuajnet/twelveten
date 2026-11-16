import { sql, type Kysely } from 'kysely';

/**
 * Room PDF export: an optional subtitle (shown under the room title and on the PDF cover), an
 * optional cover image for the PDF, an optional bio page background per artist, the PDFs admins generate (stored in the media bucket under
 * `exports/`; the newest is the one offered), and the `room_pdf` visitor event. Idempotent like the
 * earlier migrations.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
ALTER TABLE viewing_rooms ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE viewing_rooms ADD COLUMN IF NOT EXISTS cover_image text;
-- Admins can keep a generated PDF but stop offering it to visitors.
ALTER TABLE viewing_rooms ADD COLUMN IF NOT EXISTS pdf_hidden boolean NOT NULL DEFAULT false;
-- Background of the artist's bio page in the room PDF: a full-bleed photo, or a solid colour.
ALTER TABLE viewing_room_artists ADD COLUMN IF NOT EXISTS bio_background text;
ALTER TABLE viewing_room_artists ADD COLUMN IF NOT EXISTS bio_background_color text
  CHECK (bio_background_color ~ '^#[0-9a-f]{6}$');

CREATE TABLE IF NOT EXISTS viewing_room_pdfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES viewing_rooms(id) ON DELETE CASCADE,
  s3_key text NOT NULL UNIQUE,
  filename text NOT NULL,
  bytes integer NOT NULL CHECK (bytes > 0),
  content_hash text NOT NULL,           -- what it shows; compared with the room now to flag an outdated PDF
  created_by uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz              -- removed by an admin: no longer offered; the file is pruned with the others
);
ALTER TABLE viewing_room_pdfs ADD COLUMN IF NOT EXISTS withdrawn_at timestamptz;
CREATE INDEX IF NOT EXISTS viewing_room_pdfs_room_idx ON viewing_room_pdfs (room_id, created_at DESC);

ALTER TABLE viewing_room_events DROP CONSTRAINT IF EXISTS viewing_room_events_type_check;
ALTER TABLE viewing_room_events ADD CONSTRAINT viewing_room_events_type_check CHECK (type IN
  ('enter','view_mode','focus','zoom','click','inquire','artist_open','cv_open','cv_pdf','press_click','room_pdf'));
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
DROP TABLE IF EXISTS viewing_room_pdfs;
DELETE FROM viewing_room_events WHERE type = 'room_pdf';
ALTER TABLE viewing_room_events DROP CONSTRAINT IF EXISTS viewing_room_events_type_check;
ALTER TABLE viewing_room_events ADD CONSTRAINT viewing_room_events_type_check CHECK (type IN
  ('enter','view_mode','focus','zoom','click','inquire','artist_open','cv_open','cv_pdf','press_click'));
ALTER TABLE viewing_rooms DROP COLUMN IF EXISTS subtitle;
ALTER TABLE viewing_rooms DROP COLUMN IF EXISTS cover_image;
ALTER TABLE viewing_rooms DROP COLUMN IF EXISTS pdf_hidden;
ALTER TABLE viewing_room_artists DROP COLUMN IF EXISTS bio_background;
ALTER TABLE viewing_room_artists DROP COLUMN IF EXISTS bio_background_color;
`.execute(db);
}
