CREATE TABLE transfer_requests_new (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id        INTEGER REFERENCES employees(id),
  name               TEXT NOT NULL,
  position           TEXT,
  from_department_id INTEGER REFERENCES departments(id),
  from_dept_name     TEXT,
  to_division_id     INTEGER REFERENCES divisions(id),
  to_department_id   INTEGER REFERENCES departments(id),
  to_dept_name       TEXT,
  new_position       TEXT,
  reason             TEXT,
  head_status        TEXT NOT NULL DEFAULT 'pending'
                     CHECK (head_status IN ('pending','approved','rejected')),
  hr_status          TEXT NOT NULL DEFAULT 'pending'
                     CHECK (hr_status IN ('pending','approved','rejected')),
  dest_head_status   TEXT NOT NULL DEFAULT 'pending',
  deputyhr_status    TEXT NOT NULL DEFAULT 'pending',
  overall_status     TEXT NOT NULL DEFAULT 'submitted'
                     CHECK (overall_status IN ('submitted','head_approved','dest_head_approved','completed','rejected')),
  requester_user_id  INTEGER REFERENCES users(id),
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO transfer_requests_new
SELECT id, employee_id, name, position, from_department_id, from_dept_name,
       to_division_id, to_department_id, to_dept_name, new_position, reason,
       head_status, hr_status, dest_head_status, deputyhr_status, overall_status,
       requester_user_id, created_at, updated_at
FROM transfer_requests;

DROP TABLE transfer_requests;
ALTER TABLE transfer_requests_new RENAME TO transfer_requests;

CREATE INDEX idx_treq_overall ON transfer_requests(overall_status);
