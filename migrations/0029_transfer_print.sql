ALTER TABLE transfer_requests ADD COLUMN document_code TEXT;
ALTER TABLE transfer_requests ADD COLUMN running_no TEXT;
ALTER TABLE transfer_requests ADD COLUMN printed_at TEXT;
ALTER TABLE transfer_requests ADD COLUMN printed_by TEXT;
ALTER TABLE transfer_requests ADD COLUMN print_count INTEGER NOT NULL DEFAULT 0;

CREATE TABLE transfer_doc_running_no (
  year INTEGER PRIMARY KEY,
  seq  INTEGER NOT NULL DEFAULT 0
);
