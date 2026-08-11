/**
 * calculator.ts
 * Smart Workforce Engine — computes hourly coverage, KPIs, and department summaries
 * from the parsed payroll data for one or more target dates.
 *
 * Key capability: counts staff per hour based on each employee's ACTUAL start/end
 * times, including overnight shifts and split shifts (e.g. I008: 08:00–16:00 / 00:00–08:00).
 *
 * Shift grouping is done by ACTUAL time period (e.g. "07:00–16:00", "20:00–08:00"),
 * not by a fixed morning/afternoon/night bucket — the payroll file has 30+ distinct
 * shift codes with varying start times and durations (4h/6h/8h/10h/12h/14h/16h), so a
 * 3-bucket split misclassifies shifts that start near a bucket boundary.
 *
 * All calculations share one core: getActiveEntries() collects one entry per
 * employee per active working day across the given date list. Passing a single
 * date gives the daily dashboard; passing every date in a month gives person-day
 * totals for monthly reporting — same code path, no duplicated logic.
 */

import type {
  ParseResult, DashboardData, KPIData, HourlyPoint,
  DeptTimelineItem, ShiftSummaryItem, ShiftBlock, TimeRange, MonthlySummary, CurrentStaffEntry,
  ShiftBandItem, DeptBandRow, BandStaffEntry,
} from "./types";

// ─── Hourly coverage check ────────────────────────────────────────────────────

/**
 * Returns true if the given time range covers the hour that begins at `hourMin`.
 *
 * Two checks are needed:
 *   1. Direct: the hour falls within [startMin, endMin)
 *   2. Wrap:   for overnight shifts, the hour's "next-day" version falls in range
 *              e.g. I16 (start=960, end=1920): hour 02:00 (120 min)
 *              → 120 + 1440 = 1560, which is in [960, 1920) ✓
 */
function coversHour(range: TimeRange, hourMin: number): boolean {
  if (hourMin >= range.startMin && hourMin < range.endMin) return true;
  const wrapped = hourMin + 1440;
  if (wrapped >= range.startMin && wrapped < range.endMin) return true;
  return false;
}

// ─── Current time helper ──────────────────────────────────────────────────────

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ─── Time-period labeling & color registry ────────────────────────────────────

/** Formats minutes-from-midnight (wrapping past 1440 for overnight) as "HH:MM" */
function fmtClock(m: number): string {
  const mm = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(mm / 60)).padStart(2, "0")}:${String(mm % 60).padStart(2, "0")}`;
}

/** "HH:MM–HH:MM", wrapping the end time for overnight periods (e.g. 960→1920 becomes "16:00–08:00") */
function formatRangeLabel(startMin: number, endMin: number): string {
  return `${fmtClock(startMin)}–${fmtClock(endMin)}`;
}

/** Identity key for a time period — distinct (start,end) pairs are distinct periods, even if they overlap */
function rangeKey(r: TimeRange): string {
  return `${r.startMin}-${r.endMin}`;
}

const RANGE_PALETTE = [
  "#2563eb", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6",
  "#ef4444", "#0ea5e9", "#84cc16", "#f97316", "#6366f1", "#06b6d4",
  "#a855f7", "#eab308", "#10b981", "#f43f5e",
];

/**
 * Assigns a stable color to every distinct time period found in `active`, ordered
 * by start time, so the same period (e.g. "08:00–16:00") gets the same color in
 * every department row and in the summary table.
 */
function buildRangeRegistry(active: ActiveEntry[]): Map<string, { startMin: number; endMin: number; color: string }> {
  const seen = new Map<string, TimeRange>();
  for (const entry of active) {
    for (const r of entry.ranges) {
      const key = rangeKey(r);
      if (!seen.has(key)) seen.set(key, r);
    }
  }
  const sorted = Array.from(seen.entries()).sort((a, b) => a[1].startMin - b[1].startMin || a[1].endMin - b[1].endMin);

  const registry = new Map<string, { startMin: number; endMin: number; color: string }>();
  sorted.forEach(([key, r], i) => {
    registry.set(key, { startMin: r.startMin, endMin: r.endMin, color: RANGE_PALETTE[i % RANGE_PALETTE.length] });
  });
  return registry;
}

// ─── Shared active-entry extraction ───────────────────────────────────────────

type ActiveEntry = {
  deptCode: string;
  deptName: string;
  ranges: TimeRange[];
};

/**
 * Extracts one entry per employee per active working day across `dates`,
 * optionally scoped to a set of departments (e.g. every department in one
 * ฝ่าย/division, or a single แผนก).
 *
 * Passing a single date gives that day's active workforce (daily dashboard).
 * Passing every date in a month gives one entry per person-day worked, which
 * is exactly what monthly person-day totals need — no separate code path.
 *
 * @param dates     List of "DD/MM/YYYY" dates to include
 * @param deptNames When provided, only entries whose deptName is in this list are returned
 */
function getActiveEntries(parsed: ParseResult, dates: string[], deptNames?: string[] | null): ActiveEntry[] {
  const dateSet = new Set(dates);
  const deptSet = deptNames && deptNames.length > 0 ? new Set(deptNames) : null;
  const active: ActiveEntry[] = [];

  for (const emp of parsed.employees) {
    if (deptSet && !deptSet.has(emp.deptName)) continue;
    for (const rec of emp.records) {
      if (dateSet.has(rec.date) && rec.isActive && rec.ranges.length > 0) {
        active.push({ deptCode: emp.deptCode, deptName: emp.deptName, ranges: rec.ranges });
      }
    }
  }
  return active;
}

/** Reorder 24 hourly counts for display: 06:00 → 23:00, then 00:00 → 05:00 */
const DISPLAY_HOURS = [
  ...Array.from({ length: 18 }, (_, i) => i + 6),  // 6..23
  ...Array.from({ length: 6  }, (_, i) => i),       // 0..5
];

/** Raw per-hour coverage counts. When `active` spans multiple dates, this is a SUM across all of them. */
function computeHourlyCounts(active: ActiveEntry[]): number[] {
  const hourlyCounts = new Array<number>(24).fill(0);
  for (const entry of active) {
    for (const range of entry.ranges) {
      for (let h = 0; h < 24; h++) {
        if (coversHour(range, h * 60)) hourlyCounts[h]++;
      }
    }
  }
  return hourlyCounts;
}

function toHourlyPoints(hourlyCounts: number[]): HourlyPoint[] {
  return DISPLAY_HOURS.map(h => ({
    hour:  `${String(h).padStart(2, "0")}:00`,
    staff: hourlyCounts[h],
  }));
}

/**
 * Shift summary grouped by actual time period (not a fixed morning/afternoon/night
 * bucket). One row per distinct (start,end) pair present in `active`, sorted by
 * headcount descending. Percentage is relative to total active entries (person-days).
 */
function toRangeSummary(active: ActiveEntry[], registry: Map<string, { startMin: number; endMin: number; color: string }>): ShiftSummaryItem[] {
  const total = active.length;
  const counts = new Map<string, number>();

  for (const entry of active) {
    for (const r of entry.ranges) {
      const key = rangeKey(r);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([key, count]) => {
      const reg = registry.get(key)!;
      return {
        shift:      formatRangeLabel(reg.startMin, reg.endMin),
        staff:      count,
        percentage: total ? Math.round(count / total * 100) : 0,
        color:      reg.color,
      };
    })
    .sort((a, b) => b.staff - a.staff);
}

// ─── เวรเช้า / บ่าย / ดึก — partition by shift START time ──────────────────────

/**
 * The เวร. Boundaries come from the hospital's own definition: เช้า starts
 * 07:00 (up to a 10h shift, i.e. ends by 17:00), บ่าย starts 16:00 (spans
 * the full 16:00–00:00), ดึก starts 00:00 (ends by 08:00).
 */
export const SHIFT_BANDS: { key: string; label: string; sub: string; startFrom: number; startTo: number; color: string }[] = [
  { key: "morning", label: "เวรเช้า", sub: "เริ่ม 07:00–15:59", startFrom: 420, startTo: 960,  color: "#3fb96a" },
  { key: "evening", label: "เวรบ่าย", sub: "เริ่ม 16:00–23:59", startFrom: 960, startTo: 1440, color: "#8b6fe0" },
  { key: "night",   label: "เวรดึก",  sub: "เริ่ม 00:00–06:59", startFrom: 0,   startTo: 420,  color: "#1d4ed8" },
];

const CHUNK_MIN       = 480; // 1 standard shift = 8 hours
const SINGLE_BAND_MAX = 600; // 10h — matches the hospital's own เวรเช้า definition (07:00–17:00)

/** Index into SHIFT_BANDS for a chunk starting at `startMin` (0–1439). */
export function bandIndexForStart(startMin: number): number {
  const i = SHIFT_BANDS.findIndex(b => startMin >= b.startFrom && startMin < b.startTo);
  return i >= 0 ? i : SHIFT_BANDS.length - 1;   // 00:00–06:59 falls through to ดึก
}

/** Minutes a shift range overlaps a เวร's clock window, wrapping past midnight both ways. */
function bandOverlapMinutes(r: TimeRange, band: { startFrom: number; startTo: number }): number {
  const overlap = (aS: number, aE: number, bS: number, bE: number) => Math.max(0, Math.min(aE, bE) - Math.max(aS, bS));
  return overlap(r.startMin, r.endMin, band.startFrom, band.startTo)
       + overlap(r.startMin - 1440, r.endMin - 1440, band.startFrom, band.startTo);
}

/**
 * Which เวร(s) a shift's ranges count toward, as SHIFT_BANDS indices
 * (duplicates are fine — each occurrence is one 8h-equivalent of coverage).
 *
 * Short ranges (≤10h, SINGLE_BAND_MAX) are classified WHOLE, by which เวร
 * window they overlap the most — looking at the full start-to-end span, not
 * just the clock minute it starts on. That's what keeps e.g. a 06:30–15:30
 * shift (9h, starts 30min before the 07:00 เวรเช้า cutoff) reading as one
 * person in เวรเช้า instead of splitting off a token sliver into เวรดึก.
 *
 * Longer ranges are walked in 8-hour chunks from their own start — this is
 * what represents "two shifts' worth of coverage" for a genuine 12h or 16h
 * shift (e.g. 08:00–00:00 → one chunk in เวรเช้า, one in เวรบ่าย), and stays
 * exact for those; the ≤10h rule above only softens shorter, single-shift
 * cases that would otherwise misfire on a boundary they barely cross.
 *
 * Genuine split shifts in the file (two separate ranges in one day, e.g.
 * I008 = 08:00–16:00 + 00:00–08:00) are walked per-range, so each already-8h
 * segment is classified on its own.
 *
 * Because one person can land in more than one เวร, the per-เวร counts are
 * no longer a strict partition of headcount — they can sum to more than the
 * real number of people. That's intentional here: it's coverage per เวร,
 * not a headcount split.
 */
export function shiftBandIndices(ranges: TimeRange[]): number[] {
  const indices: number[] = [];
  for (const r of ranges) {
    const duration = r.endMin - r.startMin;
    if (duration <= SINGLE_BAND_MAX) {
      let best = bandIndexForStart(((r.startMin % 1440) + 1440) % 1440);
      let bestOverlap = -1;
      SHIFT_BANDS.forEach((b, i) => {
        const ov = bandOverlapMinutes(r, b);
        if (ov > bestOverlap) { bestOverlap = ov; best = i; }
      });
      indices.push(best);
    } else {
      for (let cur = r.startMin; cur < r.endMin; cur += CHUNK_MIN) {
        indices.push(bandIndexForStart(((cur % 1440) + 1440) % 1440));
      }
    }
  }
  return indices;
}

/**
 * Coverage per เวร, scoped to a set of departments (or all when null/omitted).
 * `staff` is chunk-count (8h-shift-equivalents), not headcount — see
 * shiftBandIndices(). Percentage is still relative to real headcount
 * (active.length), read as "% of today's staff present during this เวร".
 */
export function calculateShiftBandSummary(
  parsed: ParseResult,
  dates: string | string[],
  deptNames?: string[] | null,
): ShiftBandItem[] {
  const dateArr = Array.isArray(dates) ? dates : [dates];
  const active  = getActiveEntries(parsed, dateArr, deptNames);
  const totals  = new Array<number>(SHIFT_BANDS.length).fill(0);

  for (const entry of active) {
    for (const bi of shiftBandIndices(entry.ranges)) totals[bi]++;
  }

  return SHIFT_BANDS.map((b, i) => ({
    key: b.key,
    label: b.label,
    sub: b.sub,
    staff: totals[i],
    percentage: active.length ? Math.round(totals[i] / active.length * 100) : 0,
    color: b.color,
  }));
}

/**
 * Per-department coverage across the เวร, sorted by headcount desc.
 * `total` is real headcount for that department; `counts` are chunk-counts
 * per เวร, so a row's counts can sum to more than its own total.
 */
export function calculateBandsByDept(
  parsed: ParseResult,
  dates: string | string[],
  deptNames?: string[] | null,
): DeptBandRow[] {
  const dateArr = Array.isArray(dates) ? dates : [dates];
  const active  = getActiveEntries(parsed, dateArr, deptNames);
  const byDept  = new Map<string, DeptBandRow>();

  for (const entry of active) {
    let row = byDept.get(entry.deptName);
    if (!row) {
      row = { deptName: entry.deptName, total: 0, counts: new Array(SHIFT_BANDS.length).fill(0) };
      byDept.set(entry.deptName, row);
    }
    row.total++;
    for (const bi of shiftBandIndices(entry.ranges)) row.counts[bi]++;
  }

  return Array.from(byDept.values()).sort((a, b) => b.total - a.total);
}

/** Builds the per-department Gantt blocks (one per distinct time period worked in that department) */
function toDepartmentTimeline(
  active: ActiveEntry[],
  registry: Map<string, { startMin: number; endMin: number; color: string }>,
  divisor: number, // 1 for daily; days-in-month for monthly averages
  planByDept?: Map<string, number>, // Bar Chart plan headcount per payroll dept name, from planMap.ts
): DeptTimelineItem[] {
  type DeptAgg = { filled: number; blocks: Map<string, number> };
  const deptMap = new Map<string, DeptAgg>();
  const deptNameMap = new Map<string, string>();

  for (const entry of active) {
    if (!deptMap.has(entry.deptCode)) {
      deptMap.set(entry.deptCode, { filled: 0, blocks: new Map() });
      deptNameMap.set(entry.deptCode, entry.deptName);
    }
    const d = deptMap.get(entry.deptCode)!;
    d.filled++;
    for (const r of entry.ranges) {
      const key = rangeKey(r);
      d.blocks.set(key, (d.blocks.get(key) ?? 0) + 1);
    }
  }

  return Array.from(deptMap.entries())
    .map(([code, d]) => {
      const blocks: ShiftBlock[] = Array.from(d.blocks.entries())
        .map(([key, count]) => {
          const reg = registry.get(key)!;
          return {
            label:    formatRangeLabel(reg.startMin, reg.endMin),
            startMin: reg.startMin,
            endMin:   reg.endMin,
            count:    divisor > 1 ? Math.round(count / divisor) : count,
            color:    reg.color,
          };
        })
        .sort((a, b) => a.startMin - b.startMin);

      const deptName = deptNameMap.get(code) ?? `แผนก ${code}`;
      return {
        name:   deptName,
        sub:    "",
        plan:   planByDept?.get(deptName) ?? 0,
        filled: divisor > 1 ? Math.round(d.filled / divisor) : d.filled,
        blocks,
      };
    })
    .sort((a, b) => b.filled - a.filled);
}

// ─── Per-department views (for the dept filter in Hourly Chart / Shift Summary) ─

/**
 * Hourly workforce curve scoped to a set of departments (or all, when deptNames is null/omitted) —
 * e.g. every department in one ฝ่าย, or a single แผนก.
 *
 * @param dates   Either a single "DD/MM/YYYY" date (daily view) or a list of dates (monthly view)
 * @param average When true, divides each hour's total by the number of dates —
 *                use this for monthly views so the curve reads as "typical staff
 *                during this hour" instead of a period-long sum.
 */
export function calculateHourlyForDept(
  parsed: ParseResult,
  dates: string | string[],
  deptNames?: string[] | null,
  average = false,
): HourlyPoint[] {
  const dateArr = Array.isArray(dates) ? dates : [dates];
  const active  = getActiveEntries(parsed, dateArr, deptNames);
  const counts  = computeHourlyCounts(active);
  const divisor = average ? Math.max(dateArr.length, 1) : 1;
  return toHourlyPoints(counts.map(v => Math.round(v / divisor)));
}

/**
 * Shift summary table scoped to a set of departments (or all, when deptNames is null/omitted).
 * Staff counts are always totals (person-days when `dates` spans a month) —
 * percentages stay meaningful either way since they're relative to the same total.
 */
export function calculateShiftSummaryForDept(
  parsed: ParseResult,
  dates: string | string[],
  deptNames?: string[] | null,
): ShiftSummaryItem[] {
  const dateArr  = Array.isArray(dates) ? dates : [dates];
  const active   = getActiveEntries(parsed, dateArr, deptNames);
  const registry = buildRangeRegistry(active);
  return toRangeSummary(active, registry);
}

// ─── Daily dashboard ──────────────────────────────────────────────────────────

/**
 * Calculates all dashboard data for a specific date.
 *
 * @param parsed     Output from parseWorkbook()
 * @param targetDate "DD/MM/YYYY" Thai BE date to calculate for
 */
export function calculateDashboardData(parsed: ParseResult, targetDate: string, planByDept?: Map<string, number>): DashboardData {
  const { employees } = parsed;

  // ── 1. Filter: employees who are actively working on targetDate ──────────────
  const active = getActiveEntries(parsed, [targetDate]);

  // ── 2. Hourly workforce (smart engine) ───────────────────────────────────────
  const hourlyCounts = computeHourlyCounts(active);
  const hourlyWorkforce = toHourlyPoints(hourlyCounts);

  // ── 3. KPI values ────────────────────────────────────────────────────────────
  const total = active.length;

  const peakVal  = hourlyCounts.reduce((m, v) => Math.max(m, v), 0);
  const peakIdx  = hourlyCounts.indexOf(peakVal);
  const nonZero  = hourlyCounts.filter(v => v > 0);
  const lowVal   = nonZero.length ? Math.min(...nonZero) : 0;
  const lowIdx   = hourlyCounts.indexOf(lowVal);

  const nowMin = nowMinutes();
  const currentActiveStaff = active.filter(a =>
    a.ranges.some(r => coversHour(r, nowMin))
  ).length;

  const kpi: KPIData = {
    totalActiveStaff:    total,
    departmentsOperating: new Set(active.map(a => a.deptCode)).size,
    currentActiveStaff,
    peakHour:      `${String(peakIdx).padStart(2, "0")}:00`,
    peakWorkforce: peakVal,
    lowHour:       `${String(lowIdx).padStart(2, "0")}:00`,
    lowWorkforce:  lowVal,
  };

  // ── 4. Range registry + department timeline (Gantt data) ─────────────────────
  const registry = buildRangeRegistry(active);
  const departmentTimeline = toDepartmentTimeline(active, registry, 1, planByDept);

  // ── 5. Shift summary table (by actual time period) ───────────────────────────
  const shiftSummary = toRangeSummary(active, registry);

  // ── 6. Department ranking ────────────────────────────────────────────────────
  const departmentRanking = departmentTimeline.map(d => ({
    department: d.name,
    staff:      d.filled,
  }));

  return {
    kpi,
    hourlyWorkforce,
    departmentTimeline,
    shiftSummary,
    departmentRanking,
    metadata: {
      targetDate,
      availableDates:  parsed.availableDates,
      generatedAt:     new Date().toISOString(),
      totalEmployees:  employees.length,
    },
  };
}

// ─── Monthly summary (for reporting) ──────────────────────────────────────────

/**
 * Aggregates the whole date range into monthly totals — total person-days
 * worked per department/time period, a typical (averaged) hourly workforce
 * curve, and department ranking by total person-days. Used for the "รายเดือน"
 * view so HR can generate a monthly staffing report without switching day-by-day.
 *
 * @param dates All "DD/MM/YYYY" dates belonging to the payroll cycle being summarized
 */
export function calculateMonthlySummary(parsed: ParseResult, dates: string[], planByDept?: Map<string, number>): MonthlySummary {
  const daysInRange = dates.length;
  const active = getActiveEntries(parsed, dates);

  // Hourly: average per hour across all days, so the curve stays on the same
  // 0-N scale as a single day instead of ballooning by day count.
  const hourlyCounts   = computeHourlyCounts(active);
  const hourlyAverage  = hourlyCounts.map(v => (daysInRange ? Math.round(v / daysInRange) : 0));
  const hourlyWorkforce = toHourlyPoints(hourlyAverage);

  const peakWorkforce = hourlyAverage.reduce((m, v) => Math.max(m, v), 0);
  const peakHour = `${String(hourlyAverage.indexOf(peakWorkforce)).padStart(2, "0")}:00`;

  const totalPersonDays = active.length;
  const avgStaffPerDay  = daysInRange ? Math.round((totalPersonDays / daysInRange) * 10) / 10 : 0;

  const registry = buildRangeRegistry(active);

  // Shift summary uses total person-days per time period (report-appropriate), not an average.
  const shiftSummary = toRangeSummary(active, registry);

  // Department totals: person-days (for ranking/reporting) + avg/day (to reuse the Gantt panel).
  const departmentTimeline = toDepartmentTimeline(active, registry, daysInRange || 1, planByDept);

  type DeptTotal = { name: string; total: number };
  const deptTotals = new Map<string, DeptTotal>();
  for (const entry of active) {
    const cur = deptTotals.get(entry.deptCode);
    if (cur) cur.total++;
    else deptTotals.set(entry.deptCode, { name: entry.deptName, total: 1 });
  }
  const departmentsOperating = deptTotals.size;
  const departmentRanking = Array.from(deptTotals.values())
    .map(d => ({ department: d.name, staff: d.total }))
    .sort((a, b) => b.staff - a.staff);

  return {
    monthLabel: "",
    daysInRange,
    totalPersonDays,
    avgStaffPerDay,
    departmentsOperating,
    shiftSummary,
    hourlyWorkforce,
    peakHour,
    peakWorkforce,
    departmentTimeline,
    departmentRanking,
  };
}

// ─── Real-time snapshot (individual employees, for the NOW-line click) ───────

/**
 * Lists every employee actively on duty right now on `date`, optionally scoped
 * to a set of departments. Unlike the aggregated ShiftBlock counts used
 * elsewhere, this keeps each employee's name so the UI can show who (and,
 * cross-referenced against the manpower plan, what position) is on duty.
 *
 * @param date "DD/MM/YYYY" — the day to check against the current wall-clock time
 */
export function getCurrentStaffDetail(parsed: ParseResult, date: string, deptNames?: string[] | null): CurrentStaffEntry[] {
  const nowMin = nowMinutes();
  const deptSet = deptNames && deptNames.length > 0 ? new Set(deptNames) : null;
  const result: CurrentStaffEntry[] = [];

  for (const emp of parsed.employees) {
    if (deptSet && !deptSet.has(emp.deptName)) continue;
    for (const rec of emp.records) {
      if (rec.date !== date || !rec.isActive) continue;
      for (const r of rec.ranges) {
        if (coversHour(r, nowMin)) {
          result.push({ department: emp.deptName, name: emp.name, rangeLabel: formatRangeLabel(r.startMin, r.endMin) });
          break;
        }
      }
    }
  }
  return result.sort((a, b) => a.department.localeCompare(b.department, "th"));
}

/**
 * Every employee whose shift includes at least one 8-hour chunk in `bandIndex`
 * (an index into SHIFT_BANDS) on `date`, optionally scoped to a set of
 * departments. Used by the เวร KPI card click, so HR can see who exactly makes
 * up that count instead of just the number.
 *
 * straddleNote is set whenever a person's other chunks fall in a different
 * เวร too (e.g. a 08:00–00:00 shift showing up under both เวรเช้า and
 * เวรบ่าย) — this is exactly the situation calculateShiftBandSummary's counts
 * no longer partition headcount for, so flagging it here lets HR see at a
 * glance who's a long/split shift rather than two different people.
 */
export function getBandStaffDetail(
  parsed: ParseResult,
  date: string,
  bandIndex: number,
  deptNames?: string[] | null,
): BandStaffEntry[] {
  const deptSet = deptNames && deptNames.length > 0 ? new Set(deptNames) : null;
  const result: BandStaffEntry[] = [];

  for (const emp of parsed.employees) {
    if (deptSet && !deptSet.has(emp.deptName)) continue;
    for (const rec of emp.records) {
      if (rec.date !== date || !rec.isActive || rec.ranges.length === 0) continue;

      const chunkBands = new Set(shiftBandIndices(rec.ranges));
      if (!chunkBands.has(bandIndex)) continue;

      const otherLabels = SHIFT_BANDS
        .filter((_, i) => i !== bandIndex && chunkBands.has(i))
        .map(b => b.label);

      result.push({
        department: emp.deptName,
        name: emp.name,
        rangeLabel: rec.ranges.map(r => formatRangeLabel(r.startMin, r.endMin)).join(" + "),
        straddleNote: otherLabels.length
          ? `${rec.ranges.length > 1 ? "กะแยกช่วง" : "กะยาวเกิน 8 ชม."} — นับใน ${otherLabels.join(" และ ")} ด้วย`
          : "",
      });
    }
  }
  return result.sort((a, b) => a.department.localeCompare(b.department, "th") || a.name.localeCompare(b.name, "th"));
}
