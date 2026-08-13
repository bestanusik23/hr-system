// Jan–Jun 2569 (2026-01-01 – 2026-06-30 CE): HR asked that every new hire
// starting in this window be treated as having completed orientation and
// probation-competency evaluation in full — the underlying training/
// evaluation records for that period predate consistent data entry, so
// computing live would understate compliance HR already knows happened.
// Shared by /api/iso-kpi/monthly.ts (12-month grid, calendar-month bounds)
// and /api/exec/kpi.ts (live dashboard, 26th-cutoff period bounds) so both
// report the same numbers for the same employees.
export const ASSUMED_COMPLIANT_START = "2026-01-01";
export const ASSUMED_COMPLIANT_END   = "2026-06-30";

export function isAssumedCompliantMonth(yearBE: number, month: number): boolean {
  return yearBE === 2569 && month >= 1 && month <= 6;
}
