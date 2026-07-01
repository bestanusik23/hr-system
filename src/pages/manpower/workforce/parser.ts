/**
 * parser.ts
 * Reads the payroll "รายงานประกาศกะ" XLS/XLSX and extracts employees + shift records.
 * The report is hierarchical: Branch → Department → Employee → (Date, ShiftCode, ShiftName)
 */

import * as XLSX from "xlsx";
import type { Employee, ParseResult, ShiftRecord, TimeRange } from "./types";

// ─── Non-working detection ────────────────────────────────────────────────────

/** Shift codes that mean no work */
const SKIP_CODES = new Set(["DAY OFF", "OP 01"]);

/** Keywords in shift names that indicate non-working time */
const SKIP_KEYWORDS = ["วันหยุด", "ลาพักร้อน", "ลาป่วย", "ลากิจ", "ลาคลอด", "ลาออก", "ลาประชุม", "ลาอุปสมบท"];

function isNonWorking(code: string, name: string): boolean {
  if (SKIP_CODES.has(code.trim())) return true;
  return SKIP_KEYWORDS.some(kw => name.includes(kw));
}

// ─── Time parsing ─────────────────────────────────────────────────────────────

/**
 * Parses "HH.MM" → minutes from midnight.
 * Special case: "00.00" as the END of a range means 24:00 (midnight = 1440 min).
 */
function hmToMin(hhmm: string, isEnd: boolean): number {
  const parts = hhmm.trim().split(".");
  const h = parseInt(parts[0] ?? "0", 10);
  const m = parseInt(parts[1] ?? "0", 10);
  const mins = h * 60 + m;
  if (mins === 0 && isEnd) return 1440; // "00.00" as end → midnight
  return mins;
}

/**
 * Extracts all time ranges from a shift name such as:
 *   "วันงาน 08.00 - 16.00 (ทำงาน 8 ชั่วโมง)"
 *   "วันงาน 16.00 - 08.00 (ทำงาน 16 ชั่วโมง)"   ← overnight
 *   "วันงาน 08.00 - 16.00 / 00.00 - 08.00 ..."   ← split shift
 */
export function parseShiftTimes(shiftName: string): TimeRange[] {
  const ranges: TimeRange[] = [];
  const re = /(\d{1,2}\.\d{2})\s*[-–]\s*(\d{1,2}\.\d{2})/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(shiftName)) !== null) {
    const startMin = hmToMin(match[1], false);
    const rawEnd   = hmToMin(match[2], true);
    // Overnight: if end ≤ start, shift crosses midnight — extend end by 1440
    const endMin = rawEnd <= startMin ? rawEnd + 1440 : rawEnd;
    ranges.push({ startMin, endMin });
  }
  return ranges;
}

// ─── Department name cleanup ──────────────────────────────────────────────────

/** Strip the branch code suffix, e.g. "ผู้ป่วยใน 5340" → "ผู้ป่วยใน" */
function cleanDeptName(raw: string): string {
  return raw.replace(/\s+\d{3,5}$/, "").trim();
}

// ─── Date sort key ────────────────────────────────────────────────────────────

/** Convert "DD/MM/YYYY" to "YYYY/MM/DD" for lexicographic sorting */
function dateKey(d: string): string {
  const p = d.split("/");
  return `${p[2] ?? "0000"}/${p[1] ?? "00"}/${p[0] ?? "00"}`;
}

// ─── Main parser ──────────────────────────────────────────────────────────────

/**
 * Parses the payroll shift-announcement report.
 * Works with both .xls and .xlsx files.
 */
export async function parseWorkbook(file: File): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array", raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Read all rows as arrays (empty cells → empty string)
  const allRows = XLSX.utils.sheet_to_json(ws, {
    header: 1,
    defval: "",
  }) as (string | number | undefined)[][];

  const employees: Employee[] = [];
  const dateSet = new Set<string>();

  let currentBranch   = "";
  let currentDeptCode = "";
  let currentDeptName = "";
  let currentEmp: Employee | null = null;
  let reportTitle = "";
  let dateRangeStr = "";

  for (const rawRow of allRows) {
    // Normalise every cell to string
    const row = (rawRow as (string | number | undefined)[]).map((c) => String(c ?? "").trim());

    // Skip entirely empty rows
    if (row.every(c => !c)) continue;

    const c1 = row[1] ?? "";

    // ── Report header ─────────────────────────────────────────────────────────
    if (c1 === "รายงานประกาศกะ") { reportTitle = c1; continue; }
    if (c1.startsWith("ตั้งแต่วันที่")) { dateRangeStr = c1; continue; }
    if (c1 === "รหัส") continue; // column header row

    // ── Branch header: col[1] = "รหัสสาขา" ───────────────────────────────────
    if (c1 === "รหัสสาขา") {
      currentBranch = [row[6], row[5], row[4], row[2]].find(v => v) ?? "";
      continue;
    }

    // ── Department header: col[1] = "แผนก" ───────────────────────────────────
    if (c1 === "แผนก") {
      currentDeptCode = row[2] ?? "";
      currentDeptName = cleanDeptName([row[5], row[4], row[6]].find(v => v) ?? `แผนก ${row[2]}`);
      continue;
    }

    // ── Employee header: col[1] = 5-8 digit employee code, col[3] = name ─────
    if (/^\d{5,8}$/.test(c1) && (row[3] ?? "")) {
      if (currentEmp) employees.push(currentEmp);
      currentEmp = {
        code: c1,
        name: row[3] ?? "",
        deptCode: currentDeptCode,
        deptName: currentDeptName,
        branch: currentBranch,
        records: [],
      };
      continue;
    }

    // ── Shift record: col[10] = date, col[11] = code, col[15] = name ─────────
    const date      = row[10] ?? "";
    const shiftCode = row[11] ?? "";
    const shiftName = row[15] ?? "";

    if (date && shiftCode && /\d{2}\/\d{2}\/\d{4}/.test(date) && currentEmp) {
      const skip   = isNonWorking(shiftCode, shiftName);
      const ranges = skip ? [] : parseShiftTimes(shiftName);

      const record: ShiftRecord = {
        date,
        code:     shiftCode,
        name:     shiftName,
        ranges,
        isActive: !skip && ranges.length > 0,
      };

      currentEmp.records.push(record);
      if (date) dateSet.add(date);
    }
  }

  // Push the last employee
  if (currentEmp) employees.push(currentEmp);

  const availableDates = Array.from(dateSet).sort((a, b) =>
    dateKey(a) < dateKey(b) ? -1 : 1
  );

  return { employees, availableDates, reportTitle, dateRangeStr };
}
