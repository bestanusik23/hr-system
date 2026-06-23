-- Migration 0011: Redesign transfer workflow
-- New flow: source head submits → dest head approves → deputyHR approves → completed

ALTER TABLE transfer_requests ADD COLUMN dest_head_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE transfer_requests ADD COLUMN deputyhr_status  TEXT NOT NULL DEFAULT 'pending';

-- Migrate existing data to new statuses
UPDATE transfer_requests SET
  overall_status   = 'dest_head_approved',
  dest_head_status = 'approved'
WHERE overall_status IN ('head_approved', 'deputy_approved');

UPDATE transfer_requests SET
  dest_head_status = 'approved',
  deputyhr_status  = 'approved'
WHERE overall_status = 'completed';

UPDATE transfer_requests SET
  dest_head_status = 'rejected'
WHERE overall_status = 'rejected' AND head_status = 'rejected';
