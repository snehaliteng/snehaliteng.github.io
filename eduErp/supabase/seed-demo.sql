-- Seed demo data for Demo International School (org_id=1)
-- Run this after logging in as super_admin or directly via SQL editor

-- ============ TEACHERS ============
INSERT INTO teachers (org_id, first_name, last_name, email, phone, qualification, specialization, status, employee_id)
SELECT * FROM (VALUES
  (1, 'Rajesh', 'Kumar', 'rajesh.kumar@demoschool.edu', '+91-9876543210', 'M.Sc. Mathematics', 'Mathematics', 'active', 'TCH-001'),
  (1, 'Priya', 'Sharma', 'priya.sharma@demoschool.edu', '+91-9876543211', 'M.A. English', 'English Literature', 'active', 'TCH-002'),
  (1, 'Amit', 'Verma', 'amit.verma@demoschool.edu', '+91-9876543212', 'M.Sc. Physics', 'Physics', 'active', 'TCH-003'),
  (1, 'Sunita', 'Patel', 'sunita.patel@demoschool.edu', '+91-9876543213', 'M.Sc. Chemistry', 'Chemistry', 'active', 'TCH-004'),
  (1, 'Vikram', 'Singh', 'vikram.singh@demoschool.edu', '+91-9876543214', 'M.A. History', 'History & Civics', 'active', 'TCH-005'),
  (1, 'Anita', 'Desai', 'anita.desai@demoschool.edu', '+91-9876543215', 'M.Sc. Biology', 'Biology', 'active', 'TCH-006'),
  (1, 'Rohan', 'Joshi', 'rohan.joshi@demoschool.edu', '+91-9876543216', 'M.A. Hindi', 'Hindi', 'active', 'TCH-007'),
  (1, 'Deepa', 'Nair', 'deepa.nair@demoschool.edu', '+91-9876543217', 'M.A. Geography', 'Geography', 'active', 'TCH-008'),
  (1, 'Suresh', 'Reddy', 'suresh.reddy@demoschool.edu', '+91-9876543218', 'M.C.A.', 'Computer Science', 'active', 'TCH-009'),
  (1, 'Kavita', 'Mehta', 'kavita.mehta@demoschool.edu', '+91-9876543219', 'M.P.Ed.', 'Physical Education', 'active', 'TCH-010')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM teachers WHERE org_id = 1 LIMIT 1);

-- ============ CLASSES ============
INSERT INTO classes (org_id, name, section, teacher_id, room, academic_year)
SELECT * FROM (VALUES
  (1, 'Class 6', 'A', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1), '101', '2026-27'),
  (1, 'Class 6', 'B', (SELECT id FROM teachers WHERE employee_id = 'TCH-002' LIMIT 1), '102', '2026-27'),
  (1, 'Class 7', 'A', (SELECT id FROM teachers WHERE employee_id = 'TCH-003' LIMIT 1), '103', '2026-27'),
  (1, 'Class 7', 'B', (SELECT id FROM teachers WHERE employee_id = 'TCH-004' LIMIT 1), '104', '2026-27'),
  (1, 'Class 8', 'A', (SELECT id FROM teachers WHERE employee_id = 'TCH-005' LIMIT 1), '105', '2026-27'),
  (1, 'Class 8', 'B', (SELECT id FROM teachers WHERE employee_id = 'TCH-006' LIMIT 1), '106', '2026-27'),
  (1, 'Class 9', 'A', (SELECT id FROM teachers WHERE employee_id = 'TCH-007' LIMIT 1), '201', '2026-27'),
  (1, 'Class 9', 'B', (SELECT id FROM teachers WHERE employee_id = 'TCH-008' LIMIT 1), '202', '2026-27'),
  (1, 'Class 10', 'A', (SELECT id FROM teachers WHERE employee_id = 'TCH-009' LIMIT 1), '203', '2026-27'),
  (1, 'Class 10', 'B', (SELECT id FROM teachers WHERE employee_id = 'TCH-010' LIMIT 1), '204', '2026-27')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE org_id = 1 LIMIT 1);

-- ============ SUBJECTS ============
INSERT INTO subjects (org_id, class_id, name, code, teacher_id)
SELECT * FROM (VALUES
  (1, (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), 'Mathematics', 'MTH06', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), 'English', 'ENG06', (SELECT id FROM teachers WHERE employee_id = 'TCH-002' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), 'Science', 'SCI06', (SELECT id FROM teachers WHERE employee_id = 'TCH-003' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), 'Mathematics', 'MTH07', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), 'English', 'ENG07', (SELECT id FROM teachers WHERE employee_id = 'TCH-002' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), 'Science', 'SCI07', (SELECT id FROM teachers WHERE employee_id = 'TCH-006' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 8' AND section = 'A' LIMIT 1), 'Mathematics', 'MTH08', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 8' AND section = 'A' LIMIT 1), 'English', 'ENG08', (SELECT id FROM teachers WHERE employee_id = 'TCH-002' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 9' AND section = 'A' LIMIT 1), 'Mathematics', 'MTH09', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 9' AND section = 'A' LIMIT 1), 'Science', 'SCI09', (SELECT id FROM teachers WHERE employee_id = 'TCH-006' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 10' AND section = 'A' LIMIT 1), 'Mathematics', 'MTH10', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM classes WHERE name = 'Class 10' AND section = 'A' LIMIT 1), 'Science', 'SCI10', (SELECT id FROM teachers WHERE employee_id = 'TCH-006' LIMIT 1))
) AS v
WHERE NOT EXISTS (SELECT 1 FROM subjects WHERE org_id = 1 LIMIT 1);

-- ============ STUDENTS ============
INSERT INTO students (org_id, first_name, last_name, email, phone, dob, gender, address, roll_number, guardian_name, guardian_phone, status)
SELECT * FROM (VALUES
  (1, 'Arjun', 'Sharma', 'arjun.s@demoschool.edu', '+91-9000000001', '2014-05-12'::date, 'Male', '12 MG Road, Mumbai', 'STU-001', 'Mr. Sharma', '+91-9000000101', 'active'),
  (1, 'Divya', 'Patel', 'divya.p@demoschool.edu', '+91-9000000002', '2013-08-23'::date, 'Female', '45 Lake View, Delhi', 'STU-002', 'Mrs. Patel', '+91-9000000102', 'active'),
  (1, 'Rahul', 'Verma', 'rahul.v@demoschool.edu', '+91-9000000003', '2014-01-15'::date, 'Male', '78 Green Park, Bangalore', 'STU-003', 'Mr. Verma', '+91-9000000103', 'active'),
  (1, 'Sneha', 'Reddy', 'sneha.r@demoschool.edu', '+91-9000000004', '2013-11-30'::date, 'Female', '23 Oak Street, Hyderabad', 'STU-004', 'Dr. Reddy', '+91-9000000104', 'active'),
  (1, 'Aryan', 'Singh', 'aryan.s@demoschool.edu', '+91-9000000005', '2014-03-08'::date, 'Male', '56 Rose Avenue, Pune', 'STU-005', 'Col. Singh', '+91-9000000105', 'active'),
  (1, 'Priya', 'Joshi', 'priya.j@demoschool.edu', '+91-9000000006', '2013-07-19'::date, 'Female', '34 Lotus Colony, Chennai', 'STU-006', 'Mr. Joshi', '+91-9000000106', 'active'),
  (1, 'Karan', 'Mehta', 'karan.m@demoschool.edu', '+91-9000000007', '2012-09-02'::date, 'Male', '89 Sunshine Apartments, Kolkata', 'STU-007', 'Mrs. Mehta', '+91-9000000107', 'active'),
  (1, 'Isha', 'Nair', 'isha.n@demoschool.edu', '+91-9000000008', '2012-04-14'::date, 'Female', '67 River Side, Kochi', 'STU-008', 'Mr. Nair', '+91-9000000108', 'active'),
  (1, 'Rohit', 'Kumar', 'rohit.k@demoschool.edu', '+91-9000000009', '2011-12-25'::date, 'Male', '12 Central Market, Jaipur', 'STU-009', 'Mr. Kumar', '+91-9000000109', 'active'),
  (1, 'Ananya', 'Desai', 'ananya.d@demoschool.edu', '+91-9000000010', '2011-06-17'::date, 'Female', '55 Hill Top, Ahmedabad', 'STU-010', 'Mrs. Desai', '+91-9000000110', 'active'),
  (1, 'Vivaan', 'Gupta', 'vivaan.g@demoschool.edu', '+91-9000000011', '2014-10-05'::date, 'Male', '90 Peace Colony, Lucknow', 'STU-011', 'Mr. Gupta', '+91-9000000111', 'active'),
  (1, 'Neha', 'Bose', 'neha.b@demoschool.edu', '+91-9000000012', '2013-02-28'::date, 'Female', '22 Temple Road, Bhopal', 'STU-012', 'Dr. Bose', '+91-9000000112', 'active')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM students WHERE org_id = 1 LIMIT 1);

-- ============ SYLLABUS ============
INSERT INTO syllabus (org_id, class_id, subject_id, title, topics)
SELECT * FROM (VALUES
  (1, (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH06' LIMIT 1), 'Number Systems', '["Natural Numbers","Integers","Fractions","Decimals"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'ENG06' LIMIT 1), 'Grammar Basics', '["Nouns","Verbs","Tenses","Sentences"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'SCI06' LIMIT 1), 'Living World', '["Plants","Animals","Human Body","Food"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH07' LIMIT 1), 'Algebra', '["Expressions","Equations","Inequalities","Graphs"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'SCI07' LIMIT 1), 'Heat & Energy', '["Temperature","Heat Transfer","Energy Forms","Renewable Energy"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 8' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH08' LIMIT 1), 'Geometry', '["Triangles","Circles","Quadrilaterals","Mensuration"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 8' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'ENG08' LIMIT 1), 'Literature', '["Poetry","Prose","Drama","Composition"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 9' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH09' LIMIT 1), 'Polynomials', '["Degree","Operations","Factorization","Theorems"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 9' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'SCI09' LIMIT 1), 'Motion & Force', '["Laws of Motion","Gravity","Work","Energy"]'::jsonb),
  (1, (SELECT id FROM classes WHERE name = 'Class 10' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH10' LIMIT 1), 'Trigonometry', '["Ratios","Identities","Heights","Applications"]'::jsonb)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM syllabus WHERE org_id = 1 LIMIT 1);

-- ============ ATTENDANCE ============
INSERT INTO attendance (org_id, student_id, class_id, date, status, marked_by)
SELECT * FROM (VALUES
  (1, (SELECT id FROM students WHERE roll_number = 'STU-001' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-01'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-002' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-01'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-003' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-01'::date, 'absent', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-001' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-02'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-002' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-02'::date, 'late', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-003' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-02'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-001' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-03'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-002' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-03'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-003' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), '2026-07-03'::date, 'leave', (SELECT id FROM teachers WHERE employee_id = 'TCH-001' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-004' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), '2026-07-01'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-003' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-005' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), '2026-07-01'::date, 'present', (SELECT id FROM teachers WHERE employee_id = 'TCH-003' LIMIT 1)),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-004' LIMIT 1), (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), '2026-07-02'::date, 'absent', (SELECT id FROM teachers WHERE employee_id = 'TCH-003' LIMIT 1))
) AS v
WHERE NOT EXISTS (SELECT 1 FROM attendance WHERE org_id = 1 LIMIT 1);

-- ============ EXAMS ============
INSERT INTO exams (org_id, title, class_id, subject_id, total_marks, pass_percentage, duration_minutes, scheduled_date, status, instructions)
SELECT * FROM (VALUES
  (1, 'Mid-Term Mathematics', (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH06' LIMIT 1), 100, 40, 180, '2026-08-15 10:00:00'::timestamptz, 'published', 'Answer all questions. Use of calculator is not permitted.'),
  (1, 'Mid-Term English', (SELECT id FROM classes WHERE name = 'Class 6' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'ENG06' LIMIT 1), 100, 40, 180, '2026-08-16 10:00:00'::timestamptz, 'published', 'Read each passage carefully before answering.'),
  (1, 'Mid-Term Science', (SELECT id FROM classes WHERE name = 'Class 7' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'SCI07' LIMIT 1), 80, 40, 150, '2026-08-17 10:00:00'::timestamptz, 'draft', 'Draw diagrams wherever necessary.'),
  (1, 'Annual Mathematics', (SELECT id FROM classes WHERE name = 'Class 8' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH08' LIMIT 1), 100, 35, 180, '2026-12-10 10:00:00'::timestamptz, 'draft', 'All questions are compulsory.'),
  (1, 'Unit Test - Polynomials', (SELECT id FROM classes WHERE name = 'Class 9' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'MTH09' LIMIT 1), 40, 40, 90, '2026-07-20 10:00:00'::timestamptz, 'published', 'Short answer type questions.'),
  (1, 'Pre-Board Science', (SELECT id FROM classes WHERE name = 'Class 10' AND section = 'A' LIMIT 1), (SELECT id FROM subjects WHERE code = 'SCI10' LIMIT 1), 100, 33, 180, '2027-01-05 10:00:00'::timestamptz, 'draft', 'Follow CBSE pattern.')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM exams WHERE org_id = 1 LIMIT 1);

-- ============ QUESTIONS ============
INSERT INTO questions (exam_id, type, question_text, options, correct_answer, marks, order_num)
SELECT e.id, q.type, q.text, q.opts, q.answer, q.marks, q.ord
FROM exams e
CROSS JOIN (VALUES
  ('mcq', 'What is the value of π (pi) rounded to 2 decimal places?', '["3.14","3.16","3.12","3.18"]'::jsonb, '3.14', 2, 1),
  ('mcq', 'Which is the largest planet in our solar system?', '["Earth","Mars","Jupiter","Saturn"]'::jsonb, 'Jupiter', 2, 2),
  ('descriptive', 'Explain the process of photosynthesis.', NULL, 'Photosynthesis is the process by which green plants convert light energy into chemical energy.', 5, 3),
  ('mcq', 'What is the chemical symbol for water?', '["H2O","CO2","NaCl","O2"]'::jsonb, 'H2O', 1, 4),
  ('scenario', 'A train travels 120 km in 2 hours. What is its average speed?', NULL, '60 km/h', 4, 5),
  ('mcq', 'Who wrote "Romeo and Juliet"?', '["Shakespeare","Dickens","Tolstoy","Hemingway"]'::jsonb, 'Shakespeare', 1, 6)
) q(type, text, opts, answer, marks, ord)
WHERE e.title = 'Mid-Term Mathematics'
AND NOT EXISTS (SELECT 1 FROM questions WHERE exam_id = e.id LIMIT 1);

-- ============ FEES ============
INSERT INTO fees (org_id, student_id, amount, due_date, paid_date, status, type, payment_method)
SELECT * FROM (VALUES
  (1, (SELECT id FROM students WHERE roll_number = 'STU-001' LIMIT 1), 25000, '2026-06-15'::date, '2026-06-10'::date, 'paid', 'tuition', 'online'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-002' LIMIT 1), 30000, '2026-06-15'::date, '2026-06-12'::date, 'paid', 'tuition', 'bank_transfer'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-003' LIMIT 1), 22000, '2026-06-15'::date, NULL, 'pending', 'tuition', 'cash'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-004' LIMIT 1), 25000, '2026-06-15'::date, '2026-06-08'::date, 'paid', 'tuition', 'online'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-005' LIMIT 1), 30000, '2026-07-15'::date, NULL, 'overdue', 'tuition', 'cash'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-006' LIMIT 1), 22000, '2026-07-15'::date, '2026-07-02'::date, 'paid', 'tuition', 'bank_transfer'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-007' LIMIT 1), 25000, '2026-06-15'::date, NULL, 'pending', 'tuition', 'online'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-008' LIMIT 1), 30000, '2026-07-15'::date, NULL, 'overdue', 'tuition', 'cash'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-009' LIMIT 1), 22000, '2026-06-15'::date, '2026-06-05'::date, 'paid', 'tuition', 'online'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-010' LIMIT 1), 25000, '2026-07-15'::date, '2026-07-01'::date, 'paid', 'tuition', 'bank_transfer'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-001' LIMIT 1), 5000, '2026-06-15'::date, '2026-06-10'::date, 'paid', 'library', 'online'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-004' LIMIT 1), 3000, '2026-06-15'::date, '2026-06-08'::date, 'paid', 'exam', 'cash')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM fees WHERE org_id = 1 LIMIT 1);

-- ============ DONATIONS ============
INSERT INTO donations (org_id, donor_name, donor_email, donor_phone, amount, date, message, payment_method, status)
SELECT * FROM (VALUES
  (1, 'Infosys Foundation', 'foundation@infosys.com', '+91-8000000001', 500000, '2026-04-10'::date, 'Annual scholarship fund for meritorious students', 'bank_transfer', 'completed'),
  (1, 'Mr. Anil Agarwal', 'anil.agarwal@email.com', '+91-8000000002', 25000, '2026-05-20'::date, 'Library book donation drive', 'online', 'completed'),
  (1, 'Rotary Club Mumbai', 'rotary.mumbai@email.com', '+91-8000000003', 100000, '2026-06-01'::date, 'Science lab equipment grant', 'cheque', 'completed'),
  (1, 'Mrs. Sunita Devi', 'sunita.devi@email.com', '+91-8000000004', 5000, '2026-06-15'::date, 'Support for underprivileged students', 'online', 'completed')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM donations WHERE org_id = 1 LIMIT 1);

-- ============ EXPENSES ============
INSERT INTO expenses (org_id, category, amount, date, description, created_by)
SELECT * FROM (VALUES
  (1, 'salary', 450000, '2026-06-01'::date, 'Staff salaries for June 2026', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'infrastructure', 120000, '2026-05-15'::date, 'Classroom renovation - new desks and chairs', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'supplies', 35000, '2026-06-10'::date, 'Stationery and lab supplies', NULL),
  (1, 'utilities', 28000, '2026-06-05'::date, 'Electricity bill - June', NULL),
  (1, 'events', 55000, '2026-04-25'::date, 'Annual Day Celebration', NULL),
  (1, 'other', 15000, '2026-06-20'::date, 'Miscellaneous repairs', NULL)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE org_id = 1 LIMIT 1);

-- ============ EVENTS ============
INSERT INTO events (org_id, title, description, event_date, event_type, created_by)
SELECT * FROM (VALUES
  (1, 'Independence Day Celebration', 'Flag hoisting and cultural program', '2026-08-15'::date, 'general', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'Mid-Term Exams Begin', 'Start of mid-term examinations for all classes', '2026-08-15'::date, 'exam', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'PTA Meeting', 'Parent-Teacher Association quarterly meeting', '2026-09-10'::date, 'meeting', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'Gandhi Jayanti', 'School holiday - Gandhi Jayanti', '2026-10-02'::date, 'holiday', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'Annual Sports Day', 'Inter-house sports competition and awards', '2026-11-20'::date, 'general', NULL),
  (1, 'Fee Payment Deadline', 'Last date for tuition fee payment without late fee', '2026-07-15'::date, 'deadline', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'Diwali Break', 'School closed for Diwali festival', '2026-10-30'::date, 'holiday', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'Annual Examination', 'Start of annual examinations for classes 6-10', '2026-12-10'::date, 'exam', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1)),
  (1, 'Science Exhibition', 'Student science project exhibition', '2026-09-25'::date, 'general', NULL),
  (1, 'Result Day', 'Declaration of annual examination results', '2027-03-30'::date, 'deadline', (SELECT id FROM profiles WHERE email = 'demo@edu-erp.com' LIMIT 1))
) AS v
WHERE NOT EXISTS (SELECT 1 FROM events WHERE org_id = 1 LIMIT 1);

-- ============ CLASS SCHEDULES (Class 6A) ============
-- Periods: 1(09:00-09:45), 2(09:45-10:30), 3(10:30-11:15), 4(11:30-12:15), 5(12:15-13:00), 6(13:45-14:30)
INSERT INTO class_schedules (org_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, academic_year)
SELECT * FROM (VALUES
  -- Monday
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 1, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 1, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 1, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 1, 4, '11:30'::time, '12:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 1, 5, '12:15'::time, '13:00'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 1, 6, '13:45'::time, '14:30'::time, '2026-27'),
  -- Tuesday
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 2, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 2, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 2, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 2, 4, '11:30'::time, '12:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 2, 5, '12:15'::time, '13:00'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 2, 6, '13:45'::time, '14:30'::time, '2026-27'),
  -- Wednesday
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 3, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 3, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 3, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 3, 4, '11:30'::time, '12:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 3, 5, '12:15'::time, '13:00'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 3, 6, '13:45'::time, '14:30'::time, '2026-27'),
  -- Thursday
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 4, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 4, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 4, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 4, 4, '11:30'::time, '12:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 4, 5, '12:15'::time, '13:00'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 4, 6, '13:45'::time, '14:30'::time, '2026-27'),
  -- Friday
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 5, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 5, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 5, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 5, 4, '11:30'::time, '12:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 5, 5, '12:15'::time, '13:00'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 5, 6, '13:45'::time, '14:30'::time, '2026-27'),
  -- Saturday
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 6, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 6, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 6, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 6, 4, '11:30'::time, '12:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-003' LIMIT 1), 6, 5, '12:15'::time, '13:00'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 6' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG06' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 6, 6, '13:45'::time, '14:30'::time, '2026-27')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM class_schedules WHERE org_id = 1 LIMIT 1);

-- ============ CLASS SCHEDULES (Class 7A) ============
-- 7A subjects: Math(001), Eng(002), Sci(006). Periods carefully chosen to avoid overlapping
-- with 6A (same teachers 001 & 002 teach both classes).
-- 6A schedule for reference: Mon(P1-001,P2-002,P3-003,P4-001,P5-002,P6-003), Tue(P1-002,P2-003,P3-001,P4-003,P5-001,P6-002),
-- Wed(P1-003,P2-001,P3-002,P4-001,P5-002,P6-003), Thu(P1-001,P2-003,P3-002,P4-003,P5-001,P6-002),
-- Fri(P1-002,P2-001,P3-003,P4-002,P5-003,P6-001), Sat(P1-001,P2-002,P3-003,P4-001,P5-003,P6-002)
INSERT INTO class_schedules (org_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, academic_year)
SELECT * FROM (VALUES
  -- Monday: P1-Sci(006), P3-Math(001), P6-Eng(002)  [001 free@P3, 002 free@P6]
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-006' LIMIT 1), 1, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 1, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 1, 6, '13:45'::time, '14:30'::time, '2026-27'),
  -- Tuesday: P1-Math(001), P3-Eng(002), P5-Sci(006)  [001 free@P1, 002 free@P3]
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 2, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 2, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-006' LIMIT 1), 2, 5, '12:15'::time, '13:00'::time, '2026-27'),
  -- Wednesday: P1-Eng(002), P3-Sci(006), P5-Math(001)  [002 free@P1, 001 free@P5]
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 3, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-006' LIMIT 1), 3, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 3, 5, '12:15'::time, '13:00'::time, '2026-27'),
  -- Thursday: P1-Sci(006), P3-Math(001), P4-Eng(002)  [001 free@P3, 002 free@P4]
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-006' LIMIT 1), 4, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 4, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 4, 4, '11:30'::time, '12:15'::time, '2026-27'),
  -- Friday: P1-Math(001), P3-Eng(002), P5-Sci(006)  [001 free@P1, 002 free@P3]
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 5, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 5, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-006' LIMIT 1), 5, 5, '12:15'::time, '13:00'::time, '2026-27'),
  -- Saturday: P1-Eng(002), P3-Sci(006), P5-Math(001)  [002 free@P1, 001 free@P5]
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 6, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='SCI07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-006' LIMIT 1), 6, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH07' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 6, 5, '12:15'::time, '13:00'::time, '2026-27')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM class_schedules WHERE org_id = 1 AND class_id = (SELECT id FROM classes WHERE name='Class 7' AND section='A' LIMIT 1) LIMIT 1);

-- ============ CLASS SCHEDULES (Class 8A) ============
-- 8A has Math(001) and Eng(002) only → 2 periods/day. Periods chosen to avoid overlap with both 6A AND 7A.
INSERT INTO class_schedules (org_id, class_id, subject_id, teacher_id, day_of_week, period_number, start_time, end_time, academic_year)
SELECT * FROM (VALUES
  -- Monday: P2-Math(001), P4-Eng(002) [6A 001@P1,P4, 002@P2,P5; 7A 001@P3, 002@P6 → 001 free@P2, 002 free@P4]
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 1, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 1, 4, '11:30'::time, '12:15'::time, '2026-27'),
  -- Tuesday: P2-Eng(002), P4-Math(001) [6A 002@P1, 001@P3,P5; 7A 001@P1, 002@P3 → 001 free@P2,P4,P6; 002 free@P2,P4,P5]
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 2, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 2, 4, '11:30'::time, '12:15'::time, '2026-27'),
  -- Wednesday: P3-Math(001), P6-Eng(002) [6A 001@P2,P4; 7A 001@P5, 002@P1 → 001 free@P3,P6; 002 free@P2,P4,P6]
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 3, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 3, 6, '13:45'::time, '14:30'::time, '2026-27'),
  -- Thursday: P1-Eng(002), P2-Math(001) [6A 001@P1,P5, 002@P3,P6; 7A 001@P3, 002@P4 → 001 free@P2,P4,P6; 002 free@P1,P2,P5]
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 4, 1, '09:00'::time, '09:45'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 4, 2, '09:45'::time, '10:30'::time, '2026-27'),
  -- Friday: P3-Math(001), P5-Eng(002) [6A 001@P2,P6, 002@P1,P4; 7A 001@P1, 002@P3 → 001 free@P3,P4,P5; 002 free@P2,P5,P6]
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 5, 3, '10:30'::time, '11:15'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 5, 5, '12:15'::time, '13:00'::time, '2026-27'),
  -- Saturday: P2-Math(001), P4-Eng(002) [6A 001@P1,P4, 002@P2,P6; 7A 001@P5, 002@P1 → 001 free@P2,P3,P6; 002 free@P3,P4,P5]
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='MTH08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-001' LIMIT 1), 6, 2, '09:45'::time, '10:30'::time, '2026-27'),
  (1, (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1), (SELECT id FROM subjects WHERE code='ENG08' LIMIT 1), (SELECT id FROM teachers WHERE employee_id='TCH-002' LIMIT 1), 6, 4, '11:30'::time, '12:15'::time, '2026-27')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM class_schedules WHERE org_id = 1 AND class_id = (SELECT id FROM classes WHERE name='Class 8' AND section='A' LIMIT 1) LIMIT 1);

-- ============ LIBRARY BOOKS ============
INSERT INTO library_books (org_id, title, author, isbn, publisher, published_year, category, total_copies, available_copies, shelf_location, description)
SELECT * FROM (VALUES
  (1, 'Mathematics for Class 6', 'R.S. Aggarwal', '978-817709-001-1', 'S. Chand', 2023, 'Textbook', 10, 10, 'A-01', 'NCERT-aligned mathematics textbook for Class 6'),
  (1, 'Science for Class 6', 'Lakhmir Singh', '978-817709-002-8', 'S. Chand', 2023, 'Textbook', 10, 10, 'A-02', 'NCERT-aligned science textbook for Class 6'),
  (1, 'English Grammar in Use', 'Raymond Murphy', '978-110753-001-5', 'Cambridge', 2020, 'Reference', 5, 5, 'B-01', 'Essential English grammar reference'),
  (1, 'The Discovery of India', 'Jawaharlal Nehru', '978-014303-002-0', 'Penguin', 2010, 'History', 3, 3, 'C-01', 'Classic historical work on Indian heritage'),
  (1, 'Wings of Fire', 'Dr. APJ Abdul Kalam', '978-817371-001-2', 'Universities Press', 2015, 'Biography', 5, 5, 'C-02', 'Autobiography of former President of India'),
  (1, 'Harry Potter and the Philosophers Stone', 'J.K. Rowling', '978-140885-001-3', 'Bloomsbury', 2014, 'Fiction', 8, 8, 'D-01', 'Popular fantasy novel for young readers'),
  (1, 'The Adventures of Tom Sawyer', 'Mark Twain', '978-014062-001-0', 'Penguin', 2008, 'Fiction', 4, 4, 'D-02', 'Classic American childrens literature'),
  (1, 'Concise Physics for Class 7', 'R.P. Rishi', '978-817709-004-2', 'S. Chand', 2023, 'Textbook', 8, 8, 'A-03', 'Physics textbook for Class 7 students'),
  (1, 'Chemistry for Class 8', 'Dr. S.P. Jauhar', '978-817709-005-9', 'S. Chand', 2023, 'Textbook', 8, 8, 'A-04', 'Chemistry textbook for Class 8 students'),
  (1, 'Panchatantra Stories', 'Vishnu Sharma', '978-014045-001-7', 'Penguin', 2005, 'Fiction', 6, 6, 'D-03', 'Collection of ancient Indian fables'),
  (1, 'A Brief History of Time', 'Stephen Hawking', '978-055338-002-0', 'Bantam', 2011, 'Science', 2, 2, 'B-02', 'Groundbreaking book on cosmology'),
  (1, 'Computer Science with Python', 'Sumita Arora', '978-817709-007-3', 'S. Chand', 2024, 'Textbook', 6, 6, 'A-05', 'Python programming for Class 9-10 students')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM library_books WHERE org_id = 1 LIMIT 1);

-- ============ LIBRARY MEMBERS (from existing students) ============
INSERT INTO library_members (org_id, student_id, member_id, first_name, last_name, email, membership_type, status)
SELECT * FROM (VALUES
  (1, (SELECT id FROM students WHERE roll_number = 'STU-001' LIMIT 1), 'LM-000001', 'Arjun', 'Sharma', 'arjun.s@demoschool.edu', 'student', 'active'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-002' LIMIT 1), 'LM-000002', 'Divya', 'Patel', 'divya.p@demoschool.edu', 'student', 'active'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-004' LIMIT 1), 'LM-000004', 'Sneha', 'Reddy', 'sneha.r@demoschool.edu', 'student', 'active'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-006' LIMIT 1), 'LM-000006', 'Priya', 'Joshi', 'priya.j@demoschool.edu', 'student', 'active'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-008' LIMIT 1), 'LM-000008', 'Isha', 'Nair', 'isha.n@demoschool.edu', 'student', 'active'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-010' LIMIT 1), 'LM-000010', 'Ananya', 'Desai', 'ananya.d@demoschool.edu', 'student', 'active'),
  (1, (SELECT id FROM students WHERE roll_number = 'STU-007' LIMIT 1), 'LM-000007', 'Karan', 'Mehta', 'karan.m@demoschool.edu', 'student', 'active')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM library_members WHERE org_id = 1 LIMIT 1);

-- Add a teacher as library member too
INSERT INTO library_members (org_id, profile_id, student_id, member_id, first_name, last_name, email, membership_type, status)
SELECT * FROM (VALUES
  (1, (SELECT id FROM profiles WHERE email = 'rajesh.kumar@demoschool.edu' LIMIT 1), NULL::integer, 'LM-T001', 'Rajesh', 'Kumar', 'rajesh.kumar@demoschool.edu', 'teacher', 'active'),
  (1, (SELECT id FROM profiles WHERE email = 'priya.sharma@demoschool.edu' LIMIT 1), NULL::integer, 'LM-T002', 'Priya', 'Sharma', 'priya.sharma@demoschool.edu', 'teacher', 'active')
) AS v
WHERE NOT EXISTS (SELECT 1 FROM library_members WHERE member_id IN ('LM-T001','LM-T002') LIMIT 1);

-- ============ LIBRARY TRANSACTIONS ============
-- Borrow some books (some returned, some still out, one overdue for fine demo)
INSERT INTO library_transactions (org_id, book_id, member_id, borrow_date, due_date, return_date, status, issued_by, notes)
SELECT * FROM (VALUES
  -- Arjun borrowed Maths textbook - returned on time
  (1, (SELECT id FROM library_books WHERE isbn = '978-817709-001-1' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000001' LIMIT 1),
   '2026-06-10'::date, '2026-06-24'::date, '2026-06-22'::date, 'returned', NULL::integer, 'Borrowed for exam preparation'),
  -- Divya borrowed Harry Potter - returned
  (1, (SELECT id FROM library_books WHERE isbn = '978-140885-001-3' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000002' LIMIT 1),
   '2026-06-15'::date, '2026-06-29'::date, '2026-06-28'::date, 'returned', NULL::integer, NULL),
  -- Sneha borrowed Wings of Fire - still out (due soon)
  (1, (SELECT id FROM library_books WHERE isbn = '978-817371-001-2' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000004' LIMIT 1),
   '2026-07-01'::date, '2026-07-15'::date, NULL, 'borrowed', NULL::integer, 'Requested by teacher'),
  -- Priya borrowed English Grammar - still out
  (1, (SELECT id FROM library_books WHERE isbn = '978-110753-001-5' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000006' LIMIT 1),
   '2026-07-02'::date, '2026-07-16'::date, NULL, 'borrowed', NULL::integer, NULL),
  -- Isha borrowed Discovery of India - still out
  (1, (SELECT id FROM library_books WHERE isbn = '978-014303-002-0' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000008' LIMIT 1),
   '2026-07-03'::date, '2026-07-17'::date, NULL, 'borrowed', NULL::integer, NULL),
  -- Karan borrowed Tom Sawyer - returned late (will create fine)
  (1, (SELECT id FROM library_books WHERE isbn = '978-014062-001-0' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000007' LIMIT 1),
   '2026-06-01'::date, '2026-06-15'::date, '2026-06-25'::date, 'returned', NULL::integer, 'Returned 10 days late'),
  -- Ananya borrowed Panchatantra - still out (overdue!)
  (1, (SELECT id FROM library_books WHERE isbn = '978-014045-001-7' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000010' LIMIT 1),
   '2026-05-20'::date, '2026-06-03'::date, NULL, 'borrowed', NULL::integer, 'Overdue - needs follow up'),
  -- Rajesh (teacher) borrowed Brief History - still out
  (1, (SELECT id FROM library_books WHERE isbn = '978-055338-002-0' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-T001' LIMIT 1),
   '2026-07-05'::date, '2026-07-19'::date, NULL, 'borrowed', NULL::integer, NULL),
  -- Divya borrowed Computer Science - returned on time
  (1, (SELECT id FROM library_books WHERE isbn = '978-817709-007-3' LIMIT 1), (SELECT id FROM library_members WHERE member_id = 'LM-000002' LIMIT 1),
   '2026-06-20'::date, '2026-07-04'::date, '2026-07-02'::date, 'returned', NULL::integer, NULL)
) AS v
WHERE NOT EXISTS (SELECT 1 FROM library_transactions WHERE org_id = 1 LIMIT 1);

-- ============ LIBRARY FINES ============
-- Karan's late return: 10 days overdue x Rs5 = Rs50
INSERT INTO library_fines (org_id, transaction_id, member_id, amount, days_overdue, paid, paid_at)
SELECT 1, txn.id, txn.member_id, 50.00, 10, true, '2026-06-25 14:30:00'::timestamptz
FROM library_transactions txn
JOIN library_books b ON txn.book_id = b.id
WHERE b.isbn = '978-014062-001-0' AND txn.org_id = 1
AND NOT EXISTS (SELECT 1 FROM library_fines WHERE org_id = 1 LIMIT 1);

-- Ananya's overdue book: 36 days overdue x Rs5 = Rs180 (unpaid)
INSERT INTO library_fines (org_id, transaction_id, member_id, amount, days_overdue, paid, paid_at)
SELECT 1, txn.id, txn.member_id, 180.00, 36, false, NULL
FROM library_transactions txn
JOIN library_books b ON txn.book_id = b.id
WHERE b.isbn = '978-014045-001-7' AND txn.org_id = 1
AND NOT EXISTS (SELECT 1 FROM library_fines WHERE org_id = 1 AND paid = false LIMIT 1);
