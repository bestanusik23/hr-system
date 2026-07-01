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
  DeptTimelineItem, ShiftSummaryItem, ShiftBlock, TimeRange, MonthlySummary,
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
 * optionally scoped to one department.
 *
 * Passing a single date gives that day's active workforce (daily dashboard).
 * Passing every date in a month gives one entry per person-day worked, which
 * is exactly what monthly person-day totals need — no separate code path.
 *
 * @param dates    List of "DD/MM/YYYY" dates to include
 * @param deptName When provided, only entries whose deptName matches are returned
 */
function getActiveEntries(parsed: ParseResult, dates: string[], deptName?: string | null): ActiveEntry[] {
  const dateSet = new Set(dates);
  const active: ActiveEntry[] = [];

  for (const emp of parsed.employees) {
    if (deptName && emp.deptName !== deptName) continue;
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

/** Builds the per-department Gantt blocks (one per distinct time period worked in that department) */
function toDepartmentTimeline(
  active: ActiveEntry[],
  registry: Map<string, { startMin: number; endMin: number; color: string }>,
  divisor: number, // 1 for daily; days-in-month for monthly averages
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

      return {
        name:   deptNameMap.get(code) ?? `แผนก ${code}`,
        sub:    "",
        plan:   0,   // not available in payroll export
        filled: divisor > 1 ? Math.round(d.filled / divisor) : d.filled,
        blocks,
      };
    })
    .sort((a, b) => b.filled - a.filled);
}

// ─── Per-department views (for the dept filter in Hourly Chart / Shift Summary) ─

/**
 * Hourly workforce curve scoped to one department (or all, when deptName is null/omitted).
 *
 * @param dates   Either a single "DD/MM/YYYY" date (daily view) or a list of dates (monthly view)
 * @param average When true, divides each hour's total by the number of dates —
 *                use this for monthly views so the curve reads as "typical staff
 *                during this hour" instead of a period-long sum.
 */
export function calculateHourlyForDept(
  parsed: ParseResult,
  dates: string | string[],
  deptName?: string | null,
  average = false,
): HourlyPoint[] {
  const dateArr = Array.isArray(dates) ? dates : [dates];
  const active  = getActiveEntries(parsed, dateArr, deptName);
  const counts  = computeHourlyCounts(active);
  const divisor = average ? Math.max(dateArr.length, 1) : 1;
  return toHourlyPoints(counts.map(v => Math.round(v / divisor)));
}

/**
 * Shift summary table scoped to one department (or all, when deptName is null/omitted).
 * Staff counts are always totals (person-days when `dates` spans a month) —
 * percentages stay meaningful either way since they're relative to the same total.
 */
export function calculateShiftSummaryForDept(
  parsed: ParseResult,
  dates: string | string[],
  deptName?: string | null,
): ShiftSummaryItem[] {
  const dateArr  = Array.isArray(dates) ? dates : [dates];
  const active   = getActiveEntries(parsed, dateArr, deptName);
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
export function calculateDashboardData(parsed: ParseResult, targetDate: string): DashboardData {
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
  const departmentTimeline = toDepartmentTimeline(active, registry, 1);

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
export function calculateMonthlySummary(parsed: ParseResult, dates: string[]): MonthlySummary {
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
  const departmentTimeline = toDepartmentTimeline(active, registry, daysInRange || 1);

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
