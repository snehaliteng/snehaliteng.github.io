-- =============================================================
-- Shop: Tables for e-book sales
-- Run this in Supabase SQL Editor
-- =============================================================

-- 1. Products (e-books / tutorials for sale)
CREATE TABLE shop_products (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  pdf_url TEXT NOT NULL,
  cover_image TEXT,
  tutorial_slug TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Cart items (per user)
CREATE TABLE shop_cart (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, product_id)
);

-- 3. Orders
CREATE TABLE shop_orders (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  total_amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'razorpay',
  payment_status TEXT DEFAULT 'pending',
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  transaction_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Order items (snapshot of what was purchased)
CREATE TABLE shop_order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES shop_products(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  pdf_url TEXT NOT NULL
);

-- =============================================================
-- RLS Policies
-- =============================================================
ALTER TABLE shop_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_order_items ENABLE ROW LEVEL SECURITY;

-- Products: public read
CREATE POLICY "Products public read" ON shop_products FOR SELECT USING (true);

-- Cart: user owns their cart
CREATE POLICY "Cart user read" ON shop_cart FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Cart user insert" ON shop_cart FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Cart user update" ON shop_cart FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Cart user delete" ON shop_cart FOR DELETE USING (auth.uid() = user_id);

-- Orders: user reads own
CREATE POLICY "Orders user read" ON shop_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Orders service insert" ON shop_orders FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Order items: user reads own via order
CREATE POLICY "Order items user read" ON shop_order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM shop_orders WHERE id = shop_order_items.order_id AND user_id = auth.uid())
);

-- =============================================================
-- Seed data (run after tables are created)
-- =============================================================
INSERT INTO shop_products (title, slug, description, price, pdf_url, cover_image, tutorial_slug) VALUES
('HTML Tutorial - Complete Guide', 'html-tutorial', 'Master HTML from basics to advanced. Covers all tags, forms, media, APIs, and best practices.', 49.00, '/tutorials/html/html-tutorial-complete-guide.pdf', '/tutorials/html/images/html-box-model.svg', 'html'),
('CSS Tutorial - Complete Guide', 'css-tutorial', 'Complete CSS guide covering selectors, box model, flexbox, grid, animations, and responsive design.', 49.00, '/tutorials/css/css-tutorial-complete-guide.pdf', '/tutorials/css/images/css-box-model.svg', 'css'),
('JavaScript Tutorial - Complete Guide', 'javascript-tutorial', 'From basics to advanced: DOM, async, modules, closures, and modern ES6+ patterns.', 49.00, '/tutorials/Javascript/Javascript-tutorial-complete-guide.pdf', '', 'Javascript'),
('React Tutorial - Complete Guide', 'react-tutorial', 'Build modern UIs with React: components, hooks, state management, routing, and deployment.', 49.00, '/tutorials/react/react-tutorial-complete-guide.pdf', '', 'react'),
('Python Tutorial - Complete Guide', 'python-tutorial', 'Learn Python: data types, functions, OOP, file I/O, modules, and real-world projects.', 49.00, '/tutorials/python/python-tutorial-complete-guide.pdf', '', 'python'),
('Angular Tutorial - Complete Guide', 'angular-tutorial', 'Enterprise Angular: components, services, routing, forms, RxJS, and NgRx state management.', 49.00, '/tutorials/angular/angular-tutorial-complete-guide.pdf', '', 'angular'),
('FastAPI Tutorial - Complete Guide', 'fastapi-tutorial', 'Build high-performance APIs with FastAPI: routing, Pydantic, SQLAlchemy, auth, and deployment.', 49.00, '/tutorials/fastapi-tutorial/fastapi-tutorial-complete-guide.pdf', '', 'fastapi-tutorial'),
('.NET Core Tutorial - Complete Guide', 'dotnetcore-tutorial', 'Cross-platform .NET: C#, ASP.NET Core, EF Core, APIs, testing, and cloud deployment.', 49.00, '/tutorials/dotnetcore/dotnetcore-tutorial-complete-guide.pdf', '', 'dotnetcore');
