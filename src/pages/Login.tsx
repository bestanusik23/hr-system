import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { icon: <ShieldIcon />, title: "ปลอดภัย",       desc: "มาตรฐานความปลอดภัยระดับสากล" },
  { icon: <PeopleIcon />, title: "ครบถ้วน",        desc: "จัดการข้อมูลบุคลากรได้อย่างครอบคลุม" },
  { icon: <ClockIcon  />, title: "รวดเร็ว",         desc: "ใช้งานง่าย สะดวกและรวดเร็ว" },
  { icon: <ChartIcon  />, title: "มีประสิทธิภาพ", desc: "รายงานและวิเคราะห์ข้อมูลได้อย่างแม่นยำ" },
];

export default function Login() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const err = await login(username, password);
    setLoading(false);
    if (err) { setError(err); return; }
    navigate("/");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", fontFamily: "inherit" }}>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex" }}>

        {/* ── Left panel ── */}
        <div style={{
          flex: "0 0 55%", position: "relative", overflow: "hidden",
          background: "linear-gradient(145deg,#001244 0%,#0038C6 65%,#005CE6 100%)",
          display: "flex", flexDirection: "column", padding: "44px 52px 40px",
        }}>
          {/* Decorative circles */}
          <div style={{ position:"absolute", right:-100, top:-100, width:340, height:340,
            borderRadius:"50%", background:"rgba(255,255,255,0.05)", pointerEvents:"none" }} />
          <div style={{ position:"absolute", left:-60, bottom:80, width:240, height:240,
            borderRadius:"50%", background:"rgba(255,255,255,0.04)", pointerEvents:"none" }} />
          <div style={{ position:"absolute", right:60, bottom:-50, width:180, height:180,
            borderRadius:"50%", background:"rgba(255,255,255,0.06)", pointerEvents:"none" }} />

          {/* Logo */}
          <div style={{ marginBottom: 44 }}>
            <div style={{ display:"inline-block", background:"#fff", borderRadius:10, padding:"10px 18px",
              boxShadow:"0 4px 16px rgba(0,0,0,0.2)" }}>
              <img src="/logo.png" alt="Chiangrai RAM" style={{ height:48, display:"block" }} />
            </div>
          </div>

          {/* Heading */}
          <h1 style={{ fontSize:34, fontWeight:900, color:"#fff", margin:"0 0 10px 0", lineHeight:1.2 }}>
            ระบบบริหารทรัพยากรบุคคล
          </h1>
          <div style={{ fontSize:16, color:"rgba(255,255,255,0.75)", marginBottom:18 }}>
            โรงพยาบาลเชียงราย ราม
          </div>
          <div style={{ width:52, height:3, background:"#60a5fa", borderRadius:2, marginBottom:22 }} />
          <p style={{ fontSize:14, color:"rgba(255,255,255,0.7)", lineHeight:1.75, marginBottom:36, maxWidth:380 }}>
            ระบบที่ช่วยบริหารจัดการข้อมูลบุคลากร<br />
            อย่างมีประสิทธิภาพ ครบถ้วน และปลอดภัย<br />
            เพื่อการทำงานที่ง่ายขึ้นสำหรับทุกคน
          </p>

          {/* Feature boxes */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, maxWidth:480, marginBottom:"auto" }}>
            {FEATURES.map(f => (
              <div key={f.title} style={{
                background:"rgba(255,255,255,0.10)", borderRadius:14, padding:"18px 16px",
                border:"1px solid rgba(255,255,255,0.15)", backdropFilter:"blur(4px)",
              }}>
                <div style={{ width:38, height:38, borderRadius:10,
                  background:"rgba(255,255,255,0.15)", display:"flex", alignItems:"center",
                  justifyContent:"center", marginBottom:10 }}>
                  {f.icon}
                </div>
                <div style={{ fontWeight:700, color:"#fff", fontSize:14, marginBottom:4 }}>{f.title}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.65)", lineHeight:1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Hospital building photo (hidden gracefully if not found) */}
          <div style={{ position:"absolute", bottom:0, left:0, right:0, height:220,
            background:"linear-gradient(to top, rgba(0,18,68,0.65), transparent)", pointerEvents:"none" }} />
          <img src="/hospital.jpg" alt="" style={{
            position:"absolute", bottom:0, left:0, right:0, width:"100%", height:220,
            objectFit:"cover", objectPosition:"center top", opacity:0.35, pointerEvents:"none",
          }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
        </div>

        {/* ── Right panel ── */}
        <div style={{
          flex:1, display:"flex", alignItems:"center", justifyContent:"center",
          background:"#f0f4ff", padding:"40px 24px",
        }}>
          <div style={{
            width:"100%", maxWidth:420, background:"#fff", borderRadius:22,
            boxShadow:"0 20px 60px rgba(0,56,198,0.13)", padding:"42px 40px 34px",
          }}>
            {/* Lock icon */}
            <div style={{ textAlign:"center", marginBottom:22 }}>
              <div style={{ display:"inline-flex", width:68, height:68, borderRadius:"50%",
                background:"#eff6ff", alignItems:"center", justifyContent:"center",
                border:"3px solid #dbeafe", boxShadow:"0 4px 14px rgba(0,56,198,0.15)" }}>
                <LockIcon />
              </div>
            </div>

            <div style={{ textAlign:"center", marginBottom:30 }}>
              <div style={{ fontSize:23, fontWeight:800, color:"#0a1628", marginBottom:8 }}>เข้าสู่ระบบ</div>
              <div style={{ fontSize:13, color:"#64748b" }}>กรุณากรอกชื่อผู้ใช้และรหัสผ่านเพื่อเข้าสู่ระบบ</div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* Username */}
              <div style={{ marginBottom:18 }}>
                <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#334155", marginBottom:8 }}>
                  ชื่อผู้ใช้
                </label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }}>
                    <UserIcon />
                  </span>
                  <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                    autoComplete="username" required placeholder="ชื่อผู้ใช้"
                    style={{ ...INP, paddingLeft:42 }} />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom:16 }}>
                <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#334155", marginBottom:8 }}>
                  รหัสผ่าน
                </label>
                <div style={{ position:"relative" }}>
                  <span style={{ position:"absolute", left:14, top:"50%", transform:"translateY(-50%)", color:"#94a3b8" }}>
                    <LockSmallIcon />
                  </span>
                  <input type={showPass ? "text" : "password"} value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password" required placeholder="••••••••"
                    style={{ ...INP, paddingLeft:42, paddingRight:46 }} />
                  <button type="button" onClick={() => setShowPass(p => !p)}
                    style={{ position:"absolute", right:12, top:"50%", transform:"translateY(-50%)",
                      background:"none", border:"none", cursor:"pointer", color:"#94a3b8", padding:4,
                      display:"flex", alignItems:"center" }}>
                    {showPass ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Remember + Forgot */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:22 }}>
                <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer",
                  fontSize:13, color:"#475569", userSelect:"none" }}>
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    style={{ width:16, height:16, cursor:"pointer", accentColor:"#0038C6" }} />
                  จดจำการเข้าสู่ระบบ
                </label>
                <span style={{ fontSize:13, color:"#0038C6", fontWeight:600, cursor:"pointer" }}>
                  ลืมรหัสผ่าน?
                </span>
              </div>

              {error && (
                <div style={{ background:"#fee2e2", border:"1px solid #fecaca", borderRadius:8,
                  padding:"10px 14px", fontSize:13, color:"#dc2626", marginBottom:18 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width:"100%", padding:"14px 0", borderRadius:11, border:"none",
                background: loading ? "#94a3b8" : "#0038C6", color:"#fff",
                fontSize:15, fontWeight:700, cursor: loading ? "not-allowed" : "pointer",
                letterSpacing:"0.03em", transition:"all .2s",
                display:"flex", alignItems:"center", justifyContent:"center", gap:10,
                boxShadow: loading ? "none" : "0 4px 18px rgba(0,56,198,0.4)",
              }}>
                {loading ? "กำลังเข้าสู่ระบบ…" : (<><span>เข้าสู่ระบบ</span><span style={{ fontSize:18 }}>→</span></>)}
              </button>
            </form>

            {/* SSL badge */}
            <div style={{ textAlign:"center", marginTop:22, fontSize:12, color:"#94a3b8",
              display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              ระบบปลอดภัย ด้วยการเข้ารหัสข้อมูลแบบ 256-bit SSL
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{
        background:"#00112e", padding:"14px 48px",
        display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10,
      }}>
        <div style={{ display:"flex", gap:32, color:"rgba(255,255,255,0.7)", fontSize:13 }}>
          <span style={{ display:"flex", alignItems:"center", gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.77 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.64a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 15.92z"/>
            </svg>
            053 798 888
          </span>
          <span style={{ display:"flex", alignItems:"center", gap:7 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            www.ram-hospital.co.th
          </span>
        </div>
        <span style={{ color:"rgba(255,255,255,0.4)", fontSize:12 }}>
          © 2024 Chiangrai Ram Hospital. All rights reserved.
        </span>
      </div>
    </div>
  );
}

/* ── Icons ── */
function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0038C6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function LockSmallIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}
function UserIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  );
}
function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}
function PeopleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}

const INP: React.CSSProperties = {
  width:"100%", padding:"11px 14px", borderRadius:10,
  border:"1.5px solid #e2e8f0", fontSize:14, outline:"none",
  fontFamily:"inherit", boxSizing:"border-box",
  transition:"border-color .2s", color:"#0a1628", background:"#fff",
};
