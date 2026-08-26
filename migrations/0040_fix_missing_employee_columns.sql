-- migrations/0013_phase3456.sql declared these three columns, but production D1 never
-- actually got them (found via a live D1_ERROR: "no such column: vehicle_plate" when
-- saving from the eval module's employee form) — re-adding here, defensively, in case
-- any of the three individually already exist.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS vehicle_plate TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS profession_type TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS emp_remark TEXT;
