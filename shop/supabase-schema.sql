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
-- Check purchase RPC function
-- =============================================================
CREATE OR REPLACE FUNCTION check_tutorial_purchase(p_product_slug TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id BIGINT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT id INTO v_product_id FROM shop_products WHERE slug = p_product_slug;
  IF v_product_id IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1 FROM shop_order_items oi
    JOIN shop_orders o ON o.id = oi.order_id
    WHERE o.user_id = auth.uid()
      AND oi.product_id = v_product_id
      AND o.payment_status = 'completed'
  );
END;
$$;

-- =============================================================
-- Seed data — upsert all 30 tutorials at ₹500 each
-- =============================================================
INSERT INTO shop_products (title, slug, description, price, pdf_url, cover_image, tutorial_slug) VALUES
('HTML Tutorial - Complete Guide', 'html-tutorial', 'Master HTML from basics to advanced. Covers all tags, forms, media, APIs, and best practices.', 500.00, '/tutorials/html/html-tutorial-complete-guide.pdf', '/tutorials/html/images/html-box-model.svg', 'html'),
('CSS Tutorial - Complete Guide', 'css-tutorial', 'Complete CSS guide covering selectors, box model, flexbox, grid, animations, and responsive design.', 500.00, '/tutorials/css/css-tutorial-complete-guide.pdf', '/tutorials/css/images/css-box-model.svg', 'css'),
('JavaScript Tutorial - Complete Guide', 'javascript-tutorial', 'From basics to advanced: DOM, async, modules, closures, and modern ES6+ patterns.', 500.00, '/tutorials/Javascript/Javascript-tutorial-complete-guide.pdf', '', 'Javascript'),
('React Tutorial - Complete Guide', 'react-tutorial', 'Build modern UIs with React: components, hooks, state management, routing, and deployment.', 500.00, '/tutorials/react/react-tutorial-complete-guide.pdf', '', 'react'),
('Python Tutorial - Complete Guide', 'python-tutorial', 'Learn Python: data types, functions, OOP, file I/O, modules, and real-world projects.', 500.00, '/tutorials/python/python-tutorial-complete-guide.pdf', '', 'python'),
('Angular Tutorial - Complete Guide', 'angular-tutorial', 'Enterprise Angular: components, services, routing, forms, RxJS, and NgRx state management.', 500.00, '/tutorials/angular/angular-tutorial-complete-guide.pdf', '', 'angular'),
('FastAPI Tutorial - Complete Guide', 'fastapi-tutorial', 'Build high-performance APIs with FastAPI: routing, Pydantic, SQLAlchemy, auth, and deployment.', 500.00, '/tutorials/fastapi-tutorial/fastapi-tutorial-complete-guide.pdf', '', 'fastapi-tutorial'),
('.NET Core Tutorial - Complete Guide', 'dotnetcore-tutorial', 'Cross-platform .NET: C#, ASP.NET Core, EF Core, APIs, testing, and cloud deployment.', 500.00, '/tutorials/dotnetcore/dotnetcore-tutorial-complete-guide.pdf', '', 'dotnetcore'),
-- New tutorials
('Artificial Intelligence Tutorial - Complete Guide', 'ai-tutorial', 'AI fundamentals: ML, NLP, computer vision, neural networks, expert systems, agents, and industry applications.', 500.00, '/tutorials/ai/ai-tutorial-complete-guide.pdf', '', 'ai'),
('Agentic AI Engineering Tutorial - Complete Guide', 'ai-agentic-track-tutorial', 'Curriculum: OpenAI SDK, CrewAI, LangGraph, AutoGen, MCP, and capstone projects for building production AI agents.', 500.00, '/tutorials/ai-agentic-track/ai-agentic-track-tutorial-complete-guide.pdf', '', 'ai-agentic-track'),
('Core AI Engineering Tutorial - Complete Guide', 'ai-engineer-core-tutorial', 'Curriculum: LLM products, multi-modal chatbots, HuggingFace, RAG, fine-tuning, QLoRA, and multi-agent systems.', 500.00, '/tutorials/ai-engineer-core/ai-engineer-core-tutorial-complete-guide.pdf', '', 'ai-engineer-core'),
('AI System Design (2026) Tutorial - Complete Guide', 'ai-system-design-tutorial', 'Problem space, architecture, data flow, agentic AI, MCP, pipelines, scalability, caching, indexing, inference, deployment, monitoring, security.', 500.00, '/tutorials/ai-system-design/ai-system-design-tutorial-complete-guide.pdf', '', 'ai-system-design'),
('Android Tutorial - Complete Guide', 'android-tutorial', 'Native Android development with Kotlin, Jetpack, MVVM, Room, Retrofit, and Material Design.', 500.00, '/tutorials/android/android-tutorial-complete-guide.pdf', '', 'android'),
('C# Tutorial - Complete Guide', 'c-tutorial', 'Modern C# development: LINQ, async, OOP, .NET ecosystem, and real-world patterns.', 500.00, '/tutorials/c%23/c%23-tutorial-complete-guide.pdf', '', 'c#'),
('Claude Vibe Coding Tutorial - Complete Guide', 'claude-vibe-course-tutorial', '3-week course: vibe coding, Claude Code CLI, MCP servers, multi-agent swarms, and production SaaS engineering.', 500.00, '/tutorials/claude-vibe-course/claude-vibe-course-tutorial-complete-guide.pdf', '', 'claude-vibe-course'),
('Data Structures & Algorithms Tutorial - Complete Guide', 'dsa-tutorial', 'Arrays, linked lists, trees, graphs, sorting, searching, DP, and greedy algorithms with code examples.', 500.00, '/tutorials/dsa/dsa-tutorial-complete-guide.pdf', '', 'dsa'),
('DSA – LeetCode 150-Day MAANG Roadmap Tutorial - Complete Guide', 'dsa-leetcode-roadmap-tutorial', 'Structured roadmap: Arrays, Strings, Linked Lists, Trees, Graphs, DP, System Design, OOD, Behavioral prep.', 500.00, '/tutorials/dsa-leetcode-roadmap/dsa-leetcode-roadmap-tutorial-complete-guide.pdf', '', 'dsa-leetcode-roadmap'),
('Microsoft Foundry Tutorial - Complete Guide', 'foundry-fundamentals-tutorial', 'Azure AI Foundry deep-dive: agents, RAG pipelines, AI Gateway, Foundry IQ, multi-modal apps, and A2A protocol.', 500.00, '/tutorials/foundry-fundamentals/foundry-fundamentals-tutorial-complete-guide.pdf', '', 'foundry-fundamentals'),
('Generative AI Tutorial - Complete Guide', 'genai-tutorial', 'GANs, transformers, VAEs, diffusion models, LLMs, ChatGPT, RLHF, and industry applications of generative AI.', 500.00, '/tutorials/genai/genai-tutorial-complete-guide.pdf', '', 'genai'),
('Interpersonal Skills Tutorial - Complete Guide', 'interpersonal-skills-tutorial', 'Communication, active listening, emotional intelligence, conflict resolution, teamwork, negotiation, and decision-making.', 500.00, '/tutorials/interpersonal-skills/interpersonal-skills-tutorial-complete-guide.pdf', '', 'interpersonal-skills'),
('iOS Tutorial - Complete Guide', 'ios-tutorial', 'Native iOS development with Swift, UIKit, SwiftUI, Core Data, MapKit, and App Store deployment.', 500.00, '/tutorials/ios/ios-tutorial-complete-guide.pdf', '', 'ios'),
('MAF Fundamentals Tutorial - Complete Guide', 'maf-fundamentals-tutorial', 'Microsoft Agent Framework: agent lifecycle, patterns, multi-agent orchestration, Teams integration, and best practices.', 500.00, '/tutorials/maf-fundamentals/maf-fundamentals-tutorial-complete-guide.pdf', '', 'maf-fundamentals'),
('Machine Learning Tutorial - Complete Guide', 'ml-tutorial', 'ML fundamentals: supervised/unsupervised learning, regression, classification, clustering, deep learning, and MLOps.', 500.00, '/tutorials/ml/ml-tutorial-complete-guide.pdf', '', 'ml'),
('ML System Design (2026) Tutorial - Complete Guide', 'ml-system-design-tutorial', 'Objectives, stages, architecture, components, batch vs real-time, training & serving, caching, indexing, scalability.', 500.00, '/tutorials/ml-system-design/ml-system-design-tutorial-complete-guide.pdf', '', 'ml-system-design'),
('Node.js Tutorial - Complete Guide', 'nodejs-tutorial', 'Server-side JavaScript runtime. Express, async, databases, REST APIs, real-time apps, and deployment.', 500.00, '/tutorials/nodejs/nodejs-tutorial-complete-guide.pdf', '', 'nodejs'),
('Playwright Automation Tutorial - Complete Guide', 'playwright-tutorial', 'Complete guide: setup, locators, UI components, API testing, visual testing, CI/CD, Cucumber, TypeScript, AI agents.', 500.00, '/tutorials/playwright-tutorial/playwright-tutorial-tutorial-complete-guide.pdf', '', 'playwright-tutorial'),
('Project Management Tutorial - Complete Guide', 'project-management-tutorial', 'PM fundamentals: methodologies, scheduling, risk, cost, quality, leadership, and certification prep.', 500.00, '/tutorials/project-management/project-management-tutorial-complete-guide.pdf', '', 'project-management'),
('Progressive Web Apps Tutorial - Complete Guide', 'pwa-tutorial', 'Build reliable, fast, and installable PWAs. Service Workers, caching, offline, manifest, and push notifications.', 500.00, '/tutorials/pwa/pwa-tutorial-complete-guide.pdf', '', 'pwa'),
('Snowflake Tutorial - Complete Guide', 'snowflake-tutorial', 'Complete guide: architecture, virtual warehouses, data loading, time travel, caching, external integrations.', 500.00, '/tutorials/snowflake-tutorial/snowflake-tutorial-tutorial-complete-guide.pdf', '', 'snowflake-tutorial'),
('System Design Fundamentals Tutorial - Complete Guide', 'system-design-fundamentals-tutorial', 'Complete guide: networking, protocols, architecture patterns, scalability, storage, performance, reliability, security.', 500.00, '/tutorials/system-design-fundamentals/system-design-fundamentals-tutorial-complete-guide.pdf', '', 'system-design-fundamentals')
,
('Mindset Mastery E-Book', 'mindset-mastery-tutorial', '53 chapters across 5 parts covering focus, discipline, resilience, emotional intelligence, leadership, and personal growth — by Snehal Kadiya.', 500.00, '/tutorials/mindset-mastery/mindset-mastery-ebook.pdf', '', 'mindset-mastery')
ON CONFLICT (slug) DO UPDATE SET price = EXCLUDED.price, description = EXCLUDED.description;
