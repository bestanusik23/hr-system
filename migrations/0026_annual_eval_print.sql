ALTER TABLE annual_evaluations ADD COLUMN document_code TEXT;
ALTER TABLE annual_evaluations ADD COLUMN running_no TEXT;
ALTER TABLE annual_evaluations ADD COLUMN printed_at TEXT;
ALTER TABLE annual_evaluations ADD COLUMN printed_by TEXT;
ALTER TABLE annual_evaluations ADD COLUMN print_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE annual_eval_doc_running_no (
  year INTEGER PRIMARY KEY,
  seq  INTEGER NOT NULL DEFAULT 0
);
