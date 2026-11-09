// One-page printable summary of รายงาน RAM GROUP (A4 landscape): the period summary grouped
// Labor Cost → Function → สายงาน, and % of people against % of pay. Figures only — no staff names.
import { SUMMARY_COLUMNS, summaryCell, type HqReport, type SummaryBlock, type SummaryRow } from "./hqReportCalc";
import { laborCompareHtml } from "./hqCharts";

const numCells = (r: SummaryRow, hasCost: boolean) => SUMMARY_COLUMNS.map(c => `<td class="n">${summaryCell(r, c.key, hasCost)}</td>`).join("");

function summaryRow(r: SummaryRow, hasCost: boolean): string {
  if (r.kind !== "line") return `<tr class="${r.kind}"><td colspan="3">${r.label}</td>${numCells(r, hasCost)}</tr>`;
  const labor = r.laborSpan > 0 ? `<td rowspan="${r.laborSpan}" class="group">${r.labor}</td>` : "";
  const func = r.funcSpan > 0 ? `<td rowspan="${r.funcSpan}" class="group">${r.func}</td>` : "";
  return `<tr>${labor}${func}<td>${r.label}</td>${numCells(r, hasCost)}</tr>`;
}

const colWidth = (key: string) => (key === "cost" ? 14 : key === "avgCost" ? 10 : 6);

const summaryTable = (b: SummaryBlock) => `<div class="sect">${b.title}${b.note ? `<span class="note">${b.note}</span>` : ""}</div>
  ${b.costWarning ? `<div class="cwarn">⚠ Labor Cost ยังไม่ครบ: ${b.costWarning}</div>` : ""}
  <table class="fixed">
    <colgroup><col style="width:8%"><col style="width:13%"><col style="width:19%">${SUMMARY_COLUMNS.map(c => `<col style="width:${colWidth(c.key)}%">`).join("")}</colgroup>
    <thead><tr><th>Labor Cost</th><th>Function</th><th>สายงาน</th>${SUMMARY_COLUMNS.map(c => `<th class="n">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${b.rows.map(r => summaryRow(r, b.hasCost)).join("")}</tbody>
  </table>`;

/** `summary` is the whole-period block (the first one from buildSummaryBlocks). */
export function printHqReport(rep: HqReport, summary: SummaryBlock, periodLabel: string) {
  const win = window.open("", "_blank", "width=1200,height=800,scrollbars=yes");
  if (!win) { alert("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup สำหรับเว็บไซต์นี้"); return; }

  const period = `${periodLabel} ${rep.year + 543}`;
  const compare = laborCompareHtml(rep);

  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>รายงาน RAM GROUP ${period}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4 landscape;margin:9mm 10mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Sarabun',Arial,sans-serif;font-size:9pt;color:#222;margin:0;line-height:1.25}
  .hdr{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;border-bottom:3px solid #1F3864;padding-bottom:5px;margin-bottom:6px}
  .sub{font-size:8.5pt;color:#64748b}
  h1{font-size:14pt;color:#1F3864;margin:0;font-weight:800}
  h2{font-size:11pt;color:#1F3864;margin:8px 0 4px;font-weight:800;border-left:4px solid #1F3864;padding-left:6px}
  .warn{color:#9A6700;background:#FFF8E1;padding:3px 8px;margin-bottom:5px;font-size:8.5pt}
  .sect{font-size:9.5pt;font-weight:800;color:#1F3864;margin-bottom:2px}
  .note{font-size:7pt;font-weight:400;color:#64748b;margin-left:6px}
  .cwarn{font-size:7.5pt;font-weight:600;color:#9A6700;margin-bottom:2px}
  table{width:100%;border-collapse:collapse;font-size:8pt}
  table.fixed{table-layout:fixed}
  table.fixed th{background:#1F3864;color:#fff;padding:2px 4px;text-align:left;font-weight:700;font-size:7.5pt}
  table.fixed td{border:1px solid #D5DCEB;padding:1.5px 4px;vertical-align:middle}
  .n{text-align:right !important;font-variant-numeric:tabular-nums}
  .group{font-weight:700;background:#F2F5FB}
  tr.labor td{background:#E8EEF8;font-weight:700}
  tr.total td{background:#1F3864;color:#fff;font-weight:800}
  .empty{color:#64748b;font-size:8.5pt;padding:2px 0}
  .foot{font-size:7pt;color:#64748b;margin-top:5px}
  .btns{margin:14px 0;text-align:center}
  .btns button{padding:9px 24px;background:#1F3864;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12pt;font-family:inherit}
  @media print{.noprint{display:none}}
  @media screen{body{padding:16px;max-width:297mm;margin:0 auto}}
</style></head><body>
<div class="hdr">
  <div>
    <div class="sub">โรงพยาบาลเชียงราย ราม · HR Dashboard (RAM Group)</div>
    <h1>รายงาน RAM GROUP · ${period}</h1>
  </div>
  <div class="sub">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
</div>
${rep.unmapped.length ? `<div class="warn">มีตำแหน่งที่ยังไม่จับคู่สายงาน ${rep.unmapped.length} รายการ ซึ่งยังไม่รวมในตัวเลขของรายงานนี้</div>` : ""}

<h2>1. สรุปอัตรากำลัง ตาม Labor Cost / Function / สายงาน</h2>
${summaryTable(summary)}

<h2>2. เทียบสัดส่วนจำนวนคน เงินเดือน และค่าเวร กับตำแหน่งว่าง</h2>
${compare || `<div class="empty">ยังไม่มีข้อมูลเงินเดือนในงวดนี้</div>`}

<div class="foot">Planned = แผนอัตรากำลังปัจจุบัน · Existing นับ ณ สิ้นเดือน · เริ่มงาน/ลาออก นับรอบวันที่ 26 เดือนก่อน – 25 ของเดือน · Labor Cost = รายได้รวมจากไฟล์เงินเดือน หักลาไม่รับค่าจ้าง โดยค่านอกเวลาและค่าเวรลงเป็นค่าใช้จ่ายของเดือนก่อนงวดจ่าย</div>
<div class="btns noprint"><button onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button></div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 800);
}
