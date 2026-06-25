-- ============================================================
-- All-in-One ERP — Full Database Bootstrap
-- Run this in Supabase SQL Editor
-- ============================================================

-- 1. Core tables
CREATE TABLE IF NOT EXISTS organizations (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  gstin         TEXT UNIQUE,
  pan           TEXT,
  address       JSONB,
  contact       JSONB,
  industry_type TEXT,
  variant       TEXT DEFAULT 'blue',
  settings      JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id        BIGINT REFERENCES organizations(id),
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'staff'
                CHECK (role IN ('admin','accountant','sales','inventory_manager','staff')),
  phone         TEXT,
  avatar_url    TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  code          TEXT NOT NULL,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('asset','liability','income','expense','equity')),
  parent_id     BIGINT REFERENCES chart_of_accounts(id),
  is_active     BOOLEAN DEFAULT TRUE,
  UNIQUE(org_id, code)
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reference     TEXT,
  description   TEXT,
  entry_type    TEXT DEFAULT 'manual' CHECK (entry_type IN ('manual','invoice','payment','contra','gst')),
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  entry_id      BIGINT REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id    BIGINT REFERENCES chart_of_accounts(id),
  debit         NUMERIC(14,2) DEFAULT 0,
  credit        NUMERIC(14,2) DEFAULT 0,
  description   TEXT
);

CREATE TABLE IF NOT EXISTS parties (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  type          TEXT NOT NULL CHECK (type IN ('customer','supplier','both')),
  name          TEXT NOT NULL,
  gstin         TEXT,
  pan           TEXT,
  phone         TEXT,
  email         TEXT,
  address       JSONB,
  credit_limit  NUMERIC(14,2),
  opening_bal   NUMERIC(14,2) DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  name          TEXT NOT NULL,
  sku           TEXT,
  hsn_code      TEXT,
  sac_code      TEXT,
  unit          TEXT DEFAULT 'nos',
  gst_rate      NUMERIC(5,2) DEFAULT 0,
  cess_rate     NUMERIC(5,2) DEFAULT 0,
  category      TEXT,
  brand         TEXT,
  attributes    JSONB DEFAULT '[]',
  mrp           NUMERIC(12,2),
  selling_price NUMERIC(12,2),
  purchase_price NUMERIC(12,2),
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_batches (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  product_id    BIGINT REFERENCES products(id),
  batch_no      TEXT,
  mfg_date      DATE,
  expiry_date   DATE,
  quantity      NUMERIC(12,3) DEFAULT 0,
  cost_price    NUMERIC(12,2),
  location      TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_serial_numbers (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  product_id    BIGINT REFERENCES products(id),
  batch_id      BIGINT REFERENCES inventory_batches(id),
  serial_no     TEXT NOT NULL UNIQUE,
  status        TEXT DEFAULT 'available' CHECK (status IN ('available','sold','damaged','returned'))
);

CREATE TABLE IF NOT EXISTS invoices (
  id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id            BIGINT REFERENCES organizations(id),
  invoice_no        TEXT NOT NULL,
  invoice_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date          DATE,
  customer_id       BIGINT REFERENCES parties(id),
  billing_address   JSONB,
  shipping_address  JSONB,
  gstin             TEXT,
  place_of_supply   TEXT,
  invoice_type      TEXT DEFAULT 'regular' CHECK (invoice_type IN ('regular','export','debit_note','credit_note','proforma')),
  reverse_charge    BOOLEAN DEFAULT FALSE,
  payment_terms     TEXT,
  subtotal          NUMERIC(14,2),
  discount_pct      NUMERIC(5,2) DEFAULT 0,
  discount_amt      NUMERIC(14,2) DEFAULT 0,
  taxable_amt       NUMERIC(14,2),
  cgst_amt          NUMERIC(14,2) DEFAULT 0,
  sgst_amt          NUMERIC(14,2) DEFAULT 0,
  igst_amt          NUMERIC(14,2) DEFAULT 0,
  cess_amt          NUMERIC(14,2) DEFAULT 0,
  total             NUMERIC(14,2),
  status            TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','overdue','cancelled')),
  irn               TEXT,
  eway_bill_no      TEXT,
  created_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id      BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
  product_id      BIGINT REFERENCES products(id),
  batch_id        BIGINT REFERENCES inventory_batches(id),
  description     TEXT,
  quantity        NUMERIC(12,3),
  unit            TEXT,
  rate            NUMERIC(14,2),
  discount_pct    NUMERIC(5,2) DEFAULT 0,
  taxable_amt     NUMERIC(14,2),
  gst_rate        NUMERIC(5,2),
  cgst_amt        NUMERIC(14,2) DEFAULT 0,
  sgst_amt        NUMERIC(14,2) DEFAULT 0,
  igst_amt        NUMERIC(14,2) DEFAULT 0,
  total           NUMERIC(14,2)
);

CREATE TABLE IF NOT EXISTS payments (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  invoice_id    BIGINT REFERENCES invoices(id),
  party_id      BIGINT REFERENCES parties(id),
  amount        NUMERIC(14,2) NOT NULL,
  mode          TEXT DEFAULT 'cash' CHECK (mode IN ('cash','bank','upi','card','cheque','online')),
  reference_no  TEXT,
  payment_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gst_records (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id          BIGINT REFERENCES organizations(id),
  return_type     TEXT NOT NULL CHECK (return_type IN ('GSTR1','GSTR2A','GSTR3B','GSTR9')),
  return_period   TEXT NOT NULL,
  invoice_id      BIGINT REFERENCES invoices(id),
  party_id        BIGINT REFERENCES parties(id),
  gstin           TEXT,
  invoice_no      TEXT,
  invoice_date    DATE,
  taxable_amt     NUMERIC(14,2),
  cgst_amt        NUMERIC(14,2) DEFAULT 0,
  sgst_amt        NUMERIC(14,2) DEFAULT 0,
  igst_amt        NUMERIC(14,2) DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','matched','mismatched','filed')),
  filed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS gst_rates (
  hsn_code      TEXT PRIMARY KEY,
  description   TEXT,
  cgst          NUMERIC(5,2),
  sgst          NUMERIC(5,2),
  igst          NUMERIC(5,2),
  cess          NUMERIC(5,2) DEFAULT 0,
  effective_from DATE,
  effective_to   DATE
);

CREATE TABLE IF NOT EXISTS industry_configs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  industry_type   TEXT NOT NULL UNIQUE,
  label           TEXT NOT NULL,
  features        JSONB DEFAULT '[]',
  default_accounts JSONB DEFAULT '[]',
  gst_required    BOOLEAN DEFAULT TRUE,
  is_active       BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  org_id        BIGINT REFERENCES organizations(id),
  user_id       UUID REFERENCES auth.users(id),
  action        TEXT NOT NULL,
  table_name    TEXT,
  record_id     BIGINT,
  old_data      JSONB,
  new_data      JSONB,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS keepalive (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  pinged_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_serial_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gst_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Org isolation: user sees only their org's data
CREATE POLICY org_isolation ON organizations
  FOR ALL USING (
    id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON products
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON invoices
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON invoice_lines
  FOR ALL USING (
    invoice_id IN (SELECT id FROM invoices WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
  );

CREATE POLICY org_isolation ON parties
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON chart_of_accounts
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON journal_entries
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON journal_lines
  FOR ALL USING (
    entry_id IN (SELECT id FROM journal_entries WHERE org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid()))
  );

CREATE POLICY org_isolation ON payments
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON inventory_batches
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON inventory_serial_numbers
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON gst_records
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY org_isolation ON audit_log
  FOR ALL USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- User profiles: self-read, org-read
CREATE POLICY user_profiles_self ON user_profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY user_profiles_org ON user_profiles
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY user_profiles_admin ON user_profiles
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can create organizations
CREATE POLICY "Users can create organizations" ON organizations
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Users can read any organization (needed for post-insert select and profile linking)
CREATE POLICY "Users can read organizations" ON organizations
  FOR SELECT USING (auth.role() = 'authenticated');

-- Users can update their own organization (by checking profile link)
CREATE POLICY "Users can update own org" ON organizations
  FOR UPDATE USING (
    id IN (SELECT org_id FROM user_profiles WHERE id = auth.uid())
  );

-- Admin: full access to all org data
CREATE POLICY admin_all ON organizations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- User profiles self-insert (during registration)
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (id = auth.uid());

-- User profiles self-update (e.g. org_id, phone)
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Public: can read GST rates and industry configs
CREATE POLICY gst_rates_public ON gst_rates FOR SELECT USING (true);
CREATE POLICY industry_configs_public ON industry_configs FOR SELECT USING (true);

-- 4. Seed industry configs
INSERT INTO industry_configs (industry_type, label, features) VALUES
  ('retail','Retail Shop','["billing","inventory","gst"]'),
  ('pharmacy','Pharmacy','["batch","expiry","schedule_h","gst"]'),
  ('fmcg','FMCG','["batch","expiry","distribution","gst"]'),
  ('auto_parts','Auto Parts','["serial_no","interchangeable","gst"]'),
  ('food_beverages','Food & Beverages','["batch","expiry","fssai","gst"]'),
  ('chemical','Chemical','["batch","hazardous","gst"]'),
  ('computer_hardware','Computer Hardware','["serial_no","warranty","gst"]'),
  ('furniture','Furniture','["attributes","dimensions","gst"]'),
  ('book_publishing','Book Publishing','["isbn","author","edition","gst"]'),
  ('travel','Travel','["booking","itinerary","gst"]'),
  ('electrical','Electrical','["serial_no","warranty","gst"]'),
  ('paper_mill','Paper Mill','["batch","weight","gst"]'),
  ('paint','Paint','["batch","shade","gst"]'),
  ('mobile','Mobile','["imei","brand","warranty","gst"]'),
  ('garments','Garments','["size","color","season","gst"]'),
  ('jewellery','Jewellery','["hallmark","carat","weight","gst"]'),
  ('agriculture','Agriculture','["mandi","commission","gst"]'),
  ('stationery','Stationery','["batch","gst"]'),
  ('electronics','Electronics','["serial_no","warranty","gst"]'),
  ('real_estate','Real Estate','["project","unit","rera","gst"]'),
  ('grocery','Grocery','["batch","expiry","gst"]'),
  ('ecommerce','Ecommerce','["order_sync","marketplace","gst"]')
ON CONFLICT (industry_type) DO NOTHING;

-- 5. Seed GST rates
INSERT INTO gst_rates VALUES
  ('0101','Live animals',2.5,2.5,5,0,'2017-07-01','9999-12-31'),
  ('0402','Milk powder',2.5,2.5,5,0,'2017-07-01','9999-12-31'),
  ('0901','Coffee',2.5,2.5,5,0,'2017-07-01','9999-12-31'),
  ('1701','Sugar',2.5,2.5,5,0,'2017-07-01','9999-12-31'),
  ('2710','Petroleum',NULL,NULL,NULL,0,'2017-07-01','9999-12-31'),
  ('3004','Pharmaceuticals',6,6,12,0,'2017-07-01','9999-12-31'),
  ('6204','Women garments',6,6,12,0,'2017-07-01','9999-12-31'),
  ('8471','Computers',9,9,18,0,'2017-07-01','9999-12-31'),
  ('8517','Mobile phones',9,9,18,0,'2017-07-01','9999-12-31'),
  ('9999','Services (general)',9,9,18,0,'2017-07-01','9999-12-31')
ON CONFLICT (hsn_code) DO NOTHING;

-- 6. Functions
CREATE OR REPLACE FUNCTION next_invoice_no(org_id_param BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  prefix TEXT;
  next_num INT;
BEGIN
  SELECT COALESCE(settings->>'invoice_prefix', 'INV-') INTO prefix
  FROM organizations WHERE id = org_id_param;
  SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_no, '-', 2) AS INTEGER)), 0) + 1
  INTO next_num FROM invoices WHERE org_id = org_id_param;
  RETURN prefix || LPAD(next_num::TEXT, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION calculate_gst(
  taxable_amt NUMERIC,
  gst_rate NUMERIC,
  place_of_supply TEXT,
  org_state TEXT
) RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cgst NUMERIC;
  sgst NUMERIC;
  igst NUMERIC;
BEGIN
  IF place_of_supply = org_state THEN
    cgst := ROUND(taxable_amt * gst_rate / 200, 2);
    sgst := cgst;
    igst := 0;
  ELSE
    cgst := 0;
    sgst := 0;
    igst := ROUND(taxable_amt * gst_rate / 100, 2);
  END IF;
  RETURN jsonb_build_object('cgst', cgst, 'sgst', sgst, 'igst', igst);
END;
$$;

CREATE OR REPLACE FUNCTION get_dashboard_kpis(org_id_param BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_invoices', (SELECT COUNT(*) FROM invoices WHERE org_id = org_id_param),
    'pending_invoices', (SELECT COUNT(*) FROM invoices WHERE org_id = org_id_param AND status IN ('draft','sent','overdue')),
    'paid_invoices', (SELECT COUNT(*) FROM invoices WHERE org_id = org_id_param AND status = 'paid'),
    'total_revenue', (SELECT COALESCE(SUM(total), 0) FROM invoices WHERE org_id = org_id_param AND status = 'paid'),
    'total_parties', (SELECT COUNT(*) FROM parties WHERE org_id = org_id_param),
    'total_products', (SELECT COUNT(*) FROM products WHERE org_id = org_id_param),
    'low_stock_items', (SELECT COUNT(*) FROM inventory_batches WHERE org_id = org_id_param AND quantity < 10),
    'total_gst_payable', (SELECT COALESCE(SUM(cgst_amt + sgst_amt + igst_amt), 0) FROM invoices WHERE org_id = org_id_param AND status = 'paid')
  ) INTO result;
  RETURN result;
END;
$$;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_products_org ON products(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_org ON invoices(org_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_parties_org ON parties(org_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_org ON journal_entries(org_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_product ON inventory_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_batches_expiry ON inventory_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_gst_records_period ON gst_records(org_id, return_period);
CREATE INDEX IF NOT EXISTS idx_invoices_irn ON invoices(irn);
CREATE INDEX IF NOT EXISTS idx_user_profiles_org ON user_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice ON invoice_lines(invoice_id);
