-- เพิ่ม soft-cancel สำหรับหลักสูตรอบรม
ALTER TABLE training_courses ADD COLUMN is_cancelled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE training_courses ADD COLUMN cancel_reason TEXT;
