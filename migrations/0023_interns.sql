-- นักศึกษาฝึกงาน (intern student management module)

CREATE TABLE IF NOT EXISTS intern_institutions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL UNIQUE,
  type       TEXT,                              -- มหาวิทยาลัย | วิทยาลัย | โรงเรียน | อื่นๆ
  province   TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS interns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  intern_code         TEXT NOT NULL UNIQUE,      -- INT-YYYY-NNNN (auto-generated)

  -- Section A: student info
  prefix              TEXT,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  education_level     TEXT,                      -- ระดับการศึกษา
  faculty             TEXT,                      -- คณะ
  major               TEXT,                      -- สาขาวิชา
  year_level          TEXT,                      -- ชั้นปี
  phone               TEXT,
  photo_url            TEXT,                      -- base64 data URL, optional

  -- Section B: institution info
  institution_id       INTEGER REFERENCES intern_institutions(id),
  advisor_name          TEXT,
  advisor_phone         TEXT,
  advisor_email         TEXT,
  referral_letter_url   TEXT,                     -- หนังสือส่งตัว (base64 data URL)

  -- Section C: placement details
  start_date            TEXT NOT NULL,
  end_date              TEXT NOT NULL,
  department_id         INTEGER REFERENCES departments(id),
  division_id           INTEGER REFERENCES divisions(id),
  supervisor_name       TEXT,
  supervisor_position   TEXT,
  training_type         TEXT,                     -- ฝึกงาน|สหกิจศึกษา|ดูงาน|ฝึกประสบการณ์วิชาชีพ|อื่นๆ
  work_hours            TEXT,                      -- เวลาปฏิบัติงาน
  note                  TEXT,

  is_cancelled          INTEGER NOT NULL DEFAULT 0,
  cancel_reason          TEXT,

  created_by             TEXT,
  created_at             TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_interns_dates       ON interns(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_interns_department  ON interns(department_id);
CREATE INDEX IF NOT EXISTS idx_interns_institution ON interns(institution_id);

-- Rotation schedule (one intern can rotate through several departments)
CREATE TABLE IF NOT EXISTS intern_rotations (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  intern_id       INTEGER NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  department_id   INTEGER REFERENCES departments(id),
  division_id     INTEGER REFERENCES divisions(id),
  start_date      TEXT NOT NULL,
  end_date        TEXT NOT NULL,
  supervisor_name TEXT,
  note            TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intern_rotations_intern ON intern_rotations(intern_id);

-- Supporting documents (referral letters, other attachments) — base64 data URL,
-- matching the existing training_photos storage pattern.
CREATE TABLE IF NOT EXISTS intern_documents (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  intern_id   INTEGER NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  doc_type    TEXT,
  file_name   TEXT,
  url         TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_intern_documents_intern ON intern_documents(intern_id);

-- Internship completion certificates — mirrors training_certificates
CREATE TABLE IF NOT EXISTS intern_certificates (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_id          TEXT NOT NULL UNIQUE,
  intern_id        INTEGER NOT NULL REFERENCES interns(id) ON DELETE CASCADE,
  full_name        TEXT NOT NULL,
  institution_name TEXT,
  faculty          TEXT,
  major            TEXT,
  department_name  TEXT,
  start_date       TEXT,
  end_date         TEXT,
  issued_at        TEXT NOT NULL DEFAULT (datetime('now')),
  issued_by        TEXT,
  status           TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued','revoked')),
  qr_token         TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_intern_cert_intern ON intern_certificates(intern_id);
CREATE INDEX IF NOT EXISTS idx_intern_cert_token  ON intern_certificates(qr_token);
