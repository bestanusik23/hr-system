import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ─────────────── Feature Cards ─────────────── */
const FEATURES = [
  {
    icon: <PersonnelIcon />,
    title: "Personnel Management",
    desc:  "บริหารจัดการข้อมูลบุคลากรได้อย่างเป็นระบบ",
  },
  {
    icon: <AttendanceIcon />,
    title: "Attendance & Leave",
    desc:  "จัดการเวลา การเข้าออกงานและการลาอย่างสะดวก",
  },
  {
    icon: <PayrollIcon />,
    title: "Payroll & Benefits",
    desc:  "ระบบเงินเดือน สวัสดิการและสิทธิประโยชน์พนักงาน",
  },
  {
    icon: <AnalyticsIcon />,
    title: "Analytics Dashboard",
    desc:  "รายงานและวิเคราะห์ข้อมูลเพื่อการตัดสินใจที่แม่นยำ",
  },
];

/* ─────────────── Component ─────────────── */
export default function Login() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);
  const [mounted,  setMounted]  = useState(false);
  const [hovered,  setHovered]  = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const err = await login(username, password);
    setLoading(false);
    if (err) { setError(err); return; }
    navigate("/");
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'IBM Plex Sans Thai', 'Noto Sans Thai', sans-serif; }
        .login-wrap { opacity: 0; transform: translateY(12px); transition: opacity .6s ease, transform .6s ease; }
        .login-wrap.mounted { opacity: 1; transform: translateY(0); }
        .feat-card { transition: transform .2s ease, box-shadow .2s ease; cursor: default; }
        .feat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(0,56,198,.12) !important; }
        .login-btn { transition: all .2s ease; }
        .login-btn:hover:not(:disabled) { background: #0031ad !important; box-shadow: 0 8px 28px rgba(0,56,198,.45) !important; transform: translateY(-1px); }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .inp-field { transition: border-color .2s ease, box-shadow .2s ease; }
        .inp-field:focus { border-color: #0038C6 !important; box-shadow: 0 0 0 4px rgba(0,56,198,.12) !important; outline: none; }
        .eye-btn { transition: color .15s; }
        .eye-btn:hover { color: #0038C6 !important; }
        .forgot-link { transition: color .15s; }
        .forgot-link:hover { color: #0031ad !important; }
      `}</style>

      <div className={`login-wrap${mounted ? " mounted" : ""}`}
        style={{ display:"flex", flexDirection:"column", minHeight:"100vh",
          fontFamily:"'IBM Plex Sans Thai','Noto Sans Thai',sans-serif",
          background:"#F5F8FF" }}>

        {/* ── Main ── */}
        <div style={{ flex:1, display:"flex", maxWidth:1600, margin:"0 auto", width:"100%", padding:"0 0" }}>

          {/* ════════════ LEFT PANEL ════════════ */}
          <div style={{ flex:"0 0 45%", position:"relative", overflow:"hidden",
            background:"#F5F8FF", display:"flex", flexDirection:"column",
            padding:"52px 56px 40px" }}>

            {/* Decorative blurred circles */}
            <div style={{ position:"absolute", top:-120, left:-80, width:380, height:380,
              borderRadius:"50%", background:"rgba(0,56,198,0.055)", filter:"blur(60px)", pointerEvents:"none" }} />
            <div style={{ position:"absolute", bottom:60, right:-60, width:300, height:300,
              borderRadius:"50%", background:"rgba(38,169,224,0.07)", filter:"blur(50px)", pointerEvents:"none" }} />
            {/* Dot grid */}
            <div style={{ position:"absolute", top:40, right:30, opacity:0.18, pointerEvents:"none" }}>
              <DotGrid />
            </div>

            {/* Logo */}
            <div style={{ marginBottom:40 }}>
              <img src="/logo.png" alt="Chiangrai RAM Hospital" style={{ height:96 }} />
            </div>

            {/* Heading */}
            <h1 style={{ fontSize:36, fontWeight:700, color:"#12284C", lineHeight:1.18, marginBottom:10 }}>
              ระบบบริหารทรัพยากรบุคคล
            </h1>
            <div style={{ fontSize:15, color:"#52607A", marginBottom:18, fontWeight:400 }}>
              Human Resource Management System
            </div>
            <div style={{ width:52, height:3, background:"#0038C6", borderRadius:2, marginBottom:22 }} />
            <p style={{ fontSize:14, color:"#52607A", lineHeight:1.8, marginBottom:40, maxWidth:380 }}>
              ระบบบริหารข้อมูลบุคลากรที่ทันสมัย ใช้งานง่าย ปลอดภัย และมีประสิทธิภาพ<br />
              เพื่อสนับสนุนการทำงานขององค์กร
            </p>

            {/* Feature Cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, maxWidth:480 }}>
              {FEATURES.map((f, i) => (
                <div key={i} className="feat-card"
                  style={{ background:"#fff", borderRadius:20, padding:"22px 20px",
                    border:"1px solid #E7EBF3",
                    boxShadow: hovered === i
                      ? "0 12px 32px rgba(0,56,198,.12)"
                      : "0 2px 12px rgba(15,23,42,.06)",
                    display:"flex", flexDirection:"column", gap:10 }}
                  onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
                    <div style={{ width:44, height:44, borderRadius:12,
                      background:"#EFF4FF", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      {f.icon}
                    </div>
                    <div style={{ width:28, height:28, borderRadius:"50%",
                      background:"#F1F5F9", display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8A95A6" strokeWidth="2.5">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </div>
                  </div>
                  <div style={{ fontSize:13, fontWeight:700, color:"#12284C", lineHeight:1.3 }}>{f.title}</div>
                  <div style={{ fontSize:12, color:"#8A95A6", lineHeight:1.6 }}>{f.desc}</div>
                </div>
              ))}
            </div>

          </div>

          {/* ════════════ RIGHT PANEL ════════════ */}
          <div style={{ flex:1, position:"relative", overflow:"hidden",
            background:"linear-gradient(145deg,#EDF2FF 0%,#F0F7FF 50%,#E8F4FF 100%)",
            display:"flex", alignItems:"center", justifyContent:"center", padding:"40px 32px" }}>

            {/* Decorative circles right side */}
            <div style={{ position:"absolute", top:-80, right:-80, width:320, height:320,
              borderRadius:"50%", background:"rgba(0,56,198,0.07)", filter:"blur(50px)", pointerEvents:"none" }} />
            <div style={{ position:"absolute", bottom:-60, left:0, width:260, height:260,
              borderRadius:"50%", background:"rgba(38,169,224,0.08)", filter:"blur(40px)", pointerEvents:"none" }} />

            {/* Login Card */}
            <div style={{ width:"100%", maxWidth:480, position:"relative", zIndex:1,
              background:"rgba(255,255,255,0.82)", backdropFilter:"blur(30px)",
              WebkitBackdropFilter:"blur(30px)",
              borderRadius:32, padding:"48px 44px 40px",
              border:"1px solid rgba(255,255,255,0.6)",
              boxShadow:"0 40px 120px rgba(15,23,42,.09), 0 2px 4px rgba(15,23,42,.04)" }}>

              {/* Lock icon */}
              <div style={{ display:"flex", justifyContent:"center", marginBottom:26 }}>
                <div style={{ width:72, height:72, borderRadius:"50%",
                  background:"#EFF4FF", border:"3px solid #DBEAFE",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  boxShadow:"0 0 0 8px rgba(0,56,198,0.06)" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#0038C6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    <circle cx="12" cy="16" r="1.5" fill="#0038C6" stroke="none"/>
                  </svg>
                </div>
              </div>

              <div style={{ textAlign:"center", marginBottom:32 }}>
                <h2 style={{ fontSize:26, fontWeight:700, color:"#12284C", marginBottom:10, letterSpacing:"-0.01em" }}>
                  เข้าสู่ระบบ
                </h2>
                <p style={{ fontSize:14, color:"#52607A", lineHeight:1.6 }}>
                  กรุณาเข้าสู่ระบบเพื่อเข้าใช้งานระบบบุคลากร
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                {/* Username */}
                <div style={{ marginBottom:20 }}>
                  <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#12284C", marginBottom:8 }}>
                    ชื่อผู้ใช้
                  </label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", color:"#8A95A6", display:"flex" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                      </svg>
                    </span>
                    <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                      autoComplete="username" required autoFocus
                      placeholder="กรุณากรอกชื่อผู้ใช้"
                      className="inp-field"
                      style={{ ...INP, paddingLeft:46 }} />
                  </div>
                </div>

                {/* Password */}
                <div style={{ marginBottom:18 }}>
                  <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#12284C", marginBottom:8 }}>
                    รหัสผ่าน
                  </label>
                  <div style={{ position:"relative" }}>
                    <span style={{ position:"absolute", left:16, top:"50%", transform:"translateY(-50%)", color:"#8A95A6", display:"flex" }}>
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <rect x="3" y="11" width="18" height="11" rx="2.5"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </span>
                    <input type={showPass ? "text" : "password"} value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="current-password" required
                      placeholder="กรุณากรอกรหัสผ่าน"
                      className="inp-field"
                      style={{ ...INP, paddingLeft:46, paddingRight:50 }} />
                    <button type="button" className="eye-btn" onClick={() => setShowPass(p => !p)}
                      style={{ position:"absolute", right:14, top:"50%", transform:"translateY(-50%)",
                        background:"none", border:"none", cursor:"pointer", color:"#8A95A6",
                        padding:4, display:"flex", alignItems:"center" }}>
                      {showPass
                        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      }
                    </button>
                  </div>
                </div>

                {/* Remember + Forgot */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:26 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer",
                    fontSize:13, color:"#52607A", userSelect:"none" }}>
                    <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                      style={{ width:17, height:17, cursor:"pointer", accentColor:"#0038C6", borderRadius:4 }} />
                    จดจำการเข้าสู่ระบบ
                  </label>
                  <span className="forgot-link"
                    style={{ fontSize:13, color:"#0038C6", fontWeight:600, cursor:"pointer" }}>
                    ลืมรหัสผ่าน?
                  </span>
                </div>

                {error && (
                  <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", borderRadius:12,
                    padding:"12px 16px", fontSize:13, color:"#DC2626", marginBottom:18,
                    display:"flex", alignItems:"center", gap:8 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <button type="submit" disabled={loading} className="login-btn"
                  style={{ width:"100%", height:56, borderRadius:16, border:"none",
                    background: loading ? "#94a3b8" : "#0038C6", color:"#fff",
                    fontSize:15, fontWeight:600, cursor: loading ? "not-allowed" : "pointer",
                    letterSpacing:"0.02em",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                    boxShadow: loading ? "none" : "0 4px 20px rgba(0,56,198,.38)",
                  }}>
                  {loading
                    ? <><Spinner /><span>กำลังเข้าสู่ระบบ…</span></>
                    : <><span>เข้าสู่ระบบ</span>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      </>
                  }
                </button>
              </form>

              {/* SSL */}
              <div style={{ marginTop:26, display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:"#EFF4FF",
                  display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0038C6" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <div style={{ fontSize:13, fontWeight:600, color:"#12284C" }}>Protected by 256-bit SSL Encryption</div>
                  <div style={{ fontSize:11, color:"#8A95A6", marginTop:1 }}>ระบบของเราปลอดภัยด้วยการเข้ารหัสมาตรฐานระดับสากล</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ════════════ FOOTER ════════════ */}
        <div style={{ background:"#fff", borderTop:"1px solid #E7EBF3",
          padding:"14px 56px", display:"flex", alignItems:"center",
          justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div style={{ display:"flex", gap:28, color:"#52607A", fontSize:13, alignItems:"center" }}>
            <span style={{ display:"flex", alignItems:"center", gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A95A6" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.77 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 15.92z"/>
              </svg>
              092-2749555
            </span>
            <span style={{ display:"flex", alignItems:"center", gap:7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A95A6" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              hr@chiangrairam.com
            </span>
          </div>
          <span style={{ fontSize:12, color:"#8A95A6" }}>
            © 2026 Chiangrai RAM Hospital. All rights reserved.
          </span>
          <div style={{ display:"flex", alignItems:"center", gap:7, fontSize:12, color:"#52607A", fontWeight:500 }}>
            HR System v3.0
            <span style={{ width:7, height:7, borderRadius:"50%", background:"#16A34A", display:"inline-block" }} />
          </div>
        </div>
      </div>
    </>
  );
}

/* ─────────────── Sub-components ─────────────── */

function Spinner() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation:"spin 0.8s linear infinite" }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/>
    </svg>
  );
}

function DotGrid() {
  const dots = [];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 8; c++) {
      dots.push(<circle key={`${r}-${c}`} cx={c * 18} cy={r * 18} r="1.6" fill="#0038C6" />);
    }
  }
  return <svg width="144" height="108" viewBox="0 0 144 108">{dots}</svg>;
}

function ArchDecoration() {
  return (
    <svg width="100%" height="180" viewBox="0 0 560 180" preserveAspectRatio="xMidYMax slice"
      xmlns="http://www.w3.org/2000/svg" style={{ opacity:0.1 }}>
      {/* Stylized hospital building silhouette using rectangles */}
      <rect x="60"  y="80"  width="80"  height="100" rx="2" fill="#0038C6"/>
      <rect x="75"  y="60"  width="50"  height="22"  rx="1" fill="#0038C6"/>
      <rect x="90"  y="40"  width="20"  height="22"  rx="1" fill="#0038C6"/>
      <rect x="160" y="100" width="60"  height="80"  rx="2" fill="#0038C6"/>
      <rect x="170" y="82"  width="40"  height="20"  rx="1" fill="#0038C6"/>
      <rect x="240" y="50"  width="120" height="130" rx="3" fill="#0038C6"/>
      <rect x="260" y="28"  width="80"  height="24"  rx="1" fill="#0038C6"/>
      <rect x="285" y="10"  width="30"  height="20"  rx="1" fill="#0038C6"/>
      <rect x="378" y="70"  width="80"  height="110" rx="2" fill="#0038C6"/>
      <rect x="390" y="52"  width="56"  height="20"  rx="1" fill="#0038C6"/>
      <rect x="470" y="110" width="60"  height="70"  rx="2" fill="#0038C6"/>
      {/* Windows */}
      {[80,100,120].map(y => [68,88,108].map(x =>
        <rect key={`${x}-${y}`} x={x} y={y} width="12" height="10" rx="1" fill="#EFF4FF" opacity="0.6"/>
      ))}
      {[110,130,150].map(y => [248,274,300,326].map(x =>
        <rect key={`${x}-${y}`} x={x} y={y} width="14" height="12" rx="1" fill="#EFF4FF" opacity="0.6"/>
      ))}
      {/* Ground line */}
      <rect x="0" y="178" width="560" height="2" rx="1" fill="#0038C6"/>
      {/* Trees */}
      <ellipse cx="35"  cy="155" rx="18" ry="22" fill="#26A9E0" opacity="0.5"/>
      <rect    x="32"   cy="165" width="6"  height="15" rx="2" fill="#26A9E0" opacity="0.4"/>
      <ellipse cx="530" cy="158" rx="16" ry="20" fill="#26A9E0" opacity="0.5"/>
      <rect    x="527"  cy="168" width="6"  height="12" rx="2" fill="#26A9E0" opacity="0.4"/>
    </svg>
  );
}

/* ─────────────── Feature Icons ─────────────── */
function PersonnelIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0038C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function AttendanceIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0038C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8"  y1="2" x2="8"  y2="6"/>
      <line x1="3"  y1="10" x2="21" y2="10"/>
      <polyline points="9 16 11 18 15 14"/>
    </svg>
  );
}
function PayrollIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0038C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
      <circle cx="12" cy="15" r="2"/>
      <path d="M6 15h.01M18 15h.01"/>
    </svg>
  );
}
function AnalyticsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0038C6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6"  y1="20" x2="6"  y2="14"/>
      <line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  );
}

/* ─────────────── Shared Styles ─────────────── */
const INP: React.CSSProperties = {
  width:"100%", height:52, padding:"0 14px", borderRadius:14,
  border:"1.5px solid #E7EBF3", fontSize:14, outline:"none",
  fontFamily:"'IBM Plex Sans Thai','Noto Sans Thai',sans-serif",
  boxSizing:"border-box", color:"#12284C", background:"rgba(255,255,255,0.9)",
};
