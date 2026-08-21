-- Separate title/prefix (นาย/นาง/นางสาว/...) from full_name so it can be edited
-- and read independently (full_name keeps being the free-text display name).
ALTER TABLE employees ADD COLUMN prefix TEXT;
