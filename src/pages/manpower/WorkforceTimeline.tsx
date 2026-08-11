import { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx";
import { importWorkforceFile, switchDate, switchDeptView, getAvailableMonths, calculateMonthly, formatThaiDate, todayThai, getCurrentStaffDetail, SHIFT_BANDS, shiftChunkStarts, bandIndexForStart, getBandStaffDetail } from "./workforce/api";
import type { ParseResult, DashboardData, DeptTimelineItem, ShiftBlock, HourlyPoint, ShiftSummaryItem, MonthOption, MonthlySummary, CurrentStaffEntry, ShiftBandItem, DeptBandRow, BandStaffEntry } from "./workforce/api";
import { getDivisionForDept, PAYROLL_DEPT_NAMES } from "./workforce/divisionMap";
import { getPositionForName } from "./workforce/positionMap";
import { getPlanByPayrollDept } from "./workforce/planMap";
import { parseOtWorkbook } from "./workforce/otParser";
import type { OtParseHit, OtParseSkip } from "./workforce/otParser";
import { saveImportLocal, loadImportLocal, saveImportRemote, loadImportRemote } from "./workforce/persist";
import type { StoredImport } from "./workforce/persist";

// ─── Static fallback data (shown before any import) ──────────────────────────
// Same 3-block shape as before, just expressed as explicit time-period blocks
// instead of a fixed night/morning/evening record — this is only example data
// shown before the user imports a real payroll file.
const INITIAL_DEPTS: DeptTimelineItem[] = [
  { name: "ฝ่ายเทคนิคบริการ", sub: "สหสาขา",    plan: 52, filled: 36, blocks: mkBlocks(6, 22, 8) },
  { name: "ฝ่ายการพยาบาล",    sub: "ส่วนหน้า",   plan: 41, filled: 29, blocks: mkBlocks(8, 14, 7) },
  { name: "ฝ่ายบริการ",       sub: "",            plan: 47, filled: 24, blocks: mkBlocks(4, 14, 6) },
  { name: "ฝ่ายการเงิน",      sub: "",            plan: 20, filled: 16, blocks: mkBlocks(0, 16, 0) },
  { name: "ฝ่ายสนับสนุน",     sub: "",            plan: 23, filled: 16, blocks: mkBlocks(2, 10, 4) },
  { name: "ฝ่ายการแพทย์",     sub: "",            plan: 20, filled: 14, blocks: mkBlocks(2, 10, 2) },
  { name: "สนง.ผู้อำนวยการ",  sub: "",            plan: 17, filled: 10, blocks: mkBlocks(0, 10, 0) },
  { name: "ฝ่ายพัฒนาองค์กร",  sub: "",            plan: 12, filled:  9, blocks: mkBlocks(0,  9, 0) },
  { name: "ฝ่ายบริหาร",       sub: "ค่าตอบแทนฯ", plan:  7, filled:  4, blocks: mkBlocks(0,  4, 0) },
];

function mkBlocks(night: number, morning: number, evening: number): ShiftBlock[] {
  const blocks: ShiftBlock[] = [];
  if (night   > 0) blocks.push({ label: "00:00–08:00", startMin: 0,   endMin: 480,  count: night,   color: "#1d4ed8" });
  if (morning > 0) blocks.push({ label: "08:00–16:00", startMin: 480, endMin: 960,  count: morning, color: "#3fb96a" });
  if (evening > 0) blocks.push({ label: "16:00–24:00", startMin: 960, endMin: 1440, count: evening, color: "#8b6fe0" });
  return blocks;
}

// ─── Computed stats from dept blocks (used when no import yet) ────────────────
function computeStats(depts: DeptTimelineItem[]) {
  const total = depts.reduce((s, d) => s + d.filled, 0);

  const hourlyCounts = new Array(24).fill(0);
  for (const d of depts) {
    for (const b of d.blocks) {
      for (let h = 0; h < 24; h++) {
        const hourMin = h * 60;
        const inRange = (hourMin >= b.startMin && hourMin < b.endMin) || (hourMin + 1440 >= b.startMin && hourMin + 1440 < b.endMin);
        if (inRange) hourlyCounts[h] += b.count;
      }
    }
  }
  const displayHours = [...Array.from({ length: 18 }, (_, i) => i + 6), ...Array.from({ length: 6 }, (_, i) => i)];
  const hourly: [string, number][] = displayHours.map(h => [`${String(h).padStart(2, "0")}:00`, hourlyCounts[h]] as [string, number]);
  const maxHourly = Math.max(...hourly.map(([, v]) => v), 1);
  const peakIdx   = hourly.findIndex(([, v]) => v === maxHourly);

  const rangeMap = new Map<string, { label: string; staff: number; color: string }>();
  for (const d of depts) for (const b of d.blocks) {
    const key = `${b.startMin}-${b.endMin}`;
    const cur = rangeMap.get(key);
    if (cur) cur.staff += b.count;
    else rangeMap.set(key, { label: b.label, staff: b.count, color: b.color });
  }
  const shiftSummary: ShiftSummaryItem[] = Array.from(rangeMap.values())
    .map(r => ({ shift: r.label, staff: r.staff, percentage: total ? Math.round(r.staff / total * 100) : 0, color: r.color }))
    .sort((a, b) => b.staff - a.staff);

  return { total, hourly, maxHourly, peakHour: peakIdx >= 0 ? hourly[peakIdx][0] : "08:00", shiftSummary };
}

// ─── เวร fallbacks (used before any file is imported) ─────────────────────────
// The engine classifies per employee-record; with no import there are no
// records, only the example depts' aggregated blocks — so derive the same
// numbers from those, reusing the engine's own start-time rule so both agree.

function bandsFromBlocks(depts: DeptTimelineItem[]): ShiftBandItem[] {
  const totals = SHIFT_BANDS.map(() => 0);
  let all = 0;
  for (const d of depts) {
    for (const b of d.blocks) {
      all += b.count;
      for (const start of shiftChunkStarts([b])) totals[bandIndexForStart(start)] += b.count;
    }
  }
  return SHIFT_BANDS.map((b, i) => ({
    key: b.key, label: b.label, sub: b.sub, staff: totals[i],
    percentage: all ? Math.round(totals[i] / all * 100) : 0, color: b.color,
  }));
}

function deptBandsFromBlocks(depts: DeptTimelineItem[]): DeptBandRow[] {
  return depts.map(d => {
    const counts = SHIFT_BANDS.map(() => 0);
    let total = 0;
    for (const b of d.blocks) {
      total += b.count;
      for (const start of shiftChunkStarts([b])) counts[bandIndexForStart(start)] += b.count;
    }
    return { deptName: d.name, total, counts };
  }).sort((a, b) => b.total - a.total);
}

/** Splits a block into 1 or 2 {left,width} segments (in minutes, 0-1440 scale) so overnight blocks wrap correctly on the ruler */
function blockSegments(b: ShiftBlock): { left: number; width: number }[] {
  if (b.endMin <= 1440) return [{ left: b.startMin, width: b.endMin - b.startMin }];
  return [
    { left: b.startMin, width: 1440 - b.startMin },
    { left: 0, width: b.endMin - 1440 },
  ];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const ROW_H     = 64;
const DEPT_W    = 164;
const COUNT_W   = 90;
const HEADER_H  = 46;
const TOTAL_MIN = 1440;
const HOURS     = Array.from({ length: 24 }, (_, i) => i);
const toPct     = (min: number) => `${(min / TOTAL_MIN * 100).toFixed(4)}%`;

function getNow() {
  const d = new Date();
  const min = d.getHours() * 60 + d.getMinutes();
  return { str: `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`, min };
}

/** "MM/YYYY" (Thai BE) for the currently-active payroll cycle — 26th cut-off, same as getAvailableMonths() */
function currentPayrollMonthKey(): string {
  const d = new Date();
  let mon = d.getMonth() + 1;
  let yearBE = d.getFullYear() + 543;
  if (d.getDate() >= 26) { mon += 1; if (mon > 12) { mon = 1; yearBE += 1; } }
  return `${String(mon).padStart(2, "0")}/${yearBE}`;
}

/** Same 26th cut-off, applied to one "DD/MM/YYYY" Thai BE date → its "MM/YYYY" payroll cycle key */
function payrollMonthKeyFromThaiDate(dateStr: string): string {
  const [dayStr, monStr, yearStr] = dateStr.split("/");
  let mon = parseInt(monStr, 10);
  let yearBE = parseInt(yearStr, 10);
  if (parseInt(dayStr, 10) >= 26) { mon += 1; if (mon > 12) { mon = 1; yearBE += 1; } }
  return `${String(mon).padStart(2, "0")}/${yearBE}`;
}

interface OtEntryRow { amount_thb: number; note: string; updated_by: string | null; updated_at: string }

// ─── Scoped CSS ───────────────────────────────────────────────────────────────
const CSS = `
#hrwt{
  --hr-blue:#0038C6; --hr-cyan:#26A9E0; --hr-line:#eaedf5;
  --hr-ink:#1b2a4a;  --hr-muted:#6b7794; --hr-bg:#f4f6fb;
  font-family:'IBM Plex Sans Thai',system-ui,sans-serif;
  color:var(--hr-ink); background:var(--hr-bg);
  border-radius:18px; padding:24px; box-sizing:border-box;
}
#hrwt *{box-sizing:border-box;}
.hrwt-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px;}
.hrwt-title{font-size:22px;font-weight:700;letter-spacing:-.2px;margin:0;display:flex;align-items:center;gap:12px;}
.hrwt-title .bar{width:5px;height:24px;border-radius:6px;background:linear-gradient(var(--hr-blue),var(--hr-cyan));flex-shrink:0;}
.hrwt-sub{margin:6px 0 0 17px;color:var(--hr-muted);font-size:13.5px;}
.hrwt-date-tag{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--hr-line);border-radius:12px;padding:9px 14px;font-size:13px;font-weight:600;color:var(--hr-ink);box-shadow:0 2px 8px rgba(20,40,90,.05);}
.hrwt-date-tag .dot{width:8px;height:8px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.15);}
.hrwt-filters{display:flex;flex-wrap:wrap;gap:10px;align-items:center;background:#fff;border:1px solid var(--hr-line);border-radius:14px;padding:12px;margin-bottom:16px;box-shadow:0 4px 14px rgba(20,40,90,.04);}
.hrwt-search{flex:1 1 160px;min-width:140px;display:flex;align-items:center;gap:8px;background:#fbfcfe;border:1px solid var(--hr-line);border-radius:10px;padding:0 12px;height:40px;}
.hrwt-search svg{flex:0 0 auto;color:var(--hr-muted);}
.hrwt-search input{border:none;background:none;outline:none;font-family:inherit;font-size:13.5px;width:100%;color:var(--hr-ink);}
.hrwt-date-sel{height:40px;border:1.5px solid var(--hr-line);border-radius:10px;padding:0 10px;font-family:inherit;font-size:13px;color:var(--hr-ink);background:#fbfcfe;cursor:pointer;outline:none;}
.hrwt-date-sel:focus{border-color:var(--hr-blue);}
.hrwt-btn{display:inline-flex;align-items:center;gap:6px;height:40px;padding:0 14px;border-radius:10px;border:1.5px solid;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .15s;}
.hrwt-btn-outline{background:#fff;border-color:var(--hr-line);color:var(--hr-muted);}
.hrwt-btn-outline:hover{background:#f4f6fb;border-color:#c4cfee;color:var(--hr-ink);}
.hrwt-btn-primary{background:var(--hr-blue);border-color:var(--hr-blue);color:#fff;}
.hrwt-btn-primary:hover{background:#002fa8;border-color:#002fa8;}
.hrwt-import-info{font-size:12px;color:#16a34a;display:flex;align-items:center;gap:5px;}
.hrwt-import-err{font-size:12px;color:#dc2626;display:flex;align-items:center;gap:5px;}
.hrwt-kpis{display:grid;grid-template-columns:repeat(7,1fr);gap:12px;margin-bottom:18px;}
.hrwt-kpi{background:#fff;border:1px solid var(--hr-line);border-radius:14px;padding:15px 16px;position:relative;overflow:hidden;box-shadow:0 4px 14px rgba(20,40,90,.05);transition:.18s;}
.hrwt-kpi:hover{transform:translateY(-3px);box-shadow:0 10px 26px rgba(20,40,90,.10);}
.hrwt-kpi .ic{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:11px;}
.hrwt-kpi .lbl{font-size:11.5px;color:var(--hr-muted);font-weight:500;line-height:1.35;}
.hrwt-kpi .val{font-size:26px;font-weight:700;margin-top:3px;letter-spacing:-.5px;}
.hrwt-kpi .val small{font-size:12px;font-weight:500;color:var(--hr-muted);margin-left:3px;}
.hrwt-kpi .foot{font-size:11px;color:var(--hr-muted);margin-top:5px;}
.hrwt-kpi .foot b{color:#16a34a;font-weight:600;}
.hrwt-kpi::after{content:"";position:absolute;right:-24px;top:-24px;width:80px;height:80px;border-radius:50%;opacity:.05;}
.hrwt-kpi.c1 .ic,.hrwt-kpi.c1::after{background:rgba(0,56,198,.10);color:var(--hr-blue);}
.hrwt-kpi.c2 .ic,.hrwt-kpi.c2::after{background:rgba(38,169,224,.12);color:var(--hr-cyan);}
.hrwt-kpi.c6 .ic,.hrwt-kpi.c6::after{background:rgba(245,165,36,.15);color:#e08c00;}
.hrwt-legend{display:flex;flex-wrap:wrap;gap:8px 16px;padding:8px 4px;font-size:12px;color:var(--hr-ink);}
.hrwt-legend span{display:inline-flex;align-items:center;gap:7px;}
.hrwt-legend i{width:22px;height:10px;border-radius:5px;display:inline-block;}
.hrwt-panel{background:#fff;border:1px solid var(--hr-line);border-radius:16px;box-shadow:0 6px 20px rgba(20,40,90,.06);overflow:hidden;margin-bottom:18px;}
.hrwt-panel-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 18px 8px;flex-wrap:wrap;}
.hrwt-panel-head h3{margin:0;font-size:16px;font-weight:700;}
.hrwt-grid{overflow-y:auto;overflow-x:hidden;max-height:660px;}
.hrwt-canvas{position:relative;}
.hrwt-row{display:flex;border-bottom:1px solid var(--hr-line);}
.hrwt-row:last-child{border-bottom:none;}
.hrwt-c-dept,.hrwt-c-count{background:#fff;display:flex;align-items:center;flex-shrink:0;}
.hrwt-c-dept{width:${DEPT_W}px;padding:0 8px 0 16px;font-weight:600;font-size:13.5px;}
.hrwt-c-count{width:${COUNT_W}px;padding:0 12px;color:var(--hr-blue);font-weight:700;font-size:14px;border-right:1px solid var(--hr-line);}
.hrwt-c-count small{color:var(--hr-muted);font-weight:500;font-size:11px;margin-left:2px;}
.hrwt-header{position:sticky;top:0;z-index:7;background:#f8fafd;box-shadow:0 1px 0 var(--hr-line);}
.hrwt-header .hrwt-c-dept,.hrwt-header .hrwt-c-count{background:#f8fafd;height:${HEADER_H}px;font-size:12px;color:var(--hr-muted);font-weight:600;}
.hrwt-ruler{flex:1;display:flex;height:${HEADER_H}px;position:relative;}
.hrwt-tick{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--hr-muted);border-left:1px solid #eef1f7;overflow:hidden;}
.hrwt-track{position:relative;flex:1;height:${ROW_H}px;display:flex;min-width:0;}
.hrwt-slot{flex:1;min-width:0;border-left:1px solid #f1f4fa;}
.hrwt-bar{position:absolute;height:16px;border-radius:9px;display:flex;align-items:center;padding:0 8px;font-size:11px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;cursor:pointer;box-shadow:0 2px 6px rgba(20,40,90,.18);transition:transform .12s,filter .12s,box-shadow .12s;}
.hrwt-bar:hover{transform:scaleY(1.15);filter:saturate(1.2);box-shadow:0 5px 14px rgba(20,40,90,.28);z-index:3;}
.hrwt-now-seg{position:absolute;top:0;bottom:0;width:2px;background:#ef4444;opacity:.7;pointer-events:none;z-index:4;}
.hrwt-summary{display:grid;grid-template-columns:1.4fr 1fr 1.1fr;gap:16px;}
.hrwt-scard{background:#fff;border:1px solid var(--hr-line);border-radius:16px;padding:18px;box-shadow:0 6px 20px rgba(20,40,90,.06);}
.hrwt-scard h4{margin:0 0 14px;font-size:14px;font-weight:700;}
.hrwt-bars{display:flex;align-items:flex-end;gap:4px;height:160px;padding-top:16px;}
.hrwt-bcol{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:3px;height:100%;position:relative;}
.hrwt-bcol .bv{font-size:8px;color:var(--hr-muted);font-weight:600;}
.hrwt-bcol .bfill{width:75%;max-width:18px;border-radius:4px 4px 2px 2px;background:linear-gradient(var(--hr-cyan),var(--hr-blue));min-height:3px;}
.hrwt-bcol.peak .bfill{background:linear-gradient(#ffb64d,#f5a524);box-shadow:0 0 0 2px rgba(245,165,36,.2);}
.hrwt-bcol .bx{font-size:7px;color:var(--hr-muted);transform:rotate(-45deg);transform-origin:center;white-space:nowrap;margin-top:3px;}
.hrwt-bcol .peak-tag{position:absolute;top:-2px;background:#f5a524;color:#fff;font-size:8px;font-weight:700;padding:1px 4px;border-radius:4px;}
.hrwt-tbl{width:100%;border-collapse:collapse;font-size:12.5px;}
.hrwt-tbl-wrap{max-height:280px;overflow-y:auto;}
.hrwt-tbl th{text-align:left;color:var(--hr-muted);font-weight:600;font-size:11px;padding:8px 10px;border-bottom:2px solid var(--hr-line);position:sticky;top:0;background:#fff;}
.hrwt-tbl td{padding:10px 10px;border-bottom:1px solid var(--hr-line);}
.hrwt-tbl td:first-child{display:flex;align-items:center;gap:8px;font-weight:500;}
.hrwt-tbl .sw{width:11px;height:11px;border-radius:3px;flex:0 0 auto;}
.hrwt-tbl td.num{text-align:right;font-weight:600;}
.hrwt-tbl tr.total td{border-top:2px solid var(--hr-line);border-bottom:none;font-weight:700;color:var(--hr-blue);}
.hrwt-deptbars{display:flex;flex-direction:column;gap:10px;}
.hrwt-db{display:grid;grid-template-columns:80px 1fr 30px;align-items:center;gap:8px;font-size:12px;}
.hrwt-db .nm{font-weight:600;text-align:right;color:var(--hr-ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.hrwt-db .tr{height:13px;background:#f1f4fa;border-radius:7px;overflow:hidden;}
.hrwt-db .fl{height:100%;border-radius:7px;background:linear-gradient(90deg,var(--hr-cyan),var(--hr-blue));}
.hrwt-db .qv{font-weight:700;color:var(--hr-blue);}
@media(max-width:1100px){.hrwt-kpis{grid-template-columns:repeat(3,1fr);}.hrwt-summary{grid-template-columns:1fr;}}
@media(max-width:700px){#hrwt{padding:14px;}.hrwt-kpis{grid-template-columns:repeat(2,1fr);}}
`;

// ─── SVG icons ────────────────────────────────────────────────────────────────
const IcUsers    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const IcBuilding = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M15 21V9h4a1 1 0 0 1 1 1v11M2 21h20M9 7h1M9 11h1M9 15h1"/></svg>;
const IcClock    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcBolt     = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>;
const IcDownload = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>;
const IcUpload   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;

// ─── Template download (simple format for manual editing) ─────────────────────
function downloadTemplate(depts: DeptTimelineItem[]) {
  const header = ["ฝ่าย", "แผนก", "แผน", "ปฏิบัติงาน", "ช่วงเวลาทำงาน (ช่วง:จำนวนคน)"];
  const rows   = depts.map(d => [
    d.name, d.sub, d.plan, d.filled,
    d.blocks.map(b => `${b.label}:${b.count}`).join("; "),
  ]);
  const ws     = XLSX.utils.aoa_to_sheet([header, ...rows]);
  ws["!cols"]  = [{ wch: 24 }, { wch: 16 }, { wch: 6 }, { wch: 12 }, { wch: 40 }];
  const wb     = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "กำลังคนรายวัน");
  XLSX.writeFile(wb, `แบบฟอร์ม_กำลังคนรายวัน_${todayThai().replace(/\//g, "-")}.xlsx`);
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function WorkforceTimeline() {
  const [depts, setDepts]           = useState<DeptTimelineItem[]>(INITIAL_DEPTS);
  const [dashData, setDashData]     = useState<DashboardData | null>(null);
  const [parsed, setParsed]         = useState<ParseResult | null>(null);
  const [targetDate, setTargetDate] = useState<string>("");
  const [now, setNow]               = useState(getNow);
  const [search, setSearch]         = useState("");
  const [importedAt, setImportedAt] = useState<string | null>(null);
  const [importErr, setImportErr]   = useState<string | null>(null);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);
  const [loading, setLoading]       = useState(false);
  const fileRef                     = useRef<HTMLInputElement>(null);
  const [tip, setTip]               = useState<{ x: number; y: number; dept: string; shift: string; count: number; color: string } | null>(null);
  const [selectedDivision, setSelectedDivision] = useState<string>(""); // "" = all divisions (ฝ่าย)
  const [selectedDept, setSelectedDept] = useState<string>(""); // "" = all departments (แผนก) within the selected division
  const [deptView, setDeptView]         = useState<{
    hourlyWorkforce: HourlyPoint[];
    shiftSummary: ShiftSummaryItem[];
    bandSummary: ShiftBandItem[];
    deptBands: DeptBandRow[];
  } | null>(null);
  const [viewMode, setViewMode]         = useState<"daily" | "monthly">("daily");
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>("");
  const [monthlySummary, setMonthlySummary]     = useState<MonthlySummary | null>(null);
  const [nowClick, setNowClick] = useState<{ x: number; y: number; entries: CurrentStaffEntry[]; date: string } | null>(null);
  const [bandClick, setBandClick] = useState<{ x: number; y: number; entries: BandStaffEntry[]; date: string; bandLabel: string } | null>(null);
  const [planByDept, setPlanByDept] = useState<Map<string, number>>(new Map());

  // OT entry state — independent of the shift-timeline import (per plan: OT is
  // compared against the Bar Chart without needing the same time window).
  const [otMonth, setOtMonth]     = useState(currentPayrollMonthKey);
  const [otEntries, setOtEntries] = useState<Record<string, OtEntryRow>>({});
  const [otDrafts, setOtDrafts]   = useState<Record<string, string>>({});
  const [otSaving, setOtSaving]   = useState<string | null>(null);
  const [otMsg, setOtMsg]         = useState<Record<string, string>>({});
  const [otLoading, setOtLoading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(getNow()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Bar Chart plan headcount per department (from manpower_plan) — fetched once,
  // used to fill in DeptTimelineItem.plan wherever the engine builds it.
  useEffect(() => {
    getPlanByPayrollDept().then(setPlanByDept).catch(() => {});
  }, []);

  // Load saved OT amounts whenever the selected month changes
  useEffect(() => {
    setOtLoading(true);
    fetch(`/api/manpower/ot-entries?month=${encodeURIComponent(otMonth)}`)
      .then(r => r.json())
      .then((d: { ok: boolean; entries?: (OtEntryRow & { dept_name: string })[] }) => {
        const map: Record<string, OtEntryRow> = {};
        const drafts: Record<string, string> = {};
        (d.entries ?? []).forEach(e => {
          map[e.dept_name] = e;
          drafts[e.dept_name] = String(e.amount_thb);
        });
        setOtEntries(map);
        setOtDrafts(drafts);
      })
      .finally(() => setOtLoading(false));
  }, [otMonth]);

  async function saveOtAmount(deptName: string, amount: number): Promise<boolean> {
    setOtSaving(deptName);
    let ok = false;
    try {
      const r = await fetch("/api/manpower/ot-entries", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: otMonth, dept_name: deptName, amount_thb: amount }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      ok = d.ok;
      if (d.ok) {
        setOtEntries(prev => ({ ...prev, [deptName]: { amount_thb: amount, note: "", updated_by: null, updated_at: new Date().toISOString() } }));
        setOtMsg(prev => ({ ...prev, [deptName]: "✅ บันทึกแล้ว" }));
      } else {
        setOtMsg(prev => ({ ...prev, [deptName]: `❌ ${d.error}` }));
      }
    } catch {
      setOtMsg(prev => ({ ...prev, [deptName]: "❌ เกิดข้อผิดพลาด" }));
    }
    setOtSaving(null);
    setTimeout(() => setOtMsg(prev => { const n = { ...prev }; delete n[deptName]; return n; }), 3000);
    return ok;
  }

  async function saveOtEntry(deptName: string) {
    const raw = (otDrafts[deptName] ?? "").trim();
    const amount = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      setOtMsg(prev => ({ ...prev, [deptName]: "❌ ตัวเลขไม่ถูกต้อง" }));
      return;
    }
    await saveOtAmount(deptName, amount);
  }

  // ── Import OT amounts from the monthly "ค่าเวร" payroll Excel ──────────────
  const otFileRef = useRef<HTMLInputElement>(null);
  const [otImportSummary, setOtImportSummary] = useState<{ hits: OtParseHit[]; skipped: OtParseSkip[] } | null>(null);
  const [otImportErr, setOtImportErr] = useState<string | null>(null);
  const [otBulkSaving, setOtBulkSaving] = useState(false);

  async function handleOtImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOtImportErr(null);
    setOtImportSummary(null);
    try {
      const result = await parseOtWorkbook(file);
      if (result.hits.length === 0) {
        setOtImportErr("อ่านไฟล์ได้ แต่ไม่พบยอดที่จับคู่แผนกได้เลย — กรุณากรอกเอง");
      } else {
        setOtDrafts(prev => {
          const next = { ...prev };
          for (const h of result.hits) next[h.deptName] = String(h.amount);
          return next;
        });
        setOtImportSummary({ hits: result.hits, skipped: result.skipped });
      }
    } catch {
      setOtImportErr("อ่านไฟล์ไม่ได้ — ตรวจสอบว่าเป็นไฟล์ค่าเวรรายเดือน (.xls/.xlsx) ที่ถูกต้อง");
    } finally {
      e.target.value = "";
    }
  }

  async function saveAllImportedOt() {
    if (!otImportSummary) return;
    setOtBulkSaving(true);
    for (const h of otImportSummary.hits) {
      await saveOtAmount(h.deptName, h.amount);
    }
    setOtBulkSaving(false);
  }

  // Hydrate from the last imported file on mount, so the dashboard doesn't reset
  // to the static example whenever this component remounts — e.g. navigating
  // away and back, reloading the page, or the other page that also embeds this
  // component. localStorage hydrates instantly (no flash); the server request
  // (shared across every user/device) then overwrites it with the latest import
  // if there is one, and refreshes the local cache to match.
  const hydrate = (stored: StoredImport) => {
    setParsed(stored.parsed);
    setImportedAt(stored.importedAt);
    const today = todayThai();
    const date = stored.parsed.availableDates.includes(today)
      ? today
      : stored.parsed.availableDates[stored.parsed.availableDates.length - 1] ?? today;
    setTargetDate(date);
  };

  useEffect(() => {
    const local = loadImportLocal();
    if (local) hydrate(local);

    loadImportRemote().then(remote => {
      if (!remote) return;
      if (local && local.importedAt === remote.importedAt) return; // already showing this import
      hydrate(remote);
      saveImportLocal(remote.parsed, remote.importedAt);
    });
  }, []);

  // Recalculate when user changes the target date (or plan data finishes loading)
  useEffect(() => {
    if (!parsed || !targetDate) return;
    const data = switchDate(parsed, targetDate, planByDept);
    setDashData(data);
    setDepts(data.departmentTimeline);
  }, [parsed, targetDate, planByDept]);

  const monthOptions: MonthOption[] = parsed ? getAvailableMonths(parsed) : [];
  const selectedMonth = monthOptions.find(m => m.key === selectedMonthKey) ?? monthOptions[monthOptions.length - 1] ?? null;
  const isMonthly = viewMode === "monthly" && !!monthlySummary;

  // Recalculate the monthly aggregate when the user switches to "รายเดือน" or changes the month
  useEffect(() => {
    if (!parsed || viewMode !== "monthly" || !selectedMonth) { setMonthlySummary(null); return; }
    setMonthlySummary(calculateMonthly(parsed, selectedMonth, planByDept));
  }, [parsed, viewMode, selectedMonth?.key, planByDept]);

  // Keep the OT panel's month in sync with whatever month is showing above,
  // so "ปฏิบัติงานจริง" next to the OT input is always the same month's shift
  // data — not a leftover from whatever month was picked last.
  useEffect(() => {
    if (viewMode === "monthly" && selectedMonth) setOtMonth(selectedMonth.key);
    else if (viewMode === "daily" && targetDate) setOtMonth(payrollMonthKeyFromThaiDate(targetDate));
  }, [viewMode, selectedMonth?.key, targetDate]);

  // Shift-based plan/filled figures for whichever month the OT panel is currently
  // showing (otMonth) — computed independently from the Gantt view above so it
  // stays correct even if otMonth was typed to a different month by hand.
  const otMonthDepts: DeptTimelineItem[] | null = useMemo(() => {
    if (!parsed) return null;
    const match = getAvailableMonths(parsed).find(m => m.key === otMonth);
    if (!match) return null;
    return calculateMonthly(parsed, match, planByDept).departmentTimeline;
  }, [parsed, otMonth, planByDept]);

  // Dates in scope for the hourly chart / shift summary / department filter:
  // one day in "รายวัน" mode, the whole payroll cycle's dates in "รายเดือน" mode.
  const activeDates: string[] = viewMode === "monthly"
    ? (selectedMonth?.dates ?? [])
    : (targetDate ? [targetDate] : []);

  // Department list driving the Gantt panel, search, ranking and dept dropdown
  const displayDepts = isMonthly ? monthlySummary!.departmentTimeline : depts;

  // Cascading filter: dropdown 1 picks a ฝ่าย (division), dropdown 2 picks a แผนก within it
  const divisionFilteredDepts = selectedDivision
    ? displayDepts.filter(d => getDivisionForDept(d.name) === selectedDivision)
    : displayDepts;
  const availableDivisions = Array.from(new Set(displayDepts.map(d => getDivisionForDept(d.name))))
    .sort((a, b) => a.localeCompare(b, "th"));

  // Scope passed to the engine: one department if chosen, else every department in the
  // selected division, else null (no filter — the whole hospital)
  const deptScope: string[] | null = selectedDept
    ? [selectedDept]
    : selectedDivision
      ? divisionFilteredDepts.map(d => d.name)
      : null;

  // Recalculate hourly chart + shift summary when user filters by division/department (or switches mode/month/date)
  useEffect(() => {
    if (!parsed || activeDates.length === 0) { setDeptView(null); return; }
    setDeptView(switchDeptView(parsed, activeDates, deptScope));
  }, [parsed, targetDate, viewMode, selectedMonth?.key, selectedDivision, selectedDept]);

  // ── Derive display values: monthly aggregate > daily import > static fallback ─
  const stats = computeStats(depts);
  const daysInRange = monthlySummary?.daysInRange || 1;
  // Monthly numbers are shown as a daily AVERAGE (credible, same scale as the daily view) —
  // the underlying totals (person-days) are still available for reports, just not the headline number.
  const toDisplayCount = (raw: number) => (isMonthly ? Math.round(raw / daysInRange) : raw);

  // c1 KPI total: scoped to the selected department/division, average/day in monthly mode.
  // d.filled is already avg-per-day when isMonthly (see toDepartmentTimeline's divisor), so
  // summing it across the scoped departments works uniformly for daily and monthly modes.
  const scopedDepts = selectedDept
    ? displayDepts.filter(d => d.name === selectedDept)
    : selectedDivision
      ? divisionFilteredDepts
      : displayDepts;
  const isScoped = !!(selectedDept || selectedDivision);
  const scopedAvgPerDay = scopedDepts.reduce((s, d) => s + d.filled, 0);
  const scopedTotalPersonDays = isMonthly
    ? monthlySummary!.departmentRanking
        .filter(r => scopedDepts.some(d => d.name === r.department))
        .reduce((s, r) => s + r.staff, 0)
    : scopedAvgPerDay;

  const totalPersonDays = isScoped
    ? scopedTotalPersonDays
    : (isMonthly ? monthlySummary!.totalPersonDays : (dashData?.kpi.totalActiveStaff ?? stats.total));
  const T_TOTAL = isMonthly
    ? (isScoped ? scopedAvgPerDay : monthlySummary!.avgStaffPerDay)
    : totalPersonDays;

  const PEAK_HOUR  = isMonthly ? monthlySummary!.peakHour        : dashData?.kpi.peakHour    ?? stats.peakHour;
  const MAX_HOURLY = isMonthly ? monthlySummary!.peakWorkforce   : dashData?.kpi.peakWorkforce ?? stats.maxHourly;

  // Convert HourlyPoint[] → [string, number][] for chart (deptView takes priority when a department filter is active)
  const aggregateHourly = isMonthly ? monthlySummary!.hourlyWorkforce : dashData?.hourlyWorkforce;
  const hourlySource = deptView?.hourlyWorkforce ?? aggregateHourly;
  const HOURLY: [string, number][] = hourlySource
    ? hourlySource.map(h => [h.hour, h.staff] as [string, number])
    : stats.hourly;
  const hourlyMaxLocal = Math.max(...HOURLY.map(([, v]) => v), 1);

  // Shift summary is grouped by actual time period (not morning/afternoon/night) at every level.
  // Staff counts from the engine are totals (person-days in monthly mode) — displayed as a daily average.
  const aggregateShiftSummary = isMonthly ? monthlySummary!.shiftSummary : dashData?.shiftSummary;
  const shiftSummaryRowsRaw: ShiftSummaryItem[] = deptView?.shiftSummary ?? aggregateShiftSummary ?? stats.shiftSummary;
  const shiftSummaryRows = shiftSummaryRowsRaw.map(s => ({ ...s, staff: toDisplayCount(s.staff) }));
  const shiftSummaryTotal = shiftSummaryRows.reduce((s, x) => s + x.staff, 0) || T_TOTAL;

  // เวรเช้า / บ่าย / ดึก — same daily-average treatment.
  // Falls back to the example depts' blocks before any file has been imported.
  const bandRowsRaw: ShiftBandItem[] = deptView?.bandSummary ?? bandsFromBlocks(scopedDepts);
  const bandRows = bandRowsRaw.map(b => ({ ...b, staff: toDisplayCount(b.staff) }));

  const deptBandsRaw: DeptBandRow[] = deptView?.deptBands ?? deptBandsFromBlocks(scopedDepts);
  const deptBandRows = deptBandsRaw.map(d => ({
    ...d,
    total: toDisplayCount(d.total),
    counts: d.counts.map(toDisplayCount),
  }));

  const filtered = search.trim()
    ? divisionFilteredDepts.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.sub.toLowerCase().includes(search.toLowerCase())
      )
    : divisionFilteredDepts;

  // Legend: every distinct time period currently visible in the Gantt, sorted by start time
  const legendItems = Array.from(
    new Map(filtered.flatMap(d => d.blocks).map(b => [`${b.startMin}-${b.endMin}`, b])).values()
  ).sort((a, b) => a.startMin - b.startMin);

  const dateStr  = isMonthly
    ? monthlySummary!.monthLabel
    : targetDate ? formatThaiDate(targetDate) : new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  const nowPct   = toPct(now.min);
  const availDates = dashData?.metadata.availableDates ?? [];

  // Ranking uses total person-days in monthly mode (report-appropriate), daily "filled" count otherwise;
  // scoped to the selected ฝ่าย when one is chosen
  const rankingList: { name: string; value: number }[] = isMonthly
    ? monthlySummary!.departmentRanking
        .filter(r => divisionFilteredDepts.some(d => d.name === r.department))
        .map(r => ({ name: r.department, value: r.staff }))
    : divisionFilteredDepts.map(d => ({ name: d.name, value: d.filled }));
  const maxRanking = Math.max(...rankingList.map(r => r.value), 1);

  // Date checked for the real-time NOW-line click: the selected day in "รายวัน" mode,
  // or the most recent date in the selected cycle in "รายเดือน" mode (a month has no
  // single "now", so the last known day stands in).
  const nowSnapshotDate = viewMode === "monthly"
    ? (selectedMonth?.dates[selectedMonth.dates.length - 1] ?? "")
    : targetDate;

  const openNowSnapshot = (x: number, y: number) => {
    if (!parsed || !nowSnapshotDate) return;
    const entries = getCurrentStaffDetail(parsed, nowSnapshotDate, deptScope);
    setNowClick({ x, y, entries, date: nowSnapshotDate });
  };

  // เวร KPI card click — same "which date" logic as the NOW-line snapshot
  // (a month has no single day, so the most recent date in the cycle stands in).
  const openBandDetail = (bandIndex: number, bandLabel: string, x: number, y: number) => {
    if (!parsed || !nowSnapshotDate) return;
    const entries = getBandStaffDetail(parsed, nowSnapshotDate, bandIndex, deptScope);
    setBandClick({ x, y, entries, date: nowSnapshotDate, bandLabel });
  };

  // ── Import handler ────────────────────────────────────────────────────────────
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setImportErr(null);
    setSyncWarning(null);
    try {
      const { parsed: p, data } = await importWorkforceFile(file, undefined, planByDept);
      const importedAtStr = new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      setParsed(p);
      setTargetDate(data.metadata.targetDate);
      setDashData(data);
      setDepts(data.departmentTimeline);
      setImportedAt(importedAtStr);
      const localOk  = saveImportLocal(p, importedAtStr);
      const remoteOk = await saveImportRemote(p, importedAtStr);
      if (!remoteOk) {
        setSyncWarning("บันทึกไปยังเซิร์ฟเวอร์ไม่สำเร็จ — ข้อมูลนี้จะเห็นเฉพาะเบราว์เซอร์นี้ (ดู Console เพื่อดูรายละเอียด)");
      } else if (!localOk) {
        setSyncWarning("บันทึกสำเร็จบนเซิร์ฟเวอร์ แต่แคชในเครื่องนี้ล้มเหลว");
      }
    } catch (err) {
      setImportErr("อ่านไฟล์ไม่ได้ — กรุณาใช้ไฟล์รายงานประกาศกะ (.xls/.xlsx)");
      console.error(err);
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  };

  return (
    <div id="hrwt">
      <style>{CSS}</style>

      {/* ── Section Header ── */}
      <div className="hrwt-head">
        <div>
          <h2 className="hrwt-title">
            <span className="bar" />
            ตารางการทำงานบุคลากรประจำวัน
          </h2>
          <p className="hrwt-sub">สรุปจำนวนบุคลากรที่ปฏิบัติงานในแต่ละฝ่าย แยกตามช่วงเวลาการทำงานจริง</p>
        </div>
        <div className="hrwt-date-tag">
          <span className="dot" />
          <span>{dateStr}</span>
        </div>
      </div>

      {/* ── Filter + Import bar ── */}
      <div className="hrwt-filters">
        <div className="hrwt-search">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="7" cy="7" r="5" /><path d="M11 11l3 3" />
          </svg>
          <input
            placeholder="ค้นหาฝ่าย / แผนก"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Daily / Monthly view toggle — shown after import */}
        {parsed && (
          <div style={{ display:"flex", border:"1.5px solid #eaedf5", borderRadius:10, overflow:"hidden" }}>
            <button
              className={`hrwt-btn ${viewMode === "daily" ? "hrwt-btn-primary" : "hrwt-btn-outline"}`}
              style={{ border:"none", borderRadius:0 }}
              onClick={() => setViewMode("daily")}
            >รายวัน</button>
            <button
              className={`hrwt-btn ${viewMode === "monthly" ? "hrwt-btn-primary" : "hrwt-btn-outline"}`}
              style={{ border:"none", borderRadius:0 }}
              onClick={() => setViewMode("monthly")}
            >รายเดือน</button>
          </div>
        )}

        {/* Date selector — daily mode */}
        {viewMode === "daily" && availDates.length > 0 && (
          <select
            className="hrwt-date-sel"
            value={targetDate}
            onChange={e => setTargetDate(e.target.value)}
          >
            {availDates.map(d => (
              <option key={d} value={d}>{formatThaiDate(d)}</option>
            ))}
          </select>
        )}

        {/* Month (payroll cycle) selector — monthly mode */}
        {viewMode === "monthly" && monthOptions.length > 0 && (
          <select
            className="hrwt-date-sel"
            value={selectedMonth?.key ?? ""}
            onChange={e => setSelectedMonthKey(e.target.value)}
          >
            {monthOptions.map(m => (
              <option key={m.key} value={m.key}>{m.label} ({m.dates.length} วัน)</option>
            ))}
          </select>
        )}

        {/* Download simple template */}
        <button className="hrwt-btn hrwt-btn-outline" onClick={() => downloadTemplate(displayDepts)}>
          <IcDownload /> ดาวน์โหลดแบบฟอร์ม
        </button>

        {/* Import payroll Excel */}
        <input ref={fileRef} type="file" accept=".xls,.xlsx" style={{ display: "none" }} onChange={handleImport} />
        <button className="hrwt-btn hrwt-btn-primary" onClick={() => fileRef.current?.click()} disabled={loading}>
          <IcUpload /> {loading ? "กำลังประมวลผล..." : "นำเข้า Excel กะ"}
        </button>

        {importedAt && !importErr && (
          <span className="hrwt-import-info">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            อัปเดต {importedAt} · {displayDepts.length} ฝ่าย · {T_TOTAL} คน
          </span>
        )}
        {importErr && (
          <span className="hrwt-import-err">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {importErr}
          </span>
        )}
        {syncWarning && (
          <span className="hrwt-import-err">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
            {syncWarning}
          </span>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="hrwt-kpis">
        <div className="hrwt-kpi c1">
          <div className="ic"><IcUsers/></div>
          <div className="lbl">{isMonthly ? `เฉลี่ยบุคลากรต่อวัน${isScoped ? ` — ${selectedDept || selectedDivision}` : ""}` : "บุคลากรปฏิบัติงานวันนี้"}</div>
          <div className="val">{T_TOTAL}<small>คน{isMonthly ? "/วัน" : ""}</small></div>
          <div className="foot">{isMonthly ? <>รวม <b>{totalPersonDays}</b> คน-วันทั้งเดือน</> : <b>▲ ปฏิบัติงานจริง</b>}</div>
        </div>
        <div className="hrwt-kpi c2">
          <div className="ic"><IcBuilding/></div>
          <div className="lbl">แผนกที่เปิดให้บริการ</div>
          <div className="val">{divisionFilteredDepts.length}<small>แผนก</small></div>
          <div className="foot">
            {selectedDept ? `กำลังดู: ${selectedDept}` : selectedDivision ? `ฝ่าย: ${selectedDivision}` : "ครอบคลุมทุกฝ่าย"}
          </div>
        </div>

        {/* Coverage per เวร (averaged per day in monthly mode) — shifts longer than 8h are
            split into 8h chunks (see shiftChunkStarts), so one person can land in more than
            one เวร and these can sum to more than the real headcount; see the panel note below.
            "band-N" (not the fixed c1/c2/c6 names) so this never collides with the peak-hour
            card's own dedicated CSS below, regardless of how many bands there are. */}
        {bandRows.map((r, i) => (
          <div key={r.key} className={`hrwt-kpi band-${i}`}
            onClick={e => parsed && openBandDetail(i, r.label, e.clientX + 14, e.clientY + 14)}
            title={parsed ? `คลิกเพื่อดูรายชื่อเจ้าหน้าที่ใน${r.label}` : "นำเข้าไฟล์กะก่อนจึงจะดูรายชื่อได้"}
            style={parsed ? { cursor: "pointer" } : undefined}>
            <div className="ic" style={{ background: `${r.color}22`, color: r.color }}><IcClock/></div>
            <div className="lbl">{r.label} <span style={{ opacity: .7 }}>· {r.sub}</span></div>
            <div className="val">{r.staff}<small>คน{isMonthly ? "/วัน" : ""}</small></div>
            <div className="foot">
              {r.percentage}% ของทั้งหมด
              {parsed && <span style={{ color: "#0038C6", fontWeight: 600 }}> · ดูรายชื่อ →</span>}
            </div>
          </div>
        ))}

        <div className="hrwt-kpi c6">
          <div className="ic"><IcBolt/></div>
          <div className="lbl">ช่วงเวลากำลังคนสูงสุด</div>
          <div className="val">{PEAK_HOUR}</div>
          <div className="foot">{isMonthly ? <>เฉลี่ย <b>{MAX_HOURLY} คน</b> ต่อวัน</> : <><b>{MAX_HOURLY} คน</b> กำลังปฏิบัติงาน</>}</div>
        </div>
      </div>

      {/* ── Timeline Panel ── */}
      <div className="hrwt-panel">
        <div className="hrwt-panel-head">
          <h3>ไทม์ไลน์การปฏิบัติงานรายฝ่าย</h3>
          <div className="hrwt-legend">
            {legendItems.map(b => (
              <span key={`${b.startMin}-${b.endMin}`}><i style={{ background: b.color }} />{b.label}</span>
            ))}
            <span><i style={{ background: "#ef4444", height: 2, borderRadius: 1 }} />เวลาปัจจุบัน</span>
          </div>
        </div>

        <div className="hrwt-grid">
          <div className="hrwt-canvas">

            {/* Header */}
            <div className="hrwt-row hrwt-header">
              <div className="hrwt-c-dept">ฝ่าย / แผนก</div>
              <div className="hrwt-c-count">จำนวน</div>
              <div className="hrwt-ruler">
                {HOURS.map(h => (
                  <div key={h} className="hrwt-tick">{String(h).padStart(2,"0")}:00</div>
                ))}
                <div
                  onClick={e => openNowSnapshot(e.clientX + 14, e.clientY + 14)}
                  title="คลิกเพื่อดูจำนวนเจ้าหน้าที่ที่ปฏิบัติงานอยู่ ณ เวลานี้"
                  style={{ position:"absolute", bottom:0, left:nowPct, transform:"translateX(-50%)", cursor:"pointer", zIndex:10, display:"flex", flexDirection:"column", alignItems:"center" }}
                >
                  <span style={{ fontSize:9.5, fontWeight:700, color:"#ef4444", background:"#fff", border:"1.5px solid rgba(239,68,68,.3)", padding:"1px 6px", borderRadius:4, whiteSpace:"nowrap", marginBottom:1, lineHeight:1.6, boxShadow:"0 2px 5px rgba(239,68,68,.2)" }}>NOW {now.str}</span>
                  <div style={{ width:0, height:0, borderLeft:"4px solid transparent", borderRight:"4px solid transparent", borderTop:"5px solid #ef4444" }} />
                </div>
              </div>
            </div>

            {/* Dept rows */}
            {filtered.map(dept => {
              const bars    = dept.blocks;
              const laneH   = 16, gap = 5;
              const blockH  = bars.length * laneH + Math.max(bars.length - 1, 0) * gap;
              const rowH    = Math.max(ROW_H, blockH + 20);
              const top0    = (rowH - blockH) / 2;
              const fillPct = dept.plan > 0 ? Math.round(dept.filled / dept.plan * 100) : 0;

              return (
                <div key={dept.name} className="hrwt-row">
                  <div className="hrwt-c-dept" style={{ flexDirection:"column", alignItems:"flex-start", justifyContent:"center", gap:2 }}>
                    <span style={{ lineHeight:1.3 }}>{dept.name}</span>
                    {dept.sub && <span style={{ fontSize:11, color:"#94a3b8", fontWeight:400 }}>{dept.sub}</span>}
                    {dept.plan > 0 && (
                      <div style={{ width:"100%", height:3, background:"#e2e8f0", borderRadius:99, overflow:"hidden", marginTop:2 }}>
                        <div style={{ height:"100%", width:`${fillPct}%`, background:"linear-gradient(90deg,#26A9E0,#0038C6)", borderRadius:99 }} />
                      </div>
                    )}
                  </div>
                  <div className="hrwt-c-count">{dept.filled}<small>คน</small></div>
                  <div className="hrwt-track" style={{ height: rowH }}>
                    {HOURS.map(h => <div key={h} className="hrwt-slot" />)}
                    {bars.map((b, i) => {
                      const top = top0 + i * (laneH + gap);
                      return blockSegments(b).map((seg, si) => (
                        <div key={`${b.startMin}-${b.endMin}-${si}`}
                          className="hrwt-bar"
                          style={{ left: toPct(seg.left), width: `${(seg.width / TOTAL_MIN * 100).toFixed(4)}%`, top, background: b.color }}
                          onMouseMove={e => setTip({ x: e.clientX + 14, y: e.clientY + 14, dept: dept.name + (dept.sub ? ` · ${dept.sub}` : ""), shift: b.label, count: b.count, color: b.color })}
                          onMouseLeave={() => setTip(null)}
                        >
                          {si === 0 ? `${b.count} คน` : ""}
                        </div>
                      ));
                    })}
                    <div
                      className="hrwt-now-seg"
                      style={{ left: nowPct, cursor: "pointer", pointerEvents: "auto" }}
                      onClick={e => openNowSnapshot(e.clientX + 14, e.clientY + 14)}
                      title="คลิกเพื่อดูจำนวนเจ้าหน้าที่ที่ปฏิบัติงานอยู่ ณ เวลานี้"
                    />
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      </div>

      {/* ── Department × เวร headcount ── */}
      <div className="hrwt-panel">
        <div className="hrwt-panel-head">
          <h3>จำนวนบุคลากรแต่ละแผนก แยกตามเวร</h3>
          <div className="hrwt-legend">
            {SHIFT_BANDS.map(b => (
              <span key={b.key}><i style={{ background: b.color }} />{b.label}</span>
            ))}
          </div>
        </div>
        <p style={{ margin: "0 18px 10px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          ใครทำงานเกิน 8 ชม. จะถูกแบ่งเป็นช่วงละ 8 ชม. แล้วนับเข้าเวรที่ตรงกับเวลาเริ่มของแต่ละช่วง —
          เช่น เข้างาน 08:00 เลิก 00:00 (16 ชม.) นับเป็น <b>1 คนในเวรเช้า</b> (ช่วง 08:00–16:00) และ <b>1 คนในเวรบ่าย</b> (ช่วง 16:00–00:00)
          ผลรวมทั้ง 3 เวรจึงอาจ<b>มากกว่า</b>จำนวนคนจริง (คอลัมน์ "รวม" ยังเป็นจำนวนคนจริง ไม่ใช่ผลรวมของเวร)
          {isMonthly ? " · ตัวเลขเป็นค่าเฉลี่ยต่อวันของทั้งเดือน" : ""}
        </p>
        <div className="hrwt-tbl-wrap" style={{ maxHeight: 420, padding: "0 18px 16px" }}>
          <table className="hrwt-tbl">
            <thead>
              <tr>
                <th>แผนก</th>
                {SHIFT_BANDS.map(b => (
                  <th key={b.key} style={{ textAlign: "right" }}>{b.label}</th>
                ))}
                <th style={{ textAlign: "right" }}>รวม</th>
              </tr>
            </thead>
            <tbody>
              {deptBandRows.length === 0 ? (
                <tr><td colSpan={SHIFT_BANDS.length + 2} style={{ textAlign: "center", color: "#94a3b8", padding: 16 }}>
                  ไม่มีข้อมูลในช่วงที่เลือก
                </td></tr>
              ) : deptBandRows.map(d => (
                <tr key={d.deptName}>
                  <td>{d.deptName}</td>
                  {d.counts.map((c, i) => (
                    <td key={i} className="num" style={{ color: c > 0 ? SHIFT_BANDS[i].color : "#cbd5e1" }}>
                      {c || "—"}
                    </td>
                  ))}
                  <td className="num">{d.total}</td>
                </tr>
              ))}
              {deptBandRows.length > 0 && (
                <tr className="total">
                  <td>รวมทุกแผนก</td>
                  {SHIFT_BANDS.map((b, i) => (
                    <td key={b.key} className="num">
                      {deptBandRows.reduce((s, d) => s + d.counts[i], 0)}
                    </td>
                  ))}
                  <td className="num">{deptBandRows.reduce((s, d) => s + d.total, 0)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── OT vs Bar Chart panel ── */}
      {(() => {
        // "ปฏิบัติงานจริง" always reflects otMonth's own shift data (from otMonthDepts),
        // so it stays correct for whichever month OT is being entered/viewed for —
        // independent of what the Gantt view above happens to be showing right now.
        const filledByDept = new Map((otMonthDepts ?? []).map(d => [d.name, d.filled]));
        const otMonthHasShiftData = otMonthDepts !== null;
        const otTotal = PAYROLL_DEPT_NAMES.reduce((s, n) => s + (otEntries[n]?.amount_thb ?? 0), 0);
        const rows = [...PAYROLL_DEPT_NAMES].sort((a, b) => a.localeCompare(b, "th"));

        return (
          <div className="hrwt-panel">
            <div className="hrwt-panel-head">
              <h3>💰 ยอด OT ที่จ่ายจริง เทียบกับ Bar Chart (อัตราตั้งไว้)</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <input ref={otFileRef} type="file" accept=".xls,.xlsx" style={{ display: "none" }} onChange={handleOtImport} />
                <button className="hrwt-btn hrwt-btn-outline" onClick={() => otFileRef.current?.click()}>
                  📥 นำเข้า Excel ค่าเวร
                </button>
                <label style={{ fontSize: 12.5, color: "#6b7794", fontWeight: 600 }}>เดือน (MM/YYYY):</label>
                <input value={otMonth} onChange={e => setOtMonth(e.target.value)}
                  placeholder="07/2569" className="hrwt-date-sel" style={{ width: 90 }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0038C6" }}>
                  รวม {otTotal.toLocaleString("th-TH")} บาท
                </div>
              </div>
            </div>
            <p style={{ margin: "0 18px 10px", fontSize: 12, color: "#94a3b8" }}>
              เดือนนี้เปลี่ยนตามตารางกะ (รายวัน/รายเดือน) ด้านบนโดยอัตโนมัติ — พิมพ์ทับเพื่อกรอก OT เดือนอื่นได้
              {!otMonthHasShiftData && parsed && " (ยังไม่มีข้อมูลตารางกะของเดือนนี้ — คอลัมน์ปฏิบัติงานจริงจะว่าง)"} —
              แถวที่ขึ้น ⚠ คืออัตรากำลังยังขาด (แผน &gt; ปฏิบัติงานจริง) และมีการจ่าย OT ในเดือนนี้
            </p>
            {otImportErr && (
              <div style={{ margin: "0 18px 10px", padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca",
                borderRadius: 8, fontSize: 12, color: "#dc2626" }}>{otImportErr}</div>
            )}
            {otImportSummary && (
              <div style={{ margin: "0 18px 10px", padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0",
                borderRadius: 8, fontSize: 12.5, color: "#166534" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                  <span>
                    ✅ อ่านไฟล์แล้ว เติมยอดในช่องกรอกให้ {otImportSummary.hits.length} แผนก — ตรวจทานตัวเลขในตารางด้านล่างก่อนกดบันทึก
                  </span>
                  <button onClick={saveAllImportedOt} disabled={otBulkSaving}
                    style={{ padding: "6px 14px", borderRadius: 6, border: "none",
                      background: otBulkSaving ? "#c4cfee" : "#16a34a", color: "#fff", fontSize: 12, fontWeight: 700,
                      cursor: otBulkSaving ? "not-allowed" : "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                    {otBulkSaving ? "กำลังบันทึก…" : `💾 บันทึกทั้งหมดที่นำเข้า (${otImportSummary.hits.length})`}
                  </button>
                </div>
                {otImportSummary.skipped.length > 0 && (
                  <div style={{ marginTop: 8, color: "#92400e" }}>
                    ⚠ ต้องกรอกเอง: {otImportSummary.skipped.map(s => `${s.sourceLabel}${s.amount ? ` (รวม ${s.amount.toLocaleString("th-TH")} บาท)` : ""} — ${s.reason}`).join(" · ")}
                  </div>
                )}
              </div>
            )}
            <div className="hrwt-tbl-wrap" style={{ maxHeight: 420, padding: "0 18px 16px" }}>
              <table className="hrwt-tbl">
                <thead>
                  <tr>
                    <th>แผนก</th>
                    <th style={{ textAlign: "right" }}>แผน (Bar Chart)</th>
                    <th style={{ textAlign: "right" }}>ปฏิบัติงานจริง</th>
                    <th style={{ textAlign: "right" }}>ยอด OT จ่ายจริง (บาท)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(deptName => {
                    const plan = planByDept.get(deptName) ?? 0;
                    const filled = filledByDept.get(deptName);
                    const shortfall = filled !== undefined ? Math.max(0, plan - filled) : 0;
                    const otAmount = otEntries[deptName]?.amount_thb ?? 0;
                    const flagged = shortfall > 0 && otAmount > 0;
                    return (
                      <tr key={deptName} style={flagged ? { background: "#fffbeb" } : undefined}>
                        <td>
                          {flagged && <span title={`อัตรากำลังขาด ${shortfall} คน`} style={{ marginRight: 6 }}>⚠️</span>}
                          {deptName}
                        </td>
                        <td className="num">{plan || "—"}</td>
                        <td className="num">{filled ?? "—"}</td>
                        <td className="num">
                          <input type="number" min={0} step={1}
                            value={otDrafts[deptName] ?? ""}
                            onChange={e => setOtDrafts(prev => ({ ...prev, [deptName]: e.target.value }))}
                            placeholder="0"
                            style={{ width: 100, padding: "5px 8px", borderRadius: 6, border: "1.5px solid #eaedf5",
                              textAlign: "right", fontFamily: "inherit", fontSize: 12.5 }} />
                        </td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button onClick={() => saveOtEntry(deptName)} disabled={otSaving === deptName}
                            style={{ padding: "5px 12px", borderRadius: 6, border: "none",
                              background: otSaving === deptName ? "#c4cfee" : "#0038C6", color: "#fff",
                              fontSize: 11.5, fontWeight: 700, cursor: otSaving === deptName ? "not-allowed" : "pointer",
                              fontFamily: "inherit" }}>
                            {otSaving === deptName ? "..." : "บันทึก"}
                          </button>
                          {otMsg[deptName] && (
                            <span style={{ marginLeft: 8, fontSize: 11, color: otMsg[deptName].startsWith("✅") ? "#16a34a" : "#dc2626" }}>
                              {otMsg[deptName]}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {otLoading && (
                    <tr><td colSpan={5} style={{ textAlign: "center", color: "#94a3b8", padding: 16 }}>กำลังโหลด…</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ── Cascading ฝ่าย → แผนก filter for Hourly Chart / Shift Summary / Gantt ── */}
      {parsed && (
        <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:8, marginBottom:12 }}>
          <label style={{ fontSize:12.5, color:"#6b7794", fontWeight:600 }}>ฝ่าย:</label>
          <select
            className="hrwt-date-sel"
            value={selectedDivision}
            onChange={e => { setSelectedDivision(e.target.value); setSelectedDept(""); }}
          >
            <option value="">ทั้งหมด (ทุกฝ่าย)</option>
            {availableDivisions.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>

          <label style={{ fontSize:12.5, color:"#6b7794", fontWeight:600 }}>แผนก:</label>
          <select
            className="hrwt-date-sel"
            value={selectedDept}
            onChange={e => setSelectedDept(e.target.value)}
          >
            <option value="">ทั้งหมด (ทุกแผนก)</option>
            {[...divisionFilteredDepts].sort((a, b) => a.name.localeCompare(b.name, "th")).map(d => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* ── Summary Row ── */}
      <div className="hrwt-summary">

        {/* Hourly bar chart */}
        <div className="hrwt-scard">
          <h4>สรุปจำนวนบุคลากรตามช่วงเวลา{isMonthly ? ` (เฉลี่ย/วัน — ${monthlySummary!.monthLabel})` : ""}{selectedDept && ` — ${selectedDept}`}</h4>
          <div className="hrwt-bars">
            {HOURLY.map(([t, v]) => {
              const isPeak = v === hourlyMaxLocal && hourlyMaxLocal > 0;
              return (
                <div key={t} className={`hrwt-bcol${isPeak ? " peak" : ""}`}>
                  {isPeak ? <div className="peak-tag">{v}</div> : <div className="bv">{v}</div>}
                  <div className="bfill" style={{ height: `${hourlyMaxLocal > 0 ? (v / hourlyMaxLocal * 100).toFixed(1) : 0}%` }} />
                  <div className="bx">{t}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Shift summary table — grouped by actual time period, not morning/afternoon/night */}
        <div className="hrwt-scard">
          <h4>สรุปตามช่วงเวลาทำงาน{isMonthly ? ` (เฉลี่ย/วัน — ${monthlySummary!.monthLabel})` : ""}{selectedDept && ` — ${selectedDept}`}</h4>
          <div className="hrwt-tbl-wrap">
            <table className="hrwt-tbl">
              <thead>
                <tr>
                  <th>ช่วงเวลา</th>
                  <th style={{ textAlign:"right" }}>{isMonthly ? "เฉลี่ย (คน/วัน)" : "จำนวน (คน)"}</th>
                  <th style={{ textAlign:"right" }}>ร้อยละ</th>
                </tr>
              </thead>
              <tbody>
                {shiftSummaryRows.map(s => (
                  <tr key={s.shift}>
                    <td><span className="sw" style={{ background: s.color }} />{s.shift}</td>
                    <td className="num">{s.staff}</td>
                    <td className="num">{s.percentage}%</td>
                  </tr>
                ))}
                <tr className="total">
                  <td>รวมทั้งหมด</td>
                  <td className="num">{shiftSummaryTotal}</td>
                  <td className="num">100%</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Dept comparison */}
        <div className="hrwt-scard">
          <h4>เปรียบเทียบจำนวนบุคลากรตามฝ่าย{isMonthly ? " (รวมคน-วันทั้งเดือน)" : ""}</h4>
          <div className="hrwt-deptbars">
            {[...rankingList].sort((a, b) => b.value - a.value).map(d => (
              <div key={d.name} className="hrwt-db">
                <div className="nm" title={d.name}>{d.name}</div>
                <div className="tr">
                  <div className="fl" style={{ width: `${(d.value / maxRanking * 100).toFixed(1)}%` }} />
                </div>
                <div className="qv">{d.value}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Tooltip */}
      {tip && (
        <div style={{ position:"fixed", left:tip.x, top:tip.y, pointerEvents:"none", background:"#0f1b38", color:"#fff", padding:"9px 12px", borderRadius:10, fontSize:12, lineHeight:1.6, zIndex:9999, boxShadow:"0 10px 30px rgba(0,0,0,.3)", maxWidth:230 }}>
          <div style={{ fontWeight:700, marginBottom:3 }}>{tip.dept}</div>
          <div><span style={{ display:"inline-block", width:9, height:9, borderRadius:3, background:tip.color, marginRight:6, verticalAlign:"middle" }} />{tip.shift}</div>
          <div>ปฏิบัติงาน <span style={{ color:"#7fc6ff", fontWeight:700 }}>{tip.count} คน</span></div>
        </div>
      )}

      {/* Real-time click info — everyone on duty right now, grouped by ฝ่าย → แผนก, anchored at the clicked point */}
      {nowClick && (() => {
        const byDivision = new Map<string, Map<string, CurrentStaffEntry[]>>();
        for (const entry of nowClick.entries) {
          const div = getDivisionForDept(entry.department);
          if (!byDivision.has(div)) byDivision.set(div, new Map());
          const deptMap = byDivision.get(div)!;
          if (!deptMap.has(entry.department)) deptMap.set(entry.department, []);
          deptMap.get(entry.department)!.push(entry);
        }
        const divisions = Array.from(byDivision.entries()).sort((a, b) => b[1].size - a[1].size);
        const left = Math.min(nowClick.x, Math.max(window.innerWidth - 340, 0));
        const top  = Math.min(nowClick.y, Math.max(window.innerHeight - 420, 0));

        return (
          <div style={{ position:"fixed", left, top, width:320, maxHeight:420, display:"flex", flexDirection:"column", background:"#fff", color:"#1b2a4a", borderRadius:12, border:"1px solid #eaedf5", boxShadow:"0 20px 50px rgba(0,0,0,.35)", zIndex:9999 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:"1px solid #eaedf5" }}>
              <div style={{ fontWeight:700, fontSize:13 }}>
                <span style={{ display:"inline-block", width:8, height:8, borderRadius:"50%", background:"#ef4444", marginRight:6 }} />
                เวลา {now.str} น. — รวม {nowClick.entries.length} คน
              </div>
              <button onClick={() => setNowClick(null)} style={{ border:"none", background:"none", cursor:"pointer", fontSize:18, color:"#94a3b8", lineHeight:1, padding:0 }}>×</button>
            </div>
            {nowClick.date !== todayThai() && (
              <div style={{ fontSize:10.5, color:"#e08c00", padding:"6px 14px 0" }}>* อ้างอิงข้อมูลวันที่ {formatThaiDate(nowClick.date)} (ไม่ใช่วันนี้)</div>
            )}
            <div style={{ overflowY:"auto", padding:"8px 14px 12px" }}>
              {nowClick.entries.length === 0 ? (
                <div style={{ fontSize:12.5, color:"#94a3b8", padding:"12px 0" }}>ไม่มีเจ้าหน้าที่ปฏิบัติงานอยู่ในช่วงเวลานี้</div>
              ) : divisions.map(([div, deptMap]) => {
                const divTotal = Array.from(deptMap.values()).reduce((s, arr) => s + arr.length, 0);
                return (
                  <div key={div} style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11.5, fontWeight:700, color:"#0038C6", marginBottom:4 }}>{div} ({divTotal})</div>
                    {Array.from(deptMap.entries()).sort((a, b) => b[1].length - a[1].length).map(([dept, list]) => (
                      <div key={dept} style={{ marginBottom:6, paddingLeft:8 }}>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{dept} ({list.length})</div>
                        {list.map((e, i) => (
                          <div key={i} style={{ display:"flex", justifyContent:"space-between", gap:8, fontSize:11, color:"#475569", padding:"2px 0" }}>
                            <span>{e.name}</span>
                            <span style={{ color:"#94a3b8", textAlign:"right", whiteSpace:"nowrap" }}>{getPositionForName(e.name) ?? "-"}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* เวร card click — who makes up that count, grouped by ฝ่าย → แผนก, with a note on long shifts */}
      {bandClick && (() => {
        const byDivision = new Map<string, Map<string, BandStaffEntry[]>>();
        for (const entry of bandClick.entries) {
          const div = getDivisionForDept(entry.department);
          if (!byDivision.has(div)) byDivision.set(div, new Map());
          const deptMap = byDivision.get(div)!;
          if (!deptMap.has(entry.department)) deptMap.set(entry.department, []);
          deptMap.get(entry.department)!.push(entry);
        }
        const divisions = Array.from(byDivision.entries()).sort((a, b) => b[1].size - a[1].size);
        const straddleCount = bandClick.entries.filter(e => e.straddleNote).length;
        const left = Math.min(bandClick.x, Math.max(window.innerWidth - 400, 0));
        const top  = Math.min(bandClick.y, Math.max(window.innerHeight - 460, 0));

        return (
          <div style={{ position:"fixed", left, top, width:380, maxHeight:460, display:"flex", flexDirection:"column", background:"#fff", color:"#1b2a4a", borderRadius:12, border:"1px solid #eaedf5", boxShadow:"0 20px 50px rgba(0,0,0,.35)", zIndex:9999 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:"1px solid #eaedf5" }}>
              <div style={{ fontWeight:700, fontSize:13 }}>
                {bandClick.bandLabel} — รวม {bandClick.entries.length} คน
              </div>
              <button onClick={() => setBandClick(null)} style={{ border:"none", background:"none", cursor:"pointer", fontSize:18, color:"#94a3b8", lineHeight:1, padding:0 }}>×</button>
            </div>
            <div style={{ fontSize:10.5, color:"#94a3b8", padding:"6px 14px 0", lineHeight:1.6 }}>
              ข้อมูลวันที่ {formatThaiDate(bandClick.date)}
              {isMonthly && " (วันล่าสุดของรอบเดือนที่เลือก — การ์ดด้านบนเป็นค่าเฉลี่ยทั้งเดือน ตัวเลขจึงไม่เท่ากัน)"}
              {straddleCount > 0 && (
                <div style={{ color:"#b8590a", marginTop:3 }}>
                  ⚠ มี {straddleCount} คนที่เข้างานคาบเกี่ยวกะ (ถูกนับในเวรอื่นด้วย)
                </div>
              )}
            </div>
            <div style={{ overflowY:"auto", padding:"8px 14px 12px" }}>
              {bandClick.entries.length === 0 ? (
                <div style={{ fontSize:12.5, color:"#94a3b8", padding:"12px 0" }}>ไม่มีเจ้าหน้าที่ในเวรนี้</div>
              ) : divisions.map(([div, deptMap]) => {
                const divTotal = Array.from(deptMap.values()).reduce((s, arr) => s + arr.length, 0);
                return (
                  <div key={div} style={{ marginBottom:10 }}>
                    <div style={{ fontSize:11.5, fontWeight:700, color:"#0038C6", marginBottom:4 }}>{div} ({divTotal})</div>
                    {Array.from(deptMap.entries()).sort((a, b) => b[1].length - a[1].length).map(([dept, list]) => (
                      <div key={dept} style={{ marginBottom:6, paddingLeft:8 }}>
                        <div style={{ fontSize:12, fontWeight:600, marginBottom:2 }}>{dept} ({list.length} คน)</div>
                        {list.map((e, i) => (
                          <div key={i} style={{ fontSize:11, color:"#475569", padding:"2px 0" }}>
                            <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                              <span>{e.name}</span>
                              <span style={{ color:"#94a3b8", textAlign:"right", whiteSpace:"nowrap" }}>{e.rangeLabel}</span>
                            </div>
                            {e.straddleNote && (
                              <div style={{ fontSize:10, color:"#b8590a", background:"#fff7e6", border:"1px dashed #f5c563",
                                borderRadius:6, padding:"2px 6px", marginTop:2 }}>
                                ⚠ {e.straddleNote}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Footer */}
      <div style={{ marginTop:8, fontSize:11, color:"#94a3b8", textAlign:"right" }}>
        {importedAt
          ? isMonthly
            ? `ข้อมูลจาก: รายงานประกาศกะ · นำเข้า ${importedAt} · เดือน ${dateStr} (${monthlySummary!.daysInRange} วัน, รอบ 26-25) · เฉลี่ย ${T_TOTAL} คน/วัน (รวม ${totalPersonDays} คน-วัน)`
            : `ข้อมูลจาก: รายงานประกาศกะ · นำเข้า ${importedAt} · วันที่ ${dateStr} · ${T_TOTAL} คน`
          : "ข้อมูล: แผนกำลังคน 2569 · อัปเดต มิ.ย. 2569 (กด นำเข้า Excel กะ เพื่อโหลดข้อมูลจริง)"}
      </div>
    </div>
  );
}
