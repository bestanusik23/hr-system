import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(""); setLoading(true);
    const err = await login(username, password);
    setLoading(false);
    if (err) { setError(err); return; }
    navigate("/");
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(160deg,#001D66 0%,#0038C6 55%,#0050FF 100%)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Decorative circles */}
      <div style={{ position: "absolute", right: -120, top: -120, width: 400, height: 400, borderRadius: "50%", border: "60px solid rgba(255,255,255,0.04)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", left: -80, bottom: -80, width: 300, height: 300, borderRadius: "50%", border: "50px solid rgba(255,255,255,0.03)", pointerEvents: "none" }} />

      <div style={{ width: 400, position: "relative", zIndex: 1 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ display: "inline-block", background: "#fff", borderRadius: 16, padding: "14px 24px",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)", borderBottom: "3px solid #0038C6" }}>
            <img src="/logo.png" alt="Chiangrai RAM" style={{ height: 80, width: 176, display: "block" }} />
          </div>
          <div style={{ marginTop: 20, color: "#fff", fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em" }}>
            ระบบบริหารทรัพยากรบุคคล
          </div>
          <div style={{ marginTop: 6, color: "rgba(255,255,255,0.65)", fontSize: 13, letterSpacing: "0.03em" }}>
            โรงพยาบาลเชียงราย ราม
          </div>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.2)" }}>
          <div style={{ height: 4, background: "linear-gradient(90deg,#0038C6,#16A34A)" }} />
          <div style={{ padding: "32px 36px" }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 24,
              display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
              เข้าสู่ระบบ
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  ชื่อผู้ใช้
                </label>
                <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                  autoComplete="username" required style={inp} placeholder="username" />
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#475569",
                  letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                  รหัสผ่าน
                </label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" required style={inp} placeholder="••••••••" />
              </div>
              {error && (
                <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
                  padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 18 }}>
                  {error}
                </div>
              )}
              <button type="submit" disabled={loading} style={{
                width: "100%", padding: "13px 0", borderRadius: 8, border: "none",
                background: loading ? "#94a3b8" : "#0038C6", color: "#fff",
                fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                letterSpacing: "0.03em", transition: "background .2s",
              }}>
                {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
              </button>
            </form>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.06em" }}>
          HR SYSTEM · CHIANGRAI RAM HOSPITAL
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 8,
  border: "1.5px solid #c4cfee", fontSize: 14, outline: "none",
  fontFamily: "inherit", boxSizing: "border-box",
  transition: "border-color .2s", color: "#0a1628",
};
