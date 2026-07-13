import { useState } from "react";

interface Category { id: number; name: string; weight_points: number; rater_roles_json: string; sort_order: number; }
interface Item { id: number; category_id: number; text: string; sort_order: number; }
interface ScoreRow { item_id: number; rater_role: string; score: number | null; reason: string | null; created_by: string | null; }
interface Stats {
  period_start: string | null; period_end: string | null; sick_leave_days: number; personal_leave_days: number;
  vacation_leave_days: number; late_minutes: number; training_count: number;
  hospital_activity_count: number; committee_count: number; warning_count: number;
}
interface Comment { source: string; item_order: number; text: string; }
interface CategoryBreakdown { category_id: number; raw_by_rater: Record<string, number>; category_raw: number; category_weighted: number; }
interface ScoreResult { total_raw_score: number; total_weighted_score: number; total_percent: number; grade: string; category_breakdown: CategoryBreakdown[]; }
interface PrintData {
  ok: boolean; error?: string;
  document_no: string; print_count: number; is_copy: boolean; printed_by_name: string;
  evaluation: Record<string, unknown>;
  template: { level_group: string; label: string };
  categories: Category[]; items: Item[]; scores: ScoreRow[]; stats: Stats | null;
  comments: Comment[]; score_result: ScoreResult;
}
interface Props { evalId: number; onClose: () => void; }

const RATER_LABEL: Record<string, string> = {
  head: "หัวหน้าแผนก", deputy: "รองผู้อำนวยการฝ่าย", quality_head: "หัวหน้าส่วนงานคุณภาพ",
  hr: "ฝ่ายบุคคล", director: "ผู้อำนวยการ/ผู้ได้รับมอบหมาย",
};
const COMMENT_LABEL: Record<string, string> = {
  head_strength: "จุดแข็ง (หัวหน้าแผนก)", head_development: "สิ่งที่ต้องพัฒนา (หัวหน้าแผนก)",
  deputy_strength: "จุดแข็ง (รองผู้อำนวยการฝ่าย)", deputy_development: "สิ่งที่ต้องพัฒนา (รองผู้อำนวยการฝ่าย)",
  director_comment: "ความคิดเห็นผู้อำนวยการ", hr_comment: "ความเห็นเพิ่มเติมจาก HR",
  next_year_kpi: "ตัวชี้วัดการปฏิบัติงานหลัก/ผลงานที่คาดหวังปีถัดไป", dev_plan: "แผนพัฒนารายบุคคล",
  training_recommend: "หลักสูตรที่ควรเข้ารับการอบรม",
};

function thaiDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  } catch { return String(d); }
}

function generatePrintHTML(data: PrintData): string {
  const ev = data.evaluation;
  const cats = [...data.categories].sort((a, b) => a.sort_order - b.sort_order);
  const items = data.items;
  const scoreByItemRater = new Map<string, ScoreRow>();
  for (const s of data.scores) scoreByItemRater.set(`${s.item_id}:${s.rater_role}`, s);
  const breakdownByCategory = new Map(data.score_result.category_breakdown.map(b => [b.category_id, b]));

  const raterNames = new Map<string, string>();
  for (const s of data.scores) if (s.created_by && !raterNames.has(s.rater_role)) raterNames.set(s.rater_role, s.created_by);

  const categoryTables = cats.map(cat => {
    const raters = JSON.parse(cat.rater_roles_json) as string[];
    const catItems = items.filter(i => i.category_id === cat.id).sort((a, b) => a.sort_order - b.sort_order);
    const breakdown = breakdownByCategory.get(cat.id);
    const itemRows = catItems.map(item => `
      <tr>
        <td style="text-align:left">${item.text}</td>
        ${raters.map(r => {
          const s = scoreByItemRater.get(`${item.id}:${r}`);
          return `<td class="center">${s?.score ?? "—"}</td>`;
        }).join("")}
      </tr>`).join("");
    const subtotalCells = raters.map(r => `<td class="center bold">${breakdown?.raw_by_rater[r] ?? "—"}</td>`).join("");
    return `
      <table style="margin-bottom:6px">
        <thead>
          <tr><th colspan="${raters.length + 1}" class="sec-title">${cat.name} (น้ำหนัก ${cat.weight_points})</th></tr>
          <tr class="bg2">
            <th style="text-align:left">หัวข้อการประเมิน</th>
            ${raters.map(r => `<th class="center">${RATER_LABEL[r] ?? r}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${itemRows}
          <tr style="background:#ebebeb">
            <td class="right bold">รวมคะแนนดิบ</td>
            ${subtotalCells}
          </tr>
        </tbody>
      </table>
      <div style="text-align:right;font-size:9.5pt;margin-bottom:10px">
        คะแนนหลังถ่วงน้ำหนัก: <strong>${breakdown ? Math.round(breakdown.category_weighted * 100) / 100 : "—"}</strong> / ${cat.weight_points}
      </div>`;
  }).join("");

  const statsRows = data.stats ? `
    <tr><td>ลาป่วย</td><td class="center">${data.stats.sick_leave_days} วัน</td></tr>
    <tr class="bg2"><td>ลากิจ</td><td class="center">${data.stats.personal_leave_days} วัน</td></tr>
    <tr><td>ลาพักผ่อน</td><td class="center">${data.stats.vacation_leave_days} วัน</td></tr>
    <tr class="bg2"><td>มาสาย</td><td class="center">${data.stats.late_minutes} นาที</td></tr>
    <tr><td>จำนวนหลักสูตรอบรม</td><td class="center">${data.stats.training_count}</td></tr>
    <tr class="bg2"><td>กิจกรรมโรงพยาบาล</td><td class="center">${data.stats.hospital_activity_count}</td></tr>
    <tr><td>คณะกรรมการ</td><td class="center">${data.stats.committee_count}</td></tr>
    <tr class="bg2"><td>ใบเตือน</td><td class="center">${data.stats.warning_count}</td></tr>
  ` : `<tr><td colspan="2" class="center" style="color:#888">ไม่มีข้อมูล</td></tr>`;

  const commentBlocks = Object.entries(COMMENT_LABEL).map(([source, label]) => {
    const list = data.comments.filter(c => c.source === source).sort((a, b) => a.item_order - b.item_order);
    if (list.length === 0) return "";
    return `
      <div style="margin-bottom:8px">
        <div class="bold" style="font-size:9.5pt">${label}</div>
        <ul style="padding-left:18px;margin:2px 0">
          ${list.map(c => `<li>${c.text}</li>`).join("")}
        </ul>
      </div>`;
  }).join("");

  const signerRoles = [...new Set(cats.flatMap(c => JSON.parse(c.rater_roles_json) as string[]))];
  const signatureBoxes = [
    { label: "ผู้รับการประเมิน", name: "" },
    ...signerRoles.map(r => ({
      label: RATER_LABEL[r] ?? r,
      name: raterNames.get(r) ?? (r === "head" ? String(ev.snap_department_head ?? "") : r === "deputy" ? String(ev.snap_deputy_director ?? "") : ""),
    })),
    { label: "ผู้จัดการฝ่ายบุคคล", name: "" },
  ];
  const sigBoxesHTML = signatureBoxes.map(b => `
    <td class="center" style="width:${Math.floor(100 / signatureBoxes.length)}%;vertical-align:bottom;padding-bottom:4px">
      <div style="border-top:1px solid #000;margin:0 8px;padding-top:5px">${b.name}</div>
      <div style="font-size:9pt;margin-top:2px">${b.label}</div>
      <div style="font-size:8.5pt;color:#555">วันที่ ……/……/………</div>
    </td>`).join("");

  const todayTH = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>แบบประเมินผลการปฏิบัติงานประจำปี — ${ev.snap_full_name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 10mm 10mm 10mm 14mm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; line-height: 1.4; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 3px 6px; vertical-align: middle; }
  .no-border td, .no-border th { border: none; }
  .bg2 { background: #efefef; }
  .bold { font-weight: 700; }
  .center { text-align: center; }
  .right { text-align: right; }
  .doc-no { font-family: Arial, sans-serif; font-size: 8pt; text-align: right; white-space: nowrap; }
  .sec-title { background: #c0c8d8; font-weight: 700; text-align: center; padding: 4px; font-size: 10pt; }
  .watermark { position: fixed; top: 45%; left: 50%; transform: translate(-50%,-50%) rotate(-42deg);
    font-size: 88pt; font-weight: 900; color: rgba(180,0,0,0.07); pointer-events: none; z-index: 9999;
    letter-spacing: 0.25em; font-family: Arial, sans-serif; }
  @media screen {
    body { background: #d0d5dc; }
    .print-bar { background: #0038C6; padding: 10px 20px; display: flex; gap: 8px; align-items: center;
      position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    .print-bar span { color: rgba(255,255,255,.8); font-size: 11pt; flex: 1; }
    .btn-print { background: #fff; color: #0038C6; border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 11pt; font-family: 'Sarabun', sans-serif; font-weight: 700; cursor: pointer; }
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
  <span>แบบประเมินผลการปฏิบัติงานประจำปี — ${ev.snap_full_name} &nbsp;|&nbsp; ${data.document_no}</span>
  <button class="btn-print" onclick="window.print()">🖨️ พิมพ์</button>
  <button class="btn-close" onclick="window.close()">✕ ปิด</button>
</div>

<div class="page-wrap">
<div class="paper">

  <table class="no-border" style="margin-bottom:5px">
    <tr>
      <td style="width:28%;vertical-align:middle">
        <img src="/logo.png" style="height:52px;object-fit:contain;display:block" alt="CRR Logo">
      </td>
      <td style="width:44%;text-align:center;vertical-align:middle">
        <div style="font-size:13.5pt;font-weight:700">แบบประเมินผลการปฏิบัติงานประจำปี</div>
        <div style="font-size:9.5pt;color:#333;margin-top:2px">${ev.round_name} (พ.ศ. ${ev.year_be})</div>
      </td>
      <td style="width:28%" class="doc-no">
        <strong>${data.document_no}</strong>
      </td>
    </tr>
  </table>
  <div style="border-top:2.5px solid #0038C6;border-bottom:1px solid #aab;margin-bottom:8px"></div>

  <table class="no-border" style="margin-bottom:6px">
    <tr>
      <td style="width:13%;font-weight:700">ชื่อ-นามสกุล</td>
      <td style="width:37%;border-bottom:1px solid #000">${ev.snap_full_name}</td>
      <td style="width:13%;font-weight:700;padding-left:14px">รหัสพนักงาน</td>
      <td style="width:37%;border-bottom:1px solid #000">${ev.snap_emp_code ?? "—"}</td>
    </tr>
    <tr style="height:7px"></tr>
    <tr>
      <td style="font-weight:700">ตำแหน่ง</td>
      <td style="border-bottom:1px solid #000">${ev.snap_position ?? "—"}</td>
      <td style="font-weight:700;padding-left:14px">แผนก / ฝ่าย</td>
      <td style="border-bottom:1px solid #000">${ev.snap_department ?? "—"} / ${ev.snap_division ?? "—"}</td>
    </tr>
    <tr style="height:7px"></tr>
    <tr>
      <td style="font-weight:700">ระดับพนักงาน</td>
      <td style="border-bottom:1px solid #000">ระดับ ${ev.snap_job_level}</td>
      <td style="font-weight:700;padding-left:14px">วันที่สรุปผล</td>
      <td style="border-bottom:1px solid #000">${thaiDate(ev.completed_at as string)}</td>
    </tr>
  </table>

  ${categoryTables}

  <table style="margin-bottom:10px">
    <tr class="bg2">
      <th class="center">คะแนนดิบรวม</th>
      <th class="center">คะแนนหลังถ่วงน้ำหนัก (เต็ม 20)</th>
      <th class="center">คิดเป็นร้อยละ</th>
      <th class="center">เกรด</th>
    </tr>
    <tr>
      <td class="center">${data.score_result.total_raw_score}</td>
      <td class="center bold" style="font-size:13pt">${data.score_result.total_weighted_score}</td>
      <td class="center">${data.score_result.total_percent}%</td>
      <td class="center bold" style="font-size:15pt">${data.score_result.grade}</td>
    </tr>
  </table>

  <table style="margin-bottom:10px">
    <tr><th colspan="2" class="sec-title">สถิติการปฏิบัติงาน</th></tr>
    ${statsRows}
  </table>

  ${commentBlocks ? `<div style="margin-bottom:10px">${commentBlocks}</div>` : ""}

  <table>
    <tr><td colspan="${signatureBoxes.length}" class="sec-title">ลายมือชื่อผู้เกี่ยวข้อง</td></tr>
    <tr style="height:80px">${sigBoxesHTML}</tr>
  </table>

  <div style="border-top:1.5px solid #000;padding-top:6px;margin-top:10px;display:flex;justify-content:space-between;font-size:8.5pt;color:#444">
    <span>พิมพ์โดย: ${data.printed_by_name} &nbsp;|&nbsp; วันที่พิมพ์: ${todayTH}</span>
    <span>${data.document_no}</span>
  </div>

</div>
</div>
</body>
</html>`;
}

export default function AnnualEvalPrintModal({ evalId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handlePrint() {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/annual-eval/evaluations/${evalId}/print`, { method: "POST" });
      const d = await r.json() as PrintData;
      if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }

      const html = generatePrintHTML(d);
      const win = window.open("", "_blank", "width=900,height=1100,scrollbars=yes");
      if (!win) { setError("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup"); return; }
      win.document.open();
      win.document.write(html);
      win.document.close();
      onClose();
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
          🖨️ พิมพ์แบบประเมินประจำปี
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 20, lineHeight: 1.6 }}>
          ระบบจะสร้างเลขที่เอกสาร <strong>FM-HR-01-28</strong> พร้อม Running Number
          โดยอัตโนมัติ (แยกจากเลขที่ของแบบประเมินทดลองงาน)<br />
          หากพิมพ์ซ้ำจะใช้เลขที่เดิมและแสดงตราประทับ <strong>COPY</strong>
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
              cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13 }}>
            {loading ? "กำลังเตรียมเอกสาร…" : "🖨️ เปิดหน้าต่างพิมพ์"}
          </button>
        </div>
      </div>
    </div>
  );
}
