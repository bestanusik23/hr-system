-- Migration 0012: Extend employees table into the Manpower CRR Master Database
-- The existing `employees` table remains the single source of truth (shared with eval).

ALTER TABLE employees ADD COLUMN emp_type            TEXT;            -- ประเภทพนักงาน
ALTER TABLE employees ADD COLUMN supervisor          TEXT;            -- หัวหน้างาน
ALTER TABLE employees ADD COLUMN probation_days      INTEGER NOT NULL DEFAULT 119;
ALTER TABLE employees ADD COLUMN probation_end_date  TEXT;            -- start_date + probation_days
ALTER TABLE employees ADD COLUMN remark              TEXT;
ALTER TABLE employees ADD COLUMN resign_date         TEXT;
ALTER TABLE employees ADD COLUMN resign_reason       TEXT;
ALTER TABLE employees ADD COLUMN resign_type         TEXT;            -- ลาออกเอง / เลิกจ้าง / เกษียณ

-- Backfill probation_end_date for existing probation staff (start + 119 days)
UPDATE employees
SET probation_end_date = date(start_date, '+119 days')
WHERE start_date IS NOT NULL AND probation_end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_emp_probend ON employees(probation_end_date);
CREATE INDEX IF NOT EXISTS idx_emp_resign  ON employees(resign_date);
