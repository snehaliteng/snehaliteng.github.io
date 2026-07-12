-- ============================================================
-- EduERP - Multi-Tenant Education ERP Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CORE MULTI-TENANT TABLES
-- ============================================================

-- Organizations (Schools/Tenants)
CREATE TABLE IF NOT EXISTS organizations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_url TEXT,
  subscription_plan TEXT DEFAULT 'basic' CHECK (subscription_plan IN ('basic','standard','premium')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','active','suspended','rejected')),
  max_students INTEGER DEFAULT 100,
  max_teachers INTEGER DEFAULT 20,
  storage_limit_mb INTEGER DEFAULT 500,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Subscription Plans
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly','yearly')),
  max_students INTEGER DEFAULT 100,
  max_teachers INTEGER DEFAULT 20,
  storage_limit_mb INTEGER DEFAULT 500,
  features JSONB DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments / Subscriptions
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES plans(id),
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('subscription','setup','donation','fee')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','refunded')),
  payment_method TEXT,
  transaction_id TEXT,
  receipt_url TEXT,
  due_date DATE,
  paid_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- User Profiles (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id SERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('super_admin','school_admin','teacher','student','librarian','parent')),
  org_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- EDUCATION MODULE TABLES
-- ============================================================

-- Students
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  dob DATE,
  gender TEXT,
  address TEXT,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','graduated','transferred')),
  guardian_name TEXT,
  guardian_phone TEXT,
  roll_number TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Teachers
CREATE TABLE IF NOT EXISTS teachers (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  dob DATE,
  gender TEXT,
  address TEXT,
  hire_date DATE DEFAULT CURRENT_DATE,
  qualification TEXT,
  specialization TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','resigned')),
  employee_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Classes
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  section TEXT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  room TEXT,
  academic_year TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subjects
CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  teacher_id INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Syllabus
CREATE TABLE IF NOT EXISTS syllabus (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  topics JSONB DEFAULT '[]',
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Attendance
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL CHECK (status IN ('present','absent','late','leave')),
  marked_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date, class_id)
);

-- ============================================================
-- EXAM MODULE
-- ============================================================

-- Exams
CREATE TABLE IF NOT EXISTS exams (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  total_marks DECIMAL(10,2) NOT NULL,
  pass_percentage DECIMAL(5,2) DEFAULT 40.00,
  duration_minutes INTEGER DEFAULT 60,
  scheduled_date TIMESTAMPTZ,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','published','in_progress','completed')),
  instructions TEXT,
  created_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('mcq','descriptive','scenario')),
  question_text TEXT NOT NULL,
  options JSONB,
  correct_answer TEXT,
  marks DECIMAL(10,2) NOT NULL DEFAULT 1.00,
  order_num INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Exam Results
CREATE TABLE IF NOT EXISTS exam_results (
  id SERIAL PRIMARY KEY,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  marks_obtained DECIMAL(10,2) DEFAULT 0,
  total_marks DECIMAL(10,2) DEFAULT 0,
  percentage DECIMAL(5,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','passed','failed')),
  answers JSONB,
  evaluated_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  evaluated_at TIMESTAMPTZ,
  UNIQUE(exam_id, student_id)
);

-- ============================================================
-- FINANCE MODULE
-- ============================================================

-- Fees
CREATE TABLE IF NOT EXISTS fees (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_date DATE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','paid','overdue','waived')),
  type TEXT NOT NULL CHECK (type IN ('tuition','exam','library','transport','other')),
  receipt_no TEXT,
  payment_method TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Donations
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  donor_name TEXT NOT NULL,
  donor_email TEXT,
  donor_phone TEXT,
  amount DECIMAL(10,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  message TEXT,
  payment_method TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending','completed','failed')),
  receipt_no TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('salary','infrastructure','supplies','utilities','events','other')),
  amount DECIMAL(10,2) NOT NULL,
  date DATE DEFAULT CURRENT_DATE,
  description TEXT,
  receipt_url TEXT,
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- CALENDAR / EVENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_date DATE NOT NULL,
  event_type TEXT DEFAULT 'general' CHECK (event_type IN ('general','exam','holiday','meeting','deadline')),
  created_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TIMETABLE / CLASS SCHEDULES
-- ============================================================

CREATE TABLE IF NOT EXISTS class_schedules (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  period_number INTEGER NOT NULL CHECK (period_number > 0),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  academic_year TEXT,
  term TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, class_id, day_of_week, period_number),
  UNIQUE(org_id, teacher_id, day_of_week, period_number)
);

-- ============================================================
-- ASSIGNMENTS MODULE
-- ============================================================

ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS assignments (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATE NOT NULL,
  max_score DECIMAL(10,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','closed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_text TEXT,
  file_url TEXT,
  score DECIMAL(10,2),
  feedback TEXT,
  status TEXT DEFAULT 'submitted' CHECK (status IN ('pending','submitted','graded','returned')),
  submitted_at TIMESTAMPTZ DEFAULT now(),
  graded_at TIMESTAMPTZ,
  graded_by INTEGER REFERENCES teachers(id) ON DELETE SET NULL,
  UNIQUE(assignment_id, student_id)
);

ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignment_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_access_assignments" ON assignments FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);
CREATE POLICY "org_access_assignment_submissions" ON assignment_submissions FOR ALL USING (
  assignment_id IN (SELECT id FROM assignments WHERE org_id = get_user_org_id(auth.uid()))
);
CREATE POLICY "student_self_assignments" ON assignments FOR SELECT USING (
  class_id IN (SELECT class_id FROM students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "student_self_submissions" ON assignment_submissions FOR ALL USING (
  student_id IN (SELECT id FROM students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- ============================================================
-- NOTES MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_notes" ON notes FOR ALL USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- ============================================================
-- PARENT COMMUNICATION MODULE
-- ============================================================

-- Links parents to their children (one parent can have many children, one child can have many parents)
CREATE TABLE IF NOT EXISTS parent_students (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  relationship TEXT DEFAULT 'parent' CHECK (relationship IN ('parent','guardian','other')),
  is_primary BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_id, student_id)
);

-- Messages/communications from school/teachers to parents
CREATE TABLE IF NOT EXISTS parent_communications (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')),
  sent_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE parent_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_communications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_parent_students_profile ON parent_students(profile_id);
CREATE INDEX IF NOT EXISTS idx_parent_students_student ON parent_students(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_comm_org ON parent_communications(org_id);
CREATE INDEX IF NOT EXISTS idx_parent_comm_student ON parent_communications(student_id);
CREATE INDEX IF NOT EXISTS idx_parent_comm_sender ON parent_communications(sender_id);

-- ============================================================
-- LIBRARY MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS library_books (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  publisher TEXT,
  published_year INTEGER,
  category TEXT,
  total_copies INTEGER DEFAULT 1,
  available_copies INTEGER DEFAULT 1,
  shelf_location TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_members (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  student_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  profile_id INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  member_id TEXT UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  membership_type TEXT DEFAULT 'student' CHECK (membership_type IN ('student','teacher','staff','external')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_transactions (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  book_id INTEGER NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES library_members(id) ON DELETE CASCADE,
  borrow_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  return_date DATE,
  status TEXT DEFAULT 'borrowed' CHECK (status IN ('borrowed','returned','overdue','lost')),
  issued_by INTEGER REFERENCES profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS library_fines (
  id SERIAL PRIMARY KEY,
  org_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  transaction_id INTEGER NOT NULL REFERENCES library_transactions(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES library_members(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  days_overdue INTEGER DEFAULT 0,
  paid BOOLEAN DEFAULT false,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE library_fines ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_access_library_books') THEN
    CREATE POLICY "org_access_library_books" ON library_books FOR ALL USING (
      org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_access_library_members') THEN
    CREATE POLICY "org_access_library_members" ON library_members FOR ALL USING (
      org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_access_library_transactions') THEN
    CREATE POLICY "org_access_library_transactions" ON library_transactions FOR ALL USING (
      org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'org_access_library_fines') THEN
    CREATE POLICY "org_access_library_fines" ON library_fines FOR ALL USING (
      org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
    );
  END IF;
END
$$;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_students_org_id ON students(org_id);
CREATE INDEX IF NOT EXISTS idx_teachers_org_id ON teachers(org_id);
CREATE INDEX IF NOT EXISTS idx_classes_org_id ON classes(org_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_exams_class ON exams(class_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_class ON class_schedules(class_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_teacher ON class_schedules(teacher_id);
CREATE INDEX IF NOT EXISTS idx_class_schedules_day ON class_schedules(day_of_week);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(org_id);
CREATE INDEX IF NOT EXISTS idx_notes_profile ON notes(profile_id);
CREATE INDEX IF NOT EXISTS idx_library_books_org ON library_books(org_id);
CREATE INDEX IF NOT EXISTS idx_library_members_org ON library_members(org_id);
CREATE INDEX IF NOT EXISTS idx_library_transactions_org ON library_transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_library_transactions_member ON library_transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_library_transactions_book ON library_transactions(book_id);
CREATE INDEX IF NOT EXISTS idx_library_transactions_status ON library_transactions(status);
CREATE INDEX IF NOT EXISTS idx_library_fines_member ON library_fines(member_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS helper functions (SECURITY DEFINER to avoid recursive policy evaluation)
CREATE OR REPLACE FUNCTION is_super_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE user_id = uid AND role = 'super_admin');
END;
$$;

CREATE OR REPLACE FUNCTION get_user_org_id(uid UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER STABLE AS $$
DECLARE org INTEGER;
BEGIN
  SELECT org_id INTO org FROM public.profiles WHERE user_id = uid;
  RETURN org;
END;
$$;

-- Super Admin sees all
CREATE POLICY "super_admin_all_organizations" ON organizations FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "super_admin_all_plans" ON plans FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "super_admin_all_payments" ON payments FOR ALL USING (is_super_admin(auth.uid()));
CREATE POLICY "super_admin_all_profiles" ON profiles FOR ALL USING (is_super_admin(auth.uid()));

-- Anyone can read plans
CREATE POLICY "anyone_read_plans" ON plans FOR SELECT USING (true);

-- Tenant-based access (org_id scoped)
CREATE POLICY "org_access_organizations" ON organizations FOR SELECT USING (
  id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_profiles" ON profiles FOR SELECT USING (
  user_id = auth.uid() OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_students" ON students FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_teachers" ON teachers FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_classes" ON classes FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_subjects" ON subjects FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_syllabus" ON syllabus FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_attendance" ON attendance FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_exams" ON exams FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_questions" ON questions FOR ALL USING (
  exam_id IN (SELECT id FROM exams WHERE org_id = get_user_org_id(auth.uid()))
);

CREATE POLICY "org_access_exam_results" ON exam_results FOR ALL USING (
  exam_id IN (SELECT id FROM exams WHERE org_id = get_user_org_id(auth.uid()))
);

CREATE POLICY "org_access_fees" ON fees FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_donations" ON donations FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_expenses" ON expenses FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_events" ON events FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "org_access_class_schedules" ON class_schedules FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Student self-access
CREATE POLICY "student_self_attendance" ON attendance FOR SELECT USING (
  student_id IN (SELECT id FROM students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "student_self_exam_results" ON exam_results FOR SELECT USING (
  student_id IN (SELECT id FROM students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- Parent self-access (view own children's data)
CREATE POLICY "parent_self_students" ON parent_students FOR ALL USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "org_access_parent_students" ON parent_students FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

CREATE POLICY "parent_self_communications" ON parent_communications FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "org_access_parent_communications" ON parent_communications FOR ALL USING (
  org_id = get_user_org_id(auth.uid()) OR is_super_admin(auth.uid())
);

-- Parent can view their children's attendance, results, fees, assignments, schedule
CREATE POLICY "parent_self_attendance" ON attendance FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "parent_self_exam_results" ON exam_results FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "parent_self_fees" ON fees FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "parent_self_assignments" ON assignments FOR SELECT USING (
  class_id IN (SELECT class_id FROM students WHERE id IN (SELECT student_id FROM parent_students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())))
);
CREATE POLICY "parent_self_submissions" ON assignment_submissions FOR SELECT USING (
  student_id IN (SELECT student_id FROM parent_students WHERE profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()))
);

-- ============================================================
-- GRANTS
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ============================================================
-- SEED DATA
-- ============================================================

-- Default Plans
INSERT INTO plans (name, slug, description, price, billing_cycle, max_students, max_teachers, storage_limit_mb, features) VALUES
('Basic', 'basic', 'For small schools just getting started', 0, 'monthly', 100, 20, 500, '["Up to 100 students","Up to 20 teachers","500 MB storage","Basic reports","Email support"]'),
('Standard', 'standard', 'For growing institutions', 4999, 'monthly', 500, 50, 2000, '["Up to 500 students","Up to 50 teachers","2 GB storage","Advanced reports","Exam system","Priority support"]'),
('Premium', 'premium', 'For large institutions with full features', 9999, 'monthly', 999999, 999999, 10000, '["Unlimited students","Unlimited teachers","10 GB storage","All reports","Full exam system","Donation management","Calendar integration","Export to CSV/Excel","API access","Dedicated support"]')
ON CONFLICT (slug) DO NOTHING;

-- Demo Organization
INSERT INTO organizations (name, slug, email, phone, address, subscription_plan, status, max_students, max_teachers) VALUES
('Demo International School', 'demo-school', 'admin@demoschool.edu', '+1-555-0100', '123 Education Lane, Learning City', 'standard', 'active', 500, 50),
('Springfield Academy', 'springfield-academy', 'contact@springfield.edu', '+1-555-0200', '456 Knowledge Ave, Springfield', 'premium', 'active', 999999, 999999),
('Hillcrest Elementary', 'hillcrest-elementary', 'info@hillcrest.edu', '+1-555-0300', '789 Wisdom Street, Hillcrest', 'basic', 'pending', 100, 20)
ON CONFLICT (slug) DO NOTHING;

-- Function: Auto-create profile on user signup (trigger)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, full_name)
  VALUES (NEW.id, NEW.email, 'school_admin', COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
