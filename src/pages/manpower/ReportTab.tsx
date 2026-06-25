export default function ReportTab() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: 40,
        boxShadow: "0 1px 6px rgba(0,0,0,.06)", textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📈</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1628", marginBottom: 8 }}>
          รายงาน (Report)
        </div>
        <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 340, margin: "0 auto" }}>
          หน้านี้สำหรับรายงานสรุปข้อมูลบุคลากร — อยู่ระหว่างการพัฒนา
        </div>
        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 12,
          justifyContent: "center" }}>
          {["รายงานอัตรากำลัง", "รายงานการลาออก", "รายงานใบประกอบวิชาชีพ", "รายงานประจำปี"].map(label => (
            <div key={label} style={{
              padding: "10px 20px", borderRadius: 8, background: "#f8fafc",
              border: "1.5px dashed #c4cfee", fontSize: 13, color: "#94a3b8",
            }}>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
