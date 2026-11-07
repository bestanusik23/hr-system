// Data + calculations for the "รายงานส่งสำนักงานใหญ่" (HQ HR Dashboard) menu.
// The API returns raw rows; everything period-specific is computed here so the page
// and the xlsx export always agree.
//
// Month rules follow the note HR wrote in the file already sent to HQ:
//   - hires / resignations are counted in cycles 26 of the previous month – 25 of the month
//   - Existing FT / PT is counted at the last day of the month
import * as XLSX from "xlsx";

export const TEMPLATE_URL = "/templates/hq-dashboard-template.xlsx";
export const GROUP = "RAM";
export const HOSPITAL = "CRR";

// Order used by every data sheet (matches "Data_Manpower Year of Services" in the sample).
export const LINES = ["สายการพยาบาล", "สายบัญชีและการเงิน", "สายสนับสนุนบริการ", "สายสำนักงาน", "สนับสนุนทางการแพทย์"] as const;
export type Line = typeof LINES[number];
export const EXCLUDED_LINE = "ไม่นับ";

export const LINE_FUNC: Record<Line, string> = {
  "สายการพยาบาล": "Nursing",
  "สายบัญชีและการเงิน": "Back Office",
  "สายสนับสนุนบริการ": "Support Service",
  "สายสำนักงาน": "Back Office",
  "สนับสนุนทางการแพทย์": "Ancillary",
};
export const LINE_LABOR: Record<Line, string> = {
  "สายการพยาบาล": "Services",
  "สายบัญชีและการเงิน": "Admin",
  "สายสนับสนุนบริการ": "Services",
  "สายสำนักงาน": "Admin",
  "สนับสนุนทางการแพทย์": "Services",
};
// Data_Resign: Professional = clinical lines, Back office = the rest (as in the sample rows).
export const isProfessional = (l: Line) => LINE_FUNC[l] === "Nursing" || LINE_FUNC[l] === "Ancillary";

// emp_type values that HQ does not count as staff.
const EXCLUDED_EMP_TYPES = ["ผู้เช่าสถานที่ประกอบวิชาชีพเวชกรรม", "ฝึกงาน"];

export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const TENURE_BANDS = ["< 4 Months", "5 Months - 1 Year", "1–2 Years", "2–3 Years", "3–5 Years", "5–10 Years", "10–15 Years", "> 15+ Years"];
const TENURE_STEPS = [0, 4, 12, 24, 36, 60, 120, 180];
export const AGE_BANDS = ["≤ 20 Years", "21 - 24 Years", "25 - 34 Years", "35 - 44 Years", "45 - 54 Years", "55 - 60 Years", "≥ 61 Years"];
const AGE_STEPS = [0, 21, 25, 35, 45, 55, 61];

// ── API rows ──────────────────────────────────────────────────────────────────
export interface ApiEmployee {
  id: number; prefix: string | null; full_name: string; position: string | null;
  emp_type: string | null; emp_status: string; start_date: string | null; resign_date: string | null;
  resign_reason: string | null; resign_type: string | null; division_name: string;
}
export interface ApiPlan { division_name: string; pos: string; qty: number }
export interface ApiLineMap { division_name: string; position: string; line: string }
export interface ApiExtra { employee_id: number; age: number | null; sourcing_channel: string | null; reason: string | null }
export interface ApiData { employees: ApiEmployee[]; plan: ApiPlan[]; lineMap: ApiLineMap[]; extras: ApiExtra[] }

export async function fetchHqData(): Promise<ApiData> {
  const r = await fetch("/api/hq-report/data");
  const d = await r.json() as { ok: boolean; error?: string } & Partial<ApiData>;
  if (!d.ok) throw new Error(d.error || "โหลดข้อมูลไม่สำเร็จ");
  return { employees: d.employees ?? [], plan: d.plan ?? [], lineMap: d.lineMap ?? [], extras: d.extras ?? [] };
}

export async function saveExtra(body: { employee_id: number; age: number | null; sourcing_channel: string | null; reason: string | null }) {
  const r = await fetch("/api/hq-report/extra", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const d = await r.json() as { ok: boolean; error?: string };
  if (!d.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
}

export async function saveLineMap(division_name: string, position: string, line: string) {
  const r = await fetch("/api/hq-report/line-map", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ division_name, position, line }) });
  const d = await r.json() as { ok: boolean; error?: string };
  if (!d.ok) throw new Error(d.error || "บันทึกไม่สำเร็จ");
}

export async function deleteLineMap(division_name: string, position: string) {
  const qs = new URLSearchParams({ division_name, position });
  const r = await fetch(`/api/hq-report/line-map?${qs}`, { method: "DELETE" });
  const d = await r.json() as { ok: boolean; error?: string };
  if (!d.ok) throw new Error(d.error || "ลบไม่สำเร็จ");
}

// ── Template (also the source of the HQ dropdown lists) ───────────────────────
export interface TemplateLists {
  channels: string[];                  // raw sourcing channel (Map!O)
  channelCat: Record<string, string>;  // raw → category (Map!P)
  reasons: string[];                   // raw resignation reason (Map!T)
  reasonCat: Record<string, string>;   // raw → category (Map!U)
  reasonType: Record<string, string>;  // category → Voluntary/Involuntary (Map!W→X)
}

export async function loadTemplate(): Promise<XLSX.WorkBook> {
  const r = await fetch(TEMPLATE_URL);
  if (!r.ok) throw new Error("โหลดแม่แบบรายงานไม่สำเร็จ");
  const buf = await r.arrayBuffer();
  return XLSX.read(buf, { type: "array", cellFormula: true, cellStyles: true, cellDates: false });
}

export function readTemplateLists(wb: XLSX.WorkBook): TemplateLists {
  const ws = wb.Sheets["Map"];
  const col = (c: string) => {
    const out: string[] = [];
    for (let r = 4; r <= 200; r++) {
      const cell = ws?.[`${c}${r}`];
      out.push(cell && cell.v !== undefined && cell.v !== null ? String(cell.v).trim() : "");
    }
    return out;
  };
  const O = col("O"), P = col("P"), T = col("T"), U = col("U"), W = col("W"), X = col("X");
  const lists: TemplateLists = { channels: [], channelCat: {}, reasons: [], reasonCat: {}, reasonType: {} };
  O.forEach((v, i) => { if (v) { lists.channels.push(v); lists.channelCat[v] = P[i]; } });
  T.forEach((v, i) => { if (v) { lists.reasons.push(v); lists.reasonCat[v] = U[i]; } });
  W.forEach((v, i) => { if (v) lists.reasonType[v] = X[i]; });
  return lists;
}

// ── Period helpers ────────────────────────────────────────────────────────────
export type PeriodKey = "Q1" | "Q2" | "Q3" | "Q4" | "Y";
export const PERIOD_LABEL: Record<PeriodKey, string> = {
  Q1: "ไตรมาส 1 (ม.ค.–มี.ค.)", Q2: "ไตรมาส 2 (เม.ย.–มิ.ย.)", Q3: "ไตรมาส 3 (ก.ค.–ก.ย.)", Q4: "ไตรมาส 4 (ต.ค.–ธ.ค.)", Y: "ทั้งปี (ม.ค.–ธ.ค.)",
};
export function periodMonths(year: number, p: PeriodKey): string[] {
  const start = p === "Y" ? 1 : (Number(p[1]) - 1) * 3 + 1;
  const n = p === "Y" ? 12 : 3;
  return Array.from({ length: n }, (_, i) => `${year}-${String(start + i).padStart(2, "0")}`);
}
export const monthAbbr = (ym: string) => MONTH_ABBR[Number(ym.slice(5, 7)) - 1];

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (s: string | null) => (s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null);

/** Cycle month (26 prev – 25 this) that a hire/resign date falls into. */
export function cycleMonth(date: string): string {
  let y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  const d = Number(date.slice(8, 10));
  if (d >= 26) { m += 1; if (m > 12) { m = 1; y += 1; } }
  return `${y}-${pad(m)}`;
}
function monthEnd(ym: string): string {
  const y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return `${ym}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
}
/** Whole months between two ISO dates (Excel DATEDIF "m"). */
export function monthsBetween(a: string, b: string): number {
  const ay = +a.slice(0, 4), am = +a.slice(5, 7), ad = +a.slice(8, 10);
  const by = +b.slice(0, 4), bm = +b.slice(5, 7), bd = +b.slice(8, 10);
  let n = (by - ay) * 12 + (bm - am);
  if (bd < ad) n -= 1;
  return Math.max(0, n);
}
const lookupBand = (v: number, steps: number[], bands: string[]) => {
  let idx = 0;
  steps.forEach((s, i) => { if (v >= s) idx = i; });
  return bands[idx];
};
export const tenureBand = (start: string, end: string) => lookupBand(monthsBetween(start, end), TENURE_STEPS, TENURE_BANDS);
export const ageBand = (age: number) => lookupBand(age, AGE_STEPS, AGE_BANDS);

// ── Line mapping ──────────────────────────────────────────────────────────────
const norm = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
export type LineResult = Line | typeof EXCLUDED_LINE | null;

export function makeLineResolver(map: ApiLineMap[]) {
  const exact = new Map<string, string>();
  const byPos = new Map<string, Set<string>>();
  for (const m of map) {
    exact.set(`${norm(m.division_name)}|${norm(m.position)}`, m.line);
    const k = norm(m.position);
    if (!byPos.has(k)) byPos.set(k, new Set());
    byPos.get(k)!.add(m.line);
  }
  return (division: string, position: string | null): LineResult => {
    const hit = exact.get(`${norm(division)}|${norm(position)}`);
    if (hit) return hit as LineResult;
    // Same position mapped in another division with one agreed line → use it.
    const s = byPos.get(norm(position));
    if (s && s.size === 1) return [...s][0] as LineResult;
    return null;
  };
}

// ── Report model ──────────────────────────────────────────────────────────────
export interface ManpowerRow { month: string; line: Line; planned: number; ft: number; pt: number }
export interface PersonRow {
  id: number; name: string; position: string; division: string; line: Line;
  month: string; start: string | null; resign: string | null;
  age: number | null; channel: string | null; reason: string | null; resignReasonText: string | null;
}
export interface UnmappedItem { division: string; position: string; employees: number; planQty: number }
export interface HqReport {
  year: number; months: string[];
  manpower: ManpowerRow[];
  hires: PersonRow[];
  resigns: PersonRow[];
  unmapped: UnmappedItem[];
}

export function displayName(e: ApiEmployee): string {
  const p = norm(e.prefix), n = norm(e.full_name);
  return p && !n.startsWith(p) ? `${p} ${n}` : n;
}

export function buildReport(data: ApiData, year: number, period: PeriodKey, lists: TemplateLists | null): HqReport {
  const months = periodMonths(year, period);
  const monthSet = new Set(months);
  const resolve = makeLineResolver(data.lineMap);
  const extra = new Map(data.extras.map(x => [x.employee_id, x]));
  const unmapped = new Map<string, UnmappedItem>();
  const noteUnmapped = (division: string, position: string, emp: number, plan: number) => {
    const k = `${norm(division)}|${norm(position)}`;
    const u = unmapped.get(k) ?? { division: norm(division), position: norm(position), employees: 0, planQty: 0 };
    u.employees += emp; u.planQty += plan;
    unmapped.set(k, u);
  };

  // Planned per line (current plan, same for every month — the plan has no history).
  const plannedByLine = new Map<Line, number>();
  for (const p of data.plan) {
    const l = resolve(p.division_name, p.pos);
    if (l === EXCLUDED_LINE) continue;
    if (!l) { noteUnmapped(p.division_name, p.pos, 0, Number(p.qty) || 0); continue; }
    plannedByLine.set(l, (plannedByLine.get(l) ?? 0) + (Number(p.qty) || 0));
  }

  const staff = data.employees.filter(e => !EXCLUDED_EMP_TYPES.includes(norm(e.emp_type)));
  const lineOf = (e: ApiEmployee): Line | null => {
    const l = resolve(e.division_name, e.position);
    if (l === EXCLUDED_LINE) return null;
    if (!l) return null;
    return l;
  };
  const relevant = new Set<number>();

  const manpower: ManpowerRow[] = [];
  for (const ym of months) {
    const cut = monthEnd(ym);
    const counts = new Map<Line, { ft: number; pt: number }>();
    for (const e of staff) {
      const start = isoDate(e.start_date);
      const resign = isoDate(e.resign_date);
      if (!start || start > cut) continue;
      if (resign ? resign <= cut : e.emp_status === "resigned") continue;
      const l = resolve(e.division_name, e.position);
      if (l === EXCLUDED_LINE) continue;
      if (!l) { relevant.add(e.id); continue; }
      const c = counts.get(l) ?? { ft: 0, pt: 0 };
      if (/part\s*time/i.test(norm(e.emp_type))) c.pt += 1; else c.ft += 1;
      counts.set(l, c);
    }
    for (const l of LINES) {
      const c = counts.get(l) ?? { ft: 0, pt: 0 };
      manpower.push({ month: ym, line: l, planned: plannedByLine.get(l) ?? 0, ft: c.ft, pt: c.pt });
    }
  }

  const toPerson = (e: ApiEmployee, line: Line, month: string): PersonRow => {
    const x = extra.get(e.id);
    const txt = norm(e.resign_reason) || null;
    // Pre-fill the reason when the free text is already one of HQ's raw reasons.
    const reason = x?.reason ?? (txt && lists?.reasonCat[txt] ? txt : null);
    return {
      id: e.id, name: displayName(e), position: norm(e.position), division: norm(e.division_name), line, month,
      start: isoDate(e.start_date), resign: isoDate(e.resign_date),
      age: x?.age ?? null, channel: x?.sourcing_channel ?? null, reason, resignReasonText: txt,
    };
  };

  const hires: PersonRow[] = [];
  const resigns: PersonRow[] = [];
  for (const e of staff) {
    const start = isoDate(e.start_date);
    const resign = isoDate(e.resign_date);
    const hm = start ? cycleMonth(start) : null;
    const rm = resign ? cycleMonth(resign) : null;
    if (!(hm && monthSet.has(hm)) && !(rm && monthSet.has(rm))) continue;
    const l = resolve(e.division_name, e.position);
    if (l === EXCLUDED_LINE) continue;
    if (!l) { relevant.add(e.id); continue; }
    if (hm && monthSet.has(hm)) hires.push(toPerson(e, l, hm));
    if (rm && monthSet.has(rm)) resigns.push(toPerson(e, l, rm));
  }
  for (const e of staff) if (relevant.has(e.id) && lineOf(e) === null) noteUnmapped(e.division_name, e.position ?? "", 1, 0);

  const byDate = (k: "start" | "resign") => (a: PersonRow, b: PersonRow) => (a[k] ?? "").localeCompare(b[k] ?? "");
  hires.sort(byDate("start"));
  resigns.sort(byDate("resign"));
  return {
    year, months, manpower, hires, resigns,
    unmapped: [...unmapped.values()].sort((a, b) => a.division.localeCompare(b.division) || a.position.localeCompare(b.position)),
  };
}
