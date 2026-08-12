-- Manual override for one month's ISO KPI numerator/denominator, for periods
-- before this tracking existed where the live-computed figure (from
-- employees/evaluations/training tables) doesn't reflect what HR actually
-- knows happened that month. When a row exists here for a given
-- (kpi_key, year, month), it replaces the live computation in
-- /api/iso-kpi/monthly instead of being averaged/merged with it.
CREATE TABLE IF NOT EXISTS iso_kpi_overrides (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kpi_key     TEXT    NOT NULL CHECK (kpi_key IN ('license','orientation','competency','training')),
  year        INTEGER NOT NULL,        -- Buddhist era, e.g. 2569
  month       INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  numerator   INTEGER NOT NULL,
  denominator INTEGER NOT NULL,
  updated_by  TEXT,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (kpi_key, year, month)
);
