-- ============================================================
--  ประเมินผลการปฏิบัติงานประจำปี (Annual Performance Evaluation)
--  Deliberately separate from the probation eval tables
--  (evaluations / evaluation_scores / eval_topics) — different
--  workflow, different scoring model (weighted categories, 0-5
--  per item, multiple simultaneous raters per category).
--  Reuses: employees, users, divisions, departments, notifications,
--  activity_log — none of those are touched by this migration
--  except the additive employees.job_level column below.
-- ============================================================

-- ระดับพนักงาน — required to auto-select the correct annual-eval template.
-- Nullable: an employee with no level set is blocked from being added to a
-- round rather than silently guessed.
ALTER TABLE employees ADD COLUMN job_level INTEGER CHECK (job_level IN (1,2,3,4));

-- ผู้ดำรงตำแหน่งประเมิน ที่ไม่ผูกกับ users.role เดิม (หัวหน้าส่วนงานคุณภาพ / ผู้อำนวยการ)
-- เก็บเป็น settings แบบ 1 แถวต่อบทบาท แทนการเพิ่มค่าใน users.role CHECK ซึ่งต้อง
-- rebuild ตารางทั้งหมด — ผู้ดูแลระบบตั้งค่าได้จากหน้า Admin, รองรับ "ผู้แทนประเมิน" ด้วย
CREATE TABLE annual_eval_roles (
  role_key    TEXT PRIMARY KEY CHECK (role_key IN ('quality_head','director')),
  user_id     INTEGER REFERENCES users(id),
  updated_by  TEXT,
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- แบบประเมิน (versioned). level_group ตรงกับฟอร์มต้นฉบับ 3 แบบ: 1 / 2-3 / 4
-- workflow_steps_json: ลำดับขั้นตอนจริงของ level นี้ เช่น
--   level1  : ["self","head","deputy","quality","hr","summary"]
--   level2-3: ["self","deputy","quality","hr","summary"]
--   level4  : ["self","director","hr","summary"]
CREATE TABLE annual_eval_templates (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  level_group        TEXT NOT NULL CHECK (level_group IN ('1','2-3','4')),
  version            INTEGER NOT NULL DEFAULT 1,
  label              TEXT NOT NULL,
  workflow_steps_json TEXT NOT NULL,
  is_active          INTEGER NOT NULL DEFAULT 1,
  created_by         TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
-- มีได้เพียง 1 เวอร์ชันที่ active ต่อ level_group ณ เวลาใดเวลาหนึ่ง
CREATE UNIQUE INDEX idx_annual_tmpl_active ON annual_eval_templates(level_group) WHERE is_active = 1;

-- หมวดการประเมิน (แต่ละหมวดมีน้ำหนักคะแนน และผู้ประเมินเฉพาะของหมวดนั้น)
-- rater_roles_json: รายชื่อ rater ที่คะแนนของหมวดนี้นับจริง เช่น '["head","deputy"]'
-- (เฉลี่ยถ้ามีมากกว่า 1 คน), '["quality_head"]', '["hr"]', '["director"]', '["deputy"]'
-- หมายเหตุ: พนักงานประเมินตนเอง (self) ถูกเก็บคะแนนทุกหมวดเพื่อเทียบเคียง แต่ไม่นับ
-- เข้าสูตรคะแนนทางการ (ตามฟอร์มต้นฉบับ)
CREATE TABLE annual_eval_categories (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id      INTEGER NOT NULL REFERENCES annual_eval_templates(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  weight_points    REAL NOT NULL,
  rater_roles_json TEXT NOT NULL,
  sort_order       INTEGER NOT NULL
);
CREATE INDEX idx_annual_cat_tmpl ON annual_eval_categories(template_id);

-- หัวข้อย่อยในแต่ละหมวด (ให้คะแนน 1-5 ต่อหัวข้อ)
CREATE TABLE annual_eval_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES annual_eval_categories(id) ON DELETE CASCADE,
  text        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL
);
CREATE INDEX idx_annual_item_cat ON annual_eval_items(category_id);

-- รอบประเมินประจำปีที่ HR สร้างขึ้น
CREATE TABLE annual_eval_rounds (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  year_be              INTEGER NOT NULL,             -- ปี พ.ศ.
  name                 TEXT NOT NULL,
  start_date           TEXT NOT NULL,
  end_date             TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','open','closed','cancelled')),
  scope_division_id    INTEGER REFERENCES divisions(id),    -- NULL = ทุกฝ่าย
  scope_department_id  INTEGER REFERENCES departments(id),  -- NULL = ทุกแผนกในขอบเขต
  created_by           TEXT,
  created_at           TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ใบประเมินประจำปี 1 ใบ ต่อ พนักงาน ต่อ รอบ
-- เก็บ snapshot ตำแหน่ง/แผนก/ฝ่าย/ผู้บังคับบัญชา ณ วันที่เปิดรอบ เพื่อไม่ให้ประวัติ
-- เปลี่ยนตามการย้ายแผนก/ตำแหน่งในอนาคต
CREATE TABLE annual_evaluations (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id              INTEGER NOT NULL REFERENCES annual_eval_rounds(id) ON DELETE CASCADE,
  employee_id           INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  template_id           INTEGER NOT NULL REFERENCES annual_eval_templates(id),
  snap_full_name        TEXT NOT NULL,
  snap_emp_code         TEXT,
  snap_position         TEXT,
  snap_department       TEXT,
  snap_division         TEXT,
  snap_job_level        INTEGER NOT NULL,
  snap_department_head  TEXT,
  snap_deputy_director  TEXT,
  snap_supervisor       TEXT,
  status                TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN (
                           'not_started','pending_self','pending_head','pending_deputy',
                           'pending_quality','pending_hr','pending_director','pending_summary',
                           'completed','returned','cancelled'
                         )),
  returned_reason       TEXT,
  cancel_reason         TEXT,
  self_submitted_at     TEXT,
  head_submitted_at     TEXT,
  deputy_submitted_at   TEXT,
  quality_submitted_at  TEXT,
  hr_submitted_at       TEXT,
  director_submitted_at TEXT,
  completed_at          TEXT,
  total_raw_score       REAL,
  total_weighted_score  REAL,   -- เต็ม 20
  total_percent         REAL,
  grade                 TEXT,
  created_by             TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (round_id, employee_id)
);
CREATE INDEX idx_annual_eval_round ON annual_evaluations(round_id);
CREATE INDEX idx_annual_eval_emp ON annual_evaluations(employee_id);
CREATE INDEX idx_annual_eval_status ON annual_evaluations(status);

-- คะแนนรายหัวข้อ ต่อผู้ประเมิน (self เก็บไว้เทียบเคียง ไม่นับเข้าสูตรทางการ)
-- ล็อกหลังส่ง (submitted_at ไม่เป็น NULL) — แก้ไขได้อีกครั้งเมื่อ HR ส่งกลับเท่านั้น
CREATE TABLE annual_eval_item_scores (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  annual_evaluation_id INTEGER NOT NULL REFERENCES annual_evaluations(id) ON DELETE CASCADE,
  item_id             INTEGER NOT NULL REFERENCES annual_eval_items(id),
  rater_role          TEXT NOT NULL CHECK (rater_role IN ('self','head','deputy','quality_head','hr','director')),
  score               INTEGER CHECK (score BETWEEN 0 AND 5),
  reason              TEXT,     -- บังคับกรอกเมื่อ score IN (1,2,5) — ตรวจที่ backend
  submitted_at        TEXT,
  created_by          TEXT,
  updated_by          TEXT,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (annual_evaluation_id, item_id, rater_role)
);
CREATE INDEX idx_annual_score_eval ON annual_eval_item_scores(annual_evaluation_id);

-- ประวัติการแก้ไขคะแนนแบบละเอียด (ค่าเดิม → ค่าใหม่ ผู้แก้ไข เวลา) — ตามข้อกำหนดความปลอดภัย
CREATE TABLE annual_eval_score_history (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  annual_evaluation_id  INTEGER NOT NULL REFERENCES annual_evaluations(id) ON DELETE CASCADE,
  item_id               INTEGER NOT NULL REFERENCES annual_eval_items(id),
  rater_role            TEXT NOT NULL,
  old_score             INTEGER,
  new_score             INTEGER,
  old_reason            TEXT,
  new_reason            TEXT,
  changed_by            TEXT,
  changed_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_annual_history_eval ON annual_eval_score_history(annual_evaluation_id);

-- สถิติการปฏิบัติงาน (ลา/สาย/อบรม/กิจกรรม/คณะกรรมการ/ใบเตือน) — กรอกเองโดย HR
-- จนกว่าจะมีการเชื่อมต่อระบบอื่นอัตโนมัติ ใช้เป็นข้อมูลอ้างอิงประกอบการให้คะแนน
-- หมวด "กฎระเบียบ" (คะแนน 5ส./ข้อสอบคุณภาพ ให้ตรงในคะแนนหัวข้อของหมวดคุณภาพโดยตรง)
CREATE TABLE annual_eval_stats (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  annual_evaluation_id    INTEGER NOT NULL UNIQUE REFERENCES annual_evaluations(id) ON DELETE CASCADE,
  period_start            TEXT,
  period_end              TEXT,
  sick_leave_days         REAL DEFAULT 0,
  personal_leave_days     REAL DEFAULT 0,
  vacation_leave_days     REAL DEFAULT 0,
  late_minutes            REAL DEFAULT 0,
  training_count          INTEGER DEFAULT 0,
  hospital_activity_count INTEGER DEFAULT 0,
  committee_count         INTEGER DEFAULT 0,
  warning_count           INTEGER DEFAULT 0,
  source                  TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','auto')),
  updated_by              TEXT,
  updated_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

-- เกณฑ์แปลงสถิติ → คะแนน (ตั้งค่าได้จาก Admin ไม่ Hard Code)
-- level_group = NULL หมายถึงใช้ร่วมกันทุกระดับ (เช่น ลา/สาย); training_count มีเกณฑ์
-- แยกตามระดับ (ระดับ 1 ต่างจาก 2-3-4) ตามฟอร์มต้นฉบับ
CREATE TABLE annual_eval_score_bands (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  metric      TEXT NOT NULL CHECK (metric IN (
                'sick_leave','personal_leave','vacation_leave','late_minutes',
                'training_count','hospital_activity','committee'
              )),
  -- ไม่ใช้ REFERENCES เพราะ level_group ไม่ unique บน annual_eval_templates (มีหลาย
  -- version ต่อ level_group ได้) — เป็นเพียง tag กรองข้อมูล ไม่ใช่ความสัมพันธ์เชิงตาราง
  level_group TEXT CHECK (level_group IN ('1','2-3','4') OR level_group IS NULL), -- NULL = ทุกระดับ
  min_value   REAL,     -- NULL = ไม่จำกัดขั้นต่ำ
  max_value   REAL,     -- NULL = ไม่จำกัดขั้นสูง
  score       INTEGER NOT NULL CHECK (score BETWEEN 0 AND 5),
  sort_order  INTEGER NOT NULL
);
CREATE INDEX idx_annual_bands_metric ON annual_eval_score_bands(metric, level_group);

-- ข้อคิดเห็น/แผนพัฒนา — รองรับหลายรายการต่อประเภท (item_order)
CREATE TABLE annual_eval_comments (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  annual_evaluation_id  INTEGER NOT NULL REFERENCES annual_evaluations(id) ON DELETE CASCADE,
  source                TEXT NOT NULL CHECK (source IN (
                           'self_strength','self_development','head_strength','head_development',
                           'deputy_strength','deputy_development','director_comment',
                           'next_year_kpi','dev_plan','training_recommend','hr_comment'
                         )),
  item_order            INTEGER NOT NULL DEFAULT 1,
  text                  TEXT NOT NULL DEFAULT '',
  updated_by            TEXT,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_annual_comments_eval ON annual_eval_comments(annual_evaluation_id, source);

-- ============================================================
--  Seed: 3 แบบประเมิน (level 1 / 2-3 / 4) ตามฟอร์มต้นฉบับ
--  FM-HR-01-28 ประเมินประจำปี — ชื่อหมวด/หัวข้อย่อย/น้ำหนัก คงตามต้นฉบับ
-- ============================================================

-- หมายเหตุ: ไม่มีขั้น "self" (พนักงานประเมินตนเอง) ในระบบ — พนักงานทั่วไปไม่มีบัญชี
-- Login ในระบบนี้ ผู้ใช้ (HR) ยืนยันให้ตัดขั้นตอนนี้ออก จะดำเนินการนอกระบบเอง
INSERT INTO annual_eval_templates (id, level_group, version, label, workflow_steps_json) VALUES
  (1, '1',   1, 'พนักงานระดับปฏิบัติงาน (ระดับ 1)',    '["head","deputy","quality","hr","summary"]'),
  (2, '2-3', 1, 'พนักงานระดับหัวหน้างาน (ระดับ 2-3)',  '["deputy","quality","hr","summary"]'),
  (3, '4',   1, 'พนักงานระดับบริหาร (ระดับ 4)',        '["director","hr","summary"]');

-- ── ระดับ 1 ──
INSERT INTO annual_eval_categories (id, template_id, name, weight_points, rater_roles_json, sort_order) VALUES
  (101, 1, 'ประสิทธิภาพและประสิทธิผลในการทำงาน บรรลุตามเป้าหมาย ( KPI )', 40, '["head","deputy"]', 1),
  (102, 1, 'ความสามารถในการเรียนรู้งานและการพัฒนาตนเอง', 10, '["head","deputy"]', 2),
  (103, 1, 'การมีมนุษยสัมพันธ์กับผู้ร่วมงาน และการติดต่อสื่อสาร', 10, '["head","deputy"]', 3),
  (104, 1, 'ประสิทธิภาพการปฏิบัติงานด้านงานคุณภาพ', 20, '["quality_head"]', 4),
  (105, 1, 'การปฏิบัติงานภายใต้กฏระเบียบ และการมีส่วนร่วม', 20, '["hr"]', 5);

INSERT INTO annual_eval_items (category_id, text, sort_order) VALUES
  (101, 'การปฏิบัติงานเป็นไปตามขั้นตอนที่วางไว้', 1),
  (101, 'การปฏิบัติงานมีความถูกต้องและรวดเร็ว', 2),
  (101, 'การปฎิบัติตามคำสั่งของผู้บังคับบัญชา', 3),
  (101, 'ประสิทธิภาพการปฏิบัติงานภายใต้ตัวชี้วัดของพนักงาน', 4),
  (102, 'มีความสามารถในการปฏิบัติงานในหน้าทีและความเข้าใจในงานที่ทำ', 1),
  (102, 'มีความสนใจการเรียนรู้งานและการปฏิบัติงาน', 2),
  (102, 'มีความสามารถในการแก้ไขปัญหางานเฉพาะได้ดี', 3),
  (102, 'การปรับตัวยอมรับวิธีการปฏิบัติงานใหม่ๆ หรือเสนอความคิดใหม่เพื่อพัฒนาระบบของบริษัทฯ', 4),
  (103, 'การให้ความร่วมมือช่วยเหลือผู้ร่วมงาน ผู้บังคับบัญชา และบริษัท', 1),
  (103, 'มีภาพพจน์และทัศนคติที่ดีต่อที่ทำงาน ผู้บังคับบัญชา และผู้ร่วมงาน', 2),
  (103, 'มีความเคารพ นับถือและให้เกียรติผู้บังคับบัญชา และผู้ร่วมงาน', 3),
  (103, 'มีจิตใจเอื้อเฟื้อและห่วงใยผู้ร่วมงาน ผู้บังคับบัญชาและบริษัท', 4),
  (104, 'การมีส่วนร่วมในกลุ่มงานที่ปฏิบัติงานเกี่ยวงานคุณภาพ ( คะแนน 5 ส.ของแผนก )', 1),
  (104, 'ความเข้าใจการปฏิบัติงานด้านคุณภาพเบื้องต้น ( ข้อสอบ 20 ข้อ )', 2),
  (105, 'การรักษากฏระเบียบและการมีวินัยในการทำงาน ( ใบเตือนลายลักษณ์อักษร 1 ใบ = 0 คะแนน )', 1),
  (105, 'การลางาน', 2),
  (105, 'การปฏิบัติงานมีความตรงต่อเวลาในการทำงาน', 3),
  (105, 'การเข้ารับการอบรมประจำปี', 4),
  (105, 'การมีส่วนร่วมกิจกรรมของโรงพยาบาล', 5),
  (105, 'การปฏิบัตินอกเหนือจากหน้าที่หลักของตัวเอง ( เป็นหนึ่งในคณะกรรมการใดคณะกรรมการหนึ่งของโรงพยาบาล )', 6);

-- ── ระดับ 2-3 ──
INSERT INTO annual_eval_categories (id, template_id, name, weight_points, rater_roles_json, sort_order) VALUES
  (201, 2, 'ประสิทธิภาพและประสิทธิผลในการทำงาน บรรลุตามเป้าหมาย ( KPI )', 40, '["deputy"]', 1),
  (202, 2, 'ความสามารถด้านการเป็นผู้บังคับบัญชาและการบริหารงาน', 30, '["deputy"]', 2),
  (203, 2, 'ประสิทธิภาพการปฏิบัติงานด้านงานคุณภาพ', 20, '["quality_head"]', 3),
  (204, 2, 'การปฏิบัติงานภายใต้กฏระเบียบ และการมีส่วนร่วม', 10, '["hr"]', 4);

INSERT INTO annual_eval_items (category_id, text, sort_order) VALUES
  (201, 'การปฏิบัติงานเป็นไปตามขั้นตอนที่วางไว้', 1),
  (201, 'การปฏิบัติงานมีความถูกต้องและรวดเร็ว', 2),
  (201, 'สามารถมอบหมายให้พนักงานภายในแผนก ปฏิบัติงานบรรลุตามเป้าหมาย KPI', 3),
  (201, 'ประสิทธิภาพการปฏิบัติงานภายใต้ตัวชี้วัดของหัวหน้างาน', 4),
  (202, 'สามารถพัฒนาบุคลากรภายในแผนกได้มีประสิทธิภาพ', 1),
  (202, 'สามารถแก้ปัญหาในการปฏิบัติงานได้ และมีหลักเกณฑ์ที่ถูกต้อง', 2),
  (202, 'สามารถบริหารอัตรากำลังคน ภายในแผนกได้มีประสิทธิภาพ', 3),
  (202, 'สามารถบริหารบุคลากรภายในแผนกให้อยู่ภายใต้กฏระเบียบของบริษัทฯได้เป็นอย่างดี', 4),
  (202, 'สามารถตอบข้อซักถามผู้บังคับบัญชาและผู้ใต้บังคับบัญชาได้ด้วยดี', 5),
  (203, 'การมีส่วนร่วมในกลุ่มงานที่ปฏิบัติงานเกี่ยวงานคุณภาพ ( คะแนน 5 ส.ของแผนก )', 1),
  (203, 'ความเข้าใจการปฏิบัติงานด้านคุณภาพเบื้องต้น ( ข้อสอบ 20 ข้อ )', 2),
  (204, 'การรักษากฏระเบียบและการมีวินัยในการทำงาน ( ใบเตือนลายลักษณ์อักษร 1 ใบ = 0 คะแนน )', 1),
  (204, 'การลางาน', 2),
  (204, 'การปฏิบัติงานมีความตรงต่อเวลาในการทำงาน', 3),
  (204, 'การเข้ารับการอบรมประจำปี', 4),
  (204, 'การมีส่วนร่วมกิจกรรมของโรงพยาบาล', 5);

-- ── ระดับ 4 ──
INSERT INTO annual_eval_categories (id, template_id, name, weight_points, rater_roles_json, sort_order) VALUES
  (301, 3, 'ประสิทธิภาพและประสิทธิผลในการทำงาน บรรลุตามเป้าหมาย ( KPI )', 50, '["director"]', 1),
  (302, 3, 'ความสามารถด้านการเป็นผู้บังคับบัญชาและการบริหารงาน', 40, '["director"]', 2),
  (303, 3, 'การปฏิบัติงานภายใต้กฏระเบียบ และการมีส่วนร่วม', 10, '["hr"]', 3);

INSERT INTO annual_eval_items (category_id, text, sort_order) VALUES
  (301, 'บริหารงานของฝ่ายได้อย่างถูกต้องและรวดเร็ว ตามที่ได้รับมอบหมายจากฝ่ายบริหาร', 1),
  (301, 'สามารถบริหารบุคลากรภายในฝ่ายให้อยู่ภายใต้กฏระเบียบของบริษัทฯได้เป็นอย่างดี', 2),
  (301, 'สามารถมอบหมายแผนกต่างๆภายในฝ่าย ให้ปฏิบัติงานบรรลุตามเป้าหมาย KPI', 3),
  (301, 'สามารถแก้ปัญหาในการปฏิบัติงานได้ และมีหลักเกณฑ์ที่ถูกต้อง', 4),
  (301, 'ประสิทธิภาพการปฏิบัติงานภายใต้ตัวชี้วัดของรองผู้อำนวยการฝ่าย', 5),
  (302, 'สามารถพัฒนาบุคลากรภายในแผนกได้มีประสิทธิภาพ', 1),
  (302, 'สามารถบริหารอัตรากำลังคน ภายในแผนกได้มีประสิทธิภาพ', 2),
  (302, 'สามารถสร้างแรงจูงใจพนักงานภายในฝ่ายให้ปฏิบัติตามนโยบายของบริษัทฯได้เป็นอย่างดี', 3),
  (303, 'การรักษากฏระเบียบและการมีวินัยในการทำงาน ( ใบเตือนลายลักษณ์อักษร 1 ใบ = 0 คะแนน )', 1),
  (303, 'การมีส่วนร่วมกิจกรรมของโรงพยาบาล', 2),
  (303, 'เป็นวิทยากรอบรมหรือเป็นผู้คิดค้นหลักสูตรในการนำมาอบรมพนักงานของบริษัทฯ', 3);

-- ============================================================
--  Seed: เกณฑ์แปลงสถิติ → คะแนน (ตามฟอร์มต้นฉบับ)
-- ============================================================

-- ลาป่วย (ทุกระดับ)
INSERT INTO annual_eval_score_bands (metric, level_group, min_value, max_value, score, sort_order) VALUES
  ('sick_leave', NULL, NULL, 5.999, 5, 1),
  ('sick_leave', NULL, 6,    6,     4, 2),
  ('sick_leave', NULL, 7,    12,    3, 3),
  ('sick_leave', NULL, 13,   18,    2, 4),
  ('sick_leave', NULL, 19,   24,    1, 5),
  ('sick_leave', NULL, 24.001, NULL, 0, 6);

-- ลากิจ (ทุกระดับ)
INSERT INTO annual_eval_score_bands (metric, level_group, min_value, max_value, score, sort_order) VALUES
  ('personal_leave', NULL, 0, 0, 5, 1),
  ('personal_leave', NULL, 1, 1, 3, 2),
  ('personal_leave', NULL, 2, 2, 2, 3),
  ('personal_leave', NULL, 3, NULL, 0, 4);

-- ลาพักผ่อน (ทุกระดับ)
INSERT INTO annual_eval_score_bands (metric, level_group, min_value, max_value, score, sort_order) VALUES
  ('vacation_leave', NULL, 0, 0, 5, 1),
  ('vacation_leave', NULL, 1, 1, 4, 2),
  ('vacation_leave', NULL, 2, 2, 3, 3),
  ('vacation_leave', NULL, 3, 3, 2, 4),
  ('vacation_leave', NULL, 4, 5, 1, 5),
  ('vacation_leave', NULL, 6, NULL, 0, 6);

-- สาย (นาที, ทุกระดับ)
INSERT INTO annual_eval_score_bands (metric, level_group, min_value, max_value, score, sort_order) VALUES
  ('late_minutes', NULL, NULL, 30, 5, 1),
  ('late_minutes', NULL, 31, 40, 4, 2),
  ('late_minutes', NULL, 41, 50, 3, 3),
  ('late_minutes', NULL, 51, 60, 2, 4),
  ('late_minutes', NULL, 61, 70, 1, 5),
  ('late_minutes', NULL, 70.001, NULL, 0, 6);

-- จำนวนหลักสูตรอบรม/ปี — ระดับ 1 ต่างจากระดับ 2-3 / 4
INSERT INTO annual_eval_score_bands (metric, level_group, min_value, max_value, score, sort_order) VALUES
  ('training_count', '1', 8.001, NULL, 5, 1),
  ('training_count', '1', 8, 8, 4, 2),
  ('training_count', '1', 7, 7, 3, 3),
  ('training_count', '1', 6, 6, 2, 4),
  ('training_count', '1', NULL, 5.999, 1, 5),
  ('training_count', '2-3', 12.001, NULL, 5, 1),
  ('training_count', '2-3', 12, 12, 4, 2),
  ('training_count', '2-3', 11, 11, 3, 3),
  ('training_count', '2-3', 10, 10, 2, 4),
  ('training_count', '2-3', NULL, 9, 1, 5),
  ('training_count', '4', 12.001, NULL, 5, 1),
  ('training_count', '4', 12, 12, 4, 2),
  ('training_count', '4', 11, 11, 3, 3),
  ('training_count', '4', 10, 10, 2, 4),
  ('training_count', '4', NULL, 9, 1, 5);

-- การเข้าร่วมกิจกรรมโรงพยาบาล / คณะกรรมการ — ฟอร์มต้นฉบับระบุเพียงเกณฑ์เดียว
-- (1 ครั้ง = 5 คะแนน) ตีความเป็น 2 ระดับ (มี/ไม่มี) จนกว่า HR จะปรับผ่านหน้า Admin
INSERT INTO annual_eval_score_bands (metric, level_group, min_value, max_value, score, sort_order) VALUES
  ('hospital_activity', NULL, 0, 0, 0, 1),
  ('hospital_activity', NULL, 1, NULL, 5, 2),
  ('committee', NULL, 0, 0, 0, 1),
  ('committee', NULL, 1, NULL, 5, 2);
