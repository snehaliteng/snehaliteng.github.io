CREATE TABLE IF NOT EXISTS qna_categories (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  parent_id INTEGER REFERENCES qna_categories(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL DEFAULT 0,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE qna_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own categories" ON qna_categories FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS qna_questions (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER NOT NULL REFERENCES qna_categories(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  created_at TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_qna_questions_cat ON qna_questions(category_id);
ALTER TABLE qna_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own questions" ON qna_questions FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS qna_answers (
  id INTEGER PRIMARY KEY,
  question_id INTEGER NOT NULL REFERENCES qna_questions(id) ON DELETE CASCADE,
  content_html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE INDEX idx_qna_answers_q ON qna_answers(question_id);
ALTER TABLE qna_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own answers" ON qna_answers FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS qna_tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE qna_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own tags" ON qna_tags FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS qna_question_tags (
  question_id INTEGER NOT NULL REFERENCES qna_questions(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES qna_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (question_id, tag_id)
);
ALTER TABLE qna_question_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users access question_tags via questions" ON qna_question_tags FOR ALL USING (
  EXISTS (SELECT 1 FROM qna_questions WHERE id = question_id AND user_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS qna_user_question_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES qna_questions(id) ON DELETE CASCADE,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER,
  PRIMARY KEY (user_id, question_id)
);
ALTER TABLE qna_user_question_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own prefs" ON qna_user_question_preferences FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS qna_user_page_preferences (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_key TEXT NOT NULL,
  visible_columns JSONB NOT NULL DEFAULT '[]',
  PRIMARY KEY (user_id, page_key)
);
ALTER TABLE qna_user_page_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own page prefs" ON qna_user_page_preferences FOR ALL USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS qna_job_applications (
  id INTEGER PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Applied',
  website TEXT,
  contact TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT
);
ALTER TABLE qna_job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users own jobs" ON qna_job_applications FOR ALL USING (user_id = auth.uid());
