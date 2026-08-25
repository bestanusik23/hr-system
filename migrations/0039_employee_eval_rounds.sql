-- functions/api/eval/employees/[id].ts, EmployeeForm.tsx, and EmployeeList.tsx have
-- referenced employees.eval_rounds since day one (with a defensive UPDATE fallback for
-- "column missing"), but no migration ever actually added it — so every edit to
-- "จำนวนรอบประเมิน" silently fell through to the fallback UPDATE (which omits
-- eval_rounds), reported success, and never persisted the change.
ALTER TABLE employees ADD COLUMN eval_rounds INTEGER;
