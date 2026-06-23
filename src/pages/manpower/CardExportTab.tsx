import { useState } from "react";

const CANVA_FIELDS = [
  { col: "employee_code", label: "รหัสพนักงาน", example: "พว.1010101" },
  { col: "name_th",       label: "ชื่อ-นามสกุล (ไทย)",    example: "ใจดี รักสุขภาพ" },
  { col: "name_en",       label: "ชื่อ-นามสกุล (English)", example: "Jaidee Ruksukapaep" },
  { col: "position",      label: "ตำแหน่ง",   example: "พยาบาลผู้ป่วยนอก" },
  { col: "division",      label: "ฝ่าย",       example: "ฝ่ายการพยาบาล" },
  { col: "department",    label: "แผนก",       example: "ผู้ป่วยนอก หู คอ จมูก" },
  { col: "license_number",label: "เลขใบประกอบ", example: "6500564" },
];

const STEPS = [
  {
    icon: "📥",
    title: "1. Download CSV จากระบบ",
    desc: "กด Export CSV ด้านล่าง — ได้ไฟล์พร้อมข้อมูลพนักงานทุกคน",
  },
  {
    icon: "🎨",
    title: "2. เปิด design บัตรพนักงานใน Canva",
    desc: "เปิด design ที่ใช้อยู่ → คลิกขวาที่ text ชื่อพนักงาน → Connect data → ตั้งชื่อ field ให้ตรงกับ CSV",
  },
  {
    icon: "⚡",
    title: "3. ใช้ Bulk Create",
    desc: "ใน Canva → Apps → Bulk Create → Upload CSV → Map columns → Generate — ได้บัตรครบทุกคนอัตโนมัติ",
  },
];

export default function CardExportTab() {
  const [loading, setLoading] = useState(false);
  const [done, setDone]       = useState(false);

  async function downloadCSV() {
    setLoading(true); setDone(false);
    const r = await fetch("/api/manpower/export-cards");
    const blob = await r.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "employees_canva.csv";
    a.click();
    URL.revokeObjectURL(url);
    setLoading(false); setDone(true);
    setTimeout(() => setDone(false), 4000);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header card */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 24,
        boxShadow: "0 1px 6px rgba(0,0,0,.06)", borderTop: "4px solid #0038c6" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628", marginBottom: 4 }}>
              🪪 Export บัตรพนักงาน → Canva Bulk Create
            </div>
            <div style={{ fontSize: 13, color: "#64748b" }}>
              Generate บัตรพนักงานครบทุกคนอัตโนมัติ — ไม่ต้องทำทีละหน้า
            </div>
          </div>
          <button onClick={downloadCSV} disabled={loading}
            style={{ padding: "12px 24px", borderRadius: 9, border: "none",
              background: done ? "#16a34a" : "#0038c6", color: "#fff",
              fontWeight: 700, fontSize: 14, cursor: loading ? "not-allowed" : "pointer",
              fontFamily: "inherit", opacity: loading ? 0.7 : 1,
              display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
              transition: "background .3s" }}>
            {done ? "✅ ดาวน์โหลดแล้ว" : loading ? "กำลัง export…" : "⬇️ Export CSV สำหรับ Canva"}
          </button>
        </div>
      </div>

      {/* Steps */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628", marginBottom: 16 }}>วิธีใช้งาน</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "14px 16px",
              background: "#f8faff", borderRadius: 10, border: "1px solid #eef3ff" }}>
              <div style={{ fontSize: 24, flexShrink: 0 }}>{s.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#0a1628", marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, padding: "12px 16px", background: "#fffbeb",
          border: "1px solid #fde68a", borderRadius: 10, fontSize: 12, color: "#92400e" }}>
          💡 <b>ตั้งชื่อ field ใน Canva</b> → คลิกขวาที่ text element → "Connect data" → พิมพ์ชื่อ field ให้ตรงกับคอลัมน์ CSV ด้านล่าง
        </div>
      </div>

      {/* Field mapping table */}
      <div style={{ background: "#fff", borderRadius: 14, padding: 24, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628", marginBottom: 16 }}>
          คอลัมน์ใน CSV → ช่องใน Canva
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["ชื่อคอลัมน์ CSV", "ข้อมูล", "ตัวอย่าง"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700,
                    color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CANVA_FIELDS.map((f, i) => (
                <tr key={f.col} style={{ background: i % 2 === 0 ? "#fafbff" : "#fff",
                  borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <code style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: 4,
                      fontSize: 12, color: "#0038c6", fontWeight: 700 }}>{f.col}</code>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#475569" }}>{f.label}</td>
                  <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>{f.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 12,
          padding: "12px 16px", background: "#eef3ff", borderRadius: 10, fontSize: 12, color: "#3730a3" }}>
          <span style={{ fontSize: 20 }}>🎨</span>
          <div>
            <b>Design ที่ใช้อยู่:</b> Copy of บัตรพนักงาน รพ. (110 หน้า) ·{" "}
            <a href="https://www.canva.com/d/_2F1nAWLvZCBpef" target="_blank" rel="noreferrer"
              style={{ color: "#0038c6", fontWeight: 700 }}>เปิดใน Canva →</a>
          </div>
        </div>
      </div>

    </div>
  );
}
