/**
 * planMap.ts
 * Resolves the "Bar Chart" plan quantity (plan_qty summed per org-chart section)
 * for each PAYROLL department name used by the Workforce Timeline engine.
 *
 * manpower_plan (D1, edited via ManpowerTable.tsx) is a flat, ordered row list —
 * division/subdept/section header rows followed by their slot rows — with no
 * direct link to the payroll export's แผนก names. This module groups plan_qty
 * by the section/subdept header each slot row falls under, then maps that
 * section name to the payroll department name(s) it corresponds to, using the
 * same DEPT_TO_DIVISION name set already cross-referenced in divisionMap.ts.
 */

import { MANPOWER_ROWS } from "../../../data/manpowerPlan";

interface PlanRowLike { type: string; name: string; plan_qty: number }

/**
 * Payroll แผนก name → org-chart section/subdept name(s) whose plan_qty feeds it.
 * Entries marked "best-effort" are a semantic match (same department, different
 * naming between the payroll export and the org chart), not a literal string
 * match — verify with HR before treating them as authoritative budget figures.
 * "สินทรัพย์" has no corresponding section in manpowerPlan.ts and is left out
 * (resolves to 0 rather than guessing).
 */
const PAYROLL_DEPT_TO_SECTION: Record<string, string[]> = {
  "ผู้ป่วยใน": ["ผู้ป่วยใน"],
  "ห้องผ่าตัด": ["ห้องผ่าตัด"],
  "ผู้ป่วยนอก": ["ผู้ป่วยนอก"],
  "อุบัติเหตุและฉุกเฉิน": ["ฉุกเฉินและอุบัติเหตุ"],        // best-effort: word order differs from org chart
  "รถฉุกเฉินและเวรเปล": ["การแพทย์ฉุกเฉิน"],                // best-effort
  "ศูนย์สุขภาพ": ["ศูนย์สุขภาพ"],
  "ทบทวนทรัพยากรการเบิกค่ารักษา": ["ประสานสิทธิ"],           // best-effort (utilization review ~ benefits coordination)
  "ซักฟอก": ["ซักฟอก"],
  "โภชนาการ": ["โภชนาการ"],
  "เภสัชกรรม": ["เภสัชกรรม"],
  "รังสีวินิจฉัย": ["รังสีเทคนิค"],                          // best-effort
  "เทคนิคการแพทย์": ["เทคนิคการแพทย์"],
  "กายภาพบำบัด": ["กายภาพบำบัด"],
  "ศูนย์มะเร็ง": ["รังสีรักษา"],                             // best-effort
  "จัดซื้อและคลังยา": ["จัดซื้อ"],                           // best-effort, shares "จัดซื้อ" with จัดซื้อและพัสดุ below
  "หน่วยจ่ายกลาง": ["หน่วยจ่ายกลางเเละเครื่องมือแพทย์"],     // best-effort, shares section with ศูนย์เครื่องมือแพทย์ below
  "ต้อนรับเเละบริการ": ["ต้อนรับและบริการ"],
  "ต้อนรับและบริการ": ["ต้อนรับและบริการ"],
  "ศูนย์เครื่องมือแพทย์": ["หน่วยจ่ายกลางเเละเครื่องมือแพทย์"], // best-effort, shares section with หน่วยจ่ายกลาง above
  "การเงิน": ["การเงิน"],
  "บัญชี": ["บัญชี"],
  "จัดซื้อและพัสดุ": ["จัดซื้อ"],                            // best-effort, shares "จัดซื้อ" with จัดซื้อและคลังยา above
  "ทรัพยากรบุคคล": ["ทรัพยากรบุคคล"],
  "ธุรการ": ["เลขานุการ - ธุรการ"],                          // best-effort
  "ซ่อมบำรุง": ["ซ่อมบำรุง"],
  "เทคโนโลยีสารสนเทศ": ["เทคโนโลยีสารสนเทศ"],
  "แม่บ้าน": ["แม่บ้าน"],
  "ขายและการตลาด": ["ขายและการตลาด / ประชาสัมพันธ์"],       // best-effort
  "อาคารสถานที่": ["อาคารสถานที่"],
  "ยานยนต์": ["ยานยนต์"],
};

// How many payroll depts point at each section, so a section shared by more
// than one payroll dept (e.g. "จัดซื้อ") splits its total evenly between them
// instead of counting the same headcount twice.
const SECTION_SHARE_COUNT: Map<string, number> = (() => {
  const counts = new Map<string, number>();
  for (const sections of Object.values(PAYROLL_DEPT_TO_SECTION)) {
    for (const s of sections) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return counts;
})();

/** Sums plan_qty per section/subdept header, walking the ordered row list. */
function sumPlanBySection(rows: PlanRowLike[]): Map<string, number> {
  const totals = new Map<string, number>();
  let curSection = "";
  for (const r of rows) {
    if (r.type === "section" || r.type === "subdept") { curSection = r.name.trim(); continue; }
    if (r.type !== "slot" || !curSection) continue;
    totals.set(curSection, (totals.get(curSection) ?? 0) + (r.plan_qty || 0));
  }
  return totals;
}

async function fetchPlanRows(): Promise<PlanRowLike[]> {
  try {
    const res = await fetch("/api/manpower/plan");
    const data = await res.json() as { ok: boolean; plan?: PlanRowLike[] };
    if (data.ok && data.plan && data.plan.length > 0) return data.plan;
  } catch { /* fall through to static fallback */ }
  return MANPOWER_ROWS.map(r => ({ type: r.type, name: r.name, plan_qty: r.plan }));
}

/**
 * Resolves plan_qty (Bar Chart budget headcount) for every payroll department
 * name known to the Workforce Timeline. Fetches the live manpower_plan table,
 * falling back to the static MANPOWER_ROWS snapshot if the request fails.
 */
export async function getPlanByPayrollDept(): Promise<Map<string, number>> {
  const rows = await fetchPlanRows();
  const sectionTotals = sumPlanBySection(rows);

  const result = new Map<string, number>();
  for (const [deptName, sections] of Object.entries(PAYROLL_DEPT_TO_SECTION)) {
    let total = 0;
    for (const section of sections) {
      const sectionTotal = sectionTotals.get(section) ?? 0;
      const shareCount = SECTION_SHARE_COUNT.get(section) ?? 1;
      total += sectionTotal / shareCount;
    }
    result.set(deptName, Math.round(total));
  }
  return result;
}
