-- =====================================================================
--  HR System — Cloudflare D1 schema  (DRAFT for review)
--  รพ.เชียงราย ราม · ระบบบริหารทรัพยากรบุคคล
--
--  ขอบเขต D1: 4 ระบบ — eval (ประเมินผล), training (ฝึกอบรม),
--             transfer (ย้ายแผนก), exec (dashboard, อ่าน/รวมผลอย่างเดียว)
--  NOT in D1: recruit (ใบสมัคร + manpower)  → อ่าน/เขียนสดผ่าน Google Sheets API
--
--  DB นี้แยกขาดจาก CRR Asset โดยสิ้นเชิง (D1 instance ใหม่ คนละ binding)
--  Dialect: SQLite (Cloudflare D1).  วันที่/เวลาเก็บเป็น TEXT ISO-8601.
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ============================================================
--  A. ORG STRUCTURE (อ้างอิงร่วมทุกระบบ) — seed จาก orgStructure ใน design
-- ============================================================
CREATE TABLE divisions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL UNIQUE,           -- 'ฝ่ายเทคนิคบริการ'
  approver_name TEXT,                           -- ผู้อนุมัติประจำฝ่าย
  approver_role TEXT,                           -- 'รองผู้อำนวยการฝ่าย...'
  sort_order    INTEGER DEFAULT 0
);

CREATE TABLE departments (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  division_id INTEGER NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                    -- 'เภสัชกรรม'
  UNIQUE (division_id, name)
);

-- ============================================================
--  B. AUTH + RBAC
-- ============================================================
-- บทบาท (role) 5 ตัว ตรงกับ design: hr | head | deputy | deputyHR | admin
--   deputyHR = รองผอ.ฝ่ายบริหารค่าตอบแทนฯ ผู้อนุมัติขั้นสุดท้าย (role แยกของตัวเอง)
CREATE TABLE users (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  username            TEXT NOT NULL UNIQUE,
  password_hash       TEXT NOT NULL,            -- PBKDF2-SHA256 (Web Crypto)
  password_salt       TEXT NOT NULL,
  full_name           TEXT NOT NULL,
  role                TEXT NOT NULL CHECK (role IN ('hr','head','deputy','deputyHR','admin')),
  role_title          TEXT,                     -- ตำแหน่งสำหรับแสดงผล
  scope_division_id   INTEGER REFERENCES divisions(id),   -- NULL = ทั้งองค์กร
  scope_department_id INTEGER REFERENCES departments(id), -- NULL = ทั้งฝ่าย
  color               TEXT,
  initial             TEXT,
  is_active           INTEGER NOT NULL DEFAULT 1,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- session token (httpOnly cookie) — server-side validation
CREATE TABLE sessions (
  token       TEXT PRIMARY KEY,                 -- 32-byte random hex
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at  TEXT NOT NULL,
  user_agent  TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- RBAC matrix (roleMatrix ใน design): role × module → access level
--   modules: recruit | eval | training | transfer | exec | permissions
--   access : full | scope | approve | view | submit | none
CREATE TABLE role_module_access (
  role    TEXT NOT NULL CHECK (role IN ('hr','head','deputy','deputyHR','admin')),
  module  TEXT NOT NULL,
  access  TEXT NOT NULL CHECK (access IN ('full','scope','approve','view','submit','none')),
  PRIMARY KEY (role, module)
);

-- ============================================================
--  C. SYSTEM 2 — EVAL (ประเมินผลพนักงานทดลองงาน)
-- ============================================================
CREATE TABLE employees (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name     TEXT NOT NULL,
  position      TEXT,
  department_id INTEGER REFERENCES departments(id),
  division_id   INTEGER REFERENCES divisions(id),
  start_date    TEXT,                           -- ISO date วันเริ่มงาน (คำนวณรอบ 30/60/90)
  emp_status    TEXT NOT NULL DEFAULT 'probation'
                CHECK (emp_status IN ('probation','passed','transferred','resigned')),
  color         TEXT,
  initial       TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_emp_dept ON employees(department_id);
CREATE INDEX idx_emp_div  ON employees(division_id);
CREATE INDEX idx_emp_status ON employees(emp_status);

-- หัวข้อประเมิน 10 ข้อ (อ้างอิง/seed คงที่) — owner: hr (ข้อ 1-3), head (ข้อ 4-10)
CREATE TABLE eval_topics (
  id         INTEGER PRIMARY KEY,               -- 1..10
  owner      TEXT NOT NULL CHECK (owner IN ('hr','head')),
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

-- ใบประเมิน 1 ใบ ต่อ พนักงาน ต่อ รอบ (30/60/90)
-- workflow: draft → head_submitted → pending_deputy → approved | rejected
CREATE TABLE evaluations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id  INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  round        INTEGER NOT NULL CHECK (round IN (30,60,90)),
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft','head_submitted','pending_deputy','approved','rejected')),
  grade        TEXT,                            -- เกรดสรุป (คำนวณจากคะแนนรวม)
  total_score  INTEGER,                         -- คะแนนรวม (cache)
  suggestion   TEXT,                            -- ข้อเสนอแนะหัวหน้า
  decision     TEXT,                            -- ผ่าน / ทดลองต่อ / ยุติ ...
  head_user_id INTEGER REFERENCES users(id),    -- ผู้ประเมิน (หัวหน้าแผนก)
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (employee_id, round)
);
CREATE INDEX idx_eval_emp ON evaluations(employee_id);
CREATE INDEX idx_eval_status ON evaluations(status);

-- คะแนนรายหัวข้อ (0-10)
CREATE TABLE evaluation_scores (
  evaluation_id INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  topic_id      INTEGER NOT NULL REFERENCES eval_topics(id),
  score         INTEGER CHECK (score BETWEEN 0 AND 10),
  PRIMARY KEY (evaluation_id, topic_id)
);

-- log การอนุมัติประเมิน (head → deputy) — workflow state จริง
CREATE TABLE evaluation_approvals (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  evaluation_id   INTEGER NOT NULL REFERENCES evaluations(id) ON DELETE CASCADE,
  step            TEXT NOT NULL CHECK (step IN ('head','deputy')),
  approver_user_id INTEGER REFERENCES users(id),
  status          TEXT NOT NULL CHECK (status IN ('approved','rejected')),
  note            TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_evalappr_eval ON evaluation_approvals(evaluation_id);

-- ============================================================
--  D. SYSTEM 3 — TRAINING (ข้อมูลฝึกอบรม)
-- ============================================================
CREATE TABLE training_courses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course      TEXT NOT NULL,
  trainer     TEXT,
  course_date TEXT,                             -- ISO date
  month_label TEXT,                             -- 'มิ.ย. 2569' (สำหรับจัดกลุ่มปฏิทิน)
  target      INTEGER NOT NULL DEFAULT 0,       -- เป้าหมายจำนวนผู้เข้าอบรม
  status      TEXT NOT NULL DEFAULT 'planned'
              CHECK (status IN ('planned','upcoming','done')),
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_course_date ON training_courses(course_date);

CREATE TABLE training_attendees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id   INTEGER NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  employee_id INTEGER REFERENCES employees(id), -- nullable (อาจกรอกชื่ออิสระ)
  name        TEXT NOT NULL,
  position    TEXT,
  result      TEXT CHECK (result IN ('ผ่าน','ไม่ผ่าน')),
  score       INTEGER
);
CREATE INDEX idx_att_course ON training_attendees(course_id);

-- ============================================================
--  E. SYSTEM 4 — TRANSFER (คำขอย้ายแผนก, workflow 3 ขั้น)
--     ขั้น 1 submit → ขั้น 2 head อนุมัติ → ขั้น 3 hr อนุมัติขั้นสุดท้าย
-- ============================================================
CREATE TABLE transfer_requests (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id        INTEGER REFERENCES employees(id),
  name               TEXT NOT NULL,
  position           TEXT,
  from_department_id INTEGER REFERENCES departments(id),
  from_dept_name     TEXT,                      -- snapshot ชื่อแผนกเดิม
  to_division_id     INTEGER REFERENCES divisions(id),
  to_department_id   INTEGER REFERENCES departments(id),
  to_dept_name       TEXT,                      -- snapshot ชื่อแผนกใหม่
  new_position       TEXT,
  reason             TEXT,
  head_status        TEXT NOT NULL DEFAULT 'pending'
                     CHECK (head_status IN ('pending','approved','rejected')),
  hr_status          TEXT NOT NULL DEFAULT 'pending'
                     CHECK (hr_status IN ('pending','approved','rejected')),
  overall_status     TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (overall_status IN ('submitted','head_approved','completed','rejected')),
  requester_user_id  INTEGER REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_treq_overall ON transfer_requests(overall_status);

CREATE TABLE transfer_approvals (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id       INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
  step             TEXT NOT NULL CHECK (step IN ('head','hr')),
  approver_user_id INTEGER REFERENCES users(id),
  status           TEXT NOT NULL CHECK (status IN ('approved','rejected')),
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tappr_req ON transfer_approvals(request_id);

-- ============================================================
--  F. CROSS-CUTTING — notifications + activity log
-- ============================================================
CREATE TABLE notifications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  target_user_id INTEGER REFERENCES users(id),  -- เจาะจงผู้ใช้
  target_role    TEXT,                          -- หรือกระจายตามบทบาท (เลือกอย่างใดอย่างหนึ่ง)
  icon           TEXT,
  text           TEXT NOT NULL,
  kind           TEXT,                          -- eval | recruit | transfer | training
  link           TEXT,                          -- deep-link ในแอป
  is_read        INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notif_user ON notifications(target_user_id, is_read);

CREATE TABLE activity_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  actor_name  TEXT,                             -- snapshot ชื่อผู้กระทำ
  module      TEXT,                             -- auth|eval|training|transfer|recruit
  action      TEXT NOT NULL,                    -- 'login','approve_eval','submit_transfer',...
  entity_type TEXT,
  entity_id   INTEGER,
  detail      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_act_module ON activity_log(module, created_at);

-- ============================================================
--  G. SYSTEM 5 — EXEC (dashboard)
--     ไม่มีตารางของตัวเอง: API รวมผลจาก D1 (employees/training/transfer)
--     + เรียก Google Sheets (recruit) มาประกอบ KPI
--     view ช่วยสรุปอัตรากำลังจาก D1 (manpower จริงมาจาก Sheets)
-- ============================================================
-- ตัวอย่าง view สรุปสถานะพนักงานรายฝ่าย (ใช้ใน exec/summary)
CREATE VIEW v_emp_status_by_division AS
SELECT d.name AS division,
       SUM(CASE WHEN e.emp_status='probation'   THEN 1 ELSE 0 END) AS probation,
       SUM(CASE WHEN e.emp_status='passed'      THEN 1 ELSE 0 END) AS passed,
       SUM(CASE WHEN e.emp_status='transferred' THEN 1 ELSE 0 END) AS transferred,
       SUM(CASE WHEN e.emp_status='resigned'    THEN 1 ELSE 0 END) AS resigned,
       COUNT(*) AS total
FROM employees e
LEFT JOIN divisions d ON d.id = e.division_id
GROUP BY d.name;
