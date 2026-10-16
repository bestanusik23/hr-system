// ใบลงทะเบียนเข้าฝึกอบรมสำหรับหน่วยงานราชการ (หลักสูตรเช็คชื่อ 2 รอบ เช้า–บ่าย)
// - ไม่มีคอลัมน์รหัสพนักงาน · เลขบัตรประชาชน 13 หลักแสดงเป็นตัวเลขชัดเจนในช่องละ 1 หลัก
// - แบ่งหน้าเอง: ตารางเต็มความสูงทุกหน้า (แถวขยายเท่า ๆ กัน) · ข้อความที่ยาวจะย่อขนาดให้อยู่ในช่อง
// ระบบไม่เก็บเลขบัตรประชาชน: ถ้าไม่ส่ง idCard มา ช่องจะว่างไว้ให้เขียนด้วยมือ

export interface SheetCourse {
  course: string; course_code: string; course_date: string | null;
  start_time: string | null; end_time: string | null; location: string | null; trainer: string | null;
}
export interface SheetPerson { name: string; position: string | null; idCard?: string | null }

const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function thaiDate(iso: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${Number(m[3])} ${THAI_MONTHS[Number(m[2])]} ${Number(m[1]) + 543}` : "—";
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const PREFIX_RE = /^(นางสาว|น\.\s*ส\.?|นส\.?|นาย|นาง|ทพญ\.?|ทพ\.?|ภกญ\.?|ภก\.?|พญ\.?|นพ\.?|ดร\.?|ผศ\.?|รศ\.?|คุณ)\s*/;
const sortKey = (name: string) => name.trim().replace(PREFIX_RE, "");

// วิทยากรนับจากรายชื่อที่ใส่ไว้ตอนสร้างหลักสูตร (ช่อง "วิทยากร" คั่นด้วย / , และ)
export function trainerNames(field: string | null | undefined): string[] {
  return (field ?? "").split(/[\/,;&\n]|\s+และ\s+/).map(s => s.trim()).filter(Boolean);
}

// ── ขนาดหน้า A4 แนวนอน (มม.) ─────────────────────────────────────────────
const PAGE_H = 186;      // ความสูงที่ใช้ได้จริงต่อหน้า (A4 210 − ขอบ 22 − เผื่อ 2)
const TOP_FIRST = 30;    // หัวเอกสารหน้าแรก
const TOP_NEXT = 9;      // หัวย่อหน้าถัดไป
const THEAD_H = 15;      // หัวตาราง 2 แถว
const CERT_H = 29;       // ช่องผู้รับรอง (หน้าสุดท้าย)
const GAP = 1.5;         // เผื่อเศษ
const MIN_ROW = 9;       // ความสูงแถวต่ำสุด
const MIN_BLANK = 3;     // แถวว่างขั้นต่ำท้ายรายชื่อ (สำหรับผู้ที่ไม่ได้ลงทะเบียนไว้)

const rowsFit = (h: number) => Math.floor((h - GAP) / MIN_ROW);

type Cell = { kind: "person"; no: number; p: SheetPerson } | { kind: "blank"; no: number } | { kind: "section"; label: string };

function fitClass(text: string, small: number, tiny: number): string {
  const n = text.length;
  return n > tiny ? "t3" : n > small ? "t2" : "";
}

function idBoxes(id: string | null | undefined): string {
  const d = (id ?? "").replace(/\D/g, "");
  const digits = d.length === 13 ? d.split("") : Array(13).fill("");
  return `<div class="ids">${digits.map(c => `<i>${c}</i>`).join("")}</div>`;
}

function renderRow(c: Cell): string {
  if (c.kind === "section") return `<tr class="sec"><td colspan="8">${esc(c.label)}</td></tr>`;
  if (c.kind === "blank") {
    return `<tr><td class="c">${c.no}</td><td></td><td></td><td class="idc">${idBoxes(null)}</td><td></td><td></td><td></td><td></td></tr>`;
  }
  const p = c.p;
  const nm = p.name.trim();
  const pos = p.position ?? "";
  return `<tr>
    <td class="c">${c.no || ""}</td>
    <td class="nm ${fitClass(nm, 24, 34)}">${esc(nm)}</td>
    <td class="pos ${fitClass(pos, 26, 46)}">${esc(pos)}</td>
    <td class="idc">${idBoxes(p.idCard)}</td>
    <td></td><td></td><td></td><td></td>
  </tr>`;
}

const THEAD = `<thead>
  <tr>
    <th rowspan="2">ลำดับที่</th><th rowspan="2">ชื่อ-สกุล</th><th rowspan="2">ตำแหน่ง</th>
    <th rowspan="2">เลขบัตรประจำตัวประชาชน (13 หลัก)</th>
    <th colspan="2">ภาคเช้า</th><th colspan="2">ภาคบ่าย</th>
  </tr>
  <tr><th>เวลาเข้าฝึก (น.)</th><th>ลงชื่อ</th><th>เวลาเข้าฝึก (น.)</th><th>ลงชื่อ</th></tr>
</thead>`;

export function buildTwoSessionSheetHtml(course: SheetCourse, attendees: SheetPerson[]): string {
  const sorted = [...attendees].sort((a, b) => sortKey(a.name).localeCompare(sortKey(b.name), "th"));
  const trainers: SheetPerson[] = trainerNames(course.trainer).map(name => ({ name, position: "วิทยากร" }));
  const trainerBlock: Cell[] = trainers.length
    ? [{ kind: "section", label: "วิทยากร" }, ...trainers.map((p, i): Cell => ({ kind: "person", no: i + 1, p }))]
    : [];

  // ความจุของแต่ละหน้า (จำนวนแถว): หน้าแรก / หน้ากลาง / หน้าสุดท้าย (มีช่องผู้รับรอง) / หน้าเดียว
  const nFirst  = rowsFit(PAGE_H - TOP_FIRST - THEAD_H);
  const nMid    = rowsFit(PAGE_H - TOP_NEXT - THEAD_H);
  const nLast   = rowsFit(PAGE_H - TOP_NEXT - THEAD_H - CERT_H);
  const nSingle = rowsFit(PAGE_H - TOP_FIRST - THEAD_H - CERT_H);
  const capacity = (pages: number) => pages === 1 ? nSingle : nFirst + (pages - 2) * nMid + nLast;

  const need = sorted.length + MIN_BLANK + trainerBlock.length;
  let pages = 1;
  while (capacity(pages) < need) pages++;
  const blanks = capacity(pages) - sorted.length - trainerBlock.length; // เติมแถวว่างให้เต็มหน้าสุดท้ายพอดี

  const seq: Cell[] = [
    ...sorted.map((p, i): Cell => ({ kind: "person", no: i + 1, p })),
    ...Array.from({ length: blanks }, (_, i): Cell => ({ kind: "blank", no: sorted.length + i + 1 })),
    ...trainerBlock,
  ];

  const time = course.start_time || course.end_time ? `${esc(course.start_time ?? "—")} – ${esc(course.end_time ?? "—")} น.` : "—";
  const sections: string[] = [];
  let at = 0;
  for (let pg = 1; pg <= pages; pg++) {
    const isFirst = pg === 1, isLast = pg === pages;
    const n = pages === 1 ? nSingle : isFirst ? nFirst : isLast ? nLast : nMid;
    const avail = PAGE_H - (isFirst ? TOP_FIRST : TOP_NEXT) - THEAD_H - (isLast ? CERT_H : 0) - GAP;
    const rowH = (avail / n).toFixed(2);
    const chunk = seq.slice(at, at + n); at += n;

    const top = isFirst
      ? `<div class="top1">
  <div class="hdr">
    <img src="/logo.png" alt="โรงพยาบาลเชียงราย ราม">
    <div class="ht">
      <div class="sub">โรงพยาบาลเชียงราย ราม · ฝ่ายทรัพยากรบุคคล (HRD)</div>
      <h1>ใบลงทะเบียนเข้าฝึกอบรม — ${esc(course.course)}</h1>
    </div>
    <div class="pgno">${esc(course.course_code)}<br>หน้า ${pg}/${pages}</div>
  </div>
  <div class="meta">
    <div>วันที่ฝึกอบรม : <strong>${thaiDate(course.course_date)}</strong></div>
    <div>เวลา : <strong>${time}</strong> (ภาคเช้า และ ภาคบ่าย)</div>
    <div>สถานที่ : <strong>${esc(course.location) || "—"}</strong></div>
    <div>วิทยากร : <strong>${esc(course.trainer) || "—"}</strong></div>
  </div>
</div>`
      : `<div class="top2"><span>${esc(course.course_code)} · ${esc(course.course)}</span><span>หน้า ${pg}/${pages}</span></div>`;

    const cert = isLast
      ? `<div class="cert"><div class="certbox">
  ลงชื่อ ................................................................ ผู้รับรอง<br>
  ( ................................................................ )<br>
  ตำแหน่ง ................................................................<br>
  วันที่ ............ / ............ / ............
</div></div>`
      : "";

    sections.push(`<section class="pg" style="--rh:${rowH}mm">
${top}
<table><colgroup>
  <col style="width:10mm"><col style="width:56mm"><col style="width:46mm"><col style="width:65mm">
  <col style="width:17mm"><col style="width:30mm"><col style="width:17mm"><col style="width:30mm">
</colgroup>${THEAD}<tbody>${chunk.map(renderRow).join("")}</tbody></table>
${cert}
</section>`);
  }

  return `<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>ใบลงทะเบียนเข้าฝึกอบรม ${esc(course.course_code)}</title>
<style>
  @page{size:A4 landscape;margin:11mm 12mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{margin:0}
  body{font-family:Sarabun,"Leelawadee UI",Tahoma,Arial,sans-serif;font-size:11pt;color:#111}
  .pg{height:${PAGE_H}mm;display:flex;flex-direction:column;page-break-after:always;overflow:hidden}
  .pg:last-child{page-break-after:auto}
  .top1{height:${TOP_FIRST}mm;overflow:hidden}
  .hdr{display:flex;align-items:center;gap:12px;border-bottom:2.5px solid #0038C6;padding-bottom:4px;margin-bottom:4px;height:19mm}
  .hdr img{height:11mm;width:auto;object-fit:contain;flex-shrink:0}
  .ht{flex:1;min-width:0}
  h1{font-size:13.5pt;color:#0038C6;margin:0;font-weight:700;line-height:1.25}
  .sub{font-size:9pt;color:#64748b}
  .pgno{font-size:8.5pt;color:#64748b;text-align:right;line-height:1.35;flex-shrink:0}
  .meta{font-size:9.5pt;display:flex;flex-wrap:wrap;gap:1px 26px;line-height:1.35}
  .top2{height:${TOP_NEXT}mm;display:flex;justify-content:space-between;align-items:flex-start;font-size:9pt;color:#64748b;border-bottom:1.5px solid #0038C6;margin-bottom:0}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10.5pt}
  th{background:#e8eeff;color:#0038C6;border:1px solid #8aa0d6;padding:2px 3px;font-weight:700;text-align:center;line-height:1.2;font-size:9.5pt}
  thead tr:first-child th{height:7.5mm}
  thead tr:nth-child(2) th{height:7.5mm}
  td{border:1px solid #9aa9cf;height:var(--rh);padding:0 4px;vertical-align:middle;overflow:hidden;line-height:1.15}
  td.c{text-align:center;padding:0}
  td.nm{white-space:nowrap;font-weight:600}
  td.t2{font-size:9.5pt} td.t3{font-size:8.5pt}
  td.pos.t2{font-size:9pt} td.pos.t3{font-size:8pt}
  td.nm.t2{font-size:9.5pt} td.nm.t3{font-size:8.5pt}
  td.idc{padding:0}
  .ids{display:flex;height:var(--rh)}
  .ids i{flex:1;border-left:1px solid #9aa9cf;display:flex;align-items:center;justify-content:center;font-style:normal;font-weight:700;font-size:12pt;color:#000;font-variant-numeric:tabular-nums}
  .ids i:first-child{border-left:0}
  tr.sec td{background:#eff4ff;color:#0038C6;font-weight:700;height:var(--rh);padding:0 6px}
  .cert{height:${CERT_H}mm;display:flex;justify-content:flex-end;align-items:flex-end}
  .certbox{width:100mm;text-align:center;font-size:10pt;line-height:1.7}
  .noprint{padding:10px 0}
  @media print{.noprint{display:none}}
</style></head><body>
${sections.join("\n")}
<div class="noprint"><button onclick="window.print()" style="padding:9px 24px;background:#0038C6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12pt">🖨️ พิมพ์ใบลงทะเบียน</button></div>
</body></html>`;
}
