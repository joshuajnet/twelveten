import { sql, type Kysely } from 'kysely';

/**
 * Crops for the room PDF's full-page photos: the area of the cover image and of each artist's bio
 * photo to show, as fractions `{x, y, w, h}` of the image as displayed. Null: centred, filling the
 * page. Idempotent like the earlier migrations.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
ALTER TABLE viewing_rooms ADD COLUMN IF NOT EXISTS cover_crop jsonb;
ALTER TABLE viewing_room_artists ADD COLUMN IF NOT EXISTS bio_background_crop jsonb;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
ALTER TABLE viewing_rooms DROP COLUMN IF EXISTS cover_crop;
ALTER TABLE viewing_room_artists DROP COLUMN IF EXISTS bio_background_crop;
`.execute(db);
}
