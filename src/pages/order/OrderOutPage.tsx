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

// ─── Small inline icons (currentColor, reused across the letterhead/section headings) ─
const ICON = {
  pin: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  phone: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
  globe: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  doc: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  people: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  calendar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  pen: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>`,
  fb: `<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12a10 10 0 1 0-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.5-3.89 3.78-3.89 1.09 0 2.23.2 2.23.2v2.45h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0 0 22 12z"/></svg>`,
  heart: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
};

function generateOrderHTML(d: OrderData): string {
  const staffRows = d.staff
    .filter(s => s.name.trim() || s.position.trim())
    .map((s, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td class="fill">${s.name || "……………………………"}</td>
        <td class="fill">${s.position || "……………………………"}</td>
      </tr>`).join("");

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<title>คำสั่งมอบหมายปฏิบัติงานนอกสถานที่ ${d.orderNo}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4 portrait; margin: 12mm 14mm; }
  *  { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Sarabun', Arial, sans-serif; font-size: 12.5pt; color: #222222; background: #fff; line-height: 1.55; }
  .center { text-align: center; }
  .justify { text-align: justify; }
  .bold { font-weight: 700; }
  .fill { color: #0038C6; font-weight: 700; }

  @media screen {
    body { background: #d7dbe3; padding: 0; }
    .print-bar { background: #0038C6; padding: 10px 20px; display: flex; gap: 8px; align-items: center;
      position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,.25); }
    .print-bar span { color: rgba(255,255,255,.85); font-size: 11pt; flex: 1; font-family: Arial, sans-serif; }
    .btn-print { background: #fff; color: #0038C6; border: none; border-radius: 6px;
      padding: 8px 20px; font-size: 11pt; font-family: 'Sarabun', sans-serif; font-weight: 700; cursor: pointer; }
    .btn-close { background: rgba(255,255,255,.15); color: #fff; border: 1.5px solid rgba(255,255,255,.4);
      border-radius: 6px; padding: 8px 16px; font-size: 11pt; font-family: 'Sarabun', sans-serif; cursor: pointer; }
    .page-wrap { max-width: 230mm; margin: 20px auto; padding: 0 16px; }
    .paper { position: relative; background: #fff; width: 210mm; min-height: 297mm; margin: 0 auto 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,.18); overflow: hidden; }
  }
  @media print {
    .print-bar { display: none !important; }
    .paper { position: relative; box-shadow: none; min-height: 273mm; overflow: hidden; }
    body { background: #fff; }
  }

  .content { padding: 22px 26px 90px; }

  /* ── Header / letterhead ── */
  .doc-header { position: relative; padding: 20px 26px 14px; overflow: hidden; }
  .corner-accent { position: absolute; top: -50px; right: -70px; width: 240px; height: 170px;
    background: linear-gradient(135deg, #26A9E0, #0038C6);
    clip-path: polygon(35% 0, 100% 0, 100% 100%); opacity: .95; z-index: 0; }
  .header-row { display: flex; align-items: center; gap: 20px; position: relative; z-index: 1; }
  .header-logo { width: 128px; object-fit: contain; flex-shrink: 0; }
  .hosp-name { font-size: 14.5pt; font-weight: 800; color: #0038C6; margin-bottom: 8px; }
  .hosp-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 20px; font-size: 9.5pt; color: #222; }
  .contact-item { display: flex; align-items: center; gap: 6px; }
  .contact-item .ic { color: #0038C6; flex-shrink: 0; display: flex; }

  .divider { display: flex; align-items: center; gap: 10px; margin: 4px 26px 18px; }
  .divider span { flex: 1; height: 2px; background: linear-gradient(90deg, #0038C6, #26A9E0); }
  .divider i { width: 9px; height: 9px; background: #26A9E0; transform: rotate(45deg); display: inline-block; flex-shrink: 0; }

  /* ── Title ── */
  .title-row { display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 8px; flex-wrap: wrap; }
  .title-row h1 { font-size: 15.5pt; font-weight: 800; color: #111; }
  .badge { background: #0038C6; color: #fff; font-weight: 700; font-size: 10.5pt; padding: 4px 16px; border-radius: 20px; white-space: nowrap; }
  .thin-rule { height: 2px; background: #26A9E0; width: 110px; margin: 0 auto 16px; border-radius: 2px; }
  .location { color: #0038C6; font-weight: 700; text-decoration: underline; margin-bottom: 18px; }

  .body-text { text-align: justify; text-indent: 2.5em; margin-bottom: 20px; line-height: 1.75; }

  /* ── Section heading ── */
  .section-heading { display: flex; align-items: center; gap: 9px; font-weight: 800; color: #0038C6; font-size: 12.5pt; margin-bottom: 10px; }
  .section-heading .ic { width: 27px; height: 27px; border-radius: 50%; background: #eaf1ff;
    display: flex; align-items: center; justify-content: center; color: #0038C6; flex-shrink: 0; }

  /* ── Staff table ── */
  .staff-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; border-radius: 10px;
    overflow: hidden; box-shadow: 0 1px 5px rgba(0,56,198,.12); }
  .staff-table th { background: #0038C6; color: #fff; padding: 9px 14px; font-size: 10.5pt; text-align: left; font-weight: 700; }
  .staff-table th.idx, .staff-table td.idx { text-align: center; width: 56px; }
  .staff-table td { padding: 9px 14px; font-size: 11.5pt; border-bottom: 1px solid #eef2fb; }
  .staff-table td.idx { color: #94a3b8; font-weight: 700; }
  .staff-table tr:nth-child(even) td { background: #F4F7FB; }
  .staff-table tr:last-child td { border-bottom: none; }

  /* ── Order date pill ── */
  .order-date-pill { display: inline-flex; align-items: center; gap: 8px; background: #F4F7FB;
    border: 1px solid #dce8fb; border-radius: 10px; padding: 8px 18px; font-weight: 600; margin: 4px 0 44px; color: #0038C6; }
  .order-date-pill .fill { color: #111; }

  /* ── Signature ── */
  .signature-block { text-align: center; margin-top: 6px; }
  .sig-icon { width: 34px; height: 34px; border-radius: 50%; background: #eaf1ff; color: #0038C6;
    display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
  .signature-block p { margin-bottom: 4px; }

  /* ── Footer bar ── */
  .footer-bar { position: absolute; left: 0; right: 0; bottom: 0; background: linear-gradient(90deg, #0038C6, #26A9E0);
    color: #fff; padding: 11px 26px; display: flex; justify-content: space-between; align-items: center; font-size: 9pt; }
  .footer-left { display: flex; gap: 18px; align-items: center; flex-wrap: wrap; }
  .footer-item { display: flex; align-items: center; gap: 6px; }
  .footer-right { background: rgba(255,255,255,.18); border-radius: 8px; padding: 6px 14px; display: flex; align-items: center; gap: 7px; font-weight: 600; white-space: nowrap; }
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
  <div class="doc-header">
    <div class="corner-accent"></div>
    <div class="header-row">
      <img class="header-logo" src="/logo-nobg.png" alt="Chiangrai Ram Hospital">
      <div>
        <div class="hosp-name">บริษัท วัชรศิริเวช จำกัด (โรงพยาบาลเชียงราย ราม)</div>
        <div class="hosp-contact">
          <div class="contact-item"><span class="ic">${ICON.pin}</span>123 ม.26 ถ.พหลโยธิน ต.รอบเวียง อ.เมืองเชียงราย จ.เชียงราย 57000</div>
          <div class="contact-item"><span class="ic">${ICON.phone}</span>โทร : 053-719-719&nbsp;&nbsp;โทรสาร : 053-719-940</div>
          <div class="contact-item"><span class="ic">${ICON.globe}</span>Website : Chiangrairam.com&nbsp;&nbsp;E-mail : Info@chiangrairam.com</div>
          <div class="contact-item"><span class="ic">${ICON.doc}</span>เลขประจำตัวผู้เสียภาษี 0575557000289 (สำนักงานใหญ่)</div>
        </div>
      </div>
    </div>
  </div>

  <div class="divider"><span></span><i></i><span></span></div>

  <div class="content" style="padding-top:0">

    <!-- Title -->
    <div class="title-row">
      <h1>คำสั่งมอบหมายปฏิบัติงานนอกสถานที่</h1>
      <span class="badge">${d.orderNo || "……………"}</span>
    </div>
    <div class="thin-rule"></div>
    <p class="center bold" style="margin-bottom:6px">เรื่อง แต่งตั้งและมอบหมายหน้าที่ปฏิบัติงานเฉพาะกิจ</p>
    <p class="center location">ณ ${d.placeName || "……………"} ${d.address || "……………"}</p>

    <!-- Intro paragraph -->
    <p class="body-text">
      ตามที่โรงพยาบาลเชียงราย รามได้มีกำหนดการออกหน่วย<span class="fill">${d.activity || "……………………………"}</span>
      &nbsp;ณ&nbsp;<span class="fill">${d.placeName || "……………………………"}</span>
      &nbsp;<span class="fill">${d.address || "……………………………"}</span>
      &nbsp;วันที่&nbsp;<span class="fill">${d.eventDate}</span>
      &nbsp;ดังนั้นเพื่อให้การดำเนินงานเป็นไปด้วยความถูกต้องมีประสิทธิภาพและเป็นไปด้วยความเรียบร้อย
      จึงมีคำสั่งแต่งตั้งให้พนักงานของโรงพยาบาลฯทำหน้าที่และรับผิดชอบในจุดต่างๆ ดังนี้
    </p>

    <!-- Staff list -->
    <div class="section-heading"><span class="ic">${ICON.people}</span>ผู้รับผิดชอบ</div>
    <table class="staff-table">
      <thead><tr><th class="idx">ลำดับ</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่ง</th></tr></thead>
      <tbody>
        ${staffRows || `<tr><td colspan="3" style="padding:14px;color:#94a3b8;text-align:center">(ยังไม่ระบุรายชื่อ)</td></tr>`}
      </tbody>
    </table>

    <!-- Order date -->
    <div class="order-date-pill"><span style="display:flex">${ICON.calendar}</span>สั่ง ณ วันที่&nbsp;<span class="fill">${d.orderDate}</span></div>

    <!-- Signature block -->
    <div class="signature-block">
      <div class="sig-icon">${ICON.pen}</div>
      <p>ลงชื่อ ……………………………………………………</p>
      <p class="bold" style="margin-top:8px">(อนุสิกข์&nbsp;&nbsp;ทองแผ่น)</p>
      <p>รักษาการ รองผู้อำนวยการ</p>
      <p>ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ</p>
    </div>

  </div>

  <!-- Footer bar -->
  <div class="footer-bar">
    <div class="footer-left">
      <span class="footer-item">${ICON.phone}&nbsp;053-719-719</span>
      <span class="footer-item">${ICON.globe}&nbsp;www.chiangrairam.com</span>
      <span class="footer-item">${ICON.fb}&nbsp;Chiangrai Ram Hospital</span>
    </div>
    <div class="footer-right">${ICON.heart}&nbsp;อบอุ่นและเชี่ยวชาญ / Warm &amp; Expert Care</div>
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
