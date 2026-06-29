-- Manpower plan overrides: store per-row delta vs static manpowerPlan.ts
CREATE TABLE IF NOT EXISTS manpower_plan_overrides (
  row_idx    INTEGER PRIMARY KEY,
  delta      INTEGER NOT NULL DEFAULT 0,
  updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
