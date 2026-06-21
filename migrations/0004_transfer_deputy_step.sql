-- Migration 0004: Add deputy approval step to transfer_requests
ALTER TABLE transfer_requests ADD COLUMN deputy_status TEXT NOT NULL DEFAULT 'pending';

-- For records already completed, mark deputy as approved
UPDATE transfer_requests SET deputy_status = 'approved' WHERE overall_status = 'completed';

-- For records rejected at hr step, mark deputy as rejected
UPDATE transfer_requests SET deputy_status = 'rejected' WHERE overall_status = 'rejected' AND hr_status = 'rejected';
