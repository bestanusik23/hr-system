import { useEffect, useState } from "react";

interface CourseInfo {
  id: number; course: string; course_code: string;
  course_date: string | null; status: string;
}

const QUESTIONS = [
  "เนื้อหาการอบรมมีความเหมาะสมกับการปฏิบัติงาน",
  "วิทยากรถ่ายทอดเนื้อหาได้เข้าใจง่ายและชัดเจน",
  "สามารถนำความรู้ที่ได้ไปประยุกต์ใช้ในการทำงานได้จริง",
  "ระยะเวลาการอบรมมีความเหมาะสม",
  "ความพึงพอใจโดยรวมต่อการอบรมครั้งนี้",
];

const LEVELS = [
  { value: 4, label: "มากที่สุด", color: "#16a34a" },
  { value: 3, label: "มาก",       color: "#0038C6" },
  { value: 2, label: "ปานกลาง",  color: "#d97706" },
  { value: 1, label: "ควรปรับปรุง", color: "#dc2626" },
];

export default function SurveyPage() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("token") ?? "";
  const aidStr = params.get("aid")   ?? "";
  const aid    = aidStr ? parseInt(aidStr, 10) : null;

  const [course, setCourse]   = useState<CourseInfo | null>(null);
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [scores,  setScores]  = useState<number[]>([0, 0, 0, 0, 0]);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!token) { setError("ไม่พบ Token"); setLoading(false); return; }
    if (localStorage.getItem(`survey_${token}`) === "1") {
      setSubmitted(true); setLoading(false); return;
    }
    fetch(`/api/training/checkin?token=${encodeURIComponent(token)}`)
      .then(r => r.json() as Promise<{ ok: boolean; course?: CourseInfo; error?: string }>)
      .then(d => {
        if (!d.ok || !d.course) setError(d.error ?? "ไม่พบหลักสูตร");
        else setCourse(d.course);
        setLoading(false);
      });
  }, [token]);

  async function submit() {
    if (scores.some(s => s === 0)) { setError("กรุณาให้คะแนนทุกข้อ"); return; }
    setSubmitting(true); setError("");
    const r = await fetch("/api/training/survey", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, attendee_id: aid,
        q1: scores[0], q2: scores[1], q3: scores[2], q4: scores[3], q5: scores[4],
        comment: comment.trim() || null,
      }),
    });
    const d = await r.json() as { ok: boolean; duplicate?: boolean; error?: string };
    setSubmitting(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    localStorage.setItem(`survey_${token}`, "1");
    setSubmitted(true);
  }

  const today       = new Date().toISOString().slice(0, 10);
  const surveyReady = course && (course.status === "done" || (course.course_date != null && course.course_date <= today));

  const cardStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,56,198,0.12)",
    border: "1px solid #dce4f5", borderTop: "4px solid #16a34a",
    maxWidth: 520, width: "100%", padding: "32px 36px",
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f0f5ff", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 20 }}>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <div style={{ width: 44, height: 44, background: "#0038C6", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 900, fontSize: 11, lineHeight: 1.2, textAlign: "center" }}>
          RAM+
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#0038C6" }}>CHIANGRAI RAM+ HOSPITAL</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>แบบสอบถามความพึงพอใจการอบรม</div>
        </div>
      </div>

      {loading ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>กำลังโหลด…</div>
        </div>

      ) : (error && !course) ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", fontSize: 40, marginBottom: 12 }}>❌</div>
          <div style={{ textAlign: "center", fontWeight: 700, color: "#dc2626" }}>{error}</div>
        </div>

      ) : submitted ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🙏</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#16a34a", marginBottom: 10 }}>
              ขอบคุณสำหรับการตอบแบบสอบถาม!
            </div>
            <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.6 }}>
              ความคิดเห็นของท่านมีคุณค่าอย่างยิ่ง<br />
              ต่อการพัฒนาคุณภาพการอบรมในอนาคต
            </div>
          </div>
        </div>

      ) : course && !surveyReady ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <div style={{ fontWeight: 700, color: "#475569", fontSize: 16, marginBottom: 8 }}>
              แบบสอบถามยังไม่เปิด
            </div>
            <div style={{ fontSize: 14, color: "#94a3b8" }}>
              กรุณากลับมาตอบแบบสอบถามหลังการอบรมสิ้นสุด
            </div>
          </div>
        </div>

      ) : course ? (
        <div style={cardStyle}>
          {/* Course header */}
          <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "14px 18px",
            marginBottom: 24, border: "1px solid #bbf7d0" }}>
            <div style={{ fontWeight: 800, color: "#0a1628", marginBottom: 4 }}>📝 {course.course}</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              {course.course_code}{course.course_date && ` · ${course.course_date}`}
            </div>
          </div>

          <div style={{ fontSize: 13, color: "#64748b", marginBottom: 24, fontStyle: "italic" }}>
            กรุณาให้คะแนนแต่ละด้าน เพื่อพัฒนาการอบรมในอนาคต
          </div>

          {QUESTIONS.map((q, qi) => (
            <div key={qi} style={{ marginBottom: 24, paddingBottom: 24,
              borderBottom: qi < QUESTIONS.length - 1 ? "1px solid #f0f5ff" : "none" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#0a1628", marginBottom: 12 }}>
                {qi + 1}. {q}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {LEVELS.map(lv => {
                  const active = scores[qi] === lv.value;
                  return (
                    <button key={lv.value} onClick={() => {
                      const s = [...scores]; s[qi] = lv.value; setScores(s);
                    }} style={{
                      padding: "10px 6px", borderRadius: 8, border: "2px solid",
                      borderColor: active ? lv.color : "#dce4f5",
                      background: active ? lv.color + "18" : "#fff",
                      color: active ? lv.color : "#64748b",
                      fontWeight: active ? 800 : 500,
                      fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      transition: "all .15s", textAlign: "center",
                    }}>
                      {lv.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Comment */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
              ข้อเสนอแนะเพิ่มเติม (ไม่บังคับ)
            </label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
              placeholder="ความคิดเห็น ข้อเสนอแนะ หรือสิ่งที่อยากให้ปรับปรุง..."
              style={{ ...inp, resize: "vertical" } as React.CSSProperties} />
          </div>

          {error && (
            <div style={{ background: "#fee2e2", borderRadius: 7, padding: "10px 14px",
              fontSize: 13, color: "#dc2626", marginBottom: 14, border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          <button onClick={submit} disabled={submitting}
            style={{ width: "100%", padding: "14px 0", borderRadius: 9, border: "none",
              background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 16,
              cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(22,163,74,0.3)", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "กำลังส่ง…" : "📤 ส่งแบบสอบถาม"}
          </button>

          <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
            ข้อมูลของท่านจะถูกเก็บเป็นความลับและใช้เพื่อพัฒนาการอบรมเท่านั้น
          </div>
        </div>
      ) : null}
    </div>
  );
}
