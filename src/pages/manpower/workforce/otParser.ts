/**
 * otParser.ts
 * Best-effort extraction of each department's OT total from the hospital's
 * monthly "ค่าเวรประจำเดือน" Excel file (sheet usually named "ค่าเวร").
 *
 * The file has NO consistent layout: most departments end with a
 * "สรุปค่าขึ้นเวร [ชื่อแผนก]" row holding the total, but a few (ห้องยา,
 * X-RAYและรังสีรักษา) just leave a bare number after the last person row
 * with no label at all — confirmed by manually reading a real July 2569
 * file. Two sections ("X-RAYและรังสีรักษา", "IT/บัญชี") also cover TWO of
 * our payroll departments combined into one figure, so those are reported
 * but never auto-filled — HR must split them by hand. Nothing here is
 * ever saved automatically; callers must show the parsed numbers for
 * review before writing anything.
 */

import * as XLSX from "xlsx";

export interface OtParseHit { deptName: string; amount: number; sourceLabel: string }
export interface OtParseSkip { sourceLabel: string; amount: number; reason: string }
export interface OtParseResult { hits: OtParseHit[]; skipped: OtParseSkip[]; total: number }

// Section header keyword → payroll dept name(s) it maps to.
// One name = confidently auto-fillable. Multiple names = combined in the
// source file; reported under `skipped` instead, since we can't tell how
// to split the total between them.
const SECTION_KEYWORDS: { pattern: RegExp; deptNames: string[] | null; label: string }[] = [
  { pattern: /^IPD\b/i,                    deptNames: ["ผู้ป่วยใน"], label: "IPD" },
  { pattern: /^ER\b/i,                     deptNames: ["อุบัติเหตุและฉุกเฉิน"], label: "ER" },
  { pattern: /^OPD\s*\/?\s*CHK/i,          deptNames: ["ผู้ป่วยนอก"], label: "OPD/CHK" },
  { pattern: /^ห้องยา/,                     deptNames: ["เภสัชกรรม"], label: "ห้องยา" },
  { pattern: /^ต้อนรับ/,                    deptNames: ["ต้อนรับและบริการ"], label: "ต้อนรับและบริการ" },
  { pattern: /^การเงิน/,                    deptNames: ["การเงิน"], label: "การเงิน (แคชเชียร์)" },
  { pattern: /^เทคนิคการแพทย์/,             deptNames: ["เทคนิคการแพทย์"], label: "เทคนิคการแพทย์" },
  { pattern: /X-RAY|รังสี/i,                deptNames: null, label: "X-RAYและรังสีรักษา" }, // covers รังสีวินิจฉัย + ศูนย์มะเร็ง — needs manual split
  { pattern: /SUPERVISOR/i,                deptNames: [], label: "SUPERVISOR" },            // explicitly not tracked per department
  { pattern: /IT\s*\/\s*บัญชี/i,           deptNames: null, label: "IT/บัญชี" },            // covers เทคโนโลยีสารสนเทศ + บัญชี — needs manual split
];

type Cell = string | number | null;

function matchSection(cellA: Cell) {
  if (typeof cellA !== "string") return null;
  const text = cellA.trim();
  if (!text) return null;
  for (const s of SECTION_KEYWORDS) {
    if (s.pattern.test(text)) return s;
  }
  return null;
}

/** Finds the section's total: prefer a "สรุป..." row, else the last row with
 *  a number in columns E-J whose name column (B) is empty (non-person row). */
function findSectionTotal(rows: Cell[][], start: number, end: number): number | null {
  for (let r = start; r < end; r++) {
    const a = rows[r]?.[0];
    if (typeof a === "string" && a.includes("สรุป")) {
      const nums = rows[r].slice(2, 10).filter((v): v is number => typeof v === "number");
      if (nums.length > 0) return Math.max(...nums);
    }
  }
  for (let r = end - 1; r >= start; r--) {
    const b = rows[r]?.[1];
    const hasName = typeof b === "string" && b.trim() !== "";
    if (hasName) continue;
    const nums = rows[r]?.slice(2, 10).filter((v): v is number => typeof v === "number") ?? [];
    if (nums.length > 0) return Math.max(...nums);
  }
  return null;
}

export async function parseOtWorkbook(file: File): Promise<OtParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.find(n => n.includes("ค่าเวร") || n.toLowerCase().includes("ot")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null });

  // Locate every section header row
  const sections: { row: number; label: string; deptNames: string[] | null }[] = [];
  rows.forEach((row, i) => {
    const m = matchSection(row[0]);
    if (m) sections.push({ row: i, label: m.label, deptNames: m.deptNames });
  });

  const hits: OtParseHit[] = [];
  const skipped: OtParseSkip[] = [];

  sections.forEach((sec, i) => {
    const end = sections[i + 1]?.row ?? rows.length;
    const total = findSectionTotal(rows, sec.row, end);
    if (total === null) {
      skipped.push({ sourceLabel: sec.label, amount: 0, reason: "หาไม่พบยอดรวมในหมวดนี้ — กรุณากรอกเอง" });
      return;
    }
    if (sec.deptNames === null) {
      skipped.push({ sourceLabel: sec.label, amount: total, reason: "หมวดนี้รวมหลายแผนกเป็นยอดเดียว — กรุณาแบ่งยอดเอง" });
    } else if (sec.deptNames.length === 0) {
      // SUPERVISOR-style section, intentionally not tracked per department
    } else {
      for (const deptName of sec.deptNames) hits.push({ deptName, amount: total, sourceLabel: sec.label });
    }
  });

  const total = hits.reduce((s, h) => s + h.amount, 0);
  return { hits, skipped, total };
}
