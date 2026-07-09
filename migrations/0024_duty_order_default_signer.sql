-- คำสั่งออกหน่วย: จดจำผู้มีอำนาจลงนามล่าสุดที่แก้ไข ไว้ใช้เป็นค่าเริ่มต้นของคำสั่งฉบับถัดไป
CREATE TABLE IF NOT EXISTS duty_order_signer_default (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  signer_name  TEXT NOT NULL DEFAULT '',
  signer_title TEXT NOT NULL DEFAULT '',
  signer_dept  TEXT NOT NULL DEFAULT '',
  updated_by   TEXT,
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
