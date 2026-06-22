-- เพิ่มรหัสพนักงาน
ALTER TABLE employees ADD COLUMN emp_code TEXT;
CREATE UNIQUE INDEX idx_emp_code ON employees(emp_code) WHERE emp_code IS NOT NULL;
