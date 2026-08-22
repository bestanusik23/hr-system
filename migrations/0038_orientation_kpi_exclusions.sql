-- Employees the orientation KPI's start_date-in-period filter catches but who
-- aren't actually new hires (e.g. a department/position move where the move
-- wasn't recorded through the formal Transfer workflow, so emp_status never
-- became 'transferred'). Mirrors iso_kpi_license_exclusions: excluded
-- employees still show in the drill-down list (flagged, not dropped), just
-- removed from the numerator/denominator computation.
CREATE TABLE IF NOT EXISTS iso_kpi_orientation_exclusions (
  employee_id  INTEGER PRIMARY KEY REFERENCES employees(id),
  excluded_by  TEXT,
  excluded_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
