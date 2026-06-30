-- เพิ่มแผนก รังสีรักษา และ รังสีเทคนิค ใต้ ฝ่ายเทคนิคบริการ
-- เพื่อให้ย้ายแผนกระหว่าง รังสีเทคนิค ↔ รังสีรักษา ได้ภายในฝ่ายเดียวกัน
INSERT OR IGNORE INTO departments (division_id, name)
SELECT d.id, dept.name
FROM divisions d
CROSS JOIN (SELECT 'รังสีรักษา' AS name UNION ALL SELECT 'รังสีเทคนิค') dept
WHERE d.name = 'ฝ่ายเทคนิคบริการ';
