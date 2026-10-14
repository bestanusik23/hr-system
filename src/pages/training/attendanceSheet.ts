// ใบลงทะเบียนเข้าฝึกอบรมสำหรับหน่วยงานราชการ (หลักสูตรเช็คชื่อ 2 รอบ เช้า–บ่าย)
// พนักงานเขียนเลขบัตรประชาชนและลงชื่อเองบนกระดาษ — ระบบไม่เก็บเลขบัตรประชาชน จึงเว้นช่องไว้

export interface SheetCourse {
  course: string; course_code: string; course_date: string | null;
  start_time: string | null; end_time: string | null; location: string | null; trainer: string | null;
}
export interface SheetPerson { name: string; position: string | null }

const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function thaiDate(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${Number(m[3])} ${THAI_MONTHS[Number(m[2])]} ${Number(m[1]) + 543}` : "—";
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PREFIX_RE = /^(นางสาว|น\.\s*ส\.?|นส\.?|นาย|นาง|ทพญ\.?|ทพ\.?|ภกญ\.?|ภก\.?|พญ\.?|นพ\.?|ดร\.?|ผศ\.?|รศ\.?|คุณ)\s*/;
const sortKey = (name: string) => name.trim().replace(PREFIX_RE, "");

const BLANK_ROWS = 5;
const ID_BOXES = `<div class="ids">${"<i></i>".repeat(13)}</div>`;

function row(i: number, p: SheetPerson | null): string {
  return `<tr>
    <td class="c">${i}</td>
    <td class="nm">${p ? esc(p.name) : ""}</td>
    <td>${p ? esc(p.position) : ""}</td>
    <td class="idc">${ID_BOXES}</td>
    <td></td><td></td><td></td><td></td>
  </tr>`;
}

export function buildTwoSessionSheetHtml(course: SheetCourse, attendees: SheetPerson[], trainers: SheetPerson[]): string {
  const sorted = [...attendees].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), "th"));
  let n = 0;
  const attRows = sorted.map(p => row(++n, p)).join("");
  const blankRows = Array.from({ length: BLANK_ROWS }, () => row(++n, null)).join("");
  const trainerRows = trainers.length
    ? `<tr><td colspan="8" class="sect">วิทยากร</td></tr>` + trainers.map((p, i) => row(i + 1, p)).join("")
    : "";
  const time = course.start_time || course.end_time ? `${esc(course.start_time ?? "—")} – ${esc(course.end_time ?? "—")} น.` : "—";

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>ใบลงทะเบียนเข้าฝึกอบรม ${esc(course.course_code)}</title>
<style>
  @page{size:A4 landscape;margin:11mm 12mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  body{font-family:Sarabun,"Leelawadee UI",Tahoma,Arial,sans-serif;font-size:11pt;color:#111;margin:0}
  .hdr{display:flex;align-items:center;gap:14px;border-bottom:2.5px solid #0038C6;padding-bottom:8px;margin-bottom:8px}
  .hdr img{height:44px;width:auto;object-fit:contain;flex-shrink:0}
  h1{font-size:15pt;color:#0038C6;margin:0;font-weight:700}
  .sub{font-size:9.5pt;color:#64748b}
  .meta{font-size:10pt;display:flex;flex-wrap:wrap;gap:2px 28px;margin-bottom:8px}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  th{background:#e8eeff;color:#0038C6;border:1px solid #8aa0d6;padding:4px 3px;font-weight:700;text-align:center;line-height:1.25}
  td{border:1px solid #9aa9cf;height:8.6mm;padding:0 5px;vertical-align:middle;overflow:hidden}
  td.c{text-align:center;padding:0}
  td.nm{white-space:nowrap}
  td.idc{padding:0}
  .ids{display:flex;height:8.6mm}
  .ids i{flex:1;border-left:1px solid #9aa9cf}
  .ids i:first-child{border-left:0}
  td.sect{background:#eff4ff;color:#0038C6;font-weight:700;height:7mm}
  .cert{margin-top:14px;display:flex;justify-content:flex-end;page-break-inside:avoid}
  .certbox{width:96mm;text-align:center;font-size:10.5pt;line-height:1.9}
  .foot{margin-top:8px;font-size:8pt;color:#94a3b8;text-align:right}
  .noprint{margin-top:14px}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="hdr">
  <img src="/logo.png" alt="โรงพยาบาลเชียงราย ราม">
  <div>
    <div class="sub">โรงพยาบาลเชียงราย ราม · ฝ่ายทรัพยากรบุคคล (HRD)</div>
    <h1>ใบลงทะเบียนเข้าฝึกอบรม — ${esc(course.course)}</h1>
    <div class="sub">${esc(course.course_code)}</div>
  </div>
</div>
<div class="meta">
  <div>วันที่ฝึกอบรม : <strong>${thaiDate(course.course_date)}</strong></div>
  <div>เวลา : <strong>${time}</strong> (ภาคเช้า และ ภาคบ่าย)</div>
  <div>สถานที่ : <strong>${esc(course.location) || "—"}</strong></div>
  <div>วิทยากร : <strong>${esc(course.trainer) || "—"}</strong></div>
</div>
<table>
<colgroup>
  <col style="width:11mm"><col style="width:52mm"><col style="width:42mm"><col style="width:58mm">
  <col style="width:23mm"><col style="width:30mm"><col style="width:23mm"><col style="width:30mm">
</colgroup>
<thead>
  <tr>
    <th rowspan="2">ลำดับที่</th><th rowspan="2">ชื่อ-สกุล</th><th rowspan="2">ตำแหน่ง</th>
    <th rowspan="2">เลขบัตรประจำตัวประชาชน<br>(13 หลัก)</th>
    <th colspan="2">ภาคเช้า</th><th colspan="2">ภาคบ่าย</th>
  </tr>
  <tr><th>เวลาเข้าฝึก (น.)</th><th>ลงชื่อ</th><th>เวลาเข้าฝึก (น.)</th><th>ลงชื่อ</th></tr>
</thead>
<tbody>${attRows}${blankRows}${trainerRows}</tbody>
</table>
<div class="cert"><div class="certbox">
  ลงชื่อ ................................................................ ผู้รับรอง<br>
  ( ................................................................ )<br>
  ตำแหน่ง ................................................................<br>
  วันที่ ............ / ............ / ............
</div></div>
<div class="foot">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
<div class="noprint"><button onclick="window.print()" style="padding:9px 24px;background:#0038C6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12pt">🖨️ พิมพ์ใบลงทะเบียน</button></div>
</body></html>`;
}
