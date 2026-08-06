/**
 * otParser.ts
 * Best-effort extraction of each department's OT total from the hospital's
 * monthly "ค่าเวรประจำเดือน" Excel file (sheet usually named "ค่าเวร").
 *
 * The file has NO consistent layout: most departments end with a
 * "สรุปค่าขึ้นเวร [ชื่อแผนก]" row holding the total, but a few (ห้องยา)
 * just leave a bare number after the last person row with no label at
 * all — confirmed by manually reading a real July 2569 file.
 *
 * Two sections cover TWO of our payroll departments combined into one
 * figure, but each has its own way to split them back apart (verified
 * against the same real file, both reconciling exactly to the section's
 * printed total):
 *   - "X-RAYและรังสีรักษา" has separate "ศูนย์มะเร็ง"/"ตึกเก่า" columns per
 *     person → summed directly into ศูนย์มะเร็ง / รังสีวินิจฉัย.
 *   - "IT/บัญชี" has one column, but each person's position title says
 *     which team they're on → matched by keyword into เทคโนโลยีสารสนเทศ /
 *     บัญชี. A few positions (คลังสินค้า, จัดซื้อยา) belong to neither and
 *     are reported as a leftover instead of guessed into either bucket.
 *
 * If a future month's file doesn't have the expected columns/keywords,
 * both splitters fall back to reporting the section as "needs manual
 * split" rather than silently pushing a wrong number.
 *
 * Nothing here is ever saved automatically — callers must show the
 * parsed numbers for review before writing anything.
 */

import * as XLSX from "xlsx";

export interface OtParseHit { deptName: string; amount: number; sourceLabel: string }
export interface OtParseSkip { sourceLabel: string; amount: number; reason: string }
export interface OtParseResult { hits: OtParseHit[]; skipped: OtParseSkip[]; total: number }

type Cell = string | number | null;

type SectionRule =
  | { kind: "single"; deptNames: string[] }
  | { kind: "skip" }
  | { kind: "split-xray" }
  | { kind: "split-it-accounting" };

const SECTION_KEYWORDS: { pattern: RegExp; rule: SectionRule; label: string }[] = [
  { pattern: /^IPD\b/i,           rule: { kind: "single", deptNames: ["ผู้ป่วยใน"] }, label: "IPD" },
  { pattern: /^ER\b/i,            rule: { kind: "single", deptNames: ["อุบัติเหตุและฉุกเฉิน"] }, label: "ER" },
  { pattern: /^OPD\s*\/?\s*CHK/i, rule: { kind: "single", deptNames: ["ผู้ป่วยนอก"] }, label: "OPD/CHK" },
  { pattern: /^ห้องยา/,            rule: { kind: "single", deptNames: ["เภสัชกรรม"] }, label: "ห้องยา" },
  { pattern: /^ต้อนรับ/,           rule: { kind: "single", deptNames: ["ต้อนรับและบริการ"] }, label: "ต้อนรับและบริการ" },
  { pattern: /^การเงิน/,           rule: { kind: "single", deptNames: ["การเงิน"] }, label: "การเงิน (แคชเชียร์)" },
  { pattern: /^เทคนิคการแพทย์/,    rule: { kind: "single", deptNames: ["เทคนิคการแพทย์"] }, label: "เทคนิคการแพทย์" },
  { pattern: /X-RAY|รังสี/i,       rule: { kind: "split-xray" }, label: "X-RAYและรังสีรักษา" },
  { pattern: /SUPERVISOR/i,       rule: { kind: "skip" }, label: "SUPERVISOR" }, // explicitly not tracked per department
  { pattern: /IT\s*\/\s*บัญชี/i,  rule: { kind: "split-it-accounting" }, label: "IT/บัญชี" },
];

function matchSection(cellA: Cell) {
  if (typeof cellA !== "string") return null;
  const text = cellA.trim();
  if (!text) return null;
  for (const s of SECTION_KEYWORDS) {
    if (s.pattern.test(text)) return s;
  }
  return null;
}

function numCol(row: Cell[] | undefined, col: number): number {
  const v = row?.[col];
  return typeof v === "number" ? v : 0;
}

/** Finds a section's single total: prefer a "สรุป..." row, else the last row
 *  with a number in columns C-J whose name column (B) is empty (non-person row). */
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

/** Splits "X-RAYและรังสีรักษา" via its per-person ศูนย์มะเร็ง(F)/ตึกเก่า(G) columns. */
function splitXray(rows: Cell[][], start: number, end: number): OtParseHit[] | null {
  let cancerCenter = 0, oldBuilding = 0;
  for (let r = start; r < end; r++) {
    cancerCenter += numCol(rows[r], 5); // F
    oldBuilding  += numCol(rows[r], 6); // G
  }
  if (cancerCenter === 0 && oldBuilding === 0) return null; // columns not laid out as expected this month
  return [
    { deptName: "ศูนย์มะเร็ง",   amount: cancerCenter, sourceLabel: "X-RAYและรังสีรักษา (คอลัมน์ศูนย์มะเร็ง)" },
    { deptName: "รังสีวินิจฉัย", amount: oldBuilding,  sourceLabel: "X-RAYและรังสีรักษา (คอลัมน์ตึกเก่า)" },
  ];
}

/** Splits "IT/บัญชี" by matching each person's position title (col D) against keywords. */
function splitItAccounting(rows: Cell[][], start: number, end: number): { hits: OtParseHit[]; residual: number } | null {
  let itSum = 0, acctSum = 0, otherSum = 0, matched = false;
  for (let r = start; r < end; r++) {
    const pos = rows[r]?.[3];
    const amt = rows[r]?.[4];
    if (typeof pos !== "string" || typeof amt !== "number") continue;
    if (/เทคโนโลยีสารสนเทศ/.test(pos)) { itSum += amt; matched = true; }
    else if (/บัญชี/.test(pos)) { acctSum += amt; matched = true; }
    else otherSum += amt;
  }
  if (!matched) return null; // no recognizable position titles this month
  return {
    hits: [
      { deptName: "เทคโนโลยีสารสนเทศ", amount: itSum,   sourceLabel: "IT/บัญชี (ตำแหน่ง IT)" },
      { deptName: "บัญชี",             amount: acctSum, sourceLabel: "IT/บัญชี (ตำแหน่งบัญชี)" },
    ],
    residual: otherSum,
  };
}

export async function parseOtWorkbook(file: File): Promise<OtParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.find(n => n.includes("ค่าเวร") || n.toLowerCase().includes("ot")) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null });

  // Locate every section header row
  const sections: { row: number; label: string; rule: SectionRule }[] = [];
  rows.forEach((row, i) => {
    const m = matchSection(row[0]);
    if (m) sections.push({ row: i, label: m.label, rule: m.rule });
  });

  const hits: OtParseHit[] = [];
  const skipped: OtParseSkip[] = [];

  sections.forEach((sec, i) => {
    const end = sections[i + 1]?.row ?? rows.length;

    if (sec.rule.kind === "skip") return;

    if (sec.rule.kind === "single") {
      const total = findSectionTotal(rows, sec.row, end);
      if (total === null) {
        skipped.push({ sourceLabel: sec.label, amount: 0, reason: "หาไม่พบยอดรวมในหมวดนี้ — กรุณากรอกเอง" });
      } else {
        for (const deptName of sec.rule.deptNames) hits.push({ deptName, amount: total, sourceLabel: sec.label });
      }
      return;
    }

    if (sec.rule.kind === "split-xray") {
      const split = splitXray(rows, sec.row, end);
      if (split) hits.push(...split);
      else skipped.push({ sourceLabel: sec.label, amount: 0, reason: "ไม่พบคอลัมน์ศูนย์มะเร็ง/ตึกเก่าตามที่คาดไว้ — กรุณาแบ่งยอดเอง" });
      return;
    }

    if (sec.rule.kind === "split-it-accounting") {
      const split = splitItAccounting(rows, sec.row, end);
      if (split) {
        hits.push(...split.hits);
        if (split.residual > 0) {
          skipped.push({
            sourceLabel: sec.label, amount: split.residual,
            reason: "มีตำแหน่งที่ไม่ใช่ IT หรือบัญชี (เช่น คลังสินค้า/จัดซื้อ) — กรุณาตรวจสอบว่ายอดนี้ควรไปแผนกไหนเอง",
          });
        }
      } else {
        skipped.push({ sourceLabel: sec.label, amount: 0, reason: "ไม่พบตำแหน่งที่จับคู่ IT/บัญชีได้ — กรุณาแบ่งยอดเอง" });
      }
    }
  });

  const total = hits.reduce((s, h) => s + h.amount, 0);
  return { hits, skipped, total };
}
