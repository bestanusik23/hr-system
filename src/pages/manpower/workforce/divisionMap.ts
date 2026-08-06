/**
 * divisionMap.ts
 * Maps a payroll department name ("แผนก") to its parent division ("ฝ่าย").
 *
 * The payroll export (รายงานประกาศกะ) only has a flat "แผนก" level — no "ฝ่าย"
 * column. This mapping is derived from the hospital's manpower plan
 * (src/data/manpowerPlan.ts), which already groups every department under one
 * of 9 divisions. Cross-referenced by department name on 2026-07-01.
 */

export const DIVISION_NAMES: Record<number, string> = {
  1:  "ฝ่ายการแพทย์",
  2:  "ฝ่ายเทคนิคบริการ",
  3:  "ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ",
  4:  "ฝ่ายการเงิน",
  6:  "ฝ่ายสนับสนุน",
  7:  "ฝ่ายพัฒนาองค์กร",
  8:  "ฝ่ายบริการ",
  9:  "ฝ่ายการพยาบาลส่วนหน้า",
  10: "สำนักงานผู้อำนวยการ",
};

const OTHER_DIVISION = "อื่นๆ";

/** Payroll department name → divId, per manpowerPlan.ts's division/section grouping */
const DEPT_TO_DIVISION: Record<string, number> = {
  "ผู้ป่วยใน": 8,
  "ห้องผ่าตัด": 8,
  "ผู้ป่วยนอก": 9,
  "อุบัติเหตุและฉุกเฉิน": 9,
  "รถฉุกเฉินและเวรเปล": 9,
  "ศูนย์สุขภาพ": 9,
  "ทบทวนทรัพยากรการเบิกค่ารักษา": 10,
  "ซักฟอก": 6,
  "โภชนาการ": 6,
  "เภสัชกรรม": 2,
  "รังสีวินิจฉัย": 2,
  "เทคนิคการแพทย์": 2,
  "กายภาพบำบัด": 2,
  "ศูนย์มะเร็ง": 2,
  "จัดซื้อและคลังยา": 4,
  "หน่วยจ่ายกลาง": 8,
  "ต้อนรับเเละบริการ": 7,
  "ต้อนรับและบริการ": 7, // both spellings seen across exports (เเ vs และ)
  "ศูนย์เครื่องมือแพทย์": 8,
  "การเงิน": 4,
  "บัญชี": 4,
  "สินทรัพย์": 4,
  "จัดซื้อและพัสดุ": 4,
  "ทรัพยากรบุคคล": 3,
  "ธุรการ": 10,
  "ซ่อมบำรุง": 6,
  "เทคโนโลยีสารสนเทศ": 10,
  "แม่บ้าน": 6,
  "ขายและการตลาด": 7,
  "อาคารสถานที่": 6,
  "ยานยนต์": 6,
};

/** Division name for a payroll department, or "อื่นๆ" if not in the mapping (e.g. a new department) */
export function getDivisionForDept(deptName: string): string {
  const divId = DEPT_TO_DIVISION[deptName.trim()];
  return divId !== undefined ? (DIVISION_NAMES[divId] ?? OTHER_DIVISION) : OTHER_DIVISION;
}

/** Every known payroll department name, deduplicated (both spelling variants of the same dept collapse to one) */
export const PAYROLL_DEPT_NAMES: string[] = Array.from(new Set(Object.keys(DEPT_TO_DIVISION)))
  .filter(n => n !== "ต้อนรับเเละบริการ"); // duplicate spelling of "ต้อนรับและบริการ"
