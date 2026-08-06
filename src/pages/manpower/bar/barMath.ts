/**
 * barMath.ts — สูตรกลางของระบบ Bar Management
 *
 * แนวคิดจาก EXCOM: 1 Bar = 1 หน่วยกำลังคนมาตรฐานที่โรงพยาบาลยอมจ่ายต่อวัน
 * (กะ 8 ชม. = 1.00 Bar, 10 ชม. = 1.25 Bar, 12 ชม. = 1.50 Bar) — ไม่ใช่จำนวนหัวคน
 * จำนวนพนักงานจริงจึงมากกว่าจำนวน Bar ได้ เพราะวันหยุด เวร และการลาพัก
 *
 * ทุกหน้าจอในเมนู Bar Management ใช้ไฟล์นี้ที่เดียว เพื่อให้ตัวเลขตรงกันทั้งระบบ
 */

import type { DeptTimelineItem, ShiftBlock } from "../workforce/types";

/** หนึ่งแถวของมาตรฐานกะ (ตาราง shift_standards) — position '*' = ค่ากลาง */
export interface ShiftStandardRow {
  id?: number;
  position: string;
  hours: number;
  bar_value: number;
  note?: string;
}

/** หนึ่งแถวของ Approved Bar + ประเภทงาน (ตาราง dept_bar_config) */
export interface BarConfigRow {
  dept_name: string;
  approved_bar: number;
  dept_type: DeptType;
  active: number;
  note: string;
  updated_by?: string | null;
  updated_at?: string;
}

export type DeptType = "Service" | "Support" | "Back Office";
export const DEPT_TYPES: DeptType[] = ["Service", "Support", "Back Office"];

/** ค่ามาตรฐานกลางที่ใช้เมื่อยังโหลดตาราง shift_standards ไม่สำเร็จ */
export const FALLBACK_STANDARDS: ShiftStandardRow[] = [
  { position: "*", hours: 8,  bar_value: 1.0 },
  { position: "*", hours: 10, bar_value: 1.25 },
  { position: "*", hours: 12, bar_value: 1.5 },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * จำนวน Bar ที่ 1 คนได้จากการขึ้นเวร 1 กะ
 * ลำดับการค้นหา: มาตรฐานเฉพาะตำแหน่ง → มาตรฐานกลาง ('*') → สูตรตรง hours/8
 * (สูตร hours/8 คือกฎเดียวกับที่ค่ามาตรฐาน 8/10/12 ตั้งไว้ จึงต่อเนื่องกับกะที่ไม่ลงตัว เช่น 9 ชม.)
 */
export function barValueForHours(
  hours: number,
  standards: ShiftStandardRow[] = FALLBACK_STANDARDS,
  position = "*",
): number {
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;
  if (position !== "*") {
    const own = standards.find(s => s.position === position && near(s.hours, hours));
    if (own) return own.bar_value;
  }
  const std = standards.find(s => s.position === "*" && near(s.hours, hours));
  if (std) return std.bar_value;
  return round2(hours / 8);
}

/** ชั่วโมงทำงานของหนึ่งช่วงเวลา (รองรับกะข้ามคืนที่ endMin > 1440) */
export function blockHours(b: ShiftBlock): number {
  return Math.max(0, (b.endMin - b.startMin) / 60);
}

/**
 * Actual Bar ของหนึ่งแผนกในหนึ่งวัน
 * = ผลรวม (จำนวนคนในช่วงเวลานั้น × ค่า Bar ของความยาวกะนั้น)
 * ข้อมูลต้นทางคือ blocks ที่ engine สรุปจากไฟล์กะที่นำเข้า (Excel เดิม)
 */
export function actualBarForDept(
  dept: DeptTimelineItem,
  standards: ShiftStandardRow[] = FALLBACK_STANDARDS,
): number {
  const total = dept.blocks.reduce(
    (sum, b) => sum + b.count * barValueForHours(blockHours(b), standards),
    0,
  );
  return round2(total);
}

/** จำนวนสโลตของไทม์ไลน์ 24 ชม. (ช่วงละ 2 ชม.) */
export const SLOT_COUNT = 12;
export const SLOT_HOURS = 24 / SLOT_COUNT;
export const SLOT_LABELS = Array.from({ length: SLOT_COUNT }, (_, i) => {
  const s = String(i * SLOT_HOURS).padStart(2, "0");
  const e = String((i + 1) * SLOT_HOURS).padStart(2, "0");
  return `${s}-${e}`;
});

/**
 * กระจาย Bar ที่ใช้จริงลงราย 2 ชม. — Bar ของแต่ละสโลต = (คน-ชั่วโมงในสโลตนั้น) ÷ 8
 * ผลรวมทั้ง 12 สโลตจะเท่ากับ Actual Bar รายวันพอดี จึงเทียบกันได้ตรง ๆ
 */
export function slotBars(blocks: ShiftBlock[]): number[] {
  const slots = new Array(SLOT_COUNT).fill(0);
  for (const b of blocks) {
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slotStart = i * SLOT_HOURS * 60;
      const slotEnd   = slotStart + SLOT_HOURS * 60;
      // ช่วงเวลาปกติ + ส่วนที่วนข้ามเที่ยงคืนมาต้นวัน
      const overlap =
        Math.max(0, Math.min(b.endMin, slotEnd) - Math.max(b.startMin, slotStart)) +
        Math.max(0, Math.min(b.endMin - 1440, slotEnd) - Math.max(b.startMin - 1440, slotStart));
      if (overlap > 0) slots[i] += (b.count * overlap) / 60 / 8;
    }
  }
  return slots.map(round2);
}

/** ตัวเลขสรุปของหนึ่งแผนก ที่ทุกหน้าจอใช้ร่วมกัน */
export interface DeptBarRow {
  name: string;
  type: DeptType;
  approvedBar: number;
  actualBar: number;
  headcount: number;        // จำนวนหัวคนที่ลงเวรจริง (คนละหน่วยกับ Bar)
  variance: number;         // Actual − Approved
  utilization: number;      // Actual ÷ Approved × 100
  otCost: number;           // บาท (workforce_ot_entries)
  otHours: number;          // ชม. (ot_approvals)
  otPerBar: number;         // OT Cost ÷ Actual Bar
  otStatus: "none" | "pending" | "approved" | "rejected";
  otReason: string;
  slots: number[];          // Bar ที่ใช้จริงราย 2 ชม.
  hasShiftData: boolean;    // false = ยังไม่มีไฟล์กะของเดือนนี้
}

export interface BarTotals {
  approvedBar: number;
  actualBar: number;
  variance: number;
  utilization: number;
  otCost: number;
  otHours: number;
  otPerBar: number;
  overCount: number;
  slotsActual: number[];
  deptCount: number;
}

export function totalsOf(rows: DeptBarRow[]): BarTotals {
  const approvedBar = rows.reduce((s, r) => s + r.approvedBar, 0);
  const actualBar   = rows.reduce((s, r) => s + r.actualBar, 0);
  const otCost      = rows.reduce((s, r) => s + r.otCost, 0);
  const otHours     = rows.reduce((s, r) => s + r.otHours, 0);
  const slotsActual = Array.from({ length: SLOT_COUNT }, (_, i) =>
    round2(rows.reduce((s, r) => s + (r.slots[i] ?? 0), 0)));
  return {
    approvedBar: round2(approvedBar),
    actualBar:   round2(actualBar),
    variance:    round2(actualBar - approvedBar),
    utilization: approvedBar > 0 ? (actualBar / approvedBar) * 100 : 0,
    otCost, otHours,
    otPerBar:    actualBar > 0 ? otCost / actualBar : 0,
    overCount:   rows.filter(r => r.actualBar > r.approvedBar && r.approvedBar > 0).length,
    slotsActual,
    deptCount:   rows.length,
  };
}

/** สีตามระดับการใช้ Bar — ใช้ร่วมกันทั้งตาราง ไทม์ไลน์ และ Heat Map */
export function utilColor(u: number): string {
  if (u > 110) return "#dc2626";  // เกินแผนมาก
  if (u > 105) return "#f0803c";  // เกินแผน
  if (u >= 95) return "#e08c00";  // ใกล้เต็ม
  return "#12a150";               // อยู่ในแผน
}

export const fmt = (n: number, d = 0) =>
  n.toLocaleString("th-TH", { minimumFractionDigits: d, maximumFractionDigits: d });

/** "MM/YYYY" (พ.ศ.) ของรอบจ่ายเงินเดือนปัจจุบัน — ตัดรอบวันที่ 26 เหมือน getAvailableMonths() */
export function currentPayrollMonthKey(): string {
  const d = new Date();
  let mon = d.getMonth() + 1;
  let yearBE = d.getFullYear() + 543;
  if (d.getDate() >= 26) { mon += 1; if (mon > 12) { mon = 1; yearBE += 1; } }
  return `${String(mon).padStart(2, "0")}/${yearBE}`;
}

const THAI_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
/** "07/2569" → "ก.ค. 69" */
export function shortMonthLabel(key: string): string {
  const [m, y] = key.split("/");
  const idx = parseInt(m, 10) - 1;
  return `${THAI_MONTHS[idx] ?? m} ${y?.slice(-2) ?? ""}`;
}

/** เรียงคีย์เดือน "MM/YYYY" ตามเวลาจริง */
export function compareMonthKey(a: string, b: string): number {
  const [ma, ya] = a.split("/").map(Number);
  const [mb, yb] = b.split("/").map(Number);
  return ya !== yb ? ya - yb : ma - mb;
}
