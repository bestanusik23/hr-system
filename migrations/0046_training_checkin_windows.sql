-- ล็อกช่วงเวลาเช็คชื่อรายรอบ (เช้า/บ่าย) กันเช็คชื่อล่วงหน้า/ย้อนหลัง หรือเช็คทั้ง 2 รอบรวดเดียว
-- สแกนได้เฉพาะในช่วง [from, to) ของแต่ละรอบ ถ้าว่างระบบใช้ค่าเริ่มต้น: เช้า 12:00-13:00, บ่าย = เวลาเลิกอบรม ถึง +1 ชม.
ALTER TABLE training_courses ADD COLUMN am_from TEXT;
ALTER TABLE training_courses ADD COLUMN am_to   TEXT;
ALTER TABLE training_courses ADD COLUMN pm_from TEXT;
ALTER TABLE training_courses ADD COLUMN pm_to   TEXT;

UPDATE training_courses
   SET am_from = '12:00', am_to = '13:00', pm_from = '16:00', pm_to = '17:00'
 WHERE checkin_sessions = 2;
