/**
 * api.ts
 * Single entry point for the Workforce Engine.
 * Combines parseWorkbook + calculateDashboardData into one async call.
 */

import { parseWorkbook } from "./parser";
import {
  calculateDashboardData, calculateHourlyForDept, calculateShiftSummaryForDept,
  calculateMonthlySummary, getCurrentStaffDetail,
  calculateShiftBandSummary, calculateBandsByDept, SHIFT_BANDS, shiftBandIndices, bandIndexForStart,
  getBandStaffDetail, calculateMonthlyHoursPerEmployee,
} from "./calculator";
import { getPositionForName } from "./positionMap";
import { MONTHLY_HOUR_THRESHOLDS, classifyPositionCategory } from "./hoursPolicy";
import type { ParseResult, DashboardData, MonthOption, MonthlySummary, MonthlyHoursRow } from "./types";

export type { ParseResult, DashboardData, MonthOption, MonthlySummary, MonthlyHoursRow };
export type {
  DeptTimelineItem, HourlyPoint, KPIData, ShiftSummaryItem, ShiftBlock, CurrentStaffEntry,
  ShiftBandItem, DeptBandRow, BandStaffEntry,
} from "./types";
export {
  getCurrentStaffDetail, calculateShiftBandSummary, calculateBandsByDept,
  SHIFT_BANDS, shiftBandIndices, bandIndexForStart, getBandStaffDetail,
};

const THAI_MONTHS = [
  "", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/**
 * Convert "DD/MM/YYYY" Thai BE → "YYYY-MM-DD" CE for date comparison.
 * BE year: subtract 543.  e.g. 01/07/2569 → 2026-07-01
 */
export function thaiDateToISO(d: string): string {
  const [day, mon, yearBE] = d.split("/");
  const yearCE = parseInt(yearBE ?? "0", 10) - 543;
  return `${yearCE}-${mon?.padStart(2, "0") ?? "01"}-${day?.padStart(2, "0") ?? "01"}`;
}

/** Today as "DD/MM/YYYY" Thai BE */
export function todayThai(): string {
  const d = new Date();
  const yearBE = d.getFullYear() + 543;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${dd}/${mm}/${yearBE}`;
}

/** Format "DD/MM/YYYY" (BE) for display in Thai */
export function formatThaiDate(d: string): string {
  const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const [day, mon, year] = d.split("/");
  return `${parseInt(day ?? "1", 10)} ${months[parseInt(mon ?? "1", 10)] ?? ""} ${year ?? ""}`;
}

/**
 * Import a payroll XLS/XLSX file and compute dashboard data for a target date.
 *
 * @param file        The uploaded file from <input type="file">
 * @param targetDate  "DD/MM/YYYY" Thai BE — defaults to today or last date in file
 * @returns { parsed, data } — keep `parsed` in state so the user can switch dates
 */
export async function importWorkforceFile(
  file: File,
  targetDate?: string,
  planByDept?: Map<string, number>,
): Promise<{ parsed: ParseResult; data: DashboardData }> {
  const parsed = await parseWorkbook(file);

  // Choose target date: prefer today, fall back to most recent date in file
  const today = todayThai();
  const date  = targetDate
    ?? (parsed.availableDates.includes(today) ? today : parsed.availableDates[parsed.availableDates.length - 1] ?? today);

  const data = calculateDashboardData(parsed, date, planByDept);
  return { parsed, data };
}

/** Recalculate dashboard when the user changes the target date */
export function switchDate(parsed: ParseResult, targetDate: string, planByDept?: Map<string, number>): DashboardData {
  return calculateDashboardData(parsed, targetDate, planByDept);
}

/**
 * Recalculate the hourly workforce chart + shift summary table scoped to one
 * department. Pass deptName = null (or omit) for the "all departments" aggregate.
 * Pass an array of dates (e.g. a whole month) to average the hourly curve
 * across that range instead of a single day.
 */
export function switchDeptView(parsed: ParseResult, dates: string | string[], deptNames: string[] | null) {
  const average = Array.isArray(dates) && dates.length > 1;
  return {
    hourlyWorkforce: calculateHourlyForDept(parsed, dates, deptNames, average),
    shiftSummary:    calculateShiftSummaryForDept(parsed, dates, deptNames),
    bandSummary:     calculateShiftBandSummary(parsed, dates, deptNames),
    deptBands:       calculateBandsByDept(parsed, dates, deptNames),
  };
}

/**
 * Groups a file's available dates into payroll cycles (26th of the previous
 * month through the 25th), matching the same cutoff used by the manpower plan
 * table — NOT the calendar month. So 26/05–25/06 is a single "มิถุนายน" cycle,
 * not split into a 6-day May bucket and a 25-day June bucket.
 */
export function getAvailableMonths(parsed: ParseResult): MonthOption[] {
  const map = new Map<string, string[]>();

  for (const d of parsed.availableDates) {
    const [dayStr, monStr, yearStr] = d.split("/");
    const day = parseInt(dayStr, 10);
    let mon = parseInt(monStr, 10);
    let year = parseInt(yearStr, 10);

    // Dates from the 26th onward belong to next month's payroll cycle
    if (day >= 26) {
      mon += 1;
      if (mon > 12) { mon = 1; year += 1; }
    }

    const key = `${String(mon).padStart(2, "0")}/${year}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }

  return Array.from(map.entries())
    .map(([key, dates]) => {
      const [mon, year] = key.split("/");
      return {
        key,
        label: `${THAI_MONTHS[parseInt(mon, 10)] ?? mon} ${year}`,
        dates: dates.sort(),
      };
    })
    .sort((a, b) => (a.key < b.key ? -1 : 1));
}

/** Computes the monthly aggregate for one MonthOption (from getAvailableMonths). */
export function calculateMonthly(parsed: ParseResult, month: MonthOption, planByDept?: Map<string, number>): MonthlySummary {
  const summary = calculateMonthlySummary(parsed, month.dates, planByDept);
  return { ...summary, monthLabel: month.label };
}

/**
 * Total hours worked this month per employee vs the hospital's announced
 * threshold for their category (วิชาชีพ / ผู้ช่วยวิชาชีพ) — flags who may need
 * an OT submission. Position comes from getPositionForName() matching the
 * payroll name against the manpower plan roster (the shift export itself has
 * no position column) — that match is NOT 100%; unmatched names still get a
 * row here (category defaults to "assistant" per the policy's own "ส่วนที่
 * เหลือคือผู้ช่วยวิชาชีพ" rule) but with position: null, so the UI can call
 * those out separately instead of silently trusting a guess.
 */
export function calculateMonthlyHoursReport(parsed: ParseResult, month: MonthOption): MonthlyHoursRow[] {
  const hours = calculateMonthlyHoursPerEmployee(parsed, month.dates);
  const threshold = MONTHLY_HOUR_THRESHOLDS[month.key] ?? null;

  return hours.map(h => {
    const position = getPositionForName(h.name);
    const category = classifyPositionCategory(position ?? "");
    const limit = threshold ? threshold[category] : null;
    return {
      name: h.name,
      department: h.department,
      position,
      category,
      totalHours: h.totalHours,
      threshold: limit,
      overHours: limit != null ? Math.max(0, Math.round((h.totalHours - limit) * 10) / 10) : 0,
    };
  }).sort((a, b) => b.overHours - a.overHours || b.totalHours - a.totalHours);
}
