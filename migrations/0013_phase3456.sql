-- Phase 3: Add ฝ่ายบริการ as division id=8 (split from div 7)
INSERT OR IGNORE INTO divisions (id, name) VALUES (8, 'ฝ่ายบริการ');

-- Phase 5: Employee extra profile fields
ALTER TABLE employees ADD COLUMN license_number TEXT;
ALTER TABLE employees ADD COLUMN license_expiry  TEXT;
ALTER TABLE employees ADD COLUMN vehicle_plate   TEXT;
ALTER TABLE employees ADD COLUMN profession_type TEXT;
ALTER TABLE employees ADD COLUMN emp_remark      TEXT;

-- Phase 6: Multi-department assignment (employee can belong to multiple depts with weights)
CREATE TABLE IF NOT EXISTS employee_department_assignment (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id      INTEGER NOT NULL REFERENCES employees(id)   ON DELETE CASCADE,
  department_id    INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  assignment_type  TEXT    NOT NULL DEFAULT 'secondary',   -- 'primary' | 'secondary'
  assignment_weight REAL   NOT NULL DEFAULT 0.5,           -- primary=1.0, secondary=0.5
  start_date       TEXT,
  end_date         TEXT,
  note             TEXT,
  created_at       TEXT DEFAULT (datetime('now')),
  UNIQUE(employee_id, department_id)
);
