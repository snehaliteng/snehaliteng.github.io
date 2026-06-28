-- Todo App Schema (can re-run safely)
DROP POLICY IF EXISTS "users own templates" ON todo_templates;
DROP POLICY IF EXISTS "users own template tasks" ON todo_template_tasks;
DROP POLICY IF EXISTS "users own daily schedules" ON todo_daily_schedules;
DROP POLICY IF EXISTS "users own task instances" ON todo_task_instances;

CREATE TABLE IF NOT EXISTS todo_templates (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
ALTER TABLE todo_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own templates" ON todo_templates FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS todo_template_tasks (
  id INTEGER PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES todo_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_ttt_template ON todo_template_tasks(template_id);
ALTER TABLE todo_template_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own template tasks" ON todo_template_tasks FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS todo_daily_schedules (
  id INTEGER PRIMARY KEY,
  template_id INTEGER REFERENCES todo_templates(id) ON DELETE RESTRICT,
  schedule_date TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tds_date ON todo_daily_schedules(schedule_date);
ALTER TABLE todo_daily_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own daily schedules" ON todo_daily_schedules FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS todo_task_instances (
  id INTEGER PRIMARY KEY,
  schedule_id INTEGER NOT NULL REFERENCES todo_daily_schedules(id) ON DELETE CASCADE,
  template_task_id INTEGER REFERENCES todo_template_tasks(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  is_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tti_schedule ON todo_task_instances(schedule_id);
ALTER TABLE todo_task_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own task instances" ON todo_task_instances FOR ALL USING (user_id = auth.uid());

-- ======= Todo Plans (run via SQL editor or API) =======
CREATE TABLE IF NOT EXISTS todo_plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  max_templates INTEGER NOT NULL,
  max_schedules_per_month INTEGER NOT NULL,
  price INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE todo_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin manage todo plans" ON todo_plans;
CREATE POLICY "admin manage todo plans" ON todo_plans FOR ALL USING (auth.jwt() ->> 'email' = 'snehaliteng@gmail.com');
DROP POLICY IF EXISTS "users read active todo plans" ON todo_plans;
CREATE POLICY "users read active todo plans" ON todo_plans FOR SELECT USING (active = true);

CREATE TABLE IF NOT EXISTS todo_user_plans (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id INTEGER NOT NULL REFERENCES todo_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'blocked')),
  razorpay_subscription_id TEXT,
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE todo_user_plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users own todo plan" ON todo_user_plans;
CREATE POLICY "users own todo plan" ON todo_user_plans FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "users insert own todo plan" ON todo_user_plans;
CREATE POLICY "users insert own todo plan" ON todo_user_plans FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "users update own todo plan" ON todo_user_plans;
CREATE POLICY "users update own todo plan" ON todo_user_plans FOR UPDATE USING (user_id = auth.uid());

-- Seed default plans
INSERT INTO todo_plans (id, name, max_templates, max_schedules_per_month, price, active, created_at) VALUES
  (1, 'Free', 3, 30, 0, true, '2025-01-01 00:00:00'),
  (2, 'Bronze', 10, 60, 19900, true, '2025-01-01 00:00:00'),
  (3, 'Silver', 25, 120, 49900, true, '2025-01-01 00:00:00'),
  (4, 'Gold', 999999, 999999, 99900, true, '2025-01-01 00:00:00')
ON CONFLICT (id) DO NOTHING;

GRANT ALL ON todo_templates TO authenticated;
GRANT ALL ON todo_template_tasks TO authenticated;
GRANT ALL ON todo_daily_schedules TO authenticated;
GRANT ALL ON todo_task_instances TO authenticated;
GRANT SELECT ON todo_plans TO anon, authenticated;
GRANT ALL ON todo_plans TO authenticated;
GRANT ALL ON todo_user_plans TO authenticated;
GRANT USAGE ON SEQUENCE todo_plans_id_seq TO authenticated;
GRANT USAGE ON SEQUENCE todo_user_plans_id_seq TO authenticated;
