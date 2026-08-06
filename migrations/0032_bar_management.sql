-- Bar Management: dept_bar_config, shift_standards, ot_approvals
-- Existing tables kept as-is: manpower_plan, workforce_import, workforce_ot_entries

CREATE TABLE IF NOT EXISTS dept_bar_config (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  dept_name    TEXT    NOT NULL UNIQUE,
  approved_bar REAL    NOT NULL DEFAULT 0,
  dept_type    TEXT    NOT NULL DEFAULT 'Service' CHECK (dept_type IN ('Service','Support','Back Office')),
  active       INTEGER NOT NULL DEFAULT 1,
  note         TEXT    NOT NULL DEFAULT '',
  updated_by   TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS shift_standards (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  position   TEXT    NOT NULL,
  hours      REAL    NOT NULL,
  bar_value  REAL    NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  updated_by TEXT,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (position, hours)
);

INSERT OR IGNORE INTO shift_standards (position, hours, bar_value, note) VALUES ('*', 8, 1.00, 'std 8h');
INSERT OR IGNORE INTO shift_standards (position, hours, bar_value, note) VALUES ('*', 10, 1.25, 'std 10h');
INSERT OR IGNORE INTO shift_standards (position, hours, bar_value, note) VALUES ('*', 12, 1.50, 'std 12h');

CREATE TABLE IF NOT EXISTS ot_approvals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  month         TEXT    NOT NULL,
  dept_name     TEXT    NOT NULL,
  ot_hours      REAL    NOT NULL DEFAULT 0,
  over_bar      REAL    NOT NULL DEFAULT 0,
  reason        TEXT    NOT NULL DEFAULT '',
  status        TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  requested_by  TEXT,
  decided_by    TEXT,
  decided_at    TEXT,
  decision_note TEXT    NOT NULL DEFAULT '',
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (month, dept_name)
);

CREATE INDEX IF NOT EXISTS idx_ot_appr_month ON ot_approvals(month);
CREATE INDEX IF NOT EXISTS idx_ot_appr_status ON ot_approvals(status);
