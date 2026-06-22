-- ระบบบริหารการฝึกอบรม v2 : เพิ่มคอลัมน์และตารางใหม่

-- ขยาย training_courses
ALTER TABLE training_courses ADD COLUMN course_code  TEXT;
ALTER TABLE training_courses ADD COLUMN course_type  TEXT NOT NULL DEFAULT 'Internal';
ALTER TABLE training_courses ADD COLUMN organizing_dept TEXT;
ALTER TABLE training_courses ADD COLUMN project_owner   TEXT;
ALTER TABLE training_courses ADD COLUMN start_time  TEXT;
ALTER TABLE training_courses ADD COLUMN end_time    TEXT;
ALTER TABLE training_courses ADD COLUMN location    TEXT;
ALTER TABLE training_courses ADD COLUMN budget      REAL DEFAULT 0;
ALTER TABLE training_courses ADD COLUMN objectives  TEXT;
ALTER TABLE training_courses ADD COLUMN attachment_url TEXT;
ALTER TABLE training_courses ADD COLUMN reg_open    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE training_courses ADD COLUMN qr_token    TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_course_qr ON training_courses(qr_token);

-- ขยาย training_attendees สำหรับ registration workflow
ALTER TABLE training_attendees ADD COLUMN emp_code         TEXT;
ALTER TABLE training_attendees ADD COLUMN department       TEXT;
ALTER TABLE training_attendees ADD COLUMN phone            TEXT;
ALTER TABLE training_attendees ADD COLUMN reg_method       TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE training_attendees ADD COLUMN attendance_status TEXT NOT NULL DEFAULT 'registered';
ALTER TABLE training_attendees ADD COLUMN checkin_time     TEXT;
ALTER TABLE training_attendees ADD COLUMN device_info      TEXT;

-- รูปภาพกิจกรรม
CREATE TABLE IF NOT EXISTS training_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id   INTEGER NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  url         TEXT NOT NULL,
  photo_type  TEXT NOT NULL DEFAULT 'activity'
              CHECK (photo_type IN ('activity','trainer','participant')),
  caption     TEXT,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_photos_course ON training_photos(course_id);

-- ใบประกาศนียบัตร
CREATE TABLE IF NOT EXISTS training_certificates (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cert_id     TEXT NOT NULL UNIQUE,
  course_id   INTEGER NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  attendee_id INTEGER REFERENCES training_attendees(id),
  full_name   TEXT NOT NULL,
  position    TEXT,
  department  TEXT,
  hours       REAL,
  course_date TEXT,
  issued_at   TEXT NOT NULL DEFAULT (datetime('now')),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending','issued','revoked')),
  qr_token    TEXT NOT NULL UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_cert_course ON training_certificates(course_id);
CREATE INDEX IF NOT EXISTS idx_cert_token  ON training_certificates(qr_token);
