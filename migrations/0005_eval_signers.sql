-- Add signatory fields + hr_user_id to evaluations table
ALTER TABLE evaluations ADD COLUMN signer_employee  TEXT;
ALTER TABLE evaluations ADD COLUMN signer_head      TEXT;
ALTER TABLE evaluations ADD COLUMN signer_hr        TEXT;
ALTER TABLE evaluations ADD COLUMN signer_director  TEXT;
ALTER TABLE evaluations ADD COLUMN hr_user_id       INTEGER REFERENCES users(id);
