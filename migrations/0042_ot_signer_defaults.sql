-- ot_signoff previously only stored a name, auto-filled from whoever clicked the
-- "จัดทำ/ตรวจสอบ/อนุมัติ" button — but the real preparer/reviewer/approver aren't
-- necessarily the ones with system logins. Per HR, these are fixed named individuals
-- (title kept for reference; not printed, matching the original ปะหน้า sheet's plain
-- "( name )" signature block). Approver has 2 possible people per year, picked from
-- a dropdown rather than typed freely.
CREATE TABLE IF NOT EXISTS ot_signer_defaults (
  id               INTEGER PRIMARY KEY CHECK (id = 1),
  preparer_name    TEXT NOT NULL DEFAULT '',
  preparer_title   TEXT NOT NULL DEFAULT '',
  reviewer_name    TEXT NOT NULL DEFAULT '',
  reviewer_title   TEXT NOT NULL DEFAULT '',
  approver1_name   TEXT NOT NULL DEFAULT '',
  approver1_title  TEXT NOT NULL DEFAULT '',
  approver2_name   TEXT NOT NULL DEFAULT '',
  approver2_title  TEXT NOT NULL DEFAULT '',
  updated_by       TEXT,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO ot_signer_defaults
  (id, preparer_name, preparer_title, reviewer_name, reviewer_title,
   approver1_name, approver1_title, approver2_name, approver2_title)
VALUES (
  1,
  'นายอนุสิกข์ ทองแผ่น', 'รอง.ผอ.ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ',
  'นางพิมพ์พิศา วงศ์เทพเตียน', 'รอง.ผอ.ฝ่ายสนับสนุน',
  'นายแพทย์วัชระ เตชะธีราวัฒน์', 'ผู้อำนวยการโรงพยาบาล',
  'นายแพทย์ศิริ เตชะธีราวัฒน์', 'ผู้อำนวยการฝ่ายบริหาร'
);

ALTER TABLE ot_signoff ADD COLUMN preparer_title TEXT;
ALTER TABLE ot_signoff ADD COLUMN reviewer_title TEXT;
ALTER TABLE ot_signoff ADD COLUMN approver_title TEXT;

-- Backfill any ot_signoff rows created before this migration (name still blank)
-- with the defaults above, so existing fiscal years pick up the real names too.
UPDATE ot_signoff SET
  preparer_name  = (SELECT preparer_name  FROM ot_signer_defaults WHERE id = 1),
  preparer_title = (SELECT preparer_title FROM ot_signer_defaults WHERE id = 1)
WHERE preparer_name IS NULL OR preparer_name = '';

UPDATE ot_signoff SET
  reviewer_name  = (SELECT reviewer_name  FROM ot_signer_defaults WHERE id = 1),
  reviewer_title = (SELECT reviewer_title FROM ot_signer_defaults WHERE id = 1)
WHERE reviewer_name IS NULL OR reviewer_name = '';
