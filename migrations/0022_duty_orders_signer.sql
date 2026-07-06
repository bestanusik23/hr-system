-- คำสั่งออกหน่วย: ชื่อ/ตำแหน่ง/สังกัดผู้มีอำนาจลงนาม (แก้ไขได้ต่อคำสั่ง แทนที่จะตายตัว)
ALTER TABLE duty_orders ADD COLUMN signer_name  TEXT NOT NULL DEFAULT '';
ALTER TABLE duty_orders ADD COLUMN signer_title TEXT NOT NULL DEFAULT '';
ALTER TABLE duty_orders ADD COLUMN signer_dept  TEXT NOT NULL DEFAULT '';
