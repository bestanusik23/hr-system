import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await login(username, password);
    setLoading(false);
    if (err) { setError(err); return; }
    navigate("/");
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "radial-gradient(1200px 600px at 80% -10%,#0038C6 0%,#002A96 45%,#001D66 100%)",
    }}>
      <div style={{ width: 380, animation: "floatUp .4s ease both" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ display: "inline-block", background: "#fff", borderRadius: 16, padding: "12px 22px", boxShadow: "0 14px 34px -14px rgba(0,0,0,.5)" }}>
            <img src="/logo.png" alt="Chiangrai RAM" style={{ height: 80, width: 176, display: "block" }} />
          </div>
          <div style={{ marginTop: 16, color: "#fff", fontSize: 20, fontWeight: 700 }}>ระบบบริหารทรัพยากรบุคคล</div>
          <div style={{ marginTop: 4, color: "#fff", opacity: 0.7, fontSize: 13 }}>โรงพยาบาลเชียงราย ราม</div>
        </div>

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, boxShadow: "0 20px 44px -24px rgba(0,0,0,.5)" }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 22, color: "#0f172a" }}>เข้าสู่ระบบ</div>
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                ชื่อผู้ใช้
              </label>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" required
                style={inputStyle}
                placeholder="username"
              />
            </div>
            <div style={{ marginBottom: 22 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                รหัสผ่าน
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" required
                style={inputStyle}
                placeholder="••••••••"
              />
            </div>
            {error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading} style={{
              width: "100%", padding: "12px 0", borderRadius: 12, border: "none",
              background: loading ? "#94a3b8" : "#0038C6", color: "#fff",
              fontSize: 15, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
              transition: "background .2s",
            }}>
              {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: "1.5px solid #e2e8f0", fontSize: 14, outline: "none",
  fontFamily: "inherit", transition: "border-color .2s",
};
