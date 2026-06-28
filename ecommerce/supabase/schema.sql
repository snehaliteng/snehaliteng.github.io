-- Run this in Supabase SQL Editor
-- ============ ECOMMERCE SCHEMA ============

-- Vendors
CREATE TABLE IF NOT EXISTS ec_vendors (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address_line1 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_pincode TEXT,
  gstin TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','suspended')),
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  slug TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE ec_vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor select own" ON ec_vendors FOR SELECT USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com' OR user_id = auth.uid());
CREATE POLICY "anyone read approved vendors" ON ec_vendors FOR SELECT USING (status = 'approved');
CREATE POLICY "vendor insert" ON ec_vendors FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "vendor update own" ON ec_vendors FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admin all vendors" ON ec_vendors FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');

-- Categories (managed by admin, used by vendors)
CREATE TABLE IF NOT EXISTS ec_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  parent_id INTEGER REFERENCES ec_categories(id) ON DELETE RESTRICT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ec_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read categories" ON ec_categories FOR SELECT USING (true);
CREATE POLICY "admin manage categories" ON ec_categories FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');

-- Products (owned by vendors)
CREATE TABLE IF NOT EXISTS ec_products (
  id SERIAL PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES ec_vendors(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES ec_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  brand TEXT,
  images JSONB NOT NULL DEFAULT '[]'::jsonb,
  price NUMERIC(10,2) NOT NULL,
  compare_at_price NUMERIC(10,2),
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  stock INTEGER NOT NULL DEFAULT 0,
  sku TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  review_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_category ON ec_products(category_id);
CREATE INDEX idx_products_vendor ON ec_products(vendor_id);
ALTER TABLE ec_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read products" ON ec_products FOR SELECT USING (true);
CREATE POLICY "vendor manage products" ON ec_products FOR ALL USING (vendor_id IN (SELECT id FROM ec_vendors WHERE user_id = auth.uid()));
CREATE POLICY "admin all products" ON ec_products FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');

-- User Addresses
CREATE TABLE IF NOT EXISTS ec_addresses (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ec_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage addresses" ON ec_addresses FOR ALL USING (user_id = auth.uid());

-- Cart
CREATE TABLE IF NOT EXISTS ec_cart (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES ec_products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, product_id)
);
ALTER TABLE ec_cart ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage cart" ON ec_cart FOR ALL USING (user_id = auth.uid());

-- Orders
CREATE TABLE IF NOT EXISTS ec_orders (
  id SERIAL PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  address_id INTEGER REFERENCES ec_addresses(id) ON DELETE RESTRICT,
  subtotal NUMERIC(10,2) NOT NULL,
  gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  shipping_charge NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'razorpay',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  order_status TEXT NOT NULL DEFAULT 'confirmed' CHECK (order_status IN ('confirmed','processing','shipped','delivered','cancelled','rejected','refunded','returned')),
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  invoice_number TEXT,
  invoice_pdf_url TEXT,
  shipping_courier TEXT,
  shipping_tracking_number TEXT,
  shipping_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_user ON ec_orders(user_id);
ALTER TABLE ec_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own orders" ON ec_orders FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "vendor read orders" ON ec_orders FOR SELECT USING (EXISTS (SELECT 1 FROM ec_order_items oi JOIN ec_products p ON oi.product_id = p.id JOIN ec_vendors v ON p.vendor_id = v.id WHERE v.user_id = auth.uid() AND oi.order_id = ec_orders.id));
CREATE POLICY "admin all orders" ON ec_orders FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');

-- Order Items
CREATE TABLE IF NOT EXISTS ec_order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES ec_orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES ec_products(id) ON DELETE RESTRICT,
  vendor_id INTEGER NOT NULL REFERENCES ec_vendors(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  product_sku TEXT,
  quantity INTEGER NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  gst_rate NUMERIC(5,2) NOT NULL DEFAULT 18.00,
  gst_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','processing','shipped','delivered','cancelled','rejected','refunded','returned')),
  notes TEXT,
  cancelled_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  refund_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_order ON ec_order_items(order_id);
CREATE INDEX idx_order_items_vendor ON ec_order_items(vendor_id);
ALTER TABLE ec_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own items" ON ec_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM ec_orders WHERE id = order_id AND user_id = auth.uid()));
CREATE POLICY "vendor read items" ON ec_order_items FOR SELECT USING (vendor_id IN (SELECT id FROM ec_vendors WHERE user_id = auth.uid()));
CREATE POLICY "admin all items" ON ec_order_items FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');

-- Reviews
CREATE TABLE IF NOT EXISTS ec_reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES ec_products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(product_id, user_id)
);
CREATE INDEX idx_reviews_product ON ec_reviews(product_id);
ALTER TABLE ec_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone read reviews" ON ec_reviews FOR SELECT USING (true);
CREATE POLICY "users manage reviews" ON ec_reviews FOR ALL USING (user_id = auth.uid());

-- Newsletter Subscribers
CREATE TABLE IF NOT EXISTS ec_newsletter (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ec_newsletter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone insert newsletter" ON ec_newsletter FOR INSERT WITH CHECK (true);
CREATE POLICY "admin manage newsletter" ON ec_newsletter FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');

-- Newsletter Campaigns
CREATE TABLE IF NOT EXISTS ec_newsletter_campaigns (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','scheduled')),
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ec_newsletter_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage campaigns" ON ec_newsletter_campaigns FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');
CREATE POLICY "vendor read campaigns" ON ec_newsletter_campaigns FOR SELECT USING (EXISTS (SELECT 1 FROM ec_vendors WHERE user_id = auth.uid()));

-- Ecommerce Plans (admin-defined tiers)
CREATE TABLE IF NOT EXISTS ec_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  max_products INTEGER NOT NULL DEFAULT 10,
  max_categories INTEGER NOT NULL DEFAULT 5,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
  featured_products BOOLEAN NOT NULL DEFAULT false,
  priority_support BOOLEAN NOT NULL DEFAULT false,
  custom_domain BOOLEAN NOT NULL DEFAULT false,
  bulk_import BOOLEAN NOT NULL DEFAULT false,
  api_access BOOLEAN NOT NULL DEFAULT false,
  analytics BOOLEAN NOT NULL DEFAULT false,
  price INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE ec_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ec_plans admin all" ON ec_plans FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');
CREATE POLICY "ec_plans anon read active" ON ec_plans FOR SELECT USING (active = true);

-- User Ecommerce Plan Assignments
CREATE TABLE IF NOT EXISTS user_ec_plans (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES ec_plans(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','blocked','cancelled')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE user_ec_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_ec_plans admin all" ON user_ec_plans FOR ALL USING (auth.jwt()->>'email' = 'snehaliteng@gmail.com');
CREATE POLICY "user_ec_plans user own" ON user_ec_plans FOR SELECT USING (user_id = auth.uid());

-- Default plans
INSERT INTO ec_plans (name, description, max_products, max_categories, commission_rate, featured_products, priority_support, custom_domain, bulk_import, api_access, analytics, price, sort_order)
SELECT * FROM (VALUES
  ('Bronze', 'Basic plan for small stores', 10, 5, 5.00, false, false, false, false, false, false, 0, 1),
  ('Silver', 'Mid-tier plan for growing businesses', 50, 10, 3.00, true, false, false, false, false, true, 29900, 2),
  ('Gold', 'Premium plan for established stores', 999999, 999999, 2.00, true, true, true, true, true, true, 99900, 3)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM ec_plans LIMIT 1);

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ec_categories, ec_products, ec_reviews TO anon;
GRANT SELECT ON ec_categories, ec_products, ec_reviews, ec_vendors, ec_plans TO authenticated;
GRANT ALL ON ec_cart, ec_addresses, ec_orders, ec_order_items, ec_reviews TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;