-- Server-side storage for the last imported payroll shift file (รายงานประกาศกะ),
-- so every user/device sees the same Workforce Timeline data instead of each
-- browser's own localStorage copy. Single row per dataset_key (one dataset for now).
CREATE TABLE IF NOT EXISTS workforce_imports (
  dataset_key  TEXT PRIMARY KEY,
  data         TEXT NOT NULL DEFAULT '',   -- JSON-serialized ParseResult
  imported_at  TEXT NOT NULL DEFAULT '',   -- display timestamp shown in the UI
  imported_by  TEXT NOT NULL DEFAULT '',
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
