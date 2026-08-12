-- ISO 9001 quality-objective KPI tracking (FM-ISO-01-01 to 03, HR department).
-- The 4 KPIs (license, orientation, competency, training) are computed live
-- from existing tables (employees.license_expiry, training_attendees/courses,
-- evaluations, training_courses) — no snapshot storage needed for the numbers
-- themselves. Only the qualitative "ส่วนที่ 3" root-cause/corrective-action
-- log (Part 3 of each KPI-N sheet) needs its own table, since that's manual
-- narrative HR writes each month a KPI misses target.
CREATE TABLE IF NOT EXISTS iso_kpi_actions (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  kpi_key            TEXT    NOT NULL CHECK (kpi_key IN ('license','orientation','competency','training')),
  year               INTEGER NOT NULL,        -- Buddhist era, e.g. 2569
  month              INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  root_cause         TEXT    NOT NULL DEFAULT '',
  corrective_action  TEXT    NOT NULL DEFAULT '',
  responsible        TEXT    NOT NULL DEFAULT '',
  due_date           TEXT,
  completed_date     TEXT,
  created_by         TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_iso_kpi_actions_lookup ON iso_kpi_actions(kpi_key, year, month);
