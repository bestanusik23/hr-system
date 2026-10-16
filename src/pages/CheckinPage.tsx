import { useEffect, useRef, useState } from "react";

interface EmpSuggestion { emp_code: string | null; full_name: string; position: string | null; department_name: string | null; }

interface CourseInfo {
  id: number; course_code: string; course: string; course_type: string;
  course_date: string | null; start_time: string | null; end_time: string | null;
  location: string | null; trainer: string | null; reg_open: number;
  status: string; is_cancelled: number;
  checkin_sessions?: number;
}

type Step = "form" | "success" | "prereg" | "updated" | "duplicate" | "closed" | "session";
type Sess = "am" | "pm";
interface Windows { am_from: string; am_to: string; pm_from: string; pm_to: string }
interface Saved { prefix: string; firstName: string; lastName: string; position: string; department: string; empCode: string | null; }
const savedKey = (token: string) => `ramTrainingId:${token}`;
function loadSaved(token: string): Saved | null {
  try { const v = JSON.parse(localStorage.getItem(savedKey(token)) ?? "null") as Saved | null; return v && v.firstName && v.lastName ? v : null; } catch { return null; }
}
const SESS_LABEL: Record<Sess, string> = { am: "รอบเช้า", pm: "รอบบ่าย" };

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

  const [prefix,     setPrefix]     = useState("นาย");
  const [firstName,  setFirstName]  = useState("");
  const [lastName,   setLastName]   = useState("");
  const [position,   setPosition]   = useState("");
  const [department, setDepartment] = useState("");
  const [empCode,    setEmpCode]    = useState<string | null>(null);

  // Employee autocomplete
  const [empSearch,    setEmpSearch]    = useState("");
  const [suggestions,  setSuggestions]  = useState<EmpSuggestion[]>([]);
  const [showDrop,     setShowDrop]     = useState(false);
  const [autoFilled,   setAutoFilled]   = useState(false);
  const [searching,    setSearching]    = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [registeredId,   setRegisteredId]   = useState<number | null>(null);
  const [registeredType, setRegisteredType] = useState<"attendee" | "trainer">("attendee");
  const [trainingDate,   setTrainingDate]   = useState<string | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [serverToday, setServerToday] = useState<string | null>(null);
  const [sessionNow,  setSessionNow]  = useState<Sess | null>(null);
  const [windows,     setWindows]     = useState<Windows | null>(null);
  const [sessResult,  setSessResult]  = useState<{ session: Sess; already: boolean; done: Sess[]; walkin: boolean } | null>(null);
  const [quick,       setQuick]       = useState<Saved | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!token) { setError("ไม่พบ QR Token"); setLoading(false); return; }
    fetch(`/api/training/checkin?token=${encodeURIComponent(token)}`)
      .then(r => r.json() as Promise<{ ok: boolean; course?: CourseInfo; error?: string; today?: string; session_now?: Sess | null; windows?: Windows }>)
      .then(d => {
        if (!d.ok || !d.course) { setError(d.error ?? "QR Code ไม่ถูกต้อง"); }
        else {
          setCourse(d.course);
          if (d.today) setServerToday(d.today);
          setSessionNow(d.session_now ?? null);
          if (d.windows) setWindows(d.windows);
          // หลักสูตรเช็คชื่อ 2 รอบ: ปิดรับลงทะเบียนแล้วผู้ที่ลงทะเบียนไว้ยังเช็คชื่อได้ (server ตัดสิน)
          if (!d.course.reg_open && d.course.checkin_sessions !== 2) setStep("closed");
          // สแกนซ้ำในวันอบรมจากเครื่องเดิม → เช็คชื่อรอบถัดไปได้ในคลิกเดียว
          if (d.course.checkin_sessions === 2 && d.course.course_date && d.course.course_date === d.today) setQuick(loadSaved(token));
        }
        setLoading(false);
      });
  }, [token]);

  // Debounced employee search
  useEffect(() => {
    if (autoFilled || empSearch.trim().length < 2) { setSuggestions([]); setShowDrop(false); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      const r = await fetch(`/api/training/emp-lookup?token=${encodeURIComponent(token)}&q=${encodeURIComponent(empSearch.trim())}`);
      const d = await r.json() as { ok: boolean; employees: EmpSuggestion[] };
      setSuggestions(d.employees ?? []);
      setShowDrop(true);
      setSearching(false);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [empSearch, autoFilled]); // eslint-disable-line

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function selectEmp(emp: EmpSuggestion) {
    const parts = emp.full_name.trim().split(" ");
    const PREFIXES = ["นาย","นาง","น.ส.","ดร.","นพ.","พญ.","ทพ.","ทพญ.","ภก.","ภกญ."];
    const hasPrefix = PREFIXES.some(p => emp.full_name.startsWith(p));
    if (hasPrefix) {
      const found = PREFIXES.find(p => emp.full_name.startsWith(p))!;
      setPrefix(found);
      const rest = emp.full_name.slice(found.length).trim().split(" ");
      setFirstName(rest[0] ?? "");
      setLastName(rest.slice(1).join(" "));
    } else {
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" "));
    }
    if (emp.position)        setPosition(emp.position);
    if (emp.department_name) setDepartment(emp.department_name);
    setEmpCode(emp.emp_code ?? null);
    setEmpSearch(emp.full_name);
    setAutoFilled(true);
    setShowDrop(false);
  }

  function clearEmp() {
    setEmpSearch(""); setAutoFilled(false); setEmpCode(null);
    setFirstName(""); setLastName(""); setPosition(""); setDepartment("");
    setSuggestions([]); setShowDrop(false);
  }

  // บังคับเลือกชื่อจากผลการค้นหาเท่านั้น (ไม่ให้พิมพ์ชื่อเอง) — ค้นไม่พบให้ติดต่อ HR
  function register() {
    if (!autoFilled || !firstName.trim()) {
      setError("กรุณาค้นหาและเลือกชื่อของท่านจากรายการ หากค้นหาไม่พบ กรุณาติดต่อเจ้าหน้าที่ HR"); return;
    }
    return submit({ prefix, firstName: firstName.trim(), lastName: lastName.trim(), position: position.trim(), department: department.trim(), empCode });
  }

  async function submit(v: Saved) {
    setSubmitting(true); setError("");
    const r = await fetch("/api/training/checkin", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token, first_name: `${v.prefix}${v.firstName}`, last_name: v.lastName,
        position: v.position, department: v.department || undefined,
        emp_code: v.empCode ?? undefined,
      }),
    });
    const d = await r.json() as {
      ok: boolean; duplicate?: boolean; prereg?: boolean; updated?: boolean;
      attendee_id?: number; participant_type?: string; course_date?: string; error?: string;
      two_sessions?: boolean; session?: Sess; already?: boolean; sessions_done?: Sess[]; walkin?: boolean;
    };
    setSubmitting(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setRegisteredId(d.attendee_id ?? null);
    setRegisteredType((d.participant_type as "attendee" | "trainer") ?? "attendee");
    setTrainingDate(d.course_date ?? course?.course_date ?? null);
    if (d.two_sessions && !d.session) { setStep("prereg"); return; }
    if (d.two_sessions) {
      try { localStorage.setItem(savedKey(token), JSON.stringify(v)); } catch { /* private mode */ }
    }
    if (d.two_sessions && d.session) {
      setSessResult({ session: d.session, already: !!d.already, done: d.sessions_done ?? [d.session], walkin: !!d.walkin });
      setStep("session");
      return;
    }
    if      (d.duplicate) setStep("duplicate");
    else if (d.updated)   setStep("updated");
    else if (d.prereg)    setStep("prereg");
    else                  setStep("success");
  }

  const today       = serverToday ?? new Date().toISOString().slice(0, 10);
  const twoSessions = course?.checkin_sessions === 2;
  const onTrainingDay = !!course?.course_date && course.course_date === today;
  const winText = windows ? `รอบเช้า ${windows.am_from}–${windows.am_to} น. · รอบบ่าย ${windows.pm_from}–${windows.pm_to} น.` : "";
  // เช็คชื่อ 2 รอบในวันอบรม แต่ยังไม่อยู่ในช่วงเวลาของรอบใดเลย → ล็อก
  const locked = twoSessions && onTrainingDay && !sessionNow;
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
              {twoSessions ? "📌 วันอบรมกรุณาสแกน QR นี้ 2 รอบ (เช้า และ บ่าย)" : "📌 กรุณาสแกน QR อีกครั้งในวันอบรม"}
            </div>
            {twoSessions && (
              <div style={{ fontSize: 12, color: "#6d28d9", marginBottom: 8 }}>
                {winText} — สแกนได้เฉพาะในช่วงเวลานี้ และต้องครบทั้ง 2 รอบจึงจะได้รับใบประกาศนียบัตร
              </div>
            )}
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

      ) : step === "session" && sessResult ? (
        /* ===== 2-SESSION CHECK-IN RESULT ===== */
        <div style={cardStyle}>
          <div style={{ textAlign: "center", fontSize: 56, marginBottom: 12 }}>{sessResult.already ? "ℹ️" : "✅"}</div>
          <div style={{ textAlign: "center", fontSize: 20, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>
            {sessResult.already ? `เช็คชื่อ${SESS_LABEL[sessResult.session]}ไว้แล้ว` : `เช็คชื่อ${SESS_LABEL[sessResult.session]}สำเร็จ!`}
          </div>
          <div style={{ textAlign: "center", fontSize: 14, color: "#475569", marginBottom: 4 }}>{course?.course}</div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
            {new Date().toLocaleString("th-TH")}
          </div>
          {sessResult.walkin && (
            <div style={{ background: "#fff7ed", borderRadius: 8, border: "1px solid #fed7aa", padding: "10px 14px",
              fontSize: 12, color: "#9a3412", marginBottom: 14, textAlign: "center" }}>
              ⚠️ ไม่พบชื่อท่านในรายชื่อลงทะเบียนล่วงหน้า — บันทึกเป็นผู้เข้าร่วมเพิ่มเติม เจ้าหน้าที่ HR จะตรวจสอบ
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            {(["am", "pm"] as Sess[]).map(k => {
              const ok = sessResult.done.includes(k);
              return (
                <div key={k} style={{ flex: 1, textAlign: "center", padding: "12px 0", borderRadius: 10,
                  border: `1.5px solid ${ok ? "#86efac" : "#e2e8f0"}`, background: ok ? "#f0fdf4" : "#f8fafc" }}>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 700 }}>{SESS_LABEL[k]}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: ok ? "#16a34a" : "#94a3b8", marginTop: 2 }}>{ok ? "✓ เช็คแล้ว" : "ยังไม่ได้เช็ค"}</div>
                </div>
              );
            })}
          </div>
          {registeredType === "trainer" ? (
            <div style={{ background: "#eff4ff", borderRadius: 10, border: "1px solid #c4cfee", padding: "14px 20px", textAlign: "center" }}>
              <div style={{ fontWeight: 700, color: "#0038C6" }}>🎤 บันทึกการเข้าร่วมของวิทยากรแล้ว</div>
            </div>
          ) : sessResult.done.length < 2 ? (
            <div style={{ background: "#fffbeb", borderRadius: 10, border: "1px solid #fde68a", padding: "14px 18px", textAlign: "center", fontSize: 13, color: "#92400e" }}>
              📌 กรุณาสแกน QR นี้อีกครั้งในรอบ{sessResult.done.includes("am") ? "บ่าย" : "เช้า"} — ต้องเช็คชื่อครบทั้ง 2 รอบจึงจะได้รับใบประกาศนียบัตร
            </div>
          ) : (
            <div style={{ background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0", padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontWeight: 800, color: "#0a1628", fontSize: 14, marginBottom: 6 }}>เช็คชื่อครบทั้ง 2 รอบแล้ว 🎉</div>
              <div style={{ fontSize: 12, color: "#475569", marginBottom: 12 }}>ตอบแบบประเมินเมื่ออบรมเสร็จ เพื่อให้การเข้าร่วมสมบูรณ์</div>
              <a href={surveyUrl} style={{ display: "inline-block", padding: "10px 28px", borderRadius: 9,
                background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 14, textDecoration: "none" }}>ไปตอบแบบประเมิน →</a>
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

      ) : course && quick ? (
        /* ===== ONE-TAP RE-SCAN (same phone, same person) ===== */
        <div style={cardStyle}>
          <CourseCard course={course} />
          <div style={{ background: "#eff4ff", borderRadius: 8, border: "1px solid #c4cfee", padding: "10px 14px",
            fontSize: 13, color: "#0038C6", fontWeight: 700, marginBottom: 18 }}>
            {sessionNow ? `🕘 กำลังเช็คชื่อ${SESS_LABEL[sessionNow]}` : `🔒 ขณะนี้ยังไม่เปิดเช็คชื่อ (${winText})`}
          </div>
          <div style={{ textAlign: "center", marginBottom: 20 }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>เช็คชื่อในนาม</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0a1628" }}>{quick.prefix}{quick.firstName} {quick.lastName}</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{[quick.position, quick.department].filter(Boolean).join(" · ")}</div>
          </div>
          {error && (
            <div style={{ background: "#fee2e2", borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626",
              marginBottom: 14, border: "1px solid #fecaca" }}>{error}</div>
          )}
          <button onClick={() => submit(quick)} disabled={submitting || locked}
            style={{ width: "100%", padding: "14px 0", borderRadius: 9, border: "none", background: locked ? "#94a3b8" : "#0038C6", color: "#fff",
              fontWeight: 800, fontSize: 16, cursor: submitting || locked || !autoFilled ? "not-allowed" : "pointer", fontFamily: "inherit",
              boxShadow: locked || !autoFilled ? "none" : "0 4px 16px rgba(0,56,198,0.3)", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "กำลังบันทึก…" : locked ? "🔒 ยังไม่เปิดเช็คชื่อ" : `✅ ยืนยัน เช็คชื่อ${SESS_LABEL[sessionNow as Sess]}`}
          </button>
          <button onClick={() => { setQuick(null); setError(""); }}
            style={{ width: "100%", marginTop: 10, padding: "10px 0", borderRadius: 9, border: "1.5px solid #c4cfee",
              background: "#fff", color: "#475569", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            ไม่ใช่ฉัน / ค้นหาชื่อใหม่
          </button>
        </div>

      ) : course ? (
        /* ===== REGISTRATION FORM ===== */
        <div style={cardStyle}>
          <CourseCard course={course} />

          {twoSessions && onTrainingDay && (
            <div style={{ background: locked ? "#fff7ed" : "#eff4ff", borderRadius: 8, border: `1px solid ${locked ? "#fed7aa" : "#c4cfee"}`,
              padding: "10px 14px", fontSize: 13, color: locked ? "#9a3412" : "#0038C6", fontWeight: 700, marginBottom: 18 }}>
              {locked
                ? <>🔒 ขณะนี้ยังไม่เปิดเช็คชื่อ — เช็คได้เฉพาะ {winText}</>
                : <>🕘 กำลังเช็คชื่อ{SESS_LABEL[sessionNow as Sess]} — ต้องเช็คทั้งรอบเช้าและรอบบ่ายจึงจะได้รับใบประกาศนียบัตร</>}
            </div>
          )}

          {/* Pre-reg notice if before training date */}
          {course.course_date && course.course_date > today && (
            <div style={{ background: "#f5f3ff", borderRadius: 8, border: "1px solid #ddd6fe",
              padding: "10px 14px", fontSize: 12, color: "#6d28d9", marginBottom: 18 }}>
              {twoSessions ? (
                <>
                  📅 ลงทะเบียนล่วงหน้าได้เลย — <strong>ในวันอบรมต้องสแกน QR นี้ 2 รอบ</strong>
                  <div style={{ marginTop: 6, color: "#5b21b6" }}>
                    ☀️ รอบเช้า: สแกนหลังอบรมช่วงเช้าเสร็จ{windows ? ` (${windows.am_from}–${windows.am_to} น.)` : ""}<br />
                    🌙 รอบบ่าย: สแกนหลังอบรมช่วงบ่ายเสร็จ{windows ? ` (${windows.pm_from}–${windows.pm_to} น.)` : ""}<br />
                    สแกนนอกช่วงเวลาไม่ได้ · ต้องเช็คครบทั้งเช้าและบ่ายจึงจะได้รับใบประกาศนียบัตร
                  </div>
                </>
              ) : "📅 ลงทะเบียนล่วงหน้าได้เลย — สแกน QR อีกครั้งในวันอบรมเพื่อเช็คชื่อ"}
            </div>
          )}

          {/* Employee search autocomplete */}
          <div ref={searchRef} style={{ marginBottom: 18, position: "relative" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
              ค้นหาชื่อของท่าน <span style={{ color: "#dc2626" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                value={empSearch}
                onChange={e => { setEmpSearch(e.target.value); setAutoFilled(false); }}
                placeholder="พิมพ์ชื่อ นามสกุล หรือรหัสพนักงาน แล้วเลือกจากรายการ"
                style={{ ...inp, borderColor: autoFilled ? "#16a34a" : "#c4cfee",
                  paddingRight: autoFilled ? 36 : 12 }}
              />
              {searching && (
                <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  fontSize: 11, color: "#94a3b8" }}>ค้นหา…</span>
              )}
              {autoFilled && (
                <button onClick={clearEmp}
                  style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 18 }}>✕</button>
              )}
            </div>
            {showDrop && suggestions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                border: "1.5px solid #c4cfee", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,56,198,.14)",
                zIndex: 50, maxHeight: 240, overflowY: "auto", marginTop: 3 }}>
                {suggestions.map((e, i) => (
                  <div key={i} onMouseDown={() => selectEmp(e)}
                    style={{ padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid #f0f5ff",
                      display: "flex", alignItems: "center", gap: 10 }}
                    onMouseEnter={ev => (ev.currentTarget.style.background = "#f4f7ff")}
                    onMouseLeave={ev => (ev.currentTarget.style.background = "")}>
                    <div style={{ fontFamily: "monospace", fontSize: 11, color: "#0038C6",
                      background: "#eff4ff", borderRadius: 4, padding: "2px 7px", whiteSpace: "nowrap", flexShrink: 0 }}>
                      {e.emp_code ?? "—"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0a1628" }}>{e.full_name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        {[e.position, e.department_name].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {showDrop && suggestions.length === 0 && !searching && empSearch.trim().length >= 2 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                border: "1.5px solid #c4cfee", borderRadius: 10, boxShadow: "0 8px 28px rgba(0,56,198,.1)",
                zIndex: 50, padding: "14px", textAlign: "center", color: "#dc2626", fontSize: 13, marginTop: 3 }}>
                ไม่พบชื่อในระบบ — กรุณาติดต่อเจ้าหน้าที่ HR
              </div>
            )}
          </div>

          {/* ข้อมูลจากระบบ (แสดงหลังเลือกชื่อจากรายการ — แก้ไขเองไม่ได้) */}
          {autoFilled && (
            <div style={{ background: "#f0fdf4", borderRadius: 9, border: "1.5px solid #86efac",
              padding: "12px 16px", marginBottom: 16, fontSize: 13 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase",
                letterSpacing: "0.07em", marginBottom: 8 }}>✓ ข้อมูลจากระบบ</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628", marginBottom: 6 }}>{empSearch}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div><span style={{ color: "#475569" }}>รหัสพนักงาน: </span>
                  <strong style={{ color: "#0038C6", fontFamily: "monospace" }}>{empCode ?? "—"}</strong></div>
                <div><span style={{ color: "#475569" }}>แผนก: </span>
                  <strong style={{ color: "#0a1628" }}>{department || "—"}</strong></div>
                <div style={{ gridColumn: "1 / -1" }}><span style={{ color: "#475569" }}>ตำแหน่ง: </span>
                  <strong style={{ color: "#0a1628" }}>{position || "—"}</strong></div>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", borderRadius: 7, padding: "10px 14px",
              fontSize: 13, color: "#dc2626", marginBottom: 14, border: "1px solid #fecaca" }}>{error}</div>
          )}

          <button onClick={register} disabled={submitting || locked || !autoFilled}
            style={{ width: "100%", padding: "14px 0", borderRadius: 9, border: "none",
              background: locked || !autoFilled ? "#94a3b8" : "#0038C6",
              color: "#fff", fontWeight: 800, fontSize: 16,
              cursor: submitting || locked ? "not-allowed" : "pointer", fontFamily: "inherit",
              boxShadow: locked ? "none" : "0 4px 16px rgba(0,56,198,0.3)", opacity: submitting ? 0.7 : 1 }}>
            {submitting ? "กำลังบันทึก…" : locked ? "🔒 ยังไม่เปิดเช็คชื่อ" : (twoSessions && onTrainingDay ? `✅ เช็คชื่อ${SESS_LABEL[sessionNow as Sess]}` : "✅ ยืนยันลงทะเบียน")}
          </button>

          <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 12 }}>
            ต้องเลือกชื่อจากระบบเท่านั้น · หากค้นหาไม่พบ กรุณาติดต่อเจ้าหน้าที่ HR
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
