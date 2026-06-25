import { useState } from "react";

interface ScoreRow { topic_id: number; score: number; text: string; owner: string; sort_order: number; }
interface PrintData {
  ok: boolean; error?: string;
  document_no: string; running_no: string; document_code: string;
  print_count: number; is_copy: boolean; printed_by_name: string;
  evaluation: Record<string, unknown>;
  scores: ScoreRow[];
  training: { course_count: number; passed_courses: number };
}
interface Props { evalId: number; onClose: () => void; }

function gradeFromScore(s: number) {
  if (s >= 90) return "A"; if (s >= 80) return "B"; if (s >= 70) return "C";
  if (s >= 60) return "D"; if (s >= 50) return "E"; return "F";
}

function workDuration(startDate: string | null): string {
  if (!startDate) return "—";
  const s = new Date(startDate);
  const n = new Date();
  const months = (n.getFullYear() - s.getFullYear()) * 12 + (n.getMonth() - s.getMonth());
  const days = Math.abs(n.getDate() - s.getDate());
  return `${months} เดือน ${days} วัน`;
}

function thaiDate(d: string | null | unknown): string {
  if (!d) return "—";
  try {
    return new Date(d as string).toLocaleDateString("th-TH", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return String(d); }
}

function generatePrintHTML(data: PrintData): string {
  const ev = data.evaluation;
  const scores = [...data.scores].sort((a, b) => a.sort_order - b.sort_order);
  const scoreMap: Record<number, number> = {};
  scores.forEach(s => { scoreMap[s.topic_id] = s.score; });

  const totalScore = Object.values(scoreMap).reduce((a: number, b: number) => a + b, 0);
  const grade   = gradeFromScore(totalScore);
  const passed  = totalScore >= 60;
  const round   = ev.round as number;
  const roundNo = round === 30 ? 1 : round === 60 ? 2 : round === 90 ? 3 : 4;
  const todayTH = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  const rowsHTML = scores.map((t, i) => `
    <tr>
      <td style="text-align:center;width:5%">${i + 1}</td>
      <td style="width:52%">${t.text}</td>
      <td style="text-align:center;width:13%;font-size:9pt">${t.owner === "hr" ? "ฝ่ายบุคคล" : "หัวหน้าแผนก"}</td>
      <td style="text-align:center;width:15%">10</td>
      <td style="text-align:center;width:15%;font-weight:700;font-size:12pt">${scoreMap[t.topic_id] ?? "—"}</td>
    </tr>`).join("");

  const chkRound = (n: number) => n === roundNo ? "☑" : "☐";

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>แบบประเมินผลพนักงาน — ${ev.full_name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 10mm 10mm 10mm 14mm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 3px 6px; vertical-align: middle; }
  .no-border td, .no-border th { border: none; }
  .bg  { background: #d8d8d8; }
  .bg2 { background: #efefef; }
  .bold { font-weight: 700; }
  .center { text-align: center; }
  .right  { text-align: right; }
  .page1 { page-break-after: always; }
  .doc-no { font-family: Arial, sans-serif; font-size: 8pt; text-align: right; white-space: nowrap; }
  .sec-title { background: #c0c8d8; font-weight: 700; text-align: center; padding: 4px; letter-spacing: 0.03em; font-size: 10pt; }
  .watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%,-50%) rotate(-42deg);
    font-size: 88pt; font-weight: 900; color: rgba(180,0,0,0.07); pointer-events: none; z-index: 9999;
    letter-spacing: 0.25em; font-family: Arial, sans-serif; }
  @media screen {
    body { background: #d0d5dc; padding: 0; }
    .print-bar { background: #0038C6; padding: 10px 20px; display: flex; gap: 8px; align-items: center;
      position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    .print-bar span { color: rgba(255,255,255,.8); font-size: 11pt; flex: 1; }
    .btn-print { background: #fff; color: #0038C6; border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 11pt; font-family: 'Sarabun', sans-serif; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .btn-dl { background: #16a34a; color: #fff; border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 11pt; font-family: 'Sarabun', sans-serif; font-weight: 700;
      cursor: pointer; display: flex; align-items: center; gap: 6px; }
    .btn-close { background: rgba(255,255,255,.15); color: #fff; border: 1.5px solid rgba(255,255,255,.4);
      border-radius: 6px; padding: 8px 16px; font-size: 11pt; font-family: 'Sarabun', sans-serif; cursor: pointer; }
    .page-wrap { max-width: 230mm; margin: 20px auto; padding: 0 16px; }
    .paper { background: #fff; width: 210mm; margin: 0 auto 20px; padding: 10mm 10mm 10mm 14mm;
      box-shadow: 0 4px 20px rgba(0,0,0,.18); }
  }
  @media print {
    .print-bar { display: none !important; }
    .paper { padding: 0; box-shadow: none; }
    body { background: #fff; }
  }
</style>
</head>
<body>
${data.is_copy ? '<div class="watermark">COPY</div>' : ""}

<div class="print-bar">
  <span>แบบประเมินผลพนักงาน — ${ev.full_name} &nbsp;|&nbsp; ${data.document_no}</span>
  ${data.is_copy ? '<span style="color:#fde68a;font-size:10pt;background:rgba(0,0,0,.2);padding:2px 8px;border-radius:4px;">COPY #' + data.print_count + '</span>' : ""}
  <button class="btn-dl" onclick="window.print()">💾 ดาวน์โหลด PDF</button>
  <button class="btn-print" onclick="window.print()">🖨️ พิมพ์</button>
  <button class="btn-close" onclick="window.close()">✕ ปิด</button>
</div>

<div class="page-wrap">

<!-- ════════════════ PAGE 1 ════════════════ -->
<div class="paper page1">

  <!-- Header Page 1 -->
  <table class="no-border" style="margin-bottom:5px">
    <tr>
      <td style="width:28%;vertical-align:middle">
        <img src="/logo.png" style="height:52px;object-fit:contain;display:block" alt="CRR Logo">
      </td>
      <td style="width:44%;text-align:center;vertical-align:middle">
        <div style="font-size:13.5pt;font-weight:700;letter-spacing:0.02em">แบบประเมินผลการปฏิบัติงาน</div>
        <div style="font-size:9.5pt;color:#333;margin-top:2px">พนักงานในช่วงทดลองงาน | Probation Evaluation</div>
      </td>
      <td style="width:28%" class="doc-no">
        <strong>${data.document_no}</strong><br>หน้า 1 / 2
      </td>
    </tr>
  </table>
  <div style="border-top:2.5px solid #0038C6;border-bottom:1px solid #aab;margin-bottom:8px"></div>

  <!-- Employee Info -->
  <table class="no-border" style="margin-bottom:6px">
    <tr>
      <td style="width:13%;font-weight:700">ชื่อ-นามสกุล</td>
      <td style="width:37%;border-bottom:1px solid #000">${ev.full_name}</td>
      <td style="width:13%;font-weight:700;padding-left:14px">รหัสพนักงาน</td>
      <td style="width:37%;border-bottom:1px solid #000">${ev.emp_code ?? "—"}</td>
    </tr>
    <tr style="height:7px"></tr>
    <tr>
      <td style="font-weight:700">ตำแหน่ง</td>
      <td style="border-bottom:1px solid #000">${ev.position ?? "—"}</td>
      <td style="font-weight:700;padding-left:14px">แผนก / ฝ่าย</td>
      <td style="border-bottom:1px solid #000">${ev.department_name ?? "—"} / ${ev.division_name ?? "—"}</td>
    </tr>
    <tr style="height:7px"></tr>
    <tr>
      <td style="font-weight:700">วันที่เริ่มงาน</td>
      <td style="border-bottom:1px solid #000">${thaiDate(ev.start_date)}</td>
      <td style="font-weight:700;padding-left:14px">อายุงาน</td>
      <td style="border-bottom:1px solid #000">${workDuration(ev.start_date as string | null)}</td>
    </tr>
  </table>

  <!-- Round -->
  <table style="margin-bottom:6px">
    <tr>
      <td class="bg bold" style="width:22%">รอบการประเมิน</td>
      <td class="center" style="width:19.5%">${chkRound(1)} รอบที่ 1 (30 วัน)</td>
      <td class="center" style="width:19.5%">${chkRound(2)} รอบที่ 2 (60 วัน)</td>
      <td class="center" style="width:19.5%">${chkRound(3)} รอบที่ 3 (90 วัน)</td>
      <td class="center" style="width:19.5%">${chkRound(4)} รอบที่ 4</td>
    </tr>
  </table>

  <!-- Attendance + Training -->
  <table style="margin-bottom:6px">
    <tr>
      <td colspan="2" class="sec-title" style="width:50%">สถิติการมาทำงาน</td>
      <td colspan="2" class="sec-title" style="width:50%">การฝึกอบรม</td>
    </tr>
    <tr>
      <td class="bg2 bold" style="width:25%">ลาป่วย</td>
      <td style="width:25%">……………… วัน</td>
      <td class="bg2 bold" style="width:25%">จำนวนหลักสูตรที่เข้า</td>
      <td style="width:25%">${data.training.course_count} หลักสูตร</td>
    </tr>
    <tr>
      <td class="bg2 bold">ลากิจ</td>
      <td>……………… วัน</td>
      <td class="bg2 bold">ผ่านการอบรม</td>
      <td>${data.training.passed_courses} หลักสูตร</td>
    </tr>
    <tr>
      <td class="bg2 bold">ขาดงาน</td>
      <td>……………… วัน</td>
      <td class="bg2 bold">ชั่วโมงการอบรม</td>
      <td>……………… ชม.</td>
    </tr>
    <tr>
      <td class="bg2 bold">มาสาย</td>
      <td>……………… ครั้ง</td>
      <td colspan="2"></td>
    </tr>
  </table>

  <!-- Scores -->
  <table style="margin-bottom:6px">
    <thead>
      <tr><th colspan="5" class="sec-title">ผลการประเมิน</th></tr>
      <tr class="bg2">
        <th class="center" style="width:5%">ที่</th>
        <th style="width:52%;text-align:left">หัวข้อการประเมิน</th>
        <th class="center" style="width:13%;font-size:9pt">ผู้ประเมิน</th>
        <th class="center" style="width:15%">คะแนนเต็ม</th>
        <th class="center" style="width:15%">คะแนนที่ได้</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHTML}
      <tr style="background:#ebebeb;font-weight:700">
        <td colspan="3" class="right">คะแนนรวม</td>
        <td class="center">${scores.length * 10}</td>
        <td class="center" style="font-size:13pt">${totalScore}</td>
      </tr>
      <tr>
        <td colspan="3" class="right bold">เกรด</td>
        <td colspan="2" class="center" style="font-size:15pt;font-weight:700">${grade}</td>
      </tr>
      <tr>
        <td colspan="3" class="right bold">ผลการประเมิน (Result)</td>
        <td colspan="2" class="center bold" style="font-size:13pt;color:${passed ? "#15803d" : "#dc2626"}">
          ${passed ? "✓ ผ่าน (PASS)" : "✗ ไม่ผ่าน (FAIL)"}
        </td>
      </tr>
    </tbody>
  </table>

  <!-- Suggestion + Decision -->
  <table style="margin-bottom:6px">
    <tr>
      <td class="bg2 bold" style="width:20%;vertical-align:top">ข้อเสนอแนะ / Remark</td>
      <td style="min-height:36px;height:42px">${ev.suggestion ?? ""}</td>
    </tr>
    <tr>
      <td class="bg2 bold">ผลการพิจารณา</td>
      <td class="bold">${ev.decision ?? ""}</td>
    </tr>
  </table>

  <!-- Signatories -->
  <table>
    <tr><td colspan="4" class="sec-title">ลายมือชื่อผู้เกี่ยวข้อง</td></tr>
    <tr style="height:44px">
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:4px">
        <div style="border-top:1px solid #000;margin:0 8px;padding-top:5px">${ev.signer_employee ?? ""}</div>
        <div style="font-size:9pt;margin-top:2px">พนักงานผู้รับการประเมิน</div>
        <div style="font-size:8.5pt;color:#555">วันที่ ……/……/………</div>
      </td>
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:5px">
        <div style="border-top:1px solid #000;margin:0 8px;padding-top:5px">${ev.signer_head ?? ""}</div>
        <div style="font-size:9pt;margin-top:2px">หัวหน้าแผนก</div>
        <div style="font-size:8.5pt;color:#555">วันที่ ……/……/………</div>
      </td>
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:5px">
        <div style="border-top:1px solid #000;margin:0 8px;padding-top:5px">${ev.signer_hr ?? ""}</div>
        <div style="font-size:9pt;margin-top:2px">ฝ่ายทรัพยากรบุคคล</div>
        <div style="font-size:8.5pt;color:#555">วันที่ ……/……/………</div>
      </td>
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:5px">
        <div style="border-top:1px solid #000;margin:0 8px;padding-top:5px">${ev.signer_director ?? ""}</div>
        <div style="font-size:9pt;margin-top:2px">รองผู้อำนวยการ</div>
        <div style="font-size:8.5pt;color:#555">วันที่ ……/……/………</div>
      </td>
    </tr>
  </table>

</div><!-- /page1 -->

<!-- ════════════════ PAGE 2 ════════════════ -->
<div class="paper">

  <!-- Header Page 2 -->
  <table class="no-border" style="margin-bottom:5px">
    <tr>
      <td style="width:28%;vertical-align:middle">
        <img src="/logo.png" style="height:52px;object-fit:contain;display:block" alt="CRR Logo">
      </td>
      <td style="width:44%;text-align:center;vertical-align:middle">
        <div style="font-size:13pt;font-weight:700;letter-spacing:0.02em">คำชี้แจงและเกณฑ์การประเมิน</div>
        <div style="font-size:9.5pt;color:#333;margin-top:2px">Evaluation Criteria &amp; Guidelines</div>
      </td>
      <td style="width:28%" class="doc-no">
        <strong>${data.document_no}</strong><br>หน้า 2 / 2
      </td>
    </tr>
  </table>
  <div style="border-top:2.5px solid #0038C6;border-bottom:1px solid #aab;margin-bottom:8px"></div>

  <!-- Instructions -->
  <div class="sec-title" style="margin-bottom:6px">คำชี้แจงการประเมิน</div>
  <ol style="padding-left:22px;margin-bottom:12px;line-height:1.9">
    <li>แบบประเมินฉบับนี้ใช้สำหรับประเมินผลพนักงานในช่วงทดลองงานทุก 30 วัน (รอบที่ 1, 2 และ 3)</li>
    <li>ผู้ประเมินหัวข้อที่ 1–7 คือ <strong>หัวหน้าแผนก</strong> &nbsp;| &nbsp;ผู้ประเมินหัวข้อที่ 8–10 คือ <strong>ฝ่ายทรัพยากรบุคคล</strong></li>
    <li>การให้คะแนนแต่ละหัวข้อกำหนดช่วง <strong>0 – 10 คะแนน</strong></li>
    <li>คะแนนรวมสูงสุด <strong>100 คะแนน</strong> (10 หัวข้อ × 10 คะแนน)</li>
    <li>หัวหน้าแผนกต้องแจ้งผลการประเมินให้พนักงานรับทราบก่อนลงนามทุกครั้ง</li>
    <li>เอกสารฉบับนี้ถือเป็นความลับ ห้ามเผยแพร่โดยไม่ได้รับอนุญาต</li>
  </ol>

  <!-- Score criteria -->
  <div class="sec-title" style="margin-bottom:6px">เกณฑ์การให้คะแนนรายหัวข้อ (0 – 10 คะแนน)</div>
  <table style="margin-bottom:6px">
    <tr class="bg2">
      <th class="center" style="width:18%">ช่วงคะแนน</th>
      <th class="center" style="width:30%">ระดับ</th>
      <th>คำอธิบาย</th>
    </tr>
    <tr>
      <td class="center bold">9 – 10</td>
      <td class="center">ดีเยี่ยม (Excellent)</td>
      <td>ปฏิบัติงานได้ดีเยี่ยม เกินความคาดหวัง</td>
    </tr>
    <tr class="bg2">
      <td class="center bold">7 – 8</td>
      <td class="center">ดีมาก (Very Good)</td>
      <td>ปฏิบัติงานได้ดีมาก เกินมาตรฐานที่กำหนด</td>
    </tr>
    <tr>
      <td class="center bold">5 – 6</td>
      <td class="center">ดี (Good)</td>
      <td>ปฏิบัติงานได้ตามมาตรฐานที่กำหนด</td>
    </tr>
    <tr class="bg2">
      <td class="center bold">3 – 4</td>
      <td class="center">พอใช้ (Fair)</td>
      <td>ปฏิบัติงานได้บางส่วน ต้องการการชี้แนะ</td>
    </tr>
    <tr>
      <td class="center bold">1 – 2</td>
      <td class="center">ต้องปรับปรุง (Poor)</td>
      <td>ปฏิบัติงานได้น้อย ต้องการการกำกับดูแลอย่างใกล้ชิด</td>
    </tr>
    <tr class="bg2">
      <td class="center bold">0</td>
      <td class="center">ไม่ยอมรับ (Unacceptable)</td>
      <td>ไม่ปฏิบัติงาน หรือปฏิบัติงานไม่ได้เลย</td>
    </tr>
  </table>

  <!-- Grade criteria -->
  <div class="sec-title" style="margin-bottom:6px">เกณฑ์ผลการประเมิน (เกรดรวม)</div>
  <table style="margin-bottom:6px">
    <tr class="bg2">
      <th class="center" style="width:10%">เกรด</th>
      <th class="center" style="width:22%">คะแนนรวม</th>
      <th class="center" style="width:18%">ผล</th>
      <th>การดำเนินการ</th>
    </tr>
    <tr>
      <td class="center bold" style="font-size:14pt">A</td>
      <td class="center">90 – 100</td>
      <td class="center bold" style="color:#15803d">✓ ผ่าน</td>
      <td>บรรจุเป็นพนักงานประจำ (ดีเยี่ยม)</td>
    </tr>
    <tr class="bg2">
      <td class="center bold" style="font-size:14pt">B</td>
      <td class="center">80 – 89</td>
      <td class="center bold" style="color:#15803d">✓ ผ่าน</td>
      <td>บรรจุเป็นพนักงานประจำ (ดีมาก)</td>
    </tr>
    <tr>
      <td class="center bold" style="font-size:14pt">C</td>
      <td class="center">70 – 79</td>
      <td class="center bold" style="color:#15803d">✓ ผ่าน</td>
      <td>บรรจุเป็นพนักงานประจำ (ดี)</td>
    </tr>
    <tr class="bg2">
      <td class="center bold" style="font-size:14pt">D</td>
      <td class="center">60 – 69</td>
      <td class="center bold" style="color:#15803d">✓ ผ่าน</td>
      <td>บรรจุเป็นพนักงานประจำ (พอใช้)</td>
    </tr>
    <tr>
      <td class="center bold" style="font-size:14pt;color:#dc2626">E</td>
      <td class="center">50 – 59</td>
      <td class="center bold" style="color:#dc2626">✗ ไม่ผ่าน</td>
      <td>ทดลองงานต่อในรอบถัดไป หรือพิจารณายุติการจ้างงาน</td>
    </tr>
    <tr class="bg2">
      <td class="center bold" style="font-size:14pt;color:#dc2626">F</td>
      <td class="center">ต่ำกว่า 50</td>
      <td class="center bold" style="color:#dc2626">✗ ไม่ผ่าน</td>
      <td>ยุติการจ้างงานทันที</td>
    </tr>
  </table>

  <!-- Important note -->
  <div style="border:2px solid #b91c1c;border-radius:4px;padding:9px 14px;background:#fff8f8;margin-bottom:10px">
    <div class="bold" style="color:#b91c1c;margin-bottom:5px">⚠️ หมายเหตุสำคัญ</div>
    <ul style="padding-left:18px;line-height:1.85">
      <li>พนักงานที่มีคะแนนรวม <strong>ต่ำกว่า 60 คะแนน (เกรดต่ำกว่า D)</strong> ถือว่า <strong>ไม่ผ่านการทดลองงาน</strong></li>
      <li>สำเนาเอกสารเก็บที่ฝ่ายทรัพยากรบุคคล 1 ชุด และมอบพนักงาน 1 ชุด</li>
      <li>กรณีพิมพ์ซ้ำ เอกสารจะแสดงตราประทับ <strong>COPY</strong> และใช้เลขที่เดิม</li>
    </ul>
  </div>

  <!-- Footer -->
  <div style="border-top:1.5px solid #000;padding-top:6px;display:flex;justify-content:space-between;font-size:8.5pt;color:#444">
    <span>พิมพ์โดย: ${data.printed_by_name} &nbsp;|&nbsp; วันที่พิมพ์: ${todayTH}</span>
    <span>${data.document_no}</span>
  </div>

</div><!-- /page2 -->
</div><!-- /page-wrap -->
</body>
</html>`;
}

export default function PrintEvalModal({ evalId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  async function handlePrint() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/eval/print/${evalId}`, { method: "POST" });
      const d = await r.json() as PrintData;
      if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }

      const html = generatePrintHTML(d);
      const win  = window.open("", "_blank", "width=900,height=1100,scrollbars=yes");
      if (!win) { setError("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup"); return; }
      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 440,
        boxShadow: "0 24px 60px rgba(0,56,198,.25)", border: "1px solid #c4cfee",
        borderTop: "4px solid #0038C6", padding: "28px 28px 24px" }}>

        <div style={{ fontSize: 17, fontWeight: 800, color: "#0a1628", marginBottom: 6 }}>
          🖨️ พิมพ์แบบประเมิน
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
          ระบบจะสร้างเลขที่เอกสาร <strong>FM-HRD-01-04 Rev 02</strong> พร้อม Running Number
          โดยอัตโนมัติ<br />
          หากพิมพ์ซ้ำจะใช้เลขที่เดิมและแสดงตราประทับ <strong>COPY</strong>
        </div>

        <div style={{ background: "#f0f5ff", borderRadius: 8, padding: "12px 16px",
          fontSize: 12, color: "#475569", marginBottom: 20, lineHeight: 1.75 }}>
          <div style={{ fontWeight: 700, color: "#0038C6", marginBottom: 4 }}>รายละเอียดเอกสาร</div>
          <div>📄 รหัสฟอร์ม: FM-HRD-01-04 Rev 02</div>
          <div>📋 รูปแบบ: A4 แนวตั้ง · 2 หน้า (รองรับพิมพ์หน้า-หลัง)</div>
          <div>🔢 Running Number: สร้างอัตโนมัติ (รีเซ็ตทุกปี)</div>
          <div>📊 Audit log: บันทึกทุกครั้งที่พิมพ์</div>
        </div>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 7,
            padding: "10px 14px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={loading}
            style={{ flex: 1, padding: "12px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
              background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#475569" }}>
            ยกเลิก
          </button>
          <button onClick={handlePrint} disabled={loading}
            style={{ flex: 2, padding: "12px 0", borderRadius: 7, border: "none",
              background: loading ? "#94a3b8" : "#0038C6", color: "#fff", fontWeight: 700,
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {loading ? "กำลังเตรียมเอกสาร…" : "🖨️ เปิดหน้าต่างพิมพ์"}
          </button>
        </div>
      </div>
    </div>
  );
}
