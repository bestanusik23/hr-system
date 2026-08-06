-- OT amount paid per department per payroll month, entered manually by HR
-- (no automatic Excel parsing — see Workforce-Timeline-BarChart-OT-Plan.md).
-- month uses "MM/YYYY" Thai BE, matching workforce/api.ts's getAvailableMonths() keys.
CREATE TABLE IF NOT EXISTS workforce_ot_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  month       TEXT    NOT NULL,                  -- "07/2569"
  dept_name   TEXT    NOT NULL,                  -- payroll แผนก name
  amount_thb  INTEGER NOT NULL DEFAULT 0,
  note        TEXT    NOT NULL DEFAULT '',
  updated_by  TEXT,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (month, dept_name)
);

CREATE INDEX IF NOT EXISTS idx_wot_month ON workforce_ot_entries(month);
