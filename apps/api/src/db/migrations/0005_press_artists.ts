import { sql, type Kysely } from 'kysely';

/**
 * Press linked straight to an artist: coverage that isn't about one of our exhibitions (or that
 * should show for an artist whatever the exhibition). Press about an exhibition reaches its
 * artists through exhibition_artists and needs no row here. Idempotent like the earlier migrations.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
CREATE TABLE IF NOT EXISTS press_artists (
  press_item_id uuid NOT NULL REFERENCES press_items(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artist_profiles(person_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (press_item_id, artist_id)
);
CREATE INDEX IF NOT EXISTS press_artists_artist_idx ON press_artists (artist_id);
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS press_artists;`.execute(db);
}
