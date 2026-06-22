import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface SystemCard {
  key: string; no: string; icon: string; title: string; desc: string; tags: string[]; accent: string;
  roles: string[];
}

const SYSTEMS: SystemCard[] = [
  { key: "recruit", no: "1", icon: "🔍", title: "ระบบสรรหาบุคลากร", desc: "คัดเลือกใบสมัครออนไลน์ และตรวจสอบอัตรากำลัง (Manpower) ตามแผนก", tags: ["คัดเลือกใบสมัคร", "Manpower"], accent: "#0038C6", roles: ["hr","head","deputy","deputyHR","admin"] },
  { key: "eval", no: "2", icon: "📋", title: "ระบบประเมินผลพนักงาน", desc: "ประเมินพนักงานทดลองงาน รอบ 30/60/90 วัน พร้อมอนุมัติผลตามผังองค์กร", tags: ["แบบประเมิน 10 หัวข้อ", "อนุมัติผล"], accent: "#16A34A", roles: ["hr","head","deputy","deputyHR","admin"] },
  { key: "training", no: "3", icon: "🎓", title: "ระบบข้อมูลฝึกอบรม", desc: "แผนอบรมประจำเดือน บันทึกผลการอบรม และ Dashboard เปรียบเทียบแผนกับผลจริง", tags: ["แผนอบรม", "Dashboard"], accent: "#7C3AED", roles: ["hr","head","deputy","deputyHR","admin"] },
  { key: "transfer", no: "4", icon: "📑", title: "ระบบคำขอย้ายแผนก", desc: "ส่งคำขอย้ายแผนก อนุมัติโดยหัวหน้าแผนก และอนุมัติขั้นสุดท้ายโดย HR", tags: ["Workflow 3 ขั้น", "อนุมัติ"], accent: "#E0533D", roles: ["hr","head","deputy","deputyHR","admin"] },
  { key: "exec", no: "5", icon: "📈", title: "Executive Dashboard", desc: "ภาพรวมตัวชี้วัดทุกระบบสำหรับผู้บริหาร อัตรากำลัง การประเมิน และการอบรม", tags: ["ภาพรวมองค์กร", "KPI"], accent: "#0891B2", roles: ["hr","deputy","deputyHR","admin"] },
  { key: "admin", no: "6", icon: "⚙️", title: "จัดการผู้ใช้งาน", desc: "เพิ่ม แก้ไข และกำหนดสิทธิ์ผู้ใช้งานในระบบ", tags: ["เพิ่มผู้ใช้", "กำหนดสิทธิ์"], accent: "#16a34a", roles: ["admin"] },
  { key: "admin/org", no: "7", icon: "🏢", title: "จัดการฝ่าย/แผนก/ตำแหน่ง", desc: "เพิ่ม แก้ไข ลบ ฝ่าย แผนก และตำแหน่งงานในระบบ", tags: ["ฝ่าย", "แผนก", "ตำแหน่ง"], accent: "#0891B2", roles: ["hr", "admin"] },
];

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const visible = SYSTEMS.filter(s => user && s.roles.includes(user.role));

  return (
    <div style={{
      minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: 40, position: "relative", overflow: "hidden",
      background: "radial-gradient(1200px 600px at 80% -10%,#0038C6 0%,#002A96 45%,#001D66 100%)",
    }}>
      {/* Top-right user info */}
      <div style={{ position: "fixed", top: 18, right: 22, display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", background: user?.color ?? "#0038C6", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 13 }}>
          {user?.initial ?? "?"}
        </div>
        <div style={{ color: "#fff", fontSize: 13 }}>
          <div style={{ fontWeight: 600 }}>{user?.full_name}</div>
          <div style={{ opacity: 0.7, fontSize: 11 }}>{user?.role_title ?? user?.role}</div>
        </div>
        <button onClick={async () => { await logout(); navigate("/login"); }}
          style={{ marginLeft: 4, background: "rgba(255,255,255,.15)", border: "none", borderRadius: 8, padding: "6px 12px", color: "#fff", fontSize: 12, cursor: "pointer" }}>
          ออกจากระบบ
        </button>
      </div>

      {/* Header */}
      <div style={{ position: "relative", textAlign: "center", marginBottom: 34, animation: "floatUp .5s ease both" }}>
        <div style={{ display: "inline-block", background: "#fff", borderRadius: 18, padding: "16px 26px", boxShadow: "0 14px 34px -14px rgba(0,0,0,.5)" }}>
          <img src="/logo.png" alt="Chiangrai RAM Hospital" style={{ height: 104, width: 230, display: "block" }} />
        </div>
        <div style={{ marginTop: 22, color: "#fff", fontSize: 30, fontWeight: 700, letterSpacing: "-.5px" }}>
          ระบบบริหารทรัพยากรบุคคล
        </div>
        <div style={{ marginTop: 8, color: "#fff", opacity: 0.72, fontSize: 14.5 }}>
          โรงพยาบาลเชียงราย ราม · เลือกระบบที่ต้องการใช้งาน
        </div>
      </div>

      {/* Cards */}
      <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22, width: "100%", maxWidth: 820, animation: "floatUp .5s ease both" }}>
        {visible.map(c => (
          <div key={c.key} onClick={() => navigate(`/${c.key}`)}
            style={{ background: "rgba(255,255,255,.97)", borderRadius: 20, padding: 28, boxShadow: "0 20px 44px -24px rgba(0,0,0,.5)", cursor: "pointer", transition: "transform .15s, box-shadow .15s" }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 28px 54px -20px rgba(0,0,0,.55)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 20px 44px -24px rgba(0,0,0,.5)"; }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, background: c.accent }}>{c.icon}</div>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#64748b" }}>{c.no}</div>
            </div>
            <div style={{ marginTop: 16, fontSize: 19, fontWeight: 700 }}>{c.title}</div>
            <div style={{ marginTop: 8, fontSize: 13.5, color: "#5c7378", lineHeight: 1.5 }}>{c.desc}</div>
            <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
              {c.tags.map(t => <span key={t} style={{ background: "#f2f5fc", color: "#334155", borderRadius: 7, padding: "4px 10px", fontSize: 12 }}>{t}</span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
