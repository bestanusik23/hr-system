import { useEffect, useRef, useState } from "react";

interface CourseInfo {
  id: number; course_code: string; course: string; course_type: string;
  course_date: string | null; start_time: string | null; end_time: string | null;
  location: string | null; trainer: string | null; reg_open: number;
  status: string; is_cancelled: number;
}

type Step = "form" | "success" | "prereg" | "updated" | "duplicate" | "closed";

function thDate(iso: string | null) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const MONTHS = ["","ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${parseInt(d)} ${MONTHS[parseInt(m)]} ${parseInt(y) + 543}`;
}

export default function CheckinPage() {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get("token") ?? "";

  const [course, setCourse]       = useState<CourseInfo | null>(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [step, setStep]           = useState<Step>("form");
  const [submitting, setSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [position,  setPosition]  = useState("");
  const [partType,  setPartType]  = useState<"attendee" | "trainer">("attendee");
  const [registeredId,   setRegisteredId]   = useState<number | null>(null);
  const [registeredType, setRegisteredType] = useState<"attendee" | "trainer">("attendee");
  const [trainingDate,   setTrainingDate]   = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) { setError("ไม่พบ QR Token"); setLoading(false); return; }
    fetch(`/api/training/checkin?token=${encodeURIComponent(token)}`)
      .then(r => r.json() as Promise<{ ok: boolean; course?: CourseInfo; error?: string }>)
      .then(d => {
        if (!d.ok || !d.course) { setError(d.error ?? "QR Code ไม่ถูกต้อง"); }
        else {
          setCourse(d.course);
          if (!d.course.reg_open) setStep("closed");
        }
        setLoading(false);
      });
  }, [token]);

  async function register() {
    if (!firstName.trim() || !lastName.trim() || !position.trim()) {
      setError("กรุณากรอกชื่อ นามสกุล และตำแหน่งให้ครบถ้วน"); return;
    }
    setSubmitting(true); setError("");
    const r = await fetch("/api/training/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, first_name: firstName.trim(), last_name: lastName.trim(),
        position: position.trim(), participant_type: partType,
      }),
    });
    const d = await r.json() as {
      ok: boolean; duplicate?: boolean; prereg?: boolean; updated?: boolean;
      attendee_id?: number; participant_type?: string; course_date?: string; error?: string;
    };
    setSubmitting(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setRegisteredId(d.attendee_id ?? null);
    setRegisteredType((d.participant_type as "attendee" | "trainer") ?? partType);
    setTrainingDate(d.course_date ?? course?.course_date ?? null);
    if      (d.duplicate) setStep("duplicate");
    else if (d.updated)   setStep("updated");
    else if (d.prereg)    setStep("prereg");
    else                  setStep("success");
  }

  const today       = new Date().toISOString().slice(0, 10);
  const surveyUrl   = `/survey?token=${encodeURIComponent(token)}&aid=${registeredId ?? ""}`;

  // Auto-redirect to survey after check-in (attendee only, on training day)
  const shouldRedirect = ["success", "updated", "duplicate"].includes(step) && registeredType === "attendee";
  useEffect(() => {
    if (!shouldRedirect) return;
    setCountdown(3);
    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          window.location.href = surveyUrl;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [step, registeredType]); // eslint-disable-line

  const cardStyle: React.CSSProperties = {
    background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,56,198,0.18)",
    border: "1px solid #dce4f5", borderTop: "4px solid #0038C6",
    maxWidth: 460, width: "100%", padding: "32px 36px",
  };

  const inp: React.CSSProperties = {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    border: "1.5px solid #c4cfee", fontSize: 14, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };

  const typeBtn = (val: "attendee" | "trainer"): React.CSSProperties => ({
    flex: 1, padding: "12px 0", borderRadius: 9, border: "2px solid",
    borderColor: partType === val ? (val === "attendee" ? "#0038C6" : "#16a34a") : "#dce4f5",
    background:  partType === val ? (val === "attendee" ? "#eff4ff" : "#f0fdf4") : "#fff",
    color:       partType === val ? (val === "attendee" ? "#0038C6" : "#16a34a") : "#64748b",
    fontWeight:  partType === val ? 800 : 500,
    fontSize: 14, cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f0f5ff", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 20 }}>

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
        <div style={{ width: 44, height: 44, background: "#0038C6", borderRadius: 10,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", fontWeight: 900, fontSize: 11, lineHeight: 1.2, textAlign: "center" }}>RAM+</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 900, color: "#0038C6" }}>CHIANGRAI RAM+ HOSPITAL</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>ระบบลงทะเบียนเข้าอบรม</div>
        </div>
      </div>

      {loading ? (
        <div style={cardStyle}><div style={{ textAlign: "center", color: "#94a3b8", padding: "20px 0" }}>กำลังโหลด…</div></div>

      ) : (error && !course) ? (
        <div style={cardStyle}>
          <div style={{ textAlign: "center", fontSize: 40, marginBottom: 12 }}>❌</div>
          <div style={{ textAlign: "center", fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>ไม่พบหลักสูตร</div>
          <div style={{ textAlign: "center", color: "#64748b", fontSize: 14 }}>{error}</div>
        </div>

      ) : step === "closed" ? (
        <div style={cardStyle}>
          <CourseCard course={course!} />
          <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
            <div style={{ fontWeight: 700, color: "#475569", fontSize: 16 }}>ยังไม่เปิดรับลงทะเบียน</div>
            <div style={{ fontSize: 13, color: "#94a3b8", marginTop: 8 }}>กรุณาติดต่อเจ้าหน้าที่ HR</div>
          </div>
        </div>

      ) : step === "prereg" ? (
        /* ===== PRE-REGISTRATION SUCCESS ===== */
        <div style={{ ...cardStyle, borderTopColor: "#8b5cf6" }}>
          <div style={{ textAlign: "center", fontSize: 56, marginBottom: 12 }}>📅</div>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#8b5cf6", marginBottom: 6 }}>
            ลงทะเบียนล่วงหน้าสำเร็จ!
          </div>
          <div style={{ textAlign: "center", fontSize: 14, color: "#475569", marginBottom: 4 }}>{course?.course}</div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
            {new Date().toLocaleString("th-TH")}
          </div>
          <div style={{ background: "#f5f3ff", borderRadius: 10, border: "1px solid #ddd6fe",
            padding: "16px 20px", marginBottom: registeredType === "attendee" ? 16 : 0 }}>
            <div style={{ fontSize: 13, color: "#6d28d9", fontWeight: 700, marginBottom: 8 }}>
              📌 กรุณาสแกน QR อีกครั้งในวันอบรม
            </div>
            <div style={{ fontSize: 13, color: "#475569" }}>
              วันอบรม: <strong>{thDate(trainingDate ?? course?.course_date ?? null)}</strong>
            </div>
            {course?.start_time && (
              <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                เวลา: <strong>{course.start_time} – {course.end_time}</strong> น.
              </div>
            )}
            {course?.location && (
              <div style={{ fontSize: 13, color: "#475569", marginTop: 4 }}>
                สถานที่: <strong>{course.location}</strong>
              </div>
            )}
          </div>
          {registeredType === "trainer" && (
            <div style={{ background: "#eff4ff", borderRadius: 10, border: "1px solid #c4cfee",
              padding: "14px 20px", textAlign: "center" }}>
              <div style={{ fontWeight: 700, color: "#0038C6" }}>🎤 ลงทะเบียนเป็นวิทยากรแล้ว</div>
            </div>
          )}
        </div>

      ) : step === "updated" ? (
        /* ===== UPGRADED FROM PRE-REG → CHECK-IN ===== */
        <div style={cardStyle}>
          <div style={{ textAlign: "center", fontSize: 56, marginBottom: 12 }}>✅</div>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>
            เช็คชื่อสำเร็จ!
          </div>
          <div style={{ textAlign: "center", fontSize: 14, color: "#475569", marginBottom: 4 }}>{course?.course}</div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
            {new Date().toLocaleString("th-TH")}
          </div>
          {registeredType === "attendee"
            ? <SurveyRedirect countdown={countdown} url={surveyUrl} />
            : <div style={{ background: "#eff4ff", borderRadius: 10, border: "1px solid #c4cfee",
                padding: "18px 20px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "#0038C6" }}>🎤 ลงทะเบียนเป็นวิทยากรสำเร็จ</div>
              </div>
          }
        </div>

      ) : (step === "success" || step === "duplicate") ? (
        /* ===== CHECK-IN / ALREADY REGISTERED ===== */
        <div style={cardStyle}>
          <div style={{ textAlign: "center", fontSize: 56, marginBottom: 12 }}>✅</div>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>
            {step === "duplicate" ? "คุณลงทะเบียนแล้ว" : "เช็คชื่อสำเร็จ!"}
          </div>
          <div style={{ textAlign: "center", fontSize: 14, color: "#475569", marginBottom: 4 }}>{course?.course}</div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginBottom: 24 }}>
            {new Date().toLocaleString("th-TH")}
          </div>
          {registeredType === "attendee"
            ? <SurveyRedirect countdown={countdown} url={surveyUrl} />
            : <div style={{ background: "#eff4ff", borderRadius: 10, border: "1px solid #c4cfee",
                padding: "18px 20px", textAlign: "center" }}>
                <div style={{ fontWeight: 700, color: "#0038C6" }}>🎤 ลงทะเบียนเป็นวิทยากรสำเร็จ</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>ขอบคุณที่ร่วมเป็นวิทยากร</div>
              </div>
          }
        </div>

      ) : course ? (
        /* ===== REGISTRATION FORM ===== */
        <div style={cardStyle}>
          <CourseCard course={course} />

          {/* Pre-reg notice if before training date */}
          {course.course_date && course.course_date > today && (
            <div style={{ background: "#f5f3ff", borderRadius: 8, border: "1px solid #ddd6fe",
              padding: "10px 14px", fontSize: 12, color: "#6d28d9", marginBottom: 18 }}>
              📅 ลงทะเบียนล่วงหน้าได้เลย — สแกน QR อีกครั้งในวันอบรมเพื่อเช็คชื่อ
            </div>
          )}

          {/* Participant type */}
          <div style={{ marginBottom: 18 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
              ประเภทผู้เข้าร่วม <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setPartType("attendee")} style={typeBtn("attendee")}>👥 ผู้เข้ารับการอบรม</button>
              <button onClick={() => setPartType("trainer")}  style={typeBtn("trainer")}>🎤 วิทยากร</button>
            </div>
          </div>

          {/* Name */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                ชื่อ <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="ชื่อจริง" style={inp} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
                นามสกุล <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="นามสกุล" style={inp} />
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              ตำแหน่ง <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <input value={position} onChange={e => setPosition(e.target.value)}
              placeholder="เช่น พยาบาลวิชาชีพ, เจ้าหน้าที่ธุรการ" style={inp} />
          </div>

          {error && (
            <div style={{ background: "#fee2e2", borderRadius: 7, padding: "10px 14px",
              fontSize: 13, color: "#dc2626", marginBottom: 14, border: "1px solid #fecaca" }}>{error}</div>
          )}

          <button onClick={register} disabled={submitting}
            style={{ width: "100%", padding: "14px 0", borderRadius: 9, border: "none",
              background: partType === "attendee" ? "#0038C6" : "#16a34a",
              color: "#fff", fontWeight: 800, fontSize: 16,
              cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit",
              boxShadow: "0 4px 16px rgba(0,56,198,0.3)", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "กำลังลงทะเบียน…" : "✅ ยืนยันลงทะเบียน"}
          </button>

          <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
            ระบบตรวจสอบชื่ออัตโนมัติ ป้องกันลงทะเบียนซ้ำ
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SurveyRedirect({ countdown, url }: { countdown: number; url: string }) {
  return (
    <div style={{ background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0",
      padding: "22px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>📝</div>
      <div style={{ fontWeight: 800, color: "#0a1628", fontSize: 15, marginBottom: 6 }}>
        กรุณาทำแบบสอบถามเพื่อสำเร็จกระบวนการ
      </div>
      <div style={{ fontSize: 13, color: "#475569", marginBottom: 18 }}>
        กำลังนำไปยังแบบสอบถาม… ({countdown})
      </div>
      <a href={url} style={{ display: "inline-block", padding: "11px 32px", borderRadius: 9,
        background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 14,
        textDecoration: "none", boxShadow: "0 4px 12px rgba(22,163,74,0.3)" }}>
        ไปตอบแบบสอบถาม →
      </a>
    </div>
  );
}

function CourseCard({ course }: { course: CourseInfo }) {
  return (
    <div style={{ background: "#f0f5ff", borderRadius: 10, padding: "16px 18px", marginBottom: 24,
      border: "1px solid #dce4f5" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
        <div style={{ fontSize: 28, flexShrink: 0 }}>🎓</div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#0a1628", marginBottom: 4 }}>{course.course}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {course.course_date && `📅 ${course.course_date}`}
            {course.start_time && `  🕐 ${course.start_time}–${course.end_time}`}
          </div>
          {course.location && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>📍 {course.location}</div>}
          {course.trainer  && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>👤 {course.trainer}</div>}
        </div>
      </div>
    </div>
  );
}
