// Analysis figures for the "วิเคราะห์" tab of รายงาน RAM GROUP.
// Built from HqReport (same counting rules as the HQ export), so the analysis and the
// file sent to HQ never disagree.
import {
  LINES, LINE_FUNC, TENURE_BANDS, AGE_BANDS, tenureBand, ageBand, monthsBetween,
  buildReportForMonths, previousMonths, ytdMonths, monthAbbr,
  type ApiData, type HqReport, type Line, type TemplateLists,
} from "./hqReportCalc";

export const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;

export interface Turnover { resigns: number; avgHeadcount: number; rate: number; annualized: number }
export interface Count { label: string; value: number }

export interface Analysis {
  months: number;
  total: Turnover;
  byLine: (Turnover & { line: Line })[];
  monthly: { month: string; headcount: number; planned: number; resigns: number; hires: number; rate: number }[];
  lineTrend: { line: Line; months: { month: string; planned: number; existing: number; fill: number }[] }[];
  tenure: Count[];
  age: Count[]; ageMissing: number;
  reasonCat: Count[];
  leaveType: Count[];
  probationLeavers: number;
  hiresVsResigns: { line: Line; hires: number; resigns: number }[];
  channelCat: Count[]; channelMissing: number;
  hires: number;
}

const turnover = (resigns: number, headcounts: number[], months: number): Turnover => {
  const avg = headcounts.length ? headcounts.reduce((a, b) => a + b, 0) / headcounts.length : 0;
  const rate = avg > 0 ? resigns / avg : 0;
  return { resigns, avgHeadcount: avg, rate, annualized: months > 0 ? rate * (12 / months) : 0 };
};

const tally = (keys: string[], order?: string[]): Count[] => {
  const m = new Map<string, number>();
  keys.forEach(k => m.set(k, (m.get(k) ?? 0) + 1));
  const labels = order ? [...order, ...[...m.keys()].filter(k => !order.includes(k))] : [...m.keys()];
  const out = labels.map(label => ({ label, value: m.get(label) ?? 0 }));
  return order ? out : out.sort((a, b) => b.value - a.value);
};

export function analyze(rep: HqReport, lists: TemplateLists | null): Analysis {
  const n = rep.months.length;
  const hcOf = (ym: string, line?: Line) =>
    rep.manpower.filter(m => m.month === ym && (!line || m.line === line)).reduce((a, m) => a + m.ft + m.pt, 0);
  const planOf = (ym: string, line?: Line) =>
    rep.manpower.filter(m => m.month === ym && (!line || m.line === line)).reduce((a, m) => a + m.planned, 0);

  const total = turnover(rep.resigns.length, rep.months.map(ym => hcOf(ym)), n);
  const byLine = LINES.map(line => ({
    line, ...turnover(rep.resigns.filter(p => p.line === line).length, rep.months.map(ym => hcOf(ym, line)), n),
  }));
  const monthly = rep.months.map(ym => {
    const hc = hcOf(ym), r = rep.resigns.filter(p => p.month === ym).length;
    return { month: ym, headcount: hc, planned: planOf(ym), resigns: r, hires: rep.hires.filter(p => p.month === ym).length, rate: hc > 0 ? r / hc : 0 };
  });
  const lineTrend = LINES.map(line => ({
    line,
    months: rep.months.map(ym => {
      const planned = planOf(ym, line), existing = hcOf(ym, line);
      return { month: ym, planned, existing, fill: planned > 0 ? existing / planned : 0 };
    }),
  }));

  const withDates = rep.resigns.filter(p => p.start && p.resign);
  const tenure = tally(withDates.map(p => tenureBand(p.start!, p.resign!)), TENURE_BANDS);
  const withAge = rep.resigns.filter(p => p.age !== null);
  const age = tally(withAge.map(p => ageBand(p.age!)), AGE_BANDS);
  const cats = rep.resigns.map(p => (p.reason && lists?.reasonCat[p.reason]) || "ยังไม่ระบุ");
  const reasonCat = tally(cats);
  const leaveType = tally(cats.map(c => (c === "ยังไม่ระบุ" ? "ยังไม่ระบุ" : lists?.reasonType[c] || "ยังไม่ระบุ")));
  const probationLeavers = withDates.filter(p => monthsBetween(p.start!, p.resign!) < 4).length;

  const hiresVsResigns = LINES.map(line => ({
    line, hires: rep.hires.filter(p => p.line === line).length, resigns: rep.resigns.filter(p => p.line === line).length,
  }));
  const channelCat = tally(rep.hires.filter(p => p.channel).map(p => lists?.channelCat[p.channel!] || p.channel!));

  return {
    months: n, total, byLine, monthly, lineTrend, tenure, age, ageMissing: rep.resigns.filter(p => p.required && p.age === null).length,
    reasonCat, leaveType, probationLeavers, hiresVsResigns, channelCat,
    channelMissing: rep.hires.filter(p => p.required && !p.channel).length, hires: rep.hires.length,
  };
}

export const funcOf = (l: Line) => LINE_FUNC[l];

export const rangeLabel = (r: HqReport) => r.months.length === 1
  ? `${monthAbbr(r.months[0])} ${r.year}`
  : `${monthAbbr(r.months[0])}–${monthAbbr(r.months[r.months.length - 1])} ${r.year}`;

/** Everything the analysis tab and the printed report show, so the two always agree. */
export function buildAnalysisView(data: ApiData, rep: HqReport, lists: TemplateLists | null) {
  const target = lists?.turnoverTarget ?? 0.12;
  const cur = analyze(rep, lists);
  const prevRep = buildReportForMonths(data, previousMonths(rep.months), lists);
  const prev = analyze(prevRep, lists);
  const ytdRep = buildReportForMonths(data, ytdMonths(rep.months), lists);
  const ytd = analyze(ytdRep, lists);
  const lastMonth = cur.monthly[cur.monthly.length - 1];
  return {
    target, cur, prev, prevRep, ytd, ytdRep, lastMonth,
    delta: cur.total.annualized - prev.total.annualized,
    vacancy: lastMonth && lastMonth.planned > 0 ? 1 - lastMonth.headcount / lastMonth.planned : 0,
    net: cur.hires - cur.total.resigns,
  };
}
