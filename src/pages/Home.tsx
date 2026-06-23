import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ─── SVG Icons ─── */
const IcUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);
const IcSearch = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    <line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
  </svg>
);
const IcClipboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 11l3 3L22 4"/>
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
  </svg>
);
const IcBook = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
  </svg>
);
const IcArrows = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);
const IcChart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
);
const IcUserCog = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h3"/>
    <circle cx="19" cy="19" r="2"/><path d="M19 15v2M19 21v-1M16 19h2M21 19h-1M17.1 16.1l.7.7M21.2 21.2l-.7-.7M17.1 21.9l.7-.7M21.2 17l-.7.7"/>
  </svg>
);
const IcBuilding = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="9" width="18" height="13" rx="1"/><path d="M3 9l9-6 9 6"/>
    <line x1="9" y1="22" x2="9" y2="13"/><line x1="15" y1="22" x2="15" y2="13"/>
  </svg>
);
const IcFlow = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/>
    <path d="M7 6h10"/><path d="M6.5 7.5l4.5 9"/><path d="M17.5 7.5l-4.5 9"/>
  </svg>
);

/* ─── System definitions ─── */
interface SystemCard {
  key: string; no: string; icon: React.ReactNode;
  title: string; desc: string; roles: string[];
}

const SYSTEMS: SystemCard[] = [
  {
    key: "manpower", no: "01", icon: <IcUsers />,
    title: "Manpower CRR",
    desc: "ฐานข้อมูลกลางพนักงาน เพิ่มพนักงานเข้าใหม่ / ลาออก และ Dashboard อัตรากำลังแบบ Real-time",
    roles: ["hr","deputyHR","admin"],
  },
  {
    key: "recruit", no: "02", icon: <IcSearch />,
    title: "ระบบสรรหาบุคลากร",
    desc: "ตรวจสอบดูใบสมัครในแผนกที่เกี่ยวข้อง",
    roles: ["hr","head","deputy","deputyHR","admin"],
  },
  {
    key: "eval", no: "03", icon: <IcClipboard />,
    title: "ระบบประเมินผลพนักงาน",
    desc: "ประเมินพนักงานทดลองงาน รอบ 30 / 60 / 90 วัน พร้อมอนุมัติผลตามผังองค์กร",
    roles: ["hr","head","deputy","deputyHR","admin"],
  },
  {
    key: "training", no: "04", icon: <IcBook />,
    title: "ระบบฝึกอบรมภายใน",
    desc: "แผนอบรมประจำเดือน บันทึกผลการอบรม และ Dashboard เปรียบเทียบแผนกับผลจริง",
    roles: ["hr","head","deputy","deputyHR","admin"],
  },
  {
    key: "transfer", no: "05", icon: <IcArrows />,
    title: "ระบบคำขอย้ายตำแหน่ง / แผนก / ฝ่ายฯ",
    desc: "ส่งคำขอช่วยแผนก อนุมัติโดยหัวหน้าแผนกปลายทาง และรองผอ.ค่าตอบแทน",
    roles: ["hr","head","deputy","deputyHR","admin"],
  },
  {
    key: "exec", no: "06", icon: <IcChart />,
    title: "Executive Dashboard",
    desc: "ภาพรวมตัวชี้วัดทุกระบบสำหรับผู้บริหาร อัตรากำลัง การประเมิน และการอบรม",
    roles: ["hr","deputyHR","admin"],
  },
  {
    key: "admin", no: "07", icon: <IcUserCog />,
    title: "จัดการผู้ใช้งาน",
    desc: "เพิ่ม แก้ไข และกำหนดสิทธิ์ผู้ใช้งานในระบบ พร้อมกำกับดูแล Role ทุกระดับ",
    roles: ["admin"],
  },
  {
    key: "admin/org", no: "08", icon: <IcBuilding />,
    title: "จัดการตำแหน่ง/แผนก",
    desc: "เพิ่ม แก้ไข ลบ ฝ่าย แผนก และตำแหน่งงานในระบบตามโครงสร้างองค์กร",
    roles: ["hr","deputyHR","admin"],
  },
  {
    key: "workflow", no: "09", icon: <IcFlow />,
    title: "Workflow & สิทธิ์การอนุมัติ",
    desc: "ดูขั้นตอนการอนุมัติและสิทธิ์ของแต่ละ Role ในทุกระบบขององค์กร",
    roles: ["hr","deputyHR","admin"],
  },
];

const CSS = `
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: none; }
  }
  .home-root * { box-sizing: border-box; }
  .home-hero-btn:hover { transform: translateY(-2px) !important; box-shadow: 0 8px 24px rgba(0,56,198,.38) !important; }
  .home-logout:hover { background: #f1f5f9 !important; color: #0038c6 !important; border-color: #c4cfee !important; }
  .sys-card:hover { transform: translateY(-4px); box-shadow: 0 16px 32px rgba(0,56,198,.13), 0 0 0 1px rgba(0,56,198,.1) !important; }
  .sys-card .card-link { color: #0038c6; }
`;

export default function Home() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const visible = SYSTEMS.filter(s => user && s.roles.includes(user.role));

  return (
    <div className="home-root" style={{ minHeight: "100vh", background: "#f4f6fb", fontFamily: "'IBM Plex Sans Thai', sans-serif" }}>
      <style>{CSS}</style>

      {/* ══════════ HEADER ══════════ */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 64,
        background: "#fff", zIndex: 200,
        boxShadow: "0 1px 0 #e6e7e8, 0 2px 10px rgba(0,0,0,.05)",
        display: "flex", alignItems: "center", padding: "0 32px", gap: 16,
      }}>
        <img src="/logo.png" alt="Chiangrai Ram Hospital" style={{ height: 40, objectFit: "contain" }} />
        <div style={{ flex: 1 }} />
        {/* User info */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: user?.color ?? "#0038c6",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 12, flexShrink: 0,
          }}>{user?.initial ?? "?"}</div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1628", whiteSpace: "nowrap" }}>{user?.full_name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>{user?.role_title ?? user?.role}</div>
          </div>
          <button
            className="home-logout"
            onClick={async () => { await logout(); navigate("/login"); }}
            style={{
              marginLeft: 6, background: "transparent", border: "1.5px solid #e2e8f0",
              borderRadius: 8, padding: "6px 14px", color: "#64748b", fontSize: 12,
              cursor: "pointer", fontFamily: "inherit", fontWeight: 600,
              transition: "all .15s", whiteSpace: "nowrap",
            }}
          >ออกจากระบบ</button>
        </div>
      </header>

      {/* ══════════ HERO ══════════ */}
      <section style={{
        paddingTop: 64, minHeight: 400,
        background: "linear-gradient(145deg, #ffffff 0%, #eef3ff 50%, #ddeefa 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative", overflow: "hidden",
      }}>
        {/* Decorative blobs */}
        <div style={{
          position: "absolute", top: "10%", right: "5%",
          width: 280, height: 280, borderRadius: "50%",
          background: "radial-gradient(circle, #26a9e0 0%, transparent 68%)",
          opacity: 0.12, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", bottom: "5%", left: "3%",
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, #0038c6 0%, transparent 68%)",
          opacity: 0.07, pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", top: "55%", right: "22%",
          width: 90, height: 90, borderRadius: "50%",
          background: "radial-gradient(circle, #26a9e0 0%, transparent 65%)",
          opacity: 0.1, pointerEvents: "none",
        }} />

        {/* Wave SVG */}
        <svg viewBox="0 0 1440 140" preserveAspectRatio="none"
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 140, pointerEvents: "none" }}>
          <path d="M0,70 C360,140 720,0 1080,70 C1260,105 1380,35 1440,70 L1440,140 L0,140 Z"
            fill="#26a9e0" fillOpacity="0.1" />
          <path d="M0,100 C240,50 480,130 720,90 C960,50 1200,110 1440,85 L1440,140 L0,140 Z"
            fill="#0038c6" fillOpacity="0.06" />
        </svg>

        {/* Hero content */}
        <div style={{
          position: "relative", zIndex: 1, textAlign: "center",
          padding: "52px 24px 68px", animation: "fadeUp .55s ease both",
        }}>
          {/* Logo card */}
          <div style={{
            display: "inline-block", background: "#fff", borderRadius: 20,
            padding: "16px 28px", marginBottom: 24,
            boxShadow: "0 4px 20px rgba(0,56,198,.12)",
          }}>
            <img src="/logo.png" alt="Chiangrai Ram Hospital"
              style={{ height: 64, width: "auto", display: "block", objectFit: "contain" }} />
          </div>

          {/* Hospital English name */}
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#26a9e0",
            letterSpacing: "0.18em", textTransform: "uppercase",
            marginBottom: 10,
          }}>Chiangrai Ram Hospital</div>

          <h1 style={{
            fontSize: 38, fontWeight: 800, color: "#0038c6",
            margin: "0 0 6px", letterSpacing: "-0.4px", lineHeight: 1.2,
          }}>ระบบบริหารทรัพยากรบุคคล</h1>

          <div style={{
            fontSize: 14, color: "#94a3b8", letterSpacing: "0.08em",
            marginBottom: 14,
          }}>Human Resource Management System</div>

          <p style={{
            fontSize: 15.5, color: "#475569", maxWidth: 520,
            margin: "0 auto 30px", lineHeight: 1.75,
          }}>
            พัฒนาโดย ฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ
          </p>

          <button
            className="home-hero-btn"
            onClick={() => document.getElementById("systems-grid")?.scrollIntoView({ behavior: "smooth" })}
            style={{
              background: "#0038c6", color: "#fff", border: "none",
              padding: "13px 32px", borderRadius: 10, fontSize: 15, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 18px rgba(0,56,198,.28)",
              transition: "transform .15s, box-shadow .15s",
              display: "inline-flex", alignItems: "center", gap: 8,
            }}
          >
            เริ่มใช้งานระบบ
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </svg>
          </button>
        </div>
      </section>

      {/* ══════════ SYSTEMS GRID ══════════ */}
      <section id="systems-grid" style={{ maxWidth: 1200, margin: "0 auto", padding: "52px 24px 64px" }}>
        {/* Section heading */}
        <div style={{ marginBottom: 32, animation: "fadeUp .55s .1s ease both" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#eef3ff", borderRadius: 20, padding: "4px 14px",
            marginBottom: 10,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#26a9e0" }} />
            <span style={{ fontSize: 12, color: "#0038c6", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              ระบบงาน HR
            </span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#0a1628" }}>
            เลือกระบบที่ต้องการใช้งาน
          </div>
          <div style={{ fontSize: 13.5, color: "#94a3b8", marginTop: 6 }}>
            คุณมีสิทธิ์เข้าถึง {visible.length} ระบบ
          </div>
        </div>

        {/* Cards */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 20,
          animation: "fadeUp .55s .2s ease both",
        }}>
          {visible.map((c) => (
            <div
              key={c.key}
              className="sys-card"
              onClick={() => navigate(`/${c.key}`)}
              style={{
                background: "#fff", borderRadius: 18, padding: "24px 22px 20px",
                boxShadow: "0 2px 8px rgba(0,0,0,.06), 0 0 0 1px rgba(0,0,0,.04)",
                cursor: "pointer", position: "relative",
                transition: "transform .18s, box-shadow .18s",
                display: "flex", flexDirection: "column",
              }}
            >
              {/* Number badge */}
              <span style={{
                position: "absolute", top: 15, right: 17,
                fontSize: 11, color: "#cbd5e1", fontWeight: 700, letterSpacing: "0.06em",
              }}>{c.no}</span>

              {/* Icon */}
              <div style={{
                width: 46, height: 46, borderRadius: "50%", background: "#0038c6",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {c.icon}
              </div>

              {/* Title */}
              <div style={{
                fontSize: 15, fontWeight: 700, color: "#0a1628",
                marginTop: 16, marginBottom: 8, lineHeight: 1.3,
              }}>{c.title}</div>

              {/* Description */}
              <div style={{
                fontSize: 12.5, color: "#64748b", lineHeight: 1.7, flex: 1,
              }}>{c.desc}</div>

              {/* Link row */}
              <div style={{
                marginTop: 18, paddingTop: 14,
                borderTop: "1px solid #f0f4f8",
                display: "flex", alignItems: "center", gap: 5,
                color: "#0038c6", fontSize: 12.5, fontWeight: 600,
              }}>
                เข้าสู่ระบบ
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0038c6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer style={{
        background: "#0038c6", padding: "18px 32px", textAlign: "center",
      }}>
        <span style={{ color: "rgba(255,255,255,.55)", fontSize: 12 }}>
          © {new Date().getFullYear()} โรงพยาบาลเชียงราย ราม — Chiangrai Ram Hospital. All rights reserved.
        </span>
      </footer>
    </div>
  );
}
