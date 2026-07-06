-- คำสั่งออกหน่วย (off-site duty orders) — persist generated orders for history/reprint
CREATE TABLE IF NOT EXISTS duty_orders (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no    TEXT NOT NULL DEFAULT '',
  activity    TEXT NOT NULL DEFAULT '',
  place_name  TEXT NOT NULL DEFAULT '',
  address     TEXT NOT NULL DEFAULT '',
  event_date  TEXT,                          -- ISO date (วันปฏิบัติงาน)
  order_date  TEXT,                          -- ISO date (วันที่ออกคำสั่ง)
  staff_json  TEXT NOT NULL DEFAULT '[]',    -- JSON array of {name, position}
  created_by  TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_duty_orders_event_date ON duty_orders(event_date);
CREATE INDEX IF NOT EXISTS idx_duty_orders_created_at ON duty_orders(created_at);
