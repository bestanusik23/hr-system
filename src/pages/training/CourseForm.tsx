import { useState } from "react";

interface Course {
  id: number; course: string; trainer: string | null; course_date: string | null;
  month_label: string | null; target: number; actual: number; status: string;
}
interface Attendee { id?: number; name: string; position: string; result: string; score: string | number; }
interface Props { course: Course | null; onClose: () => void; onSaved: () => void; canEdit: boolean; }

const MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export default function CourseForm({ course, onClose, onSaved, canEdit }: Props) {
  const isNew = !course;
  const [courseName,  setCourseName]  = useState(course?.course ?? "");
  const [trainer,     setTrainer]     = useState(course?.trainer ?? "");
  const [courseDate,  setCourseDate]  = useState(course?.course_date ?? "");
  const [monthLabel,  setMonthLabel]  = useState(course?.month_label ?? "");
  const [target,      setTarget]      = useState(String(course?.target ?? 0));
  const [status,      setStatus]      = useState(course?.status ?? "planned");
  const [attendees,   setAttendees]   = useState<Attendee[]>([]);
  const [loadedAtt,   setLoadedAtt]   = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  const [tab,         setTab]         = useState<"info" | "attendees">("info");

  async function loadAttendees() {
    if (loadedAtt || !course) return;
    const r = await fetch(`/api/training/courses/${course.id}`);
    const d = await r.json() as { ok: boolean; attendees: Attendee[] };
    setAttendees(d.attendees ?? []);
    setLoadedAtt(true);
  }

  function addAttendee() { setAttendees(p => [...p, { name: "", position: "", result: "ผ่าน", score: "" }]); }
  function removeAttendee(i: number) { setAttendees(p => p.filter((_, idx) => idx !== i)); }
  function updateAttendee(i: number, field: keyof Attendee, val: string) {
    setAttendees(p => p.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
  }

  async function save() {
    if (!courseName.trim()) { setError("กรุณากรอกชื่อหลักสูตร"); return; }
    setSaving(true); setError("");
    const payload = { course: courseName, trainer: trainer || null, course_date: courseDate || null, month_label: monthLabel || null, target: Number(target) || 0, status, attendees };
    const url = isNew ? "/api/training/courses" : `/api/training/courses/${course.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 7,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 580,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,56,198,0.25)",
        border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
        <div style={{ padding: "24px 28px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
            {isNew ? "เพิ่มหลักสูตรฝึกอบรม" : "รายละเอียดหลักสูตร"}
          </div>

          {/* Tabs */}
          {!isNew && (
            <div style={{ display: "flex", gap: 4, marginBottom: 20,
              background: "#f0f5ff", borderRadius: 7, padding: 4, width: "fit-content",
              border: "1px solid #dce4f5" }}>
              {(["info","attendees"] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); if (t === "attendees") loadAttendees(); }}
                  style={{ padding: "7px 18px", borderRadius: 5, border: "none",
                    background: tab === t ? "#0038C6" : "transparent",
                    color: tab === t ? "#fff" : "#64748b",
                    fontWeight: 600, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  {t === "info" ? "ข้อมูลหลักสูตร" : `ผู้เข้าอบรม (${tab === "attendees" ? attendees.length : course?.actual ?? 0})`}
                </button>
              ))}
            </div>
          )}

          {tab === "info" && (
            <>
              {[
                { label: "ชื่อหลักสูตร *",         el: <input value={courseName} onChange={e => setCourseName(e.target.value)} style={inp} disabled={!canEdit} /> },
                { label: "วิทยากร",                el: <input value={trainer} onChange={e => setTrainer(e.target.value)} style={inp} disabled={!canEdit} /> },
                { label: "วันที่อบรม",              el: <input type="date" value={courseDate} onChange={e => setCourseDate(e.target.value)} style={inp} disabled={!canEdit} /> },
                { label: "เดือน",                  el: (
                    <select value={monthLabel} onChange={e => setMonthLabel(e.target.value)} style={inp} disabled={!canEdit}>
                      <option value="">-- เลือกเดือน --</option>
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                )},
                { label: "จำนวนเป้าหมาย (คน)",    el: <input type="number" value={target} onChange={e => setTarget(e.target.value)} style={inp} min={0} disabled={!canEdit} /> },
                { label: "สถานะ",                  el: (
                    <select value={status} onChange={e => setStatus(e.target.value)} style={inp} disabled={!canEdit}>
                      <option value="planned">วางแผน</option>
                      <option value="upcoming">ใกล้ถึง</option>
                      <option value="done">เสร็จแล้ว</option>
                    </select>
                )},
              ].map(({ label, el }) => (
                <div key={label} style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                    letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 7 }}>{label}</label>
                  {el}
                </div>
              ))}
            </>
          )}

          {tab === "attendees" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: "#64748b" }}>รายชื่อผู้เข้าอบรม</div>
                {canEdit && (
                  <button onClick={addAttendee}
                    style={{ padding: "6px 16px", borderRadius: 7, border: "none",
                      background: "#0038C6", color: "#fff", fontSize: 12,
                      cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                    + เพิ่ม
                  </button>
                )}
              </div>
              {attendees.map((a, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 60px 32px", gap: 6, marginBottom: 8 }}>
                  <input value={a.name} onChange={e => updateAttendee(i,"name",e.target.value)} placeholder="ชื่อ" style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit} />
                  <input value={a.position} onChange={e => updateAttendee(i,"position",e.target.value)} placeholder="ตำแหน่ง" style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit} />
                  <select value={a.result} onChange={e => updateAttendee(i,"result",e.target.value)} style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit}>
                    <option value="ผ่าน">ผ่าน</option>
                    <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                    <option value="ขาด">ขาด</option>
                  </select>
                  <input type="number" value={String(a.score)} onChange={e => updateAttendee(i,"score",e.target.value)} placeholder="คะแนน" style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit} />
                  {canEdit && (
                    <button onClick={() => removeAttendee(i)}
                      style={{ border: "none", background: "#fee2e2", color: "#dc2626", borderRadius: 7, cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  )}
                </div>
              ))}
              {attendees.length === 0 && (
                <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13,
                  background: "#f0f5ff", borderRadius: 8, border: "1px dashed #dce4f5" }}>
                  ยังไม่มีผู้เข้าอบรม
                </div>
              )}
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca",
              borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: "11px 0", borderRadius: 7,
                border: "1.5px solid #c4cfee", background: "#fff",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              ปิด
            </button>
            {canEdit && (
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {saving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
