-- Transfer Requests
CREATE TABLE IF NOT EXISTS transfer_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  position TEXT,
  from_department_id INTEGER REFERENCES departments(id),
  from_dept_name TEXT,
  to_division_id INTEGER NOT NULL REFERENCES divisions(id),
  to_department_id INTEGER NOT NULL REFERENCES departments(id),
  to_dept_name TEXT,
  new_position TEXT,
  reason TEXT,
  requester_user_id INTEGER REFERENCES users(id),
  head_status TEXT NOT NULL DEFAULT 'pending',
  hr_status TEXT NOT NULL DEFAULT 'pending',
  overall_status TEXT NOT NULL DEFAULT 'submitted',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transfer_approvals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  request_id INTEGER NOT NULL REFERENCES transfer_requests(id),
  step TEXT NOT NULL,
  approver_user_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Training
CREATE TABLE IF NOT EXISTS training_courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course TEXT NOT NULL,
  trainer TEXT,
  course_date TEXT,
  month_label TEXT,
  target INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS training_attendees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES training_courses(id),
  name TEXT NOT NULL,
  position TEXT,
  result TEXT,
  score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
