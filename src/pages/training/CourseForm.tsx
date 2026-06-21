import { useState } from "react";

interface Course {
  id: number; course: string; trainer: string | null; course_date: string | null;
  month_label: string | null; target: number; actual: number; status: string;
}
interface Attendee { id?: number; name: string; position: string; result: string; score: string | number; }
interface Props { course: Course | null; onClose: () => void; onSaved: () => void; canEdit: boolean; }

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default function CourseForm({ course, onClose, onSaved, canEdit }: Props) {
  const isNew = !course;
  const [courseName, setCourseName] = useState(course?.course ?? "");
  const [trainer, setTrainer] = useState(course?.trainer ?? "");
  const [courseDate, setCourseDate] = useState(course?.course_date ?? "");
  const [monthLabel, setMonthLabel] = useState(course?.month_label ?? "");
  const [target, setTarget] = useState(String(course?.target ?? 0));
  const [status, setStatus] = useState(course?.status ?? "planned");
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loadedAttendees, setLoadedAttendees] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"info" | "attendees">("info");

  async function loadAttendees() {
    if (loadedAttendees || !course) return;
    const r = await fetch(`/api/training/courses/${course.id}`);
    const d = await r.json() as { ok: boolean; attendees: Attendee[] };
    setAttendees(d.attendees ?? []);
    setLoadedAttendees(true);
  }

  function addAttendee() { setAttendees(prev => [...prev, { name: "", position: "", result: "ผ่าน", score: "" }]); }
  function removeAttendee(i: number) { setAttendees(prev => prev.filter((_, idx) => idx !== i)); }
  function updateAttendee(i: number, field: keyof Attendee, val: string) {
    setAttendees(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));
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

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 580, maxHeight: "90vh", overflowY: "auto", padding: 32, boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 20 }}>{isNew ? "เพิ่มหลักสูตรฝึกอบรม" : "รายละเอียดหลักสูตร"}</div>

        {/* Tabs (only when editing existing) */}
        {!isNew && (
          <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "2px solid #e2e8f0", paddingBottom: 12 }}>
            {(["info", "attendees"] as const).map(t => (
              <button key={t} onClick={() => { setTab(t); if (t === "attendees") loadAttendees(); }} style={{ padding: "6px 18px", borderRadius: 8, border: "none", background: tab === t ? "#7C3AED" : "transparent", color: tab === t ? "#fff" : "#64748b", fontWeight: 600, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {t === "info" ? "ข้อมูลหลักสูตร" : `ผู้เข้าอบรม (${tab === "attendees" ? attendees.length : course?.actual ?? 0})`}
              </button>
            ))}
          </div>
        )}

        {tab === "info" && (
          <>
            {[
              { label: "ชื่อหลักสูตร *", el: <input value={courseName} onChange={e => setCourseName(e.target.value)} style={inp} disabled={!canEdit} /> },
              { label: "วิทยากร", el: <input value={trainer} onChange={e => setTrainer(e.target.value)} style={inp} disabled={!canEdit} /> },
              { label: "วันที่อบรม", el: <input type="date" value={courseDate} onChange={e => setCourseDate(e.target.value)} style={inp} disabled={!canEdit} /> },
              { label: "เดือน", el: (
                <select value={monthLabel} onChange={e => setMonthLabel(e.target.value)} style={inp} disabled={!canEdit}>
                  <option value="">-- เลือกเดือน --</option>
                  {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )},
              { label: "จำนวนเป้าหมาย (คน)", el: <input type="number" value={target} onChange={e => setTarget(e.target.value)} style={inp} min={0} disabled={!canEdit} /> },
              { label: "สถานะ", el: (
                <select value={status} onChange={e => setStatus(e.target.value)} style={inp} disabled={!canEdit}>
                  <option value="planned">วางแผน</option>
                  <option value="upcoming">ใกล้ถึง</option>
                  <option value="done">เสร็จแล้ว</option>
                </select>
              )},
            ].map(({ label, el }) => (
              <div key={label} style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>{label}</label>
                {el}
              </div>
            ))}
          </>
        )}

        {tab === "attendees" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#64748b" }}>รายชื่อผู้เข้าอบรม</div>
              {canEdit && <button onClick={addAttendee} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#7C3AED", color: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>+ เพิ่ม</button>}
            </div>
            {attendees.map((a, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 80px 60px 32px", gap: 6, marginBottom: 8 }}>
                <input value={a.name} onChange={e => updateAttendee(i, "name", e.target.value)} placeholder="ชื่อ" style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit} />
                <input value={a.position} onChange={e => updateAttendee(i, "position", e.target.value)} placeholder="ตำแหน่ง" style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit} />
                <select value={a.result} onChange={e => updateAttendee(i, "result", e.target.value)} style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit}>
                  <option value="ผ่าน">ผ่าน</option>
                  <option value="ไม่ผ่าน">ไม่ผ่าน</option>
                  <option value="ขาด">ขาด</option>
                </select>
                <input type="number" value={String(a.score)} onChange={e => updateAttendee(i, "score", e.target.value)} placeholder="คะแนน" style={{ ...inp, padding: "7px 10px" }} disabled={!canEdit} />
                {canEdit && <button onClick={() => removeAttendee(i)} style={{ border: "none", background: "#fee2e2", color: "#ef4444", borderRadius: 8, cursor: "pointer", fontSize: 16 }}>✕</button>}
              </div>
            ))}
            {attendees.length === 0 && <div style={{ textAlign: "center", padding: 24, color: "#94a3b8", fontSize: 14 }}>ยังไม่มีผู้เข้าอบรม</div>}
          </div>
        )}

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ปิด</button>
          {canEdit && (
            <button onClick={save} disabled={saving} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
