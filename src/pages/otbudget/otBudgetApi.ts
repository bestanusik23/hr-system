// Shared types, fetch helpers and calculations for the "ประมาณการ OT และจ่ายจริง" module.
// All derived figures (row totals, diffs, over/under labels, % budget used) are computed
// here from raw budget/actual numbers — nothing is stored pre-computed.

export interface OtCategory {
  id: number; group_name: string; name: string; sort_order: number; is_active: number;
}

export interface OtMonthlyEntry {
  year_month: string; category_id: number; budget_amount: number; actual_amount: number;
  paid_date: string | null; updated_by: string | null; updated_at: string;
}

export interface OtFactor {
  id: number; year_month: string; factor_text: string; sort_order: number; created_by: string | null;
}

export interface OtSignoff {
  fiscal_year: string;
  preparer_name: string | null; preparer_status: string; preparer_at: string | null;
  reviewer_name: string | null; reviewer_status: string; reviewer_at: string | null;
  approver_name: string | null; approver_status: string; approver_at: string | null;
}

export interface CategoryGroup {
  group_name: string;
  categories: OtCategory[];
}

export function groupCategories(categories: OtCategory[]): CategoryGroup[] {
  const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
  const groups: CategoryGroup[] = [];
  for (const c of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.group_name === c.group_name) last.categories.push(c);
    else groups.push({ group_name: c.group_name, categories: [c] });
  }
  return groups;
}

const THAI_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/** "2569-07" → "ก.ค. 69" */
export function formatYearMonthShort(ym: string): string {
  const [y, m] = ym.split("-");
  const mi = Number(m) - 1;
  const yy = y.slice(-2);
  return `${THAI_MONTHS_SHORT[mi] ?? m} ${yy}`;
}

/** "2569-07" → "กรกฎาคม 2569" */
const THAI_MONTHS_LONG = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
export function formatYearMonthLong(ym: string): string {
  const [y, m] = ym.split("-");
  const mi = Number(m) - 1;
  return `${THAI_MONTHS_LONG[mi] ?? m} ${y}`;
}

export function monthsOfFiscalYear(year: string): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

export function fmtNum(n: number): string {
  if (n === 0) return "-";
  return n.toLocaleString("en-US");
}

/** Sum of budget_amount / actual_amount for one month, across every category. */
export function monthTotal(entries: OtMonthlyEntry[], yearMonth: string): { budget: number; actual: number } {
  let budget = 0, actual = 0;
  for (const e of entries) {
    if (e.year_month !== yearMonth) continue;
    budget += e.budget_amount;
    actual += e.actual_amount;
  }
  return { budget, actual };
}

export function diffLabel(budget: number, actual: number): { diff: number; label: "มากกว่า" | "น้อยกว่า" | null } {
  if (budget === 0 && actual === 0) return { diff: 0, label: null };
  const diff = actual - budget;
  if (diff === 0) return { diff: 0, label: null };
  return { diff: Math.abs(diff), label: diff > 0 ? "มากกว่า" : "น้อยกว่า" };
}

export function entryFor(entries: OtMonthlyEntry[], yearMonth: string, categoryId: number): OtMonthlyEntry | null {
  return entries.find(e => e.year_month === yearMonth && e.category_id === categoryId) ?? null;
}
