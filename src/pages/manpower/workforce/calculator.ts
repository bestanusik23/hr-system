/**
 * calculator.ts
 * Smart Workforce Engine — computes hourly coverage, KPIs, and department summaries
 * from the parsed payroll data for a specific target date.
 *
 * Key capability: counts staff per hour based on each employee's ACTUAL start/end
 * times, including overnight shifts and split shifts (e.g. I008: 08:00–16:00 / 00:00–08:00).
 */

import type {
  ParseResult, DashboardData, KPIData, HourlyPoint,
  DeptTimelineItem, ShiftSummaryItem, TimeRange,
} from "./types";

// ─── Shift classification ─────────────────────────────────────────────────────

/**
 * Classify a shift's start time into the 3 standard hospital buckets.
 * Boundary at 06:00 (360 min) and 16:00 (960 min):
 *   night   = 00:00–05:59  (shift starts in the dead of night)
 *   morning = 06:00–15:59  (includes 07:00, 08:00, 09:00 … shifts)
 *   evening = 16:00–23:59  (afternoon/evening starts)
 */
function classifyShift(startMin: number): "night" | "morning" | "evening" {
  if (startMin < 360)  return "night";
  if (startMin < 960)  return "morning";
  return "evening";
}

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

// ─── Shared active-entry extraction ───────────────────────────────────────────

type ActiveEntry = {
  deptCode: string;
  deptName: string;
  ranges: TimeRange[];
  shiftClass: "night" | "morning" | "evening";
};

/**
 * Extracts employees actively working on targetDate, optionally scoped to
 * one department. Shared by calculateDashboardData() and the per-department
 * hourly/summary helpers below so filtering logic isn't duplicated.
 *
 * @param deptName When provided, only entries whose deptName matches are returned.
 */
function getActiveEntries(parsed: ParseResult, targetDate: string, deptName?: string | null): ActiveEntry[] {
  const active: ActiveEntry[] = [];

  for (const emp of parsed.employees) {
    if (deptName && emp.deptName !== deptName) continue;
    for (const rec of emp.records) {
      if (rec.date === targetDate && rec.isActive && rec.ranges.length > 0) {
        active.push({
          deptCode:   emp.deptCode,
          deptName:   emp.deptName,
          ranges:     rec.ranges,
          shiftClass: classifyShift(rec.ranges[0].startMin),
        });
        break; // one active record per employee per date
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

function toShiftSummary(active: ActiveEntry[]): ShiftSummaryItem[] {
  const total   = active.length;
  const morning = active.filter(a => a.shiftClass === "morning").length;
  const evening = active.filter(a => a.shiftClass === "evening").length;
  const night   = active.filter(a => a.shiftClass === "night").length;

  return [
    { shift: "เวรเช้า 06:00–16:00", staff: morning, percentage: total ? Math.round(morning / total * 100) : 0 },
    { shift: "เวรบ่าย 16:00–24:00", staff: evening, percentage: total ? Math.round(evening / total * 100) : 0 },
    { shift: "เวรดึก 00:00–06:00",  staff: night,   percentage: total ? Math.round(night   / total * 100) : 0 },
  ];
}

// ─── Per-department views (for the dept filter in Hourly Chart / Shift Summary) ─

/**
 * Hourly workforce curve scoped to one department (or all, when deptName is null/omitted).
 */
export function calculateHourlyForDept(parsed: ParseResult, targetDate: string, deptName?: string | null): HourlyPoint[] {
  const active = getActiveEntries(parsed, targetDate, deptName);
  return toHourlyPoints(computeHourlyCounts(active));
}

/**
 * Shift summary table scoped to one department (or all, when deptName is null/omitted).
 */
export function calculateShiftSummaryForDept(parsed: ParseResult, targetDate: string, deptName?: string | null): ShiftSummaryItem[] {
  const active = getActiveEntries(parsed, targetDate, deptName);
  return toShiftSummary(active);
}

// ─── Main calculation ─────────────────────────────────────────────────────────

/**
 * Calculates all dashboard data for a specific date.
 *
 * @param parsed     Output from parseWorkbook()
 * @param targetDate "DD/MM/YYYY" Thai BE date to calculate for
 */
export function calculateDashboardData(parsed: ParseResult, targetDate: string): DashboardData {
  const { employees } = parsed;

  // ── 1. Filter: employees who are actively working on targetDate ──────────────
  const active = getActiveEntries(parsed, targetDate);

  // ── 2. Hourly workforce (smart engine) ───────────────────────────────────────
  const hourlyCounts = computeHourlyCounts(active);
  const hourlyWorkforce = toHourlyPoints(hourlyCounts);

  // ── 3. KPI values ────────────────────────────────────────────────────────────
  const total        = active.length;
  const morningShift = active.filter(a => a.shiftClass === "morning").length;
  const eveningShift = active.filter(a => a.shiftClass === "evening").length;
  const nightShift   = active.filter(a => a.shiftClass === "night").length;

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
    morningShift,
    eveningShift,
    nightShift,
    currentActiveStaff,
    peakHour:      `${String(peakIdx).padStart(2, "0")}:00`,
    peakWorkforce: peakVal,
    lowHour:       `${String(lowIdx).padStart(2, "0")}:00`,
    lowWorkforce:  lowVal,
  };

  // ── 4. Department timeline (Gantt data) ──────────────────────────────────────
  type DeptAgg = { filled: number; night: number; morning: number; evening: number };
  const deptMap = new Map<string, DeptAgg>();
  const deptNameMap = new Map<string, string>();

  for (const entry of active) {
    if (!deptMap.has(entry.deptCode)) {
      deptMap.set(entry.deptCode, { filled: 0, night: 0, morning: 0, evening: 0 });
      deptNameMap.set(entry.deptCode, entry.deptName);
    }
    const d = deptMap.get(entry.deptCode)!;
    d.filled++;
    d[entry.shiftClass]++;
  }

  const departmentTimeline: DeptTimelineItem[] = Array.from(deptMap.entries())
    .map(([code, d]) => ({
      name:   deptNameMap.get(code) ?? `แผนก ${code}`,
      sub:    "",
      plan:   0,      // not available in payroll export
      filled: d.filled,
      shifts: { night: d.night, morning: d.morning, evening: d.evening },
    }))
    .sort((a, b) => b.filled - a.filled);

  // ── 5. Shift summary table ───────────────────────────────────────────────────
  const shiftSummary = toShiftSummary(active);

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
