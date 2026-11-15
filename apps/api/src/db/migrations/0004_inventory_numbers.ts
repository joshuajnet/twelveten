import { sql, type Kysely } from 'kysely';

/**
 * Inventory numbers: artist initials plus a four-digit sequence (MSW0006). Each artist profile has
 * a unique letters-only prefix (initials, extended with letters of the last name on a clash). A
 * work inserted without a number gets one: the code in a "(MSW0004)"-style title suffix when it
 * carries the artist's prefix and is free, otherwise the prefix's highest number plus one.
 * Existing works are numbered here the same way. Idempotent like the earlier migrations.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
ALTER TABLE artist_profiles ADD COLUMN IF NOT EXISTS inventory_prefix text;

-- 'MSW' from 'Micah Schippa-Wildfong', 'EPVS' from 'Ellis & Parker von Sternberg'.
CREATE OR REPLACE FUNCTION inventory_initials(name text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(nullif(left(regexp_replace(upper(string_agg(left(w, 1), '' ORDER BY n)), '[^A-Z]', '', 'g'), 6), ''), 'X')
  FROM regexp_split_to_table(name, '[^[:alpha:]]+') WITH ORDINALITY AS t(w, n)
  WHERE w <> ''
$$;

-- Initials, or on a clash initials plus a later letter of the last name (TH, then THI), then A–Z.
CREATE OR REPLACE FUNCTION unique_inventory_prefix(person uuid) RETURNS text LANGUAGE plpgsql AS $$
DECLARE base text; last text; cand text;
BEGIN
  SELECT inventory_initials(p.name), regexp_replace(upper(coalesce(substring(p.name from '([[:alpha:]]+)[^[:alpha:]]*$'), '')), '[^A-Z]', '', 'g')
    INTO base, last FROM persons p WHERE p.id = person;
  FOREACH cand IN ARRAY ARRAY[base]
      || ARRAY(SELECT base || substr(last, i, 1) FROM generate_series(2, length(last)) i)
      || ARRAY(SELECT base || chr(c) FROM generate_series(65, 90) c) LOOP
    IF NOT EXISTS (SELECT 1 FROM artist_profiles WHERE inventory_prefix = cand AND person_id <> person) THEN RETURN cand; END IF;
  END LOOP;
  RAISE EXCEPTION 'No free inventory prefix for %', person;
END $$;

CREATE OR REPLACE FUNCTION inventory_code(prefix text, n bigint) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT prefix || CASE WHEN length(n::text) >= 4 THEN n::text ELSE lpad(n::text, 4, '0') END
$$;

-- The artist's next number: one past the highest number with their prefix (gaps are not reused).
CREATE OR REPLACE FUNCTION next_inventory_number(artist uuid) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT inventory_code(ap.inventory_prefix, coalesce(max(substring(w.inventory_number from length(ap.inventory_prefix) + 1)::bigint), 0) + 1)
  FROM artist_profiles ap
  LEFT JOIN works w ON w.inventory_number ~ ('^' || ap.inventory_prefix || '[0-9]+$')
  WHERE ap.person_id = artist
  GROUP BY ap.inventory_prefix
$$;

CREATE OR REPLACE FUNCTION title_inventory_code(title text, prefix text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT inventory_code(prefix, (substring(title from '\\(' || prefix || '([0-9]+)\\)\\s*$'))::bigint)
$$;

CREATE OR REPLACE FUNCTION set_inventory_prefix() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.inventory_prefix IS NULL THEN NEW.inventory_prefix := unique_inventory_prefix(NEW.person_id); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION assign_inventory_number() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p text; code text;
BEGIN
  IF NEW.inventory_number IS NOT NULL THEN RETURN NEW; END IF;
  -- Locks the profile so two works for one artist can't take the same number.
  SELECT inventory_prefix INTO p FROM artist_profiles WHERE person_id = NEW.artist_id FOR UPDATE;
  IF p IS NULL THEN RETURN NEW; END IF;
  code := title_inventory_code(NEW.title, p);
  IF code IS NOT NULL AND NOT EXISTS (SELECT 1 FROM works WHERE inventory_number = code) THEN
    NEW.inventory_number := code;
  ELSE
    NEW.inventory_number := next_inventory_number(NEW.artist_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS artist_profiles_inventory_prefix ON artist_profiles;
CREATE TRIGGER artist_profiles_inventory_prefix BEFORE INSERT ON artist_profiles FOR EACH ROW EXECUTE FUNCTION set_inventory_prefix();
DROP TRIGGER IF EXISTS works_inventory_number ON works;
CREATE TRIGGER works_inventory_number BEFORE INSERT ON works FOR EACH ROW EXECUTE FUNCTION assign_inventory_number();

-- Backfill: prefixes in name order, then title codes, then everything else in creation order.
DO $$ DECLARE r record; code text; BEGIN
  FOR r IN SELECT ap.person_id FROM artist_profiles ap JOIN persons p ON p.id = ap.person_id
           WHERE ap.inventory_prefix IS NULL ORDER BY p.sort_name, p.name, p.id LOOP
    UPDATE artist_profiles SET inventory_prefix = unique_inventory_prefix(r.person_id) WHERE person_id = r.person_id;
  END LOOP;
  FOR r IN SELECT w.id, title_inventory_code(w.title, ap.inventory_prefix) AS code
           FROM works w JOIN artist_profiles ap ON ap.person_id = w.artist_id
           WHERE w.inventory_number IS NULL ORDER BY w.created_at, w.id LOOP
    CONTINUE WHEN r.code IS NULL;
    UPDATE works SET inventory_number = r.code WHERE id = r.id AND NOT EXISTS (SELECT 1 FROM works WHERE inventory_number = r.code);
  END LOOP;
  FOR r IN SELECT id, artist_id FROM works WHERE inventory_number IS NULL ORDER BY created_at, id LOOP
    UPDATE works SET inventory_number = next_inventory_number(r.artist_id) WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE artist_profiles ALTER COLUMN inventory_prefix SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_profiles_inventory_prefix_key') THEN
    ALTER TABLE artist_profiles ADD CONSTRAINT artist_profiles_inventory_prefix_key UNIQUE (inventory_prefix);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'artist_profiles_inventory_prefix_check') THEN
    ALTER TABLE artist_profiles ADD CONSTRAINT artist_profiles_inventory_prefix_check CHECK (inventory_prefix ~ '^[A-Z]{1,8}$');
  END IF;
END $$;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`
DROP TRIGGER IF EXISTS works_inventory_number ON works;
DROP TRIGGER IF EXISTS artist_profiles_inventory_prefix ON artist_profiles;
DROP FUNCTION IF EXISTS assign_inventory_number(), set_inventory_prefix(), title_inventory_code(text, text), next_inventory_number(uuid), inventory_code(text, bigint), unique_inventory_prefix(uuid), inventory_initials(text);
ALTER TABLE artist_profiles DROP COLUMN IF EXISTS inventory_prefix;
`.execute(db);
}
