import { sql, type Kysely } from 'kysely';

/**
 * Collector profiles, invoices (line items snapshot the invoiced works, payments set the status)
 * and the invoice settings shown on every invoice. Idempotent like 0001/0002.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
    await sql`
-- Collector profile: one per person at most. The collection itself is the works they bought or hold.
CREATE TABLE IF NOT EXISTS collector_profiles (
  person_id uuid PRIMARY KEY REFERENCES persons(id) ON DELETE RESTRICT,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row: the gallery details printed on invoices. Bank/payment details come from env (INVOICE_*), not the database.
CREATE TABLE IF NOT EXISTS invoice_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  gallery_name text NOT NULL DEFAULT 'Twelve Ten',
  address text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  default_terms text NOT NULL DEFAULT '',
  default_tax_rate_bps integer NOT NULL DEFAULT 0 CHECK (default_tax_rate_bps BETWEEN 0 AND 10000),
  number_prefix text NOT NULL DEFAULT 'INV-',
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Public gallery details only; the phone number is entered in the back office.
INSERT INTO invoice_settings (id, address, email, default_terms, default_tax_rate_bps) VALUES (
  true,
  E'1104 W Thorndale Ave\nChicago, IL 60660',
  'mail@twelvetengallery.com',
  E'Payment must be remitted within thirty days of receipt. Shipping may be calculated and charged separately.\nTwelve Ten reserves the right to reclaim unpaid artworks at the purchaser''s expense for all additional costs incurred, including shipping.',
  1025
) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number text NOT NULL UNIQUE CHECK (length(btrim(number)) > 0),
  person_id uuid NOT NULL REFERENCES persons(id) ON DELETE RESTRICT,
  issued_on date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','partial','paid','cancelled')),  -- cancelled: the buyer never paid
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  bill_to text NOT NULL DEFAULT '',          -- printed under "To:", one line per line
  discount_bps integer NOT NULL DEFAULT 0 CHECK (discount_bps BETWEEN 0 AND 10000),
  tax_rate_bps integer NOT NULL DEFAULT 0 CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  shipping_cents bigint NOT NULL DEFAULT 0 CHECK (shipping_cents >= 0),
  -- Totals, recomputed by the API on every change.
  subtotal_cents bigint NOT NULL DEFAULT 0,
  discount_cents bigint NOT NULL DEFAULT 0,
  tax_cents bigint NOT NULL DEFAULT 0,
  total_cents bigint NOT NULL DEFAULT 0,
  terms text NOT NULL DEFAULT '',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoices_person_idx ON invoices (person_id, issued_on DESC);
CREATE INDEX IF NOT EXISTS invoices_list_idx ON invoices (issued_on DESC, id DESC);

-- Line items keep the work's caption and price as invoiced, even if the work changes later.
CREATE TABLE IF NOT EXISTS invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  work_id uuid REFERENCES works(id) ON DELETE SET NULL,
  position integer NOT NULL,
  artist_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  date_text text,
  medium text,
  dimensions text,
  image_url text,
  price_cents bigint NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx ON invoice_items (invoice_id, position);
CREATE INDEX IF NOT EXISTS invoice_items_work_idx ON invoice_items (work_id);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  paid_on date NOT NULL,
  method text,
  note text,
  user_id uuid REFERENCES "user"(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON invoice_payments (invoice_id, paid_on, created_at);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['collector_profiles','invoice_settings','invoices','invoice_items'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %1$s_updated_at ON %1$I', t);
    EXECUTE format('CREATE TRIGGER %1$s_updated_at BEFORE UPDATE ON %1$I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t);
  END LOOP;
END $$;
`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
    await sql`DROP TABLE IF EXISTS invoice_payments, invoice_items, invoices, invoice_settings, collector_profiles CASCADE;`.execute(db);
}
