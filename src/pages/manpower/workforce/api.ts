/**
 * api.ts
 * Single entry point for the Workforce Engine.
 * Combines parseWorkbook + calculateDashboardData into one async call.
 */

import { parseWorkbook } from "./parser";
import { calculateDashboardData, calculateHourlyForDept, calculateShiftSummaryForDept } from "./calculator";
import type { ParseResult, DashboardData } from "./types";

export type { ParseResult, DashboardData };
export type { DeptTimelineItem, HourlyPoint, KPIData, ShiftSummaryItem } from "./types";

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
): Promise<{ parsed: ParseResult; data: DashboardData }> {
  const parsed = await parseWorkbook(file);

  // Choose target date: prefer today, fall back to most recent date in file
  const today = todayThai();
  const date  = targetDate
    ?? (parsed.availableDates.includes(today) ? today : parsed.availableDates[parsed.availableDates.length - 1] ?? today);

  const data = calculateDashboardData(parsed, date);
  return { parsed, data };
}

/** Recalculate dashboard when the user changes the target date */
export function switchDate(parsed: ParseResult, targetDate: string): DashboardData {
  return calculateDashboardData(parsed, targetDate);
}

/**
 * Recalculate the hourly workforce chart + shift summary table scoped to one
 * department. Pass deptName = null (or omit) for the "all departments" aggregate.
 */
export function switchDeptView(parsed: ParseResult, targetDate: string, deptName: string | null) {
  return {
    hourlyWorkforce: calculateHourlyForDept(parsed, targetDate, deptName),
    shiftSummary:    calculateShiftSummaryForDept(parsed, targetDate, deptName),
  };
}
