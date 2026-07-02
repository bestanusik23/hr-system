-- Appointment date + free-text note for a candidate row (e.g. "โทรนัดกรอกใบสมัคร"
-- or "นัดสัมภาษณ์"). Applicant data itself lives in Google Sheets, not D1 — this
-- table is keyed by the same row number (_row) used to address cells there, so it
-- can be joined onto the Sheets data purely on the frontend without touching the
-- source spreadsheet.
CREATE TABLE IF NOT EXISTS recruit_appointments (
  row_idx          INTEGER PRIMARY KEY,      -- matches Application._row from the Sheet
  appointment_date TEXT    NOT NULL DEFAULT '',  -- "YYYY-MM-DD", optional
  note             TEXT    NOT NULL DEFAULT '',  -- free text, e.g. call notes
  updated_by       TEXT    NOT NULL DEFAULT '',
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
