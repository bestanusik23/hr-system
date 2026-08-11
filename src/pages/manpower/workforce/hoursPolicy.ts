/**
 * hoursPolicy.ts
 * The hospital's announced monthly working-hours threshold, and the rule for
 * sorting a position into "วิชาชีพ" (professional) vs "ผู้ช่วยวิชาชีพ"
 * (professional assistant) — the two categories the threshold is set per.
 *
 * Source: "ประกาศโรงพยาบาลเชียงราย ราม เรื่อง ชั่วโมงการทำงานประจำเดือน ปี 2569"
 * (17 พ.ย. 2568). Values are year-specific — MONTHLY_HOUR_THRESHOLDS is keyed
 * by the same "MM/YYYY" (พ.ศ.) payroll-cycle key used elsewhere (see
 * getAvailableMonths() in api.ts), so a future year's announcement can be
 * added without touching any of the lookup code. A month with no entry here
 * has no known threshold — callers must treat that as "unknown", not zero.
 *
 * Working hours over the threshold are paid as OT "ตามยอดที่ส่งไป" — i.e. HR
 * submits the actual OT amount separately per department; there is no
 * per-hour OT rate to compute here. This module only identifies WHO crossed
 * the threshold and by how many hours, for HR to cross-check against what
 * gets submitted.
 */

export interface MonthThreshold {
  professional: number; // ชั่วโมงทำงานสำหรับวิชาชีพ
  assistant: number;    // ชั่วโมงทำงานสำหรับผู้ช่วยวิชาชีพ
}

/** "MM/YYYY" (พ.ศ.) → threshold. Only 2569 is in the source announcement so far. */
export const MONTHLY_HOUR_THRESHOLDS: Record<string, MonthThreshold> = {
  "01/2569": { professional: 188, assistant: 208 },
  "02/2569": { professional: 200, assistant: 216 },
  "03/2569": { professional: 176, assistant: 192 },
  "04/2569": { professional: 196, assistant: 216 },
  "05/2569": { professional: 184, assistant: 200 },
  "06/2569": { professional: 200, assistant: 216 },
  "07/2569": { professional: 188, assistant: 208 },
  "08/2569": { professional: 192, assistant: 208 },
  "09/2569": { professional: 192, assistant: 208 },
  "10/2569": { professional: 180, assistant: 200 },
  "11/2569": { professional: 200, assistant: 216 },
  "12/2569": { professional: 192, assistant: 208 },
};

export type PositionCategory = "professional" | "assistant";

/**
 * ตำแหน่งที่นับเป็น "วิชาชีพ" ตามประกาศ: พยาบาลทุกส่วนงาน, พยาบาลเวรตรวจการ,
 * เภสัชกร, นักฟิสิกส์การแพทย์, นักรังสีเทคนิค, นักเทคนิคการแพทย์
 * ที่เหลือทั้งหมด (รวม "ผู้ช่วย..." ทุกแบบ) = ผู้ช่วยวิชาชีพ
 *
 * The real roster (src/data/manpowerPlan.ts) uses many position-name variants
 * of the same six roles (e.g. "พยาบาลห้องคลอด", "หัวหน้าพยาบาลผู้ป่วยนอก",
 * "นักรังสีการแพทย์ ( สาขาฟิสิกส์การแพทย์ )") rather than the exact wording in
 * the announcement, so this matches by KEYWORD rather than exact string —
 * checked BEFORE the keyword scan, "ผู้ช่วย..." always classifies as
 * assistant even though e.g. "ผู้ช่วยพยาบาล" contains "พยาบาล".
 */
const PROFESSIONAL_KEYWORDS = ["พยาบาล", "เภสัชกร", "ฟิสิกส์การแพทย์", "รังสีเทคนิค", "เทคนิคการแพทย์"];

/** null position (no name match at all) is NOT auto-classified — caller must show it as unknown, not guess. */
export function classifyPositionCategory(position: string): PositionCategory {
  if (position.includes("ผู้ช่วย")) return "assistant";
  if (PROFESSIONAL_KEYWORDS.some(k => position.includes(k))) return "professional";
  return "assistant"; // "ส่วนที่เหลือคือผู้ช่วยวิชาชีพ" per the announcement
}
