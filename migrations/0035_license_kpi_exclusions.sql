-- Employees the position-based license filter (functions/lib/licensedPositions.ts)
-- catches but HR doesn't actually want counted in the license-compliance KPI
-- (e.g. a director-level role that matched by title but isn't tracked here).
-- Excluded employees still show in the drill-down list (so this can be
-- toggled back), just dropped from the numerator/denominator computation.
CREATE TABLE IF NOT EXISTS iso_kpi_license_exclusions (
  employee_id  INTEGER PRIMARY KEY REFERENCES employees(id),
  excluded_by  TEXT,
  excluded_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
