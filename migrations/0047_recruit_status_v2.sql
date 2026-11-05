-- Recruit status v2: the Google Sheet status column now holds one of 3 values
--   "ยังไม่ได้ติดต่อ" / "ติดต่อให้มากรอกใบสมัครแล้ว" / "สัมภาษณ์แล้ว ทราบผลแล้ว"
-- Extra details live in recruit_appointments (0020 + 0030), keyed by the Sheet row:
--   appointment_date          = date the applicant is booked to come in
--   interview_result          = 'pass' | 'fail' | '' (only meaningful for status 3)
--   result_reason             = preset reason picked from the list
--   result_note               = free-text detail typed by HR
--   referred_by / referred_at = head/deputy who asked HR to contact the applicant
-- Legacy Sheet values are mapped to the new statuses in the frontend.
ALTER TABLE recruit_appointments ADD COLUMN interview_result TEXT NOT NULL DEFAULT '';
ALTER TABLE recruit_appointments ADD COLUMN result_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE recruit_appointments ADD COLUMN result_note TEXT NOT NULL DEFAULT '';
ALTER TABLE recruit_appointments ADD COLUMN referred_by TEXT NOT NULL DEFAULT '';
ALTER TABLE recruit_appointments ADD COLUMN referred_at TEXT NOT NULL DEFAULT '';
