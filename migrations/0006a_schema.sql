-- PART A: Schema
CREATE TABLE IF NOT EXISTS eval_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);
ALTER TABLE eval_topics ADD COLUMN template_id INTEGER REFERENCES eval_templates(id);
ALTER TABLE evaluations ADD COLUMN template_id INTEGER REFERENCES eval_templates(id);