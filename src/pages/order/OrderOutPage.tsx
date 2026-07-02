import { useState } from "react";
import PageLayout from "../../components/PageLayout";

interface StaffRow { name: string; position: string; }

const THAI_MONTHS = ["", "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"];

function thaiDate(iso: string): string {
  if (!iso) return "……………………………";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${THAI_MONTHS[m] ?? ""} ${y + 543}`;
}

interface OrderData {
  orderNo: string;
  activity: string;
  placeName: string;
  address: string;
  eventDate: string;
  orderDate: string;
  staff: StaffRow[];
}

function generateOrderHTML(d: OrderData): string {
  const staffRows = d.staff
    .filter(s => s.name.trim() || s.position.trim())
    .map((s, i) => `
      <p style="margin:0 0 4px 2.5em;">
        ${i + 1}. <span class="fill">${s.name || "……………………………"}</span>
        &nbsp;&nbsp;ตำแหน่ง&nbsp;&nbsp;<span class="fill">${s.position || "……………………………"}</span>
      </p>`).join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>คำสั่งมอบหมายปฏิบัติงานนอกสถานที่ ${d.orderNo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 14mm 16mm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', Arial, sans-serif; font-size: 15pt; color: #000; background: #fff; line-height: 1.6; }
  .fill { text-decoration: underline; font-weight: 600; }
  .center { text-align: center; }
  .justify { text-align: justify; }
  @media screen {
    body { background: #d0d5dc; padding: 0; }
    .print-bar { background: #0038C6; padding: 10px 20px; display: flex; gap: 8px; align-items: center;
      position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    .print-bar span { color: rgba(255,255,255,.8); font-size: 11pt; flex: 1; font-family: Arial, sans-serif; }
    .btn-print { background: #fff; color: #0038C6; border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 11pt; font-family: 'Sarabun', sans-serif; font-weight: 700;
      cursor: pointer; }
    .btn-close { background: rgba(255,255,255,.15); color: #fff; border: 1.5px solid rgba(255,255,255,.4);
      border-radius: 6px; padding: 8px 16px; font-size: 11pt; font-family: 'Sarabun', sans-serif; cursor: pointer; }
    .page-wrap { max-width: 230mm; margin: 20px auto; padding: 0 16px; }
    .paper { background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto 20px;
      padding: 14mm 16mm; box-shadow: 0 4px 20px rgba(0,0,0,.18); }
  }
  @media print {
    .print-bar { display: none !important; }
    .paper { padding: 0; box-shadow: none; min-height: auto; }
    body { background: #fff; }
  }
</style>
</head>
<body>

<div class="print-bar">
  <span>คำสั่งมอบหมายปฏิบัติงานนอกสถานที่ ${d.orderNo || "(ยังไม่ระบุเลขที่)"}</span>
  <button class="btn-print" onclick="window.print()">🖨️ พิมพ์</button>
  <button class="btn-close" onclick="window.close()">✕ ปิด</button>
</div>

<div class="page-wrap">
<div class="paper">

  <!-- Letterhead -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
    <tr>
      <td style="width:80px;vertical-align:top;padding-right:10px">
        <img src="/logo-nobg.png" style="width:70px;object-fit:contain;display:block" alt="Chiangrai Ram Hospital">
      </td>
      <td style="vertical-align:top;color:#0038C6;font-weight:700;font-size:11pt;line-height:1.5">
        บริษัท วัชรศิริเวช จำกัด (โรงพยาบาลเชียงราย ราม)<br>
        123 ม.26 ถ.พหลโยธิน ต.รอบเวียง อ.เมืองเชียงราย จ.เชียงราย 57000
        โทร: 053-719-719 โทรสาร: 053-719-940<br>
        Website: Chiangrairam.com, E-mail: Info@chiangrairam.com<br>
        เลขประจำตัวผู้เสียภาษี 0575557000289 (สำนักงานใหญ่)
      </td>
    </tr>
  </table>
  <div style="border-top:2px solid #0038C6;margin-bottom:14px"></div>

  <!-- Title -->
  <p class="center" style="font-weight:700;font-size:16pt;margin-bottom:4px">
    คำสั่งมอบหมายปฏิบัติงานนอกสถานที่&nbsp; <span class="fill">${d.orderNo || "……………"}</span>
  </p>
  <p class="center" style="font-weight:700;margin-bottom:4px">เรื่อง แต่งตั้งและมอบหมายหน้าที่ปฏิบัติงานเฉพาะกิจ</p>
  <p class="center fill" style="margin-bottom:16px">ณ ${d.placeName || "……………"} ${d.address || "……………"}</p>

  <!-- Intro paragraph -->
  <p class="justify" style="text-indent:2.5em;margin-bottom:16px">
    ตามที่โรงพยาบาลเชียงราย รามได้มีกำหนดการออกหน่วย<span class="fill">${d.activity || "……………………………"}</span>
    &nbsp;ณ&nbsp;<span class="fill">${d.placeName || "……………………………"}</span>
    &nbsp;<span class="fill">${d.address || "……………………………"}</span>
    &nbsp;วันที่&nbsp;<span class="fill">${d.eventDate}</span>
    &nbsp;ดังนั้นเพื่อให้การดำเนินงานเป็นไปด้วยความถูกต้องมีประสิทธิภาพและเป็นไปด้วยความเรียบร้อย
    จึงมีคำสั่งแต่งตั้งให้พนักงานของโรงพยาบาลฯทำหน้าที่และรับผิดชอบในจุดต่างๆ ดังนี้
  </p>

  <!-- Staff list -->
  <p style="font-weight:700;margin-bottom:6px">ผู้รับผิดชอบ</p>
  ${staffRows || `<p style="margin:0 0 4px 2.5em;color:#888">(ยังไม่ระบุรายชื่อ)</p>`}

  <!-- Order date -->
  <p style="text-indent:2.5em;margin-top:22px">สั่ง ณ วันที่ <span class="fill">${d.orderDate}</span></p>

  <!-- Signature block -->
  <div class="center" style="margin-top:70px">
    <p>ลงชื่อ ……………………………………………………</p>
    <p style="margin-top:8px">(อนุสิกข์&nbsp;&nbsp;ทองแผ่น)</p>
    <p>รักษาการ รองผู้อำนวยการ</p>
    <p>ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ</p>
  </div>

</div>
</div>
</body>
</html>`;
}

export default function OrderOutPage() {
  const [orderNo, setOrderNo]     = useState("");
  const [activity, setActivity]   = useState("");
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress]     = useState("");
  const [eventDate, setEventDate] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [staff, setStaff] = useState<StaffRow[]>([{ name: "", position: "" }]);
  const [popupErr, setPopupErr] = useState("");

  function addRow() { setStaff(s => [...s, { name: "", position: "" }]); }
  function removeRow(i: number) { setStaff(s => s.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: keyof StaffRow, value: string) {
    setStaff(s => s.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function handlePrint() {
    setPopupErr("");
    const html = generateOrderHTML({
      orderNo, activity, placeName, address,
      eventDate: thaiDate(eventDate),
      orderDate: thaiDate(orderDate),
      staff,
    });
    const win = window.open("", "_blank", "width=900,height=1100,scrollbars=yes");
    if (!win) { setPopupErr("ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup สำหรับเว็บไซต์นี้"); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #dce4f5",
    fontFamily: "inherit", fontSize: 13, outline: "none",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12.5, fontWeight: 700, color: "#334155", display: "block", marginBottom: 5,
  };

  return (
    <PageLayout title="คำสั่งออกหน่วย" accent="#0038C6">
      <div style={{ display: "grid", gap: 20, maxWidth: 760 }}>

        <div style={{ background: "#eff6ff", border: "1.5px solid #c4cfee", borderRadius: 10,
          padding: "12px 16px", fontSize: 12.5, color: "#334155", lineHeight: 1.7 }}>
          กรอกข้อมูลด้านล่าง ระบบจะประกอบเป็นคำสั่งมอบหมายปฏิบัติงานนอกสถานที่ตามแบบฟอร์มมาตรฐาน
          แล้วเปิดหน้าต่างสำหรับดูตัวอย่างและพิมพ์ได้ทันที (ช่องที่ยังไม่กรอกจะแสดงเป็นเส้นประในเอกสาร)
        </div>

        {/* ── Order info card ── */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce4f5",
          boxShadow: "0 2px 10px rgba(0,56,198,.05)", padding: "20px 22px" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628", marginBottom: 16 }}>ข้อมูลคำสั่ง</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>เลขที่คำสั่ง</label>
              <input style={inputStyle} placeholder="เช่น 031/2569" value={orderNo} onChange={e => setOrderNo(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>วันที่ปฏิบัติงาน (วันออกหน่วย)</label>
              <input type="date" style={inputStyle} value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>กิจกรรม / ประเภทหน่วยที่ออก</label>
            <input style={inputStyle} placeholder="เช่น ฉีดวัคซีนไข้หวัดใหญ่ 4 สายพันธุ์" value={activity} onChange={e => setActivity(e.target.value)} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>สถานที่ (ชื่อโรงเรียน/หน่วยงาน)</label>
              <input style={inputStyle} placeholder="เช่น โรงเรียนบ้านแม่คำ(ประชานุเคราะห์)" value={placeName} onChange={e => setPlaceName(e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>ที่อยู่ (ตำบล/อำเภอ/จังหวัด)</label>
              <input style={inputStyle} placeholder="เช่น ตำบลแม่คำ อำเภอแม่จัน จังหวัดเชียงราย" value={address} onChange={e => setAddress(e.target.value)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>วันที่ออกคำสั่ง</label>
            <input type="date" style={{ ...inputStyle, maxWidth: 220 }} value={orderDate} onChange={e => setOrderDate(e.target.value)} />
          </div>
        </div>

        {/* ── Staff list card ── */}
        <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce4f5",
          boxShadow: "0 2px 10px rgba(0,56,198,.05)", padding: "20px 22px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628" }}>ผู้รับผิดชอบ</div>
            <button onClick={addRow}
              style={{ padding: "7px 14px", borderRadius: 8, border: "1.5px solid #c4cfee",
                background: "#eff6ff", color: "#0038C6", fontWeight: 700, fontSize: 12.5,
                cursor: "pointer", fontFamily: "inherit" }}>
              + เพิ่มรายชื่อ
            </button>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {staff.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ width: 20, fontSize: 12.5, color: "#94a3b8", fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
                <input style={inputStyle} placeholder="ชื่อ-สกุล" value={row.name}
                  onChange={e => updateRow(i, "name", e.target.value)} />
                <input style={inputStyle} placeholder="ตำแหน่ง" value={row.position}
                  onChange={e => updateRow(i, "position", e.target.value)} />
                <button onClick={() => removeRow(i)} disabled={staff.length === 1}
                  title="ลบรายชื่อนี้"
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #fecaca",
                    background: staff.length === 1 ? "#f8fafc" : "#fff7f7", color: "#dc2626",
                    cursor: staff.length === 1 ? "not-allowed" : "pointer", fontSize: 14,
                    flexShrink: 0, opacity: staff.length === 1 ? 0.4 : 1 }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>

        {popupErr && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
            padding: "10px 14px", fontSize: 12.5, color: "#dc2626" }}>
            {popupErr}
          </div>
        )}

        <button onClick={handlePrint}
          style={{ padding: "14px 0", borderRadius: 10, border: "none", background: "#0038C6",
            color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "0 4px 14px rgba(0,56,198,.3)" }}>
          🖨️ ดูตัวอย่าง / พิมพ์คำสั่ง
        </button>
      </div>
    </PageLayout>
  );
}
