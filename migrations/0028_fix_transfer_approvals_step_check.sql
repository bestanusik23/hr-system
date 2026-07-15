CREATE TABLE transfer_approvals_new (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id       INTEGER NOT NULL REFERENCES transfer_requests(id) ON DELETE CASCADE,
  step             TEXT NOT NULL CHECK (step IN ('head','hr','dest_head','deputyhr')),
  approver_user_id INTEGER REFERENCES users(id),
  status           TEXT NOT NULL CHECK (status IN ('approved','rejected')),
  note             TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO transfer_approvals_new
SELECT id, request_id, step, approver_user_id, status, note, created_at
FROM transfer_approvals;

DROP TABLE transfer_approvals;
ALTER TABLE transfer_approvals_new RENAME TO transfer_approvals;

CREATE INDEX idx_tappr_req ON transfer_approvals(request_id);
