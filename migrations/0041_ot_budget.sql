-- New menu "ประมาณการ OT และจ่ายจริง" — digitizes the monthly "ปะหน้าประมาณ OT"
-- Excel (docs/ot-2569.xlsx, sheet "69"). Deliberately separate from the existing
-- workforce_ot_entries (per-department paid total) and ot_approvals (OT hours vs
-- Bar) tables — this is a different grain (named OT categories, Budget+Actual pair)
-- and neither existing table is touched.

CREATE TABLE ot_categories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  group_name  TEXT    NOT NULL,   -- top header, e.g. "RN + Na"; single-column groups repeat their own name
  name        TEXT    NOT NULL,   -- sub header, e.g. "RN"
  sort_order  INTEGER NOT NULL DEFAULT 0,
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE ot_monthly (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month    TEXT    NOT NULL,               -- "2569-07" (Buddhist Era year)
  category_id   INTEGER NOT NULL REFERENCES ot_categories(id),
  budget_amount INTEGER NOT NULL DEFAULT 0,
  actual_amount INTEGER NOT NULL DEFAULT 0,
  paid_date     TEXT,
  updated_by    TEXT,
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (year_month, category_id)
);

-- Records who changed actual_amount and when, for months whose fiscal-year
-- signoff has already moved past 'pending' — HR asked for an audit trail on
-- late edits specifically, not on every edit.
CREATE TABLE ot_monthly_audit (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month   TEXT    NOT NULL,
  category_id  INTEGER NOT NULL,
  old_actual   INTEGER NOT NULL,
  new_actual   INTEGER NOT NULL,
  changed_by   TEXT,
  changed_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ot_factors (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  year_month  TEXT    NOT NULL,
  factor_text TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE ot_signoff (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year    TEXT    NOT NULL UNIQUE,   -- "2569" (Buddhist Era year)
  preparer_name  TEXT,   preparer_status TEXT NOT NULL DEFAULT 'pending', preparer_at TEXT,
  reviewer_name  TEXT,   reviewer_status TEXT NOT NULL DEFAULT 'pending', reviewer_at TEXT,
  approver_name  TEXT,   approver_status TEXT NOT NULL DEFAULT 'pending', approver_at TEXT
);

CREATE INDEX idx_ot_monthly_ym  ON ot_monthly(year_month);
CREATE INDEX idx_ot_factors_ym  ON ot_factors(year_month);
CREATE INDEX idx_ot_audit_ym    ON ot_monthly_audit(year_month);

-- 16 categories in 7 groups, matching docs/ot-2569.xlsx sheet "69" columns C–R exactly.
INSERT INTO ot_categories (group_name, name, sort_order) VALUES
  ('RN + Na', 'RN', 1),
  ('RN + Na', 'Na', 2),
  ('RN + Na', 'On call', 3),
  ('RN + Na', 'SUPERVISOR', 4),
  ('ห้องยา', 'ผช.', 5),
  ('ห้องยา', 'ภก.', 6),
  ('เวชระเบียน,การเงิน', 'cash.', 7),
  ('เวชระเบียน,การเงิน', 'Reg.', 8),
  ('X-ray + Lab', 'X-ray', 9),
  ('X-ray + Lab', 'Lab', 10),
  ('อื่นๆ', 'ภก. (PT)', 11),
  ('อื่นๆ', 'อื่นๆ', 12),
  ('อื่นๆ', 'ตึกรังสีรักษา', 13),
  ('อื่นๆ', 'ผ่าตัดกระเพาะ', 14),
  ('บัญชี/IT', 'บัญชี/IT', 15),
  ('ออกหน่วย', 'ออกหน่วย', 16);
