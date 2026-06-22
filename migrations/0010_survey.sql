-- เพิ่ม participant_type + IP สำหรับการลงทะเบียนผ่าน QR
ALTER TABLE training_attendees ADD COLUMN participant_type TEXT NOT NULL DEFAULT 'attendee';
ALTER TABLE training_attendees ADD COLUMN ip_address TEXT;

-- ตารางแบบสอบถามความพึงพอใจ
CREATE TABLE IF NOT EXISTS training_surveys (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id    INTEGER NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  attendee_id  INTEGER,
  q1           INTEGER NOT NULL,
  q2           INTEGER NOT NULL,
  q3           INTEGER NOT NULL,
  q4           INTEGER NOT NULL,
  q5           INTEGER NOT NULL,
  comment      TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_surveys_course ON training_surveys(course_id);
