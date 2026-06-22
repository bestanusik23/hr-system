import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

interface CourseInfo {
  id: number; course_code: string; course: string; course_type: string;
  course_date: string | null; start_time: string | null; end_time: string | null;
  location: string | null; trainer: string | null; reg_open: number;
}

export default function CheckinPage() {
  const navigate   = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const token      = new URLSearchParams(window.location.search).get("token") ?? "";

  const [course, setCourse]   = useState<CourseInfo | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const [done, setDone]       = useState(false);
  const [msg, setMsg]         = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Extra fields for QR check-in (if not logged in user name / no profile)
  const [name, setName]       = useState("");
  const [empCode, setEmpCode] = useState("");
  const [dept, setDept]       = useState("");
  const [pos, setPos]         = useState("");

  useEffect(() => {
    if (!token) { setError("ไม่พบ QR Token"); setLoading(false); return; }
    fetch(`/api/training/checkin?token=${encodeURIComponent(token)}`)
      .then(r => r.json() as Promise<{ ok: boolean; course?: CourseInfo; error?: string }>)
      .then(d => {
        if (!d.ok || !d.course) { setError(d.error ?? "QR Code ไม่ถูกต้อง"); }
        else { setCourse(d.course); }
        setLoading(false);
      });
  }, [token]);

  async function checkin() {
    if (!user) { navigate(`/login?redirect=/checkin?token=${encodeURIComponent(token)}`); return; }
    if (!name.trim() && !user.full_name) { setError("กรุณากรอกชื่อ"); return; }
    setSubmitting(true); setError("");
    const r = await fetch("/api/training/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qr_token:   token,
        name:       name.trim() || user.full_name,
        emp_code:   empCode.trim() || null,
        department: dept.trim() || null,
        position:   pos.trim() || null,
      }),
    });
    const d = await r.json() as { ok: boolean; message?: string; error?: string };
    setSubmitting(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setMsg(d.message ?? "เช็คชื่อสำเร็จ");
    setDone(true);
  }

  const cardStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,56,198,0.18)",
    border: "1px solid #dce4f5", borderTop: "4px solid #0038C6",
    maxWidth: 440, width: "100%", padding: "32px 36px",
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #c4cfee", fontSize: 14, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f5ff", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 20 }}>

      {/* Logo header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, background: "#0038C6", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 900, fontSize: 11, lineHeight: 1.2, textAlign: "center" }}>
          RAM+
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#0038C6" }}>CHIANGRAI RAM+ HOSPITAL</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>ระบบเช็คชื่อเข้าอบรม</div>
        </div>
      </div>

      {loading || authLoading ? (
        <div style={cardStyle}><div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>กำลังโหลด…</div></div>
      ) : error && !course ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", fontSize: 40, marginBottom: 12 }}>❌</div>
          <div style={{ textAlign: "center", fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>QR Code ไม่ถูกต้อง</div>
          <div style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}>{error}</div>
        </div>
      ) : done ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", fontSize: 56, marginBottom: 12 }}>✅</div>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#16a34a", marginBottom: 8 }}>{msg}</div>
          <div style={{ textAlign: "center", fontSize: 14, color: "#475569", marginBottom: 20 }}>
            {course?.course}
          </div>
          <div style={{ textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
            {new Date().toLocaleTimeString("th-TH")}
          </div>
        </div>
      ) : course ? (
        <div style={cardStyle}>
          {/* Course header */}
          <div style={{ background: "#f0f5ff", borderRadius: 10, padding: "16px 18px", marginBottom: 24,
            border: "1px solid #dce4f5" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{ fontSize: 28, lineHeight: 1 }}>🎓</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0a1628" }}>{course.course}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {course.course_date && `📅 ${course.course_date}  `}
                  {course.start_time && `🕐 ${course.start_time}–${course.end_time}  `}
                </div>
                {course.location && <div style={{ fontSize: 12, color: "#64748b" }}>📍 {course.location}</div>}
              </div>
            </div>
          </div>

          {!user ? (
            <>
              <div style={{ fontSize: 14, color: "#475569", marginBottom: 16, textAlign: "center" }}>
                กรุณาเข้าสู่ระบบก่อนเช็คชื่อ
              </div>
              <button onClick={checkin}
                style={{ width: "100%", padding: "13px 0", borderRadius: 9, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 800, fontSize: 16,
                  cursor: "pointer", fontFamily: "inherit" }}>
                เข้าสู่ระบบ
              </button>
            </>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>ชื่อ-นามสกุล</label>
                <input value={name || user.full_name} onChange={e => setName(e.target.value)} style={inp} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>รหัสพนักงาน</label>
                  <input value={empCode} onChange={e => setEmpCode(e.target.value)} placeholder="ไม่บังคับ" style={inp} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>แผนก</label>
                  <input value={dept} onChange={e => setDept(e.target.value)} placeholder="ไม่บังคับ" style={inp} />
                </div>
              </div>

              {error && (
                <div style={{ background: "#fee2e2", borderRadius: 7, padding: "10px 14px",
                  fontSize: 13, color: "#dc2626", marginBottom: 14, border: "1px solid #fecaca" }}>
                  {error}
                </div>
              )}

              <button onClick={checkin} disabled={submitting}
                style={{ width: "100%", padding: "14px 0", borderRadius: 9, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 800, fontSize: 16,
                  cursor: "pointer", fontFamily: "inherit",
                  boxShadow: "0 4px 16px rgba(0,56,198,0.3)" }}>
                {submitting ? "กำลังเช็คชื่อ…" : "✅ เช็คชื่อเข้าอบรม"}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
