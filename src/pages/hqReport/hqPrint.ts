// Printable full report of รายงาน RAM GROUP (A4 landscape): summary grouped
// Labor Cost → Function → สายงาน, the analysis tab, and the leaver / new-hire lists.
import {
  SUMMARY_COLUMNS, summaryCell, monthAbbr, thDate,
  type ApiData, type HqReport, type PersonRow, type SummaryBlock, type SummaryRow, type TemplateLists,
} from "./hqReportCalc";
import { buildAnalysisView, pct, rangeLabel, type Count } from "./hqAnalysis";

const esc = (v: string | number | null | undefined) => String(v ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));

// ── Summary ──────────────────────────────────────────────────────────────────
const numCells = (r: SummaryRow, hasCost: boolean) => SUMMARY_COLUMNS.map(c => `<td class="n">${summaryCell(r, c.key, hasCost)}</td>`).join("");

function summaryRow(r: SummaryRow, hasCost: boolean): string {
  if (r.kind !== "line") return `<tr class="${r.kind}"><td colspan="3">${r.label}</td>${numCells(r, hasCost)}</tr>`;
  const labor = r.laborSpan > 0 ? `<td rowspan="${r.laborSpan}" class="group">${r.labor}</td>` : "";
  const func = r.funcSpan > 0 ? `<td rowspan="${r.funcSpan}" class="group">${r.func}</td>` : "";
  return `<tr>${labor}${func}<td>${r.label}</td>${numCells(r, hasCost)}</tr>`;
}

// Half-page tables (quarter/year) are too narrow for the full count headers.
const SHORT_LABEL: Record<string, string> = { planned: "แผน", ft: "FT", pt: "PT", vacant: "ว่าง", hired: "เข้า", resigned: "ออก" };
const colWidth = (key: string, compact: boolean) => (key === "cost" ? (compact ? 15 : 14) : key === "avgCost" ? (compact ? 11 : 10) : compact ? 5.5 : 6);

const summaryBlock = (b: SummaryBlock, compact: boolean) => `<section class="block">
  <div class="sect">${b.title}${b.note ? `<span class="note">${b.note}</span>` : ""}</div>
  ${b.costWarning ? `<div class="cwarn">⚠ Labor Cost ยังไม่ครบ: ${b.costWarning}</div>` : ""}
  <table class="fixed">
    <colgroup><col style="width:${compact ? 10 : 8}%"><col style="width:13%"><col style="width:${compact ? 18 : 19}%">${SUMMARY_COLUMNS.map(c => `<col style="width:${colWidth(c.key, compact)}%">`).join("")}</colgroup>
    <thead><tr><th>Labor Cost</th><th>Function</th><th>สายงาน</th>${SUMMARY_COLUMNS.map(c => `<th class="n">${(compact && SHORT_LABEL[c.key]) || c.label}</th>`).join("")}</tr></thead>
    <tbody>${b.rows.map(r => summaryRow(r, b.hasCost)).join("")}</tbody>
  </table>
</section>`;

// ── Analysis ─────────────────────────────────────────────────────────────────
const tile = (label: string, value: string, note: string, status?: "good" | "bad") => `<div class="tile">
  <div class="tile-l">${label}</div>
  <div class="tile-v">${value}${status ? `<span class="${status}">${status === "good" ? "✓ ไม่เกินเป้า" : "▲ สูงกว่าเป้า"}</span>` : ""}</div>
  <div class="tile-n">${note}</div>
</div>`;

function bars(rows: { label: string; value: number; text: string }[], target?: number): string {
  const top = Math.max(target ?? 0, ...rows.map(r => r.value), 1e-9);
  return rows.map(r => `<div class="bar-row">
    <div class="bar-l">${esc(r.label)}</div>
    <div class="bar-t"><div class="bar-f" style="width:${(r.value / top) * 100}%"></div>${target !== undefined ? `<div class="bar-m" style="left:${(target / top) * 100}%"></div>` : ""}</div>
    <div class="bar-v">${r.text}</div>
  </div>`).join("");
}
const countBars = (c: Count[], total: number) => c.length
  ? bars(c.map(x => ({ label: x.label, value: x.value, text: `${x.value}${total ? ` (${pct(x.value / total, 0)})` : ""}` })))
  : `<div class="empty">ยังไม่มีข้อมูล</div>`;

const panel = (title: string, sub: string, body: string, cls = "") => `<div class="panel ${cls}">
  <div class="p-t">${title}</div>${sub ? `<div class="p-s">${sub}</div>` : ""}${body}
</div>`;

function analysisHtml(view: ReturnType<typeof buildAnalysisView>, rep: HqReport): { tiles: string; panels: string } {
  const { target, cur, prev, prevRep, ytd, ytdRep, lastMonth, delta, vacancy, net } = view;
  const tiles = [
    tile(`Turnover งวดนี้ (${rangeLabel(rep)}) คิดเป็นรายปี`, pct(cur.total.annualized),
      `ลาออก ${cur.total.resigns} คน / เฉลี่ย ${cur.total.avgHeadcount.toFixed(1)} คน · งวดนี้ ${pct(cur.total.rate)} · เป้า ${pct(target, 0)}/ปี`,
      cur.total.annualized <= target ? "good" : "bad"),
    tile(`Turnover สะสมทั้งปี (${rangeLabel(ytdRep)}) คิดเป็นรายปี`, pct(ytd.total.annualized),
      `ลาออกสะสม ${ytd.total.resigns} คน`, ytd.total.annualized <= target ? "good" : "bad"),
    tile(`เทียบงวดก่อน (${rangeLabel(prevRep)})`, `${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)} จุด`,
      `งวดก่อน ${pct(prev.total.annualized)} → งวดนี้ ${pct(cur.total.annualized)}`),
    tile(`ตำแหน่งว่าง ณ สิ้น ${lastMonth ? monthAbbr(lastMonth.month) : "—"}`, pct(vacancy),
      lastMonth ? `มีคน ${lastMonth.headcount} / แผน ${lastMonth.planned} (ว่าง ${lastMonth.planned - lastMonth.headcount})` : ""),
  ].join("");

  const monthly = `<table><thead><tr><th>เดือน</th><th class="n">แผน</th><th class="n">มีคน</th><th class="n">เริ่มงาน</th><th class="n">ลาออก</th><th class="n">Turnover/เดือน</th></tr></thead>
    <tbody>${cur.monthly.map(m => `<tr><td>${monthAbbr(m.month)}</td><td class="n">${m.planned}</td><td class="n">${m.headcount}</td><td class="n">${m.hires}</td><td class="n">${m.resigns}</td><td class="n">${pct(m.rate)}</td></tr>`).join("")}</tbody></table>`;

  const trend = `<table><thead><tr><th>สายงาน</th>${rep.months.map(ym => `<th class="n">${monthAbbr(ym)}</th>`).join("")}</tr></thead>
    <tbody>${cur.lineTrend.map(t => `<tr><td>${t.line}</td>${t.months.map(m => `<td class="n">${m.planned ? `${pct(m.fill, 0)}` : "—"}</td>`).join("")}</tr>`).join("")}</tbody></table>`;

  const flows = `<table><thead><tr><th>สายงาน</th><th class="n">รับเข้า</th><th class="n">ลาออก</th><th class="n">สุทธิ</th></tr></thead>
    <tbody>${cur.hiresVsResigns.map(h => {
      const d = h.hires - h.resigns;
      return `<tr><td>${h.line}</td><td class="n">${h.hires}</td><td class="n">${h.resigns}</td><td class="n"><b>${d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "0"}</b></td></tr>`;
    }).join("")}</tbody></table>`;

  const panels = [
    panel("Turnover รายปี แยกสายงาน", `อัตราลาออกงวดนี้ ปรับเป็นรายปี · เส้นประ = เป้า ${pct(target, 0)}`,
      bars(cur.byLine.map(b => ({ label: b.line, value: b.annualized, text: pct(b.annualized) })), target)),
    panel("รายเดือน", "คน ณ สิ้นเดือน · เริ่มงาน/ลาออกตามรอบ 26–25", monthly),
    panel("รับเข้า vs ลาออก แยกสายงาน", `สุทธิทั้งงวด ${net >= 0 ? "+" : ""}${net} คน (รับเข้า ${cur.hires} · ลาออก ${cur.total.resigns})`, flows),
    panel("แนวโน้มอัตรากำลัง — % บรรจุเทียบแผน แยกสายงาน", "มีคน ÷ แผน ณ สิ้นเดือน", trend, "wide"),
    panel("ผู้ลาออกตามอายุงาน",
      `ลาออกช่วงทดลองงาน (&lt; 4 เดือน) ${cur.probationLeavers} คน${cur.total.resigns ? ` (${pct(cur.probationLeavers / cur.total.resigns, 0)} ของผู้ลาออก)` : ""}`,
      countBars(cur.tenure, cur.total.resigns), "quarter"),
    panel("ผู้ลาออกตามช่วงอายุ", `${cur.ageMissing > 0 ? `ยังไม่ได้กรอกอายุ ${cur.ageMissing} คน` : "กรอกอายุครบแล้ว"} · เริ่มเก็บ ต.ค. 2569`,
      countBars(cur.age, cur.age.reduce((a, c) => a + c.value, 0)), "quarter"),
    panel("หมวดเหตุผลการลาออก", cur.leaveType.map(l => `${esc(l.label)} ${l.value}`).join(" · ") || "ไม่มีผู้ลาออก",
      countBars(cur.reasonCat, cur.total.resigns), "quarter"),
    panel("ช่องทางสรรหาที่ได้คน", `${cur.channelMissing > 0 ? `ยังไม่ได้เลือกช่องทาง ${cur.channelMissing} คน` : "ระบุช่องทางครบแล้ว"} · เริ่มเก็บ ต.ค. 2569`,
      countBars(cur.channelCat, cur.channelCat.reduce((a, c) => a + c.value, 0)), "quarter"),
  ].join("");
  return { tiles, panels };
}

// ── People ───────────────────────────────────────────────────────────────────
function peopleTable(rows: PersonRow[], kind: "resign" | "hire"): string {
  if (rows.length === 0) return `<div class="empty">ไม่มีรายการในงวดนี้</div>`;
  const head = kind === "resign"
    ? `<th>วันลาออก</th><th class="n">อายุ</th><th>เหตุผล</th>`
    : `<th>ช่องทางสรรหา</th>`;
  const tail = (p: PersonRow) => kind === "resign"
    ? `<td>${thDate(p.resign)}</td><td class="n">${p.age ?? "—"}</td><td>${esc(p.reason || p.resignReasonText || "—")}</td>`
    : `<td>${esc(p.channel || "—")}</td>`;
  return `<table class="people">
    <thead><tr><th class="n">ลำดับ</th><th>เดือน</th><th>ชื่อ-สกุล</th><th>ตำแหน่ง</th><th>สายงาน</th><th>วันเริ่มงาน</th>${head}</tr></thead>
    <tbody>${rows.map((p, i) => `<tr><td class="n">${i + 1}</td><td>${monthAbbr(p.month)}</td><td>${esc(p.name)}</td><td>${esc(p.position)}</td><td>${esc(p.line)}</td><td>${thDate(p.start)}</td>${tail(p)}</tr>`).join("")}</tbody>
  </table>`;
}

// ── Document ─────────────────────────────────────────────────────────────────
export function printHqReport(data: ApiData, rep: HqReport, lists: TemplateLists | null, blocks: SummaryBlock[], periodLabel: string) {
  const win = window.open("", "_blank", "width=1200,height=800,scrollbars=yes");
  if (!win) { alert("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup สำหรับเว็บไซต์นี้"); return; }

  const { tiles, panels } = analysisHtml(buildAnalysisView(data, rep, lists), rep);
  const period = `${periodLabel} ${rep.year + 543}`;
  const missing = [
    rep.unmapped.length ? `ตำแหน่งที่ยังไม่จับคู่สายงาน ${rep.unmapped.length} รายการ (ยังไม่รวมในตัวเลข)` : "",
    ...[
      ["อายุผู้ลาออก", rep.resigns.filter(p => p.required && p.age === null).length],
      ["เหตุผลลาออก", rep.resigns.filter(p => p.required && !p.reason).length],
      ["ช่องทางสรรหา", rep.hires.filter(p => p.required && !p.channel).length],
    ].map(([label, n]) => (n ? `${label}ยังไม่กรอก ${n} คน` : "")),
  ].filter(Boolean).join(" · ");

  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>รายงาน RAM GROUP ${esc(period)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4 landscape;margin:9mm 10mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Sarabun',Arial,sans-serif;font-size:9pt;color:#222;margin:0;line-height:1.25}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #1F3864;padding-bottom:5px;margin-bottom:7px}
  .sub{font-size:8.5pt;color:#64748b}
  h1{font-size:14pt;color:#1F3864;margin:0;font-weight:800}
  h2{font-size:11pt;color:#1F3864;margin:10px 0 5px;font-weight:800;border-left:4px solid #1F3864;padding-left:6px;break-after:avoid;page-break-after:avoid}
  .page{break-before:page;page-break-before:always;padding-top:2mm}
  .page>h2:first-child{margin-top:0}
  .warn{color:#9A6700;background:#FFF8E1;padding:4px 8px;margin-bottom:7px;font-size:8.5pt}

  .tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-bottom:4px}
  .tile{border:1px solid #D5DCEB;border-radius:6px;padding:5px 8px;break-inside:avoid}
  .tile-l{font-size:7.5pt;color:#64748b}
  .tile-v{font-size:14pt;font-weight:800;color:#1E293B}
  .tile-v span{font-size:8pt;font-weight:700;margin-left:6px}
  .good{color:#1F7A3D}.bad{color:#B42318}
  .tile-n{font-size:7.5pt;color:#475569}

  .blocks{display:grid;gap:7px 12px}
  .blocks.two{grid-template-columns:1fr 1fr}
  .block{break-inside:avoid;page-break-inside:avoid}
  .sect{font-size:9.5pt;font-weight:800;color:#1F3864;margin-bottom:2px}
  .note{font-size:7pt;font-weight:400;color:#64748b;margin-left:6px}
  .cwarn{font-size:7pt;font-weight:600;color:#9A6700;margin-bottom:2px}

  table{width:100%;border-collapse:collapse;font-size:8pt}
  table.fixed{table-layout:fixed}
  th{background:#1F3864;color:#fff;padding:2px 4px;text-align:left;font-weight:700;font-size:7.5pt}
  td{border:1px solid #D5DCEB;padding:1.5px 4px;vertical-align:middle}
  tr{break-inside:avoid;page-break-inside:avoid}
  .n{text-align:right;font-variant-numeric:tabular-nums}
  .group{font-weight:700;background:#F2F5FB}
  tr.labor td{background:#E8EEF8;font-weight:700}
  tr.total td{background:#1F3864;color:#fff;font-weight:800}

  .panels{display:grid;grid-template-columns:repeat(12,1fr);gap:7px 10px}
  .panel{grid-column:span 4;border:1px solid #D5DCEB;border-radius:6px;padding:6px 8px;break-inside:avoid;page-break-inside:avoid}
  .panel.wide{grid-column:1/-1}
  .panel.quarter{grid-column:span 3}
  .p-t{font-size:9pt;font-weight:800;color:#1E293B}
  .p-s{font-size:7.5pt;color:#64748b;margin-bottom:3px}
  .bar-row{display:grid;grid-template-columns:38% 1fr 52px;gap:5px;align-items:center;padding:1px 0;font-size:7.5pt}
  .bar-t{position:relative;height:8px;background:#EEF2F8;border-radius:2px}
  .bar-f{height:100%;background:#2F5597;border-radius:0 2px 2px 0}
  .bar-m{position:absolute;top:-2px;bottom:-2px;border-left:1.5px dashed #64748b}
  .bar-v{text-align:right;font-variant-numeric:tabular-nums}
  .empty{color:#64748b;font-size:8.5pt;padding:2px 0}

  .foot{font-size:7.5pt;color:#64748b;margin-top:6px}
  .btns{margin:14px 0;text-align:center}
  .btns button{padding:9px 24px;background:#1F3864;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12pt;font-family:inherit}
  @media print{.noprint{display:none}}
  @media screen{body{padding:16px;max-width:297mm;margin:0 auto}}
</style></head><body>
<div class="hdr">
  <div>
    <div class="sub">โรงพยาบาลเชียงราย ราม · HR Dashboard (RAM Group)</div>
    <h1>รายงาน RAM GROUP · ${esc(period)}</h1>
  </div>
  <div class="sub">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
</div>
${missing ? `<div class="warn">ข้อมูลยังไม่ครบ: ${missing}</div>` : ""}
<div class="tiles">${tiles}</div>

<h2>1. สรุปอัตรากำลัง ตาม Labor Cost / Function / สายงาน${blocks.length > 1 ? `<span class="note">แผน = Planned · FT / PT = Existing · ว่าง = Vacant · เข้า = เริ่มงาน · ออก = ลาออก</span>` : ""}</h2>
<div class="blocks ${blocks.length > 1 ? "two" : ""}">${blocks.map(b => summaryBlock(b, blocks.length > 1)).join("")}</div>

<div class="page">
  <h2>2. วิเคราะห์</h2>
  <div class="panels">${panels}</div>
</div>

<div class="page">
  <h2>3. รายชื่อผู้ลาออก (${rep.resigns.length} คน)</h2>
  ${peopleTable(rep.resigns, "resign")}
  <h2>4. รายชื่อพนักงานใหม่ (${rep.hires.length} คน)</h2>
  ${peopleTable(rep.hires, "hire")}
  <div class="foot">Planned = แผนอัตรากำลังปัจจุบัน · Existing นับ ณ สิ้นเดือน · เริ่มงาน/ลาออก นับรอบวันที่ 26 เดือนก่อน – 25 ของเดือน · ไม่นับผู้เช่าสถานที่ประกอบวิชาชีพเวชกรรม นักศึกษาฝึกงาน และตำแหน่งที่ตั้งเป็น "ไม่นับ" · Labor Cost = รายได้รวมจากไฟล์เงินเดือน หักลาไม่รับค่าจ้าง โดยค่านอกเวลาและค่าเวรลงเป็นค่าใช้จ่ายของเดือนก่อนงวดจ่าย</div>
</div>
<div class="btns noprint"><button onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button></div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}
