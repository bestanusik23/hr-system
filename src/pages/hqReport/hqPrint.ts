// Printable summary of รายงาน RAM GROUP, grouped Labor Cost → Function → สายงาน.
import { SUMMARY_COLUMNS, type SummaryBlock, type SummaryRow } from "./hqReportCalc";

const numCells = (r: SummaryRow) => SUMMARY_COLUMNS.map(c => `<td class="n">${r[c.key]}</td>`).join("");

function rowHtml(r: SummaryRow): string {
  if (r.kind !== "line") return `<tr class="${r.kind}"><td colspan="3">${r.label}</td>${numCells(r)}</tr>`;
  const labor = r.laborSpan > 0 ? `<td rowspan="${r.laborSpan}" class="group">${r.labor}</td>` : "";
  const func = r.funcSpan > 0 ? `<td rowspan="${r.funcSpan}" class="group">${r.func}</td>` : "";
  return `<tr>${labor}${func}<td>${r.label}</td>${numCells(r)}</tr>`;
}

function blockHtml(b: SummaryBlock): string {
  return `<section class="block">
  <div class="sect">${b.title}${b.note ? `<span class="note">${b.note}</span>` : ""}</div>
  <table>
    <colgroup><col style="width:11%"><col style="width:15%"><col style="width:26%">${SUMMARY_COLUMNS.map(() => `<col style="width:8%">`).join("")}</colgroup>
    <thead><tr><th>Labor Cost</th><th>Function</th><th>สายงาน</th>${SUMMARY_COLUMNS.map(c => `<th class="n">${c.label}</th>`).join("")}</tr></thead>
    <tbody>${b.rows.map(rowHtml).join("")}</tbody>
  </table>
</section>`;
}

export function printHqSummary(blocks: SummaryBlock[], periodLabel: string, year: number, unmappedCount: number) {
  const win = window.open("", "_blank", "width=900,height=1100,scrollbars=yes");
  if (!win) { alert("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup สำหรับเว็บไซต์นี้"); return; }
  win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>สรุปอัตรากำลัง RAM GROUP ${periodLabel} ${year + 543}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4 portrait;margin:10mm 12mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:'Sarabun',Arial,sans-serif;font-size:9pt;color:#222;margin:0;line-height:1.25}
  .hdr{border-bottom:3px solid #1F3864;padding-bottom:6px;margin-bottom:8px}
  .sub{font-size:8.5pt;color:#64748b}
  h1{font-size:14pt;color:#1F3864;margin:0;font-weight:800}
  .block{break-inside:avoid;page-break-inside:avoid;margin-bottom:9px}
  .sect{font-size:10pt;font-weight:800;color:#1F3864;margin-bottom:3px}
  .note{font-size:7.5pt;font-weight:400;color:#64748b;margin-left:8px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:8.5pt}
  th{background:#1F3864;color:#fff;padding:3px 5px;text-align:left;font-weight:700;font-size:8pt}
  td{border:1px solid #D5DCEB;padding:2px 5px;vertical-align:middle}
  .n{text-align:right;font-variant-numeric:tabular-nums}
  .group{font-weight:700;background:#F2F5FB}
  tr.labor td{background:#E8EEF8;font-weight:700}
  tr.total td{background:#1F3864;color:#fff;font-weight:800}
  .warn{color:#9A6700;background:#FFF8E1;padding:4px 8px;margin-bottom:8px;font-size:8.5pt}
  .foot{font-size:7.5pt;color:#64748b;margin-top:4px}
  .btns{margin:14px 0;text-align:center}
  .btns button{padding:9px 24px;background:#1F3864;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12pt;font-family:inherit}
  @media print{.noprint{display:none}}
  @media screen{body{padding:16px;max-width:210mm;margin:0 auto}}
</style></head><body>
<div class="hdr">
  <div class="sub">โรงพยาบาลเชียงราย ราม · HR Dashboard (RAM Group)</div>
  <h1>สรุปอัตรากำลัง ผู้เริ่มงาน ผู้ลาออก · ${periodLabel} ${year + 543}</h1>
</div>
${unmappedCount > 0 ? `<div class="warn">มีตำแหน่งที่ยังไม่จับคู่สายงาน ${unmappedCount} รายการ ซึ่งยังไม่รวมในตัวเลขของรายงานนี้</div>` : ""}
${blocks.map(blockHtml).join("")}
<div class="foot">Existing นับ ณ สิ้นเดือน · เริ่มงาน/ลาออก นับรอบวันที่ 26 เดือนก่อน – 25 ของเดือน · ไม่นับผู้เช่าสถานที่ประกอบวิชาชีพเวชกรรม นักศึกษาฝึกงาน และตำแหน่งที่ตั้งเป็น "ไม่นับ" · พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
<div class="btns noprint"><button onclick="window.print()">🖨️ พิมพ์ / บันทึก PDF</button></div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}
