-- Manpower plan table: permanent DB-backed source of truth for org chart plan
-- Replaces static manpowerPlan.ts as primary data source
CREATE TABLE IF NOT EXISTS manpower_plan (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  row_idx    INTEGER UNIQUE NOT NULL,          -- original array index (stable key)
  type       TEXT    NOT NULL DEFAULT 'slot',  -- division | subdept | section | slot
  name       TEXT    NOT NULL DEFAULT '',      -- display name (may be empty for repeated slots)
  pos        TEXT    NOT NULL DEFAULT '',      -- position name (used for employee matching)
  div_id     INTEGER NOT NULL DEFAULT 0,       -- maps to divisions.id
  plan_qty   INTEGER NOT NULL DEFAULT 0,       -- อัตราตั้งไว้ (editable)
  note       TEXT    NOT NULL DEFAULT '',      -- หมายเหตุ (editable)
  sort_order INTEGER NOT NULL DEFAULT 0,       -- display order
  is_active  INTEGER NOT NULL DEFAULT 1,       -- soft-delete flag
  updated_by TEXT,
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mp_div    ON manpower_plan(div_id);
CREATE INDEX IF NOT EXISTS idx_mp_sort   ON manpower_plan(sort_order);
CREATE INDEX IF NOT EXISTS idx_mp_active ON manpower_plan(is_active);
