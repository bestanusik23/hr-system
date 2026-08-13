-- Manual backfill for the Executive Dashboard's 7 live KPI cards (turnover,
-- eval_coverage, orientation, satisfaction, probation_pass, training_plan,
-- license), keyed to the exact same period value the dashboard's own period
-- selector uses (period_type "month" → period_value "YYYY-MM", "year" →
-- "YYYY"). Stored as the final percentage + a free-text detail line rather
-- than numerator/denominator, since satisfaction is an average score (not a
-- ratio) and each KPI's sub-label reads differently — HR types in whatever
-- they know is true for that historical period.
CREATE TABLE IF NOT EXISTS exec_kpi_overrides (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  kpi_key      TEXT    NOT NULL CHECK (kpi_key IN
                 ('turnover','eval_coverage','orientation','satisfaction','probation_pass','training_plan','license')),
  period_type  TEXT    NOT NULL CHECK (period_type IN ('month','year')),
  period_value TEXT    NOT NULL,       -- "2026-07" for month, "2026" for year
  pct          REAL    NOT NULL,
  detail       TEXT    NOT NULL DEFAULT '',
  updated_by   TEXT,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kpi_key, period_type, period_value)
);
