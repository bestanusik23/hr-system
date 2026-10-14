-- เช็คชื่ออบรมแยกรอบเช้า/บ่าย
-- checkin_sessions: 1 = เช็คชื่อครั้งเดียว (เดิม), 2 = เช็คชื่อ 2 รอบ (เช้า + บ่าย)
-- pm_start_time   : เวลาเริ่มรอบบ่าย (ใช้ตัดสินว่าสาย) ถ้าว่างใช้ 13:00
ALTER TABLE training_courses ADD COLUMN checkin_sessions INTEGER NOT NULL DEFAULT 1;
ALTER TABLE training_courses ADD COLUMN pm_start_time TEXT;

CREATE TABLE IF NOT EXISTS training_checkins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id   INTEGER NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  attendee_id INTEGER NOT NULL REFERENCES training_attendees(id) ON DELETE CASCADE,
  session     TEXT    NOT NULL CHECK (session IN ('am','pm')),
  checked_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  is_late     INTEGER NOT NULL DEFAULT 0,
  source      TEXT    NOT NULL DEFAULT 'qr' CHECK (source IN ('qr','manual')),
  UNIQUE (attendee_id, session)
);
CREATE INDEX IF NOT EXISTS idx_training_checkins_course ON training_checkins(course_id);

-- หลักสูตร AI-Powered Workforce รุ่นที่ 1 และ 2 เช็คชื่อ 2 รอบ
UPDATE training_courses
   SET checkin_sessions = 2, pm_start_time = '13:00'
 WHERE course LIKE '%AI-Powered Workforce%';
