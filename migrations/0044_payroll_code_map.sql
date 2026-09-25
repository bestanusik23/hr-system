-- Payroll shift-schedule codes that don't resolve to the right employees row by a plain
-- emp_code match. Confirmed by HR against the Sep 2569 schedule (26 Aug - 25 Sep):
--   6601003 is an old resigned record with no position; the live record is 6601003.1
--   6802029 in payroll is 6802025 in the registry (surname also differs: อิมคำ vs อินคำ)
--   6701025 matches by code, but payroll says ภูมิสิทธิ์ where the registry says ศุภกานต์ (same person)
-- Resigned employees who still worked/earned OT in a cycle remain a cost to count, so lookups
-- must include emp_status = 'resigned'. Payroll code 0000016 (พจรินทร์ ประเสริฐ, บัญชี) is not in the
-- registry and is deliberately left unmapped until HR confirms who she is.
CREATE TABLE IF NOT EXISTS payroll_code_map (
  payroll_code TEXT PRIMARY KEY,
  employee_id  INTEGER NOT NULL REFERENCES employees(id),
  payroll_name TEXT,
  note         TEXT NOT NULL DEFAULT '',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO payroll_code_map (payroll_code, employee_id, payroll_name, note)
SELECT '6601003', id, 'นายปฏิพัทธ์  ทิพย์บุญลือ', 'payroll code hits the old resigned record; live record is 6601003.1'
FROM employees WHERE emp_code = '6601003.1';

INSERT OR IGNORE INTO payroll_code_map (payroll_code, employee_id, payroll_name, note)
SELECT '6802029', id, 'น.ส.มินทร์  อิมคำ', 'payroll code and surname differ from registry 6802025 (อินคำ); confirmed same person'
FROM employees WHERE emp_code = '6802025';

INSERT OR IGNORE INTO payroll_code_map (payroll_code, employee_id, payroll_name, note)
SELECT '6701025', id, 'นายภูมิสิทธิ์  อัครมัจฉานนท์', 'first name differs from registry (ศุภกานต์); confirmed same person'
FROM employees WHERE emp_code = '6701025';
