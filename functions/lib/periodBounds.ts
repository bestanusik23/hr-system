// 26th cut-off month bounds, matching /api/manpower/summary and /api/manpower/snapshot:
// the "July" period runs 26 June – 25 July, not the plain calendar month. Shared by
// /api/exec/kpi.ts and /api/iso-kpi/monthly.ts so a given (year, month) always means the
// exact same date range in both places — the two sections used to disagree near month
// edges because ISO computed on plain calendar months while Exec used this cut-off.
export function monthBounds(yearCE: number, month: number): { pStart: string; pEnd: string } {
  const pStartDate = new Date(yearCE, month - 2, 26);
  const pEndDate   = new Date(yearCE, month - 1, 25);
  return {
    pStart: pStartDate.toISOString().slice(0, 10),
    pEnd:   pEndDate.toISOString().slice(0, 10),
  };
}
