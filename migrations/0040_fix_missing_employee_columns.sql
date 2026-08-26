-- migrations/0013_phase3456.sql declared these three columns, but production D1 never
-- actually got them (found via a live D1_ERROR: "no such column: vehicle_plate" when
-- saving from the eval module's employee form). D1's SQLite doesn't support
-- "ADD COLUMN IF NOT EXISTS", so if any of these three already exist, applying this
-- migration will fail with "duplicate column name" on that line — comment it out and
-- re-run for the rest.
ALTER TABLE employees ADD COLUMN vehicle_plate TEXT;
ALTER TABLE employees ADD COLUMN profession_type TEXT;
ALTER TABLE employees ADD COLUMN emp_remark TEXT;
