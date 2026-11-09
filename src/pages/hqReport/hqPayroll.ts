// Reads the monthly payroll report (.xls) in the browser and reduces it to department totals.
// Nothing per-person leaves this file. Column positions and labels differ between months, and
// some months only have department summaries, so everything is located by its header label.
import * as XLSX from "xlsx";
import { LINES, type ApiLaborCost, type ApiPayrollDept, type Line } from "./hqReportCalc";

export interface PayrollDept { name: string; headcount: number; regular: number; otShift: number }
export interface PayrollFile { fileName: string; payMonth: string; depts: PayrollDept[] }

const t = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => (typeof v === "number" ? v : 0);
const round2 = (v: number) => Math.round(v * 100) / 100;

/** "ผู้ป่วยใน ( 5340 )" and "ผู้ป่วยใน 5340" are the same department; the trailing number is its account code. */
export const normalizeDept = (s: string) => s.replace(/\s*\(?\s*\d{4}\s*\)?\s*$/, "").replace(/\s+/g, " ").trim();

export function parsePayroll(buf: ArrayBuffer, fileName: string): PayrollFile {
  const wb = XLSX.read(buf, { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "", raw: true }) as unknown[][];

  const h = rows.findIndex(r => r.some(v => t(v) === "เงินเดือน") && r.some(v => /สุทธิ/.test(t(v))));
  if (h < 0) throw new Error(`${fileName}: ไม่พบหัวคอลัมน์ของรายงานเงินเดือน`);
  const labels = rows[h].map(t);

  const date = rows.slice(0, h).map(r => t(r[0])).join(" ").match(/ถึงวันที่\s+\d{1,2}\/(\d{1,2})\/(\d{4})/);
  if (!date) throw new Error(`${fileName}: ไม่พบวันที่ของงวดเงินเดือน`);
  const payMonth = `${Number(date[2]) - 543}-${date[1].padStart(2, "0")}`;

  // Income columns run from เงินเดือน up to the first หัก… column.
  const salaryCol = labels.indexOf("เงินเดือน");
  const firstDeduction = labels.findIndex((l, i) => i > salaryCol && /^หัก/.test(l));
  if (firstDeduction < 0) throw new Error(`${fileName}: ไม่พบคอลัมน์รายการหัก`);
  const income = labels.flatMap((l, i) => (l && i >= salaryCol && i < firstDeduction ? [i] : []));
  const otCols = income.filter(i => /นอกเวลา|ค่าเวร/.test(labels[i]));
  const regularCols = income.filter(i => !otCols.includes(i));
  const leaveCol = labels.findIndex(l => /ลาไม่รับค่าจ้าง/.test(l));

  const toDept = (name: string, r: unknown[]): PayrollDept => ({
    name: normalizeDept(name),
    headcount: parseInt(r.map(t).find(v => /^\d+\s*คน$/.test(v)) ?? "", 10) || 0,
    regular: round2(regularCols.reduce((s, c) => s + num(r[c]), 0) - (leaveCol >= 0 ? num(r[leaveCol]) : 0)),
    otShift: round2(otCols.reduce((s, c) => s + num(r[c]), 0)),
  });

  const depts: PayrollDept[] = [];
  const isSummary = t(rows[h][0]) === "แผนก";
  const nameCol = labels.indexOf("ชื่อแผนก");
  let current = "";
  rows.forEach((r, i) => {
    if (i <= h) return;
    const a = t(r[0]);
    if (isSummary) {
      if (/^\d+$/.test(a) && typeof r[salaryCol] === "number") depts.push(toDept(t(r[nameCol]), r));
      return;
    }
    if (a === "แผนก") current = [rows[i - 2], rows[i - 1], r, rows[i + 1], rows[i + 2]].map(x => (x ? t(x[10]) : "")).find(Boolean) ?? "";
    if (a === "รวมแผนก") depts.push(toDept(current, r));
  });
  if (!depts.length || depts.some(d => !d.name)) throw new Error(`${fileName}: อ่านรายชื่อแผนกไม่สำเร็จ`);

  // The file's own branch total proves no department was missed.
  const branch = rows.find(r => t(r[0]) === "รวมสาขา");
  if (branch) {
    const fileTotal = income.reduce((s, c) => s + num(branch[c]), 0) - (leaveCol >= 0 ? num(branch[leaveCol]) : 0);
    const readTotal = depts.reduce((s, d) => s + d.regular + d.otShift, 0);
    if (Math.abs(fileTotal - readTotal) > 1) throw new Error(`${fileName}: ยอดรวมแผนกไม่ตรงกับยอดรวมสาขาในไฟล์`);
  }
  return { fileName, payMonth, depts };
}

export const deptLineMap = (map: ApiPayrollDept[]) => new Map(map.map(m => [m.dept_name, m.line]));

/** Per-สายงาน totals to store for one payroll. Departments set to ไม่นับ are left out. */
export function linesOf(file: PayrollFile, lineOf: Map<string, string>): Omit<ApiLaborCost, "pay_month">[] {
  return LINES.map((line: Line) => {
    const depts = file.depts.filter(d => lineOf.get(d.name) === line);
    return {
      line,
      regular: round2(depts.reduce((s, d) => s + d.regular, 0)),
      ot_shift: round2(depts.reduce((s, d) => s + d.otShift, 0)),
      headcount: depts.reduce((s, d) => s + d.headcount, 0),
    };
  });
}
