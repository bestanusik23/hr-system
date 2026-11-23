ALTER TABLE manpower_plan ADD COLUMN is_closed INTEGER NOT NULL DEFAULT 0;

UPDATE manpower_plan SET is_closed = 1 WHERE is_active = 1 AND type IN ('section', 'subdept') AND TRIM(name) IN ('ห้องคลอด', 'ผู้ป่วยหนัก', 'ผู้ป่วยเด็ก', 'พัฒนาคุณภาพ', 'ประสานงานแพทย์');
