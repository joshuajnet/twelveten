import { sql, type Kysely } from 'kysely';

/**
 * People (the core record), profiles attached to them (artist first), structured addresses that
 * can be attached to any entity, and the works inventory with its change history.
 * Idempotent like 0001: safe to re-run.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
CREATE TABLE IF NOT EXISTS persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  sort_name text,                            -- e.g. 'Africh, Noelle'; falls back to name
  birth_date date,
  birth_place text,
  email text CHECK (email IS NULL OR email ~ '^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'),
  phone text,
  website text,
  portrait text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS persons_sort_idx ON persons (lower(coalesce(sort_name, name)), id);

-- Artist profile: one per person at most. Future roles follow the same shape.
CREATE TABLE IF NOT EXISTS artist_profiles (
  person_id uuid PRIMARY KEY REFERENCES persons(id) ON DELETE RESTRICT,
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  bio jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  cv jsonb NOT NULL DEFAULT '{"type":"doc","content":[]}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Structured addresses, attachable to any entity through address_links.
CREATE TABLE IF NOT EXISTS addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line1 text NOT NULL DEFAULT '',
  line2 text,
  city text,
  region text,
  postal_code text,
  country text NOT NULL DEFAULT 'US' CHECK (country ~ '^[A-Z]{2}$'),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS address_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_id uuid NOT NULL REFERENCES addresses(id) ON DELETE CASCADE,
  entity text NOT NULL CHECK (entity IN ('person')),
  entity_id uuid NOT NULL,
  label text,
  is_primary boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT address_links_uq UNIQUE (entity, entity_id, address_id)
);
CREATE INDEX IF NOT EXISTS address_links_owner_idx ON address_links (entity, entity_id, position);
CREATE UNIQUE INDEX IF NOT EXISTS address_links_primary_uq ON address_links (entity, entity_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS address_links_address_idx ON address_links (address_id);

-- entity_id is polymorphic (no FK): owners clean up their links, and unlinked addresses are removed.
CREATE OR REPLACE FUNCTION delete_person_address_links() RETURNS trigger AS $$
BEGIN DELETE FROM address_links WHERE entity = 'person' AND entity_id = OLD.id; RETURN OLD; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS persons_address_links ON persons;
CREATE TRIGGER persons_address_links AFTER DELETE ON persons FOR EACH ROW EXECUTE FUNCTION delete_person_address_links();

CREATE OR REPLACE FUNCTION delete_orphan_address() RETURNS trigger AS $$
BEGIN
  DELETE FROM addresses a WHERE a.id = OLD.address_id
    AND NOT EXISTS (SELECT 1 FROM address_links l WHERE l.address_id = OLD.address_id);
  RETURN OLD;
END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS address_links_orphans ON address_links;
CREATE TRIGGER address_links_orphans AFTER DELETE ON address_links FOR EACH ROW EXECUTE FUNCTION delete_orphan_address();

CREATE TABLE IF NOT EXISTS exhibition_artists (
  exhibition_id uuid NOT NULL REFERENCES exhibitions(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES artist_profiles(person_id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY (exhibition_id, artist_id)
);
CREATE INDEX IF NOT EXISTS exhibition_artists_artist_idx ON exhibition_artists (artist_id);

CREATE TABLE IF NOT EXISTS works (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id uuid NOT NULL REFERENCES artist_profiles(person_id) ON DELETE RESTRICT,
  inventory_number text UNIQUE,
  title text NOT NULL DEFAULT '',
  date_text text,
  medium text,
  dimensions text,
  edition text,
  credit text,
  price_cents bigint CHECK (price_cents IS NULL OR price_cents >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','on_hold','sold','nfs','returned')),
  location text CHECK (location IS NULL OR location IN ('gallery','storage','artist','collector','on_loan','other')),
  location_note text,
  consigned_on date,
  consignment_ends_on date,
  sold_on date,
  sale_price_cents bigint CHECK (sale_price_cents IS NULL OR sale_price_cents >= 0),
  buyer_id uuid REFERENCES persons(id) ON DELETE SET NULL,
  sale_notes text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT works_consignment_chk CHECK (consignment_ends_on IS NULL OR consigned_on IS NULL OR consignment_ends_on >= consigned_on)
);
CREATE INDEX IF NOT EXISTS works_artist_idx ON works (artist_id, created_at DESC);
CREATE INDEX IF NOT EXISTS works_buyer_idx ON works (buyer_id);

CREATE TABLE IF NOT EXISTS work_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text NOT NULL DEFAULT '',
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE work_images ADD CONSTRAINT work_images_position_uq
    UNIQUE (work_id, position) DEFERRABLE INITIALLY DEFERRED;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

-- Append-only history of the inventory fields that matter commercially.
CREATE TABLE IF NOT EXISTS work_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id uuid NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  field text NOT NULL CHECK (field IN ('price','status','location','consignment','sale')),
  old_value jsonb,
  new_value jsonb,
  note text,
  user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS work_changes_work_idx ON work_changes (work_id, created_at DESC, id DESC);

ALTER TABLE artworks ADD COLUMN IF NOT EXISTS work_id uuid REFERENCES works(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS artworks_work_idx ON artworks (work_id);

ALTER TABLE content_revisions DROP CONSTRAINT IF EXISTS content_revisions_entity_check;
ALTER TABLE content_revisions ADD CONSTRAINT content_revisions_entity_check CHECK (entity IN
  ('exhibition','exhibition_event','artwork','news_post','press_item','home_page','person','artist_profile','work'));

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['persons','artist_profiles','addresses','address_links','works','work_images'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$s_updated_at ON %1$I', t);
    EXECUTE format('CREATE TRIGGER %1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
ALTER TABLE artworks DROP COLUMN IF EXISTS work_id;
DROP TABLE IF EXISTS work_changes, work_images, works, exhibition_artists, address_links, addresses, artist_profiles, persons CASCADE;
DROP FUNCTION IF EXISTS delete_person_address_links();
DROP FUNCTION IF EXISTS delete_orphan_address();
DELETE FROM content_revisions WHERE entity IN ('person','artist_profile','work');
ALTER TABLE content_revisions DROP CONSTRAINT IF EXISTS content_revisions_entity_check;
ALTER TABLE content_revisions ADD CONSTRAINT content_revisions_entity_check CHECK (entity IN
  ('exhibition','exhibition_event','artwork','news_post','press_item','home_page'));
`.execute(db);
}
