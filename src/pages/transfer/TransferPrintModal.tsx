import { useEffect, useState } from "react";

interface TRequest {
  id: number; name: string; position: string | null; reason: string | null; new_position: string | null;
  from_dept_name: string | null; to_dept_name: string | null;
  from_division_name: string | null; to_division_name: string | null;
  overall_status: string; created_at: string; requester_user_id: number | null; requester_name: string | null;
}
interface Approval { step: string; status: string; note: string | null; created_at: string; approver_name: string; }
interface Requester { full_name: string; role_title: string | null; }
interface Signers { source_head_name: string; dest_head_name: string; deputyhr_name: string; }
interface PrintData {
  ok: boolean; error?: string;
  document_no: string; print_count: number; is_copy: boolean; printed_by_name: string;
  request: TRequest; approvals: Approval[]; requester: Requester | null; signers: Signers;
}
interface Overrides {
  name: string; position: string; from_dept_name: string; to_dept_name: string;
  new_position: string; reason: string;
  source_head_name: string; dest_head_name: string; deputyhr_name: string;
}
interface Props { requestId: number; onClose: () => void; }

function thaiDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
  } catch { return String(d); }
}

function generatePrintHTML(data: PrintData): string {
  const req = data.request;
  const s = data.signers;
  const todayTH = new Date().toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>แบบคำขอย้ายแผนก — ${req.name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 10mm 10mm 10mm 14mm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', Arial, sans-serif; font-size: 10.5pt; color: #000; background: #fff; line-height: 1.45; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #333; padding: 5px 8px; vertical-align: middle; }
  .no-border td, .no-border th { border: none; }
  .center { text-align: center; }
  .doc-no { font-family: Arial, sans-serif; font-size: 8pt; text-align: right; white-space: nowrap; }
  .sec-title { background: #c0c8d8; font-weight: 700; text-align: center; padding: 5px; font-size: 10.5pt; }
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
  <span>แบบคำขอย้ายแผนก — ${req.name} &nbsp;|&nbsp; ${data.document_no}</span>
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
        <div style="font-size:13.5pt;font-weight:700">แบบคำขอย้ายแผนก / ตำแหน่ง</div>
        <div style="font-size:9.5pt;color:#333;margin-top:2px">Department Transfer Request</div>
      </td>
      <td style="width:28%" class="doc-no">
        <strong>${data.document_no}</strong>
      </td>
    </tr>
  </table>
  <div style="border-top:2.5px solid #0038C6;border-bottom:1px solid #aab;margin-bottom:14px"></div>

  <table class="no-border" style="margin-bottom:16px">
    <tr>
      <td style="width:20%;font-weight:700">ชื่อ-นามสกุล</td>
      <td style="width:80%;border-bottom:1px solid #000">${req.name}</td>
    </tr>
    <tr style="height:10px"></tr>
    <tr>
      <td style="font-weight:700">ตำแหน่งปัจจุบัน</td>
      <td style="border-bottom:1px solid #000">${req.position ?? "—"}</td>
    </tr>
    <tr style="height:10px"></tr>
    <tr>
      <td style="font-weight:700">แผนก/ฝ่ายต้นทาง</td>
      <td style="border-bottom:1px solid #000">${req.from_dept_name ?? "—"} / ${req.from_division_name ?? "—"}</td>
    </tr>
    <tr style="height:10px"></tr>
    <tr>
      <td style="font-weight:700">แผนก/ฝ่ายปลายทาง</td>
      <td style="border-bottom:1px solid #000">${req.to_dept_name ?? "—"} / ${req.to_division_name ?? "—"}</td>
    </tr>
    <tr style="height:10px"></tr>
    <tr>
      <td style="font-weight:700">ตำแหน่งใหม่</td>
      <td style="border-bottom:1px solid #000">${req.new_position ?? "—"}</td>
    </tr>
    <tr style="height:10px"></tr>
    <tr>
      <td style="font-weight:700;vertical-align:top">เหตุผล</td>
      <td style="border-bottom:1px solid #000">${req.reason ?? "—"}</td>
    </tr>
    <tr style="height:10px"></tr>
    <tr>
      <td style="font-weight:700">วันที่ยื่นคำขอ</td>
      <td style="border-bottom:1px solid #000">${thaiDate(req.created_at)}</td>
    </tr>
  </table>

  <table>
    <tr><td colspan="4" class="sec-title">ลายมือชื่อ</td></tr>
    <tr style="height:110px">
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:4px">
        <div style="border-top:1px solid #000;margin:0 6px;padding-top:5px">${req.name}</div>
        <div style="font-size:9pt;margin-top:2px">พนักงานผู้ขอย้าย</div>
        <div style="font-size:8.5pt;color:#555">(รับทราบผลการพิจารณา)</div>
        <div style="font-size:8.5pt;color:#555;margin-top:2px">วันที่ ……/……/………</div>
      </td>
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:4px">
        <div style="border-top:1px solid #000;margin:0 6px;padding-top:5px">${s.source_head_name || "……………………………"}</div>
        <div style="font-size:9pt;margin-top:2px">หัวหน้าแผนกต้นทาง</div>
        <div style="font-size:8.5pt;color:#555;margin-top:2px">วันที่ ……/……/………</div>
      </td>
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:4px">
        <div style="border-top:1px solid #000;margin:0 6px;padding-top:5px">${s.dest_head_name || "……………………………"}</div>
        <div style="font-size:9pt;margin-top:2px">หัวหน้าแผนกปลายทาง</div>
        <div style="font-size:8.5pt;color:#555;margin-top:2px">วันที่ ……/……/………</div>
      </td>
      <td class="center" style="width:25%;vertical-align:bottom;padding-bottom:4px">
        <div style="border-top:1px solid #000;margin:0 6px;padding-top:5px">${s.deputyhr_name || "……………………………"}</div>
        <div style="font-size:9pt;margin-top:2px">รองผู้อำนวยการฝ่ายบริหารค่าตอบแทนฯ</div>
        <div style="font-size:8.5pt;color:#555;margin-top:2px">วันที่ ……/……/………</div>
      </td>
    </tr>
  </table>

  <div style="border-top:1.5px solid #000;padding-top:6px;margin-top:14px;display:flex;justify-content:space-between;font-size:8.5pt;color:#444">
    <span>พิมพ์โดย: ${data.printed_by_name} &nbsp;|&nbsp; วันที่พิมพ์: ${todayTH}</span>
    <span>${data.document_no}</span>
  </div>

</div>
</div>
</body>
</html>`;
}

export default function TransferPrintModal({ requestId, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState("");
  const [ov, setOv] = useState<Overrides | null>(null);

  useEffect(() => {
    fetch(`/api/transfer/requests/${requestId}`).then(r => r.json())
      .then((d: { ok: boolean; error?: string; request: TRequest; approvals: Approval[] }) => {
        if (!d.ok) { setError(d.error ?? "โหลดข้อมูลไม่สำเร็จ"); return; }
        const destHead = (d.approvals ?? []).find(a => a.step === "dest_head" && a.status === "approved")?.approver_name;
        const deputyHR = (d.approvals ?? []).find(a => a.step === "deputyhr" && a.status === "approved")?.approver_name;
        setOv({
          name: d.request.name, position: d.request.position ?? "",
          from_dept_name: d.request.from_dept_name ?? "", to_dept_name: d.request.to_dept_name ?? "",
          new_position: d.request.new_position ?? "", reason: d.request.reason ?? "",
          source_head_name: d.request.requester_name ?? "", dest_head_name: destHead ?? "", deputyhr_name: deputyHR ?? "",
        });
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
      .finally(() => setLoading(false));
  }, [requestId]);

  function set<K extends keyof Overrides>(key: K, value: string) {
    setOv(o => o ? { ...o, [key]: value } : o);
  }

  async function handlePrint() {
    if (!ov) return;
    setPrinting(true); setError("");
    try {
      const r = await fetch(`/api/transfer/requests/${requestId}/print`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overrides: ov }),
      });
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
      setPrinting(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #c4cfee",
    fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: "#334155", display: "block", marginBottom: 4 };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
      <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,56,198,.25)", border: "1px solid #c4cfee",
        borderTop: "4px solid #0038C6", padding: "28px 28px 24px" }}>

        <div style={{ fontSize: 17, fontWeight: 800, color: "#0a1628", marginBottom: 6 }}>
          🖨️ ตรวจสอบและแก้ไขก่อนพิมพ์
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 18, lineHeight: 1.6 }}>
          แก้ไขข้อมูลด้านล่างได้ก่อนพิมพ์ (ไม่กระทบข้อมูลคำขอที่บันทึกไว้จริง) —
          หากพิมพ์ซ้ำจะใช้เลขที่เดิมและแสดงตราประทับ <strong>COPY</strong>
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>กำลังโหลด…</div>
        ) : !ov ? (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
            padding: "12px 16px", fontSize: 13, color: "#dc2626" }}>{error || "โหลดข้อมูลไม่สำเร็จ"}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={label}>ชื่อ-นามสกุล</label>
              <input style={inp} value={ov.name} onChange={e => set("name", e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>ตำแหน่งปัจจุบัน</label>
                <input style={inp} value={ov.position} onChange={e => set("position", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>ตำแหน่งใหม่</label>
                <input style={inp} value={ov.new_position} onChange={e => set("new_position", e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={label}>แผนกต้นทาง</label>
                <input style={inp} value={ov.from_dept_name} onChange={e => set("from_dept_name", e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={label}>แผนกปลายทาง</label>
                <input style={inp} value={ov.to_dept_name} onChange={e => set("to_dept_name", e.target.value)} />
              </div>
            </div>
            <div>
              <label style={label}>เหตุผล</label>
              <textarea style={{ ...inp, resize: "vertical" }} rows={2} value={ov.reason} onChange={e => set("reason", e.target.value)} />
            </div>

            <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0038C6", marginBottom: 10 }}>ชื่อผู้ลงนาม (แก้ไขได้หากไม่ตรง)</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <label style={label}>หัวหน้าแผนกต้นทาง</label>
                  <input style={inp} value={ov.source_head_name} onChange={e => set("source_head_name", e.target.value)}
                    placeholder="ระบุชื่อ…" />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={label}>หัวหน้าแผนกปลายทาง</label>
                  <input style={inp} value={ov.dest_head_name} onChange={e => set("dest_head_name", e.target.value)}
                    placeholder="ระบุชื่อ…" />
                </div>
              </div>
              <div>
                <label style={label}>รองผู้อำนวยการฝ่ายบริหารค่าตอบแทนฯ</label>
                <input style={inp} value={ov.deputyhr_name} onChange={e => set("deputyhr_name", e.target.value)}
                  placeholder="ระบุชื่อ…" />
              </div>
            </div>
          </div>
        )}

        {error && ov && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 7,
            padding: "10px 14px", fontSize: 12, color: "#dc2626", marginTop: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={printing}
            style={{ flex: 1, padding: "12px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
              background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#475569" }}>
            ยกเลิก
          </button>
          <button onClick={handlePrint} disabled={printing || loading || !ov}
            style={{ flex: 2, padding: "12px 0", borderRadius: 7, border: "none",
              background: printing || loading || !ov ? "#94a3b8" : "#0038C6", color: "#fff", fontWeight: 700,
              cursor: printing || loading || !ov ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13 }}>
            {printing ? "กำลังเตรียมเอกสาร…" : "🖨️ เปิดหน้าต่างพิมพ์"}
          </button>
        </div>
      </div>
    </div>
  );
}
