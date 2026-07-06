import { useEffect, useState } from "react";
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
};

function generateOrderHTML(d: OrderData): string {
  const filledStaff = d.staff.filter(s => s.name.trim() || s.position.trim());
  const staffRows = filledStaff
    .map((s, i) => `
      <tr>
        <td class="idx">${i + 1}</td>
        <td class="fill">${s.name || "……………………………"}</td>
        <td class="fill">${s.position || "……………………………"}</td>
      </tr>`).join("");

  // Shrink type density as the staff list grows, so the document reliably fits one A4 page.
  const density = filledStaff.length > 20 ? "density-ultra" : filledStaff.length > 12 ? "density-compact" : "";

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
    .paper { position: relative; background: #fff; width: 210mm; height: 297mm; margin: 0 auto 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,.18); overflow: hidden; }
    .overflow-warn { background: #fef2f2; color: #dc2626; border-bottom: 2px solid #fecaca;
      padding: 10px 20px; font-family: 'Sarabun', Arial, sans-serif; font-size: 12px; font-weight: 700;
      text-align: center; position: sticky; top: 44px; z-index: 99; }
  }
  @media print {
    .print-bar, .overflow-warn { display: none !important; }
    /* Fixed height + hidden overflow guarantees the order never spills onto a second printed page. */
    .paper { position: relative; box-shadow: none; height: 273mm; overflow: hidden; }
    body { background: #fff; }
  }

  /* ── Density tiers — keep everything on one A4 page as the staff list grows ── */
  body.density-compact .content { padding: 14px 26px 18px; }
  body.density-compact .doc-header { padding: 14px 26px 10px; }
  body.density-compact .header-logo { width: 100px; }
  body.density-compact .hosp-name { font-size: 13pt; margin-bottom: 5px; }
  body.density-compact .hosp-contact { font-size: 8.5pt; }
  body.density-compact .title-row h1 { font-size: 14pt; }
  body.density-compact .thin-rule { margin: 0 auto 10px; }
  body.density-compact .body-text { line-height: 1.5; margin-bottom: 12px; }
  body.density-compact .staff-table td, body.density-compact .staff-table th { padding: 6px 12px; font-size: 10.5pt; }
  body.density-compact .staff-table { margin-bottom: 14px; }
  body.density-compact .order-date-pill { margin: 4px 0 24px; }
  body.density-compact .signature-block { margin-top: 2px; }

  body.density-ultra .content { padding: 10px 20px 14px; }
  body.density-ultra .doc-header { padding: 8px 20px 6px; }
  body.density-ultra .header-logo { width: 78px; }
  body.density-ultra .hosp-name { font-size: 11.5pt; margin-bottom: 3px; }
  body.density-ultra .hosp-contact { font-size: 7.5pt; gap: 2px 14px; }
  body.density-ultra .title-row h1 { font-size: 12.5pt; }
  body.density-ultra p.center.bold, body.density-ultra p.center.location { margin-bottom: 3px; }
  body.density-ultra .thin-rule { margin: 0 auto 6px; }
  body.density-ultra .body-text { font-size: 10.5pt; line-height: 1.35; margin-bottom: 6px; text-indent: 1.5em; }
  body.density-ultra .section-heading { margin-bottom: 4px; font-size: 11pt; }
  body.density-ultra .staff-table td, body.density-ultra .staff-table th { padding: 3px 10px; font-size: 9.5pt; }
  body.density-ultra .staff-table { margin-bottom: 8px; }
  body.density-ultra .order-date-pill { margin: 2px 0 10px; padding: 5px 14px; }
  body.density-ultra .signature-block { margin-top: 0; }
  body.density-ultra .signature-block p { margin-bottom: 2px; }

  .content { padding: 22px 26px 32px; }

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
  .signature-block p { margin-bottom: 4px; }
</style>
</head>
<body class="${density}">

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
      <p>ลงชื่อ ……………………………………………………</p>
      <p class="bold" style="margin-top:8px">(อนุสิกข์&nbsp;&nbsp;ทองแผ่น)</p>
      <p>รักษาการ รองผู้อำนวยการ</p>
      <p>ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ</p>
    </div>

  </div>

</div>
</div>

<script>
  function mmToPx(mm) {
    var d = document.createElement('div');
    d.style.cssText = 'height:' + mm + 'mm;position:absolute;visibility:hidden;';
    document.body.appendChild(d);
    var px = d.offsetHeight;
    document.body.removeChild(d);
    return px;
  }
  window.addEventListener('load', function () {
    var paper = document.querySelector('.paper');
    var pageWrap = document.querySelector('.page-wrap');
    if (!paper || !pageWrap) return;
    if (paper.scrollHeight > mmToPx(297) + 2) {
      var warn = document.createElement('div');
      warn.className = 'overflow-warn';
      warn.textContent = '⚠ เนื้อหายาวเกินหนึ่งหน้ากระดาษ A4 — ส่วนที่เกินจะถูกตัดออกตอนพิมพ์ กรุณาลดจำนวนรายชื่อหรือย่อข้อความ';
      document.body.insertBefore(warn, pageWrap);
    }
  });
</script>
</body>
</html>`;
}

interface OrderListItem {
  id: number; order_no: string; activity: string; place_name: string; address: string;
  event_date: string | null; order_date: string | null; created_by: string; created_at: string;
}

function openPrintWindow(d: OrderData): string {
  const html = generateOrderHTML(d);
  const win = window.open("", "_blank", "width=900,height=1100,scrollbars=yes");
  if (!win) return "ไม่สามารถเปิดหน้าต่างพิมพ์ได้ กรุณาอนุญาต popup สำหรับเว็บไซต์นี้";
  win.document.open();
  win.document.write(html);
  win.document.close();
  return "";
}

export default function OrderOutPage() {
  const [view, setView] = useState<"form" | "history">("form");
  const [isEditing, setIsEditing] = useState(false);

  const [orderNo, setOrderNo]     = useState("");
  const [activity, setActivity]   = useState("");
  const [placeName, setPlaceName] = useState("");
  const [address, setAddress]     = useState("");
  const [eventDate, setEventDate] = useState("");
  const [orderDate, setOrderDate] = useState("");
  const [staff, setStaff] = useState<StaffRow[]>([{ name: "", position: "" }]);
  const [popupErr, setPopupErr] = useState("");

  // History (reprint) tab
  const [history, setHistory]         = useState<OrderListItem[]>([]);
  const [historyLoading, setHistLoad] = useState(false);
  const [historyErr, setHistErr]      = useState("");
  const [historyQ, setHistoryQ]       = useState("");
  const [reprintingId, setReprintingId] = useState<number | null>(null);

  function loadHistory() {
    setHistLoad(true); setHistErr("");
    const params = new URLSearchParams();
    if (historyQ.trim()) params.set("q", historyQ.trim());
    fetch(`/api/order-out?${params}`).then(r => r.json())
      .then((d: { ok: boolean; orders?: OrderListItem[]; error?: string }) => {
        if (!d.ok) { setHistErr(d.error ?? "โหลดประวัติไม่สำเร็จ"); return; }
        setHistory(d.orders ?? []);
      })
      .catch(() => setHistErr("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
      .finally(() => setHistLoad(false));
  }

  useEffect(() => {
    if (view !== "history") return;
    const t = setTimeout(loadHistory, 250);
    return () => clearTimeout(t);
  }, [view, historyQ]);

  async function reprint(id: number) {
    setReprintingId(id); setHistErr("");
    try {
      const r = await fetch(`/api/order-out/${id}`);
      const d = await r.json() as { ok: boolean; error?: string; order?: {
        orderNo: string; activity: string; placeName: string; address: string;
        eventDate: string; orderDate: string; staff: StaffRow[];
      } };
      if (!d.ok || !d.order) { setHistErr(d.error ?? "ไม่พบคำสั่งนี้"); return; }
      const err = openPrintWindow({
        orderNo: d.order.orderNo, activity: d.order.activity,
        placeName: d.order.placeName, address: d.order.address,
        eventDate: thaiDate(d.order.eventDate), orderDate: thaiDate(d.order.orderDate),
        staff: d.order.staff,
      });
      if (err) setHistErr(err);
    } catch {
      setHistErr("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setReprintingId(null);
    }
  }

  async function editFromHistory(id: number) {
    setReprintingId(id); setHistErr("");
    try {
      const r = await fetch(`/api/order-out/${id}`);
      const d = await r.json() as { ok: boolean; error?: string; order?: {
        orderNo: string; activity: string; placeName: string; address: string;
        eventDate: string; orderDate: string; staff: StaffRow[];
      } };
      if (!d.ok || !d.order) { setHistErr(d.error ?? "ไม่พบคำสั่งนี้"); return; }
      setOrderNo(d.order.orderNo);
      setActivity(d.order.activity);
      setPlaceName(d.order.placeName);
      setAddress(d.order.address);
      setEventDate(d.order.eventDate);
      setOrderDate(d.order.orderDate);
      setStaff(d.order.staff.length > 0 ? d.order.staff : [{ name: "", position: "" }]);
      setPopupErr("");
      setIsEditing(true);
      setView("form");
    } catch {
      setHistErr("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setReprintingId(null);
    }
  }

  function startNewOrder() {
    setOrderNo(""); setActivity(""); setPlaceName(""); setAddress("");
    setEventDate(""); setOrderDate(""); setStaff([{ name: "", position: "" }]);
    setIsEditing(false); setPopupErr(""); setView("form");
  }

  function addRow() { setStaff(s => [...s, { name: "", position: "" }]); }
  function removeRow(i: number) { setStaff(s => s.filter((_, idx) => idx !== i)); }
  function updateRow(i: number, field: keyof StaffRow, value: string) {
    setStaff(s => s.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  async function handlePrint() {
    setPopupErr("");
    const err = openPrintWindow({
      orderNo, activity, placeName, address,
      eventDate: thaiDate(eventDate),
      orderDate: thaiDate(orderDate),
      staff,
    });
    if (err) { setPopupErr(err); return; }
    // Save to history — non-blocking, printing already happened above.
    try {
      await fetch("/api/order-out", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo, activity, placeName, address, eventDate, orderDate, staff }),
      });
    } catch { /* history save is best-effort */ }
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
      <div style={{ display: "flex", gap: 2, marginBottom: 20, flexWrap: "wrap",
        background: "#fff", borderRadius: 8, padding: 4, width: "fit-content",
        boxShadow: "0 1px 4px rgba(0,56,198,0.08)", border: "1px solid #dce4f5" }}>
        {([["form", "📝 สร้างคำสั่งใหม่"], ["history", "🕘 ประวัติคำสั่งย้อนหลัง"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => key === "form" ? startNewOrder() : setView(key)} style={{
            padding: "9px 18px", borderRadius: 6, border: "none", fontFamily: "inherit",
            fontSize: 13, fontWeight: view === key ? 700 : 400, cursor: "pointer",
            background: view === key ? "#0038C6" : "transparent",
            color: view === key ? "#fff" : "#64748b", transition: "all .15s",
          }}>
            {label}
          </button>
        ))}
      </div>

      {view === "history" ? (
        <div style={{ display: "grid", gap: 16, maxWidth: 900 }}>
          <input value={historyQ} onChange={e => setHistoryQ(e.target.value)}
            placeholder="🔍 ค้นหาเลขที่คำสั่ง / กิจกรรม / สถานที่…"
            style={{ padding: "9px 14px", borderRadius: 9, border: "1.5px solid #dce4f5",
              fontSize: 13, fontFamily: "inherit", width: 320, outline: "none" }} />

          {historyErr && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: 12.5, color: "#dc2626" }}>
              {historyErr}
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #dce4f5",
            boxShadow: "0 2px 10px rgba(0,56,198,.05)", overflow: "hidden" }}>
            {historyLoading ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>
                ยังไม่มีประวัติคำสั่งออกหน่วย
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["เลขที่คำสั่ง", "กิจกรรม", "สถานที่", "วันปฏิบัติงาน", "บันทึกโดย", ""].map(h => (
                      <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11.5,
                        fontWeight: 700, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((o, i) => (
                    <tr key={o.id} style={{ background: i % 2 === 0 ? "#fff" : "#fafbff", borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 14px", fontSize: 12.5, fontWeight: 700, color: "#0038C6", whiteSpace: "nowrap" }}>{o.order_no || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#334155" }}>{o.activity || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#64748b" }}>{o.place_name || "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12.5, color: "#64748b", whiteSpace: "nowrap" }}>{o.event_date ? thaiDate(o.event_date) : "—"}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>{o.created_by || "—"}</td>
                      <td style={{ padding: "10px 14px", display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button onClick={() => reprint(o.id)} disabled={reprintingId === o.id}
                          style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #c4cfee",
                            background: "#eff6ff", color: "#0038C6", fontWeight: 700, fontSize: 12,
                            cursor: reprintingId === o.id ? "not-allowed" : "pointer", fontFamily: "inherit",
                            whiteSpace: "nowrap", opacity: reprintingId === o.id ? 0.6 : 1 }}>
                          {reprintingId === o.id ? "กำลังเปิด…" : "🖨️ ดู / พิมพ์ซ้ำ"}
                        </button>
                        <button onClick={() => editFromHistory(o.id)} disabled={reprintingId === o.id}
                          style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #fde68a",
                            background: "#fffbeb", color: "#b45309", fontWeight: 700, fontSize: 12,
                            cursor: reprintingId === o.id ? "not-allowed" : "pointer", fontFamily: "inherit",
                            whiteSpace: "nowrap", opacity: reprintingId === o.id ? 0.6 : 1 }}>
                          ✏️ แก้ไข
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
      <div style={{ display: "grid", gap: 20, maxWidth: 760 }}>

        {isEditing ? (
          <div style={{ background: "#fffbeb", border: "1.5px solid #fde68a", borderRadius: 10,
            padding: "12px 16px", fontSize: 12.5, color: "#92400e", lineHeight: 1.7 }}>
            ✏️ กำลังแก้ไขคำสั่งเลขที่ <b>{orderNo || "(ไม่มีเลขที่)"}</b> — แก้ไขข้อมูลแล้วกด "พิมพ์คำสั่ง" เพื่อบันทึกทับรายการเดิม
          </div>
        ) : (
          <div style={{ background: "#eff6ff", border: "1.5px solid #c4cfee", borderRadius: 10,
            padding: "12px 16px", fontSize: 12.5, color: "#334155", lineHeight: 1.7 }}>
            กรอกข้อมูลด้านล่าง ระบบจะประกอบเป็นคำสั่งมอบหมายปฏิบัติงานนอกสถานที่ตามแบบฟอร์มมาตรฐาน
            แล้วเปิดหน้าต่างสำหรับดูตัวอย่างและพิมพ์ได้ทันที (ช่องที่ยังไม่กรอกจะแสดงเป็นเส้นประในเอกสาร)
            คำสั่งที่พิมพ์แล้วจะถูกบันทึกไว้ในแท็บ "ประวัติคำสั่งย้อนหลัง" ให้เรียกดู/แก้ไข/พิมพ์ซ้ำได้ภายหลัง
          </div>
        )}

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
          {isEditing ? "🖨️ พิมพ์ / บันทึกการแก้ไข" : "🖨️ ดูตัวอย่าง / พิมพ์คำสั่ง"}
        </button>
      </div>
      )}
    </PageLayout>
  );
}
