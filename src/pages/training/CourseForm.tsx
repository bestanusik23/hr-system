import { useState } from "react";

const WORKFLOW: { key: string; label: string; icon: string; color: string; next: string }[] = [
  { key: "planned",  label: "วางแผน",       icon: "📋", color: "#94a3b8", next: "approved" },
  { key: "approved", label: "อนุมัติแล้ว",   icon: "✅", color: "#7c3aed", next: "open" },
  { key: "open",     label: "เปิดรับสมัคร",  icon: "📝", color: "#0891b2", next: "upcoming" },
  { key: "upcoming", label: "กำลังอบรม",     icon: "🎯", color: "#d97706", next: "done" },
  { key: "done",     label: "เสร็จสิ้น",     icon: "🏆", color: "#16a34a", next: "" },
];

interface Course {
  id: number; course_code: string; course: string; course_type: string;
  organizing_dept: string | null; project_owner: string | null; trainer: string | null;
  course_date: string | null; start_time: string | null; end_time: string | null;
  location: string | null; month_label: string | null; target: number;
  budget: number; objectives: string | null; status: string; reg_open: number;
  qr_token: string | null; actual: number;
}
interface Props { course: Course | null; onClose: () => void; onSaved: () => void; canEdit: boolean; }

const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export default function CourseForm({ course, onClose, onSaved, canEdit }: Props) {
  const isNew = !course;
  const [courseName,      setCourseName]      = useState(course?.course ?? "");
  const [courseType,      setCourseType]      = useState(course?.course_type ?? "Internal");
  const [organizingDept,  setOrganizingDept]  = useState(course?.organizing_dept ?? "");
  const [projectOwner,    setProjectOwner]    = useState(course?.project_owner ?? "");
  const [trainer,         setTrainer]         = useState(course?.trainer ?? "");
  const [courseDate,      setCourseDate]      = useState(course?.course_date ?? "");
  const [startTime,       setStartTime]       = useState(course?.start_time ?? "");
  const [endTime,         setEndTime]         = useState(course?.end_time ?? "");
  const [location,        setLocation]        = useState(course?.location ?? "");
  const [monthLabel,      setMonthLabel]      = useState(course?.month_label ?? "");
  const [target,          setTarget]          = useState(String(course?.target ?? 0));
  const [budget,          setBudget]          = useState(String(course?.budget ?? 0));
  const [objectives,      setObjectives]      = useState(course?.objectives ?? "");
  const [attachmentUrl,   setAttachmentUrl]   = useState(course?.attachment_url ?? "");
  const [status,          setStatus]          = useState(course?.status ?? "planned");
  const [regOpen,         setRegOpen]         = useState(course?.reg_open !== 0);
  const [saving,          setSaving]          = useState(false);
  const [error,           setError]           = useState("");

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 11px", borderRadius: 7,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
    letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 5,
  };
  const row2: React.CSSProperties = {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12,
  };

  async function save() {
    if (!courseName.trim()) { setError("กรุณากรอกชื่อหลักสูตร"); return; }
    setSaving(true); setError("");
    const payload = {
      course: courseName, course_type: courseType,
      organizing_dept: organizingDept || null, project_owner: projectOwner || null,
      trainer: trainer || null, course_date: courseDate || null,
      start_time: startTime || null, end_time: endTime || null,
      location: location || null, month_label: monthLabel || null,
      target: Number(target) || 0, budget: Number(budget) || 0,
      objectives: objectives || null, attachment_url: attachmentUrl || null,
      status, reg_open: regOpen ? 1 : 0,
    };
    const url    = isNew ? "/api/training/courses" : `/api/training/courses/${course!.id}`;
    const method = isNew ? "POST" : "PUT";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 680,
        maxHeight: "92vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,56,198,0.25)",
        border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
        <div style={{ padding: "24px 28px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
            {isNew ? "เพิ่มหลักสูตรฝึกอบรม" : `แก้ไขหลักสูตร · ${course!.course_code}`}
          </div>

          {/* ชื่อหลักสูตร */}
          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>ชื่อหลักสูตร *</label>
            <input value={courseName} onChange={e => setCourseName(e.target.value)} style={inp} disabled={!canEdit} placeholder="ระบุชื่อหลักสูตร" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>ประเภทการอบรม</label>
            <select value={courseType} onChange={e => setCourseType(e.target.value)} style={inp} disabled={!canEdit}>
              <option value="Internal">Internal</option>
              <option value="External">External</option>
              <option value="Mandatory">Mandatory Training</option>
              <option value="Continuing">Continuing Education</option>
            </select>
          </div>

          {/* 5-step workflow stepper */}
          {!isNew && (() => {
            const curIdx = WORKFLOW.findIndex(w => w.key === status);
            const cur    = WORKFLOW[curIdx] ?? WORKFLOW[0];
            const next   = cur.next ? WORKFLOW.find(w => w.key === cur.next) : null;
            return (
              <div style={{ marginBottom: 16 }}>
                <label style={lbl}>สถานะ / ขั้นตอน</label>
                {/* Stepper bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 12, overflowX: "auto" }}>
                  {WORKFLOW.map((w, i) => {
                    const done  = i < curIdx;
                    const active = i === curIdx;
                    return (
                      <div key={w.key} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 60 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                          <div style={{
                            width: 36, height: 36, borderRadius: "50%", fontSize: 16,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            background: active ? w.color : done ? w.color + "30" : "#f1f5f9",
                            border: `2px solid ${active ? w.color : done ? w.color + "80" : "#e2e8f0"}`,
                            color: active ? "#fff" : done ? w.color : "#94a3b8",
                            fontWeight: 700, transition: "all .2s",
                          }}>
                            {done ? "✓" : w.icon}
                          </div>
                          <div style={{ fontSize: 10, marginTop: 4, fontWeight: active ? 700 : 400,
                            color: active ? w.color : done ? "#64748b" : "#94a3b8", textAlign: "center",
                            whiteSpace: "nowrap" }}>{w.label}</div>
                        </div>
                        {i < WORKFLOW.length - 1 && (
                          <div style={{ height: 2, width: 24, flexShrink: 0,
                            background: done ? cur.color + "60" : "#e2e8f0", marginBottom: 20 }} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* Advance button */}
                {canEdit && next && (
                  <button type="button" onClick={() => setStatus(next.key)}
                    style={{ width: "100%", padding: "10px 0", borderRadius: 8, border: "none",
                      background: next.color, color: "#fff", fontWeight: 700, fontSize: 13,
                      cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {next.icon} ขยับสู่ขั้นตอนถัดไป: {next.label} →
                  </button>
                )}
                {!next && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8,
                    padding: "10px 14px", fontSize: 13, color: "#16a34a", fontWeight: 600,
                    textAlign: "center" }}>
                    🏆 เสร็จสิ้นทุกขั้นตอนแล้ว
                  </div>
                )}
                {/* Hidden: allow manual override via small dropdown */}
                {canEdit && (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: "#94a3b8", cursor: "pointer", userSelect: "none" }}>
                      ⚙ เปลี่ยนสถานะด้วยตนเอง
                    </summary>
                    <select value={status} onChange={e => setStatus(e.target.value)}
                      style={{ ...inp, marginTop: 6, fontSize: 12 }}>
                      {WORKFLOW.map(w => <option key={w.key} value={w.key}>{w.icon} {w.label}</option>)}
                    </select>
                  </details>
                )}
              </div>
            );
          })()}
          {isNew && (
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>สถานะเริ่มต้น</label>
              <div style={{ background: "#f0f5ff", borderRadius: 8, padding: "10px 14px",
                fontSize: 13, color: "#0038C6", fontWeight: 600, border: "1px solid #dce4f5" }}>
                📋 วางแผน (ขั้นตอนที่ 1/5)
              </div>
            </div>
          )}

          <div style={row2}>
            <div>
              <label style={lbl}>แผนกผู้จัดอบรม</label>
              <input value={organizingDept} onChange={e => setOrganizingDept(e.target.value)} style={inp} disabled={!canEdit} placeholder="เช่น ฝ่าย HRD" />
            </div>
            <div>
              <label style={lbl}>ผู้รับผิดชอบโครงการ</label>
              <input value={projectOwner} onChange={e => setProjectOwner(e.target.value)} style={inp} disabled={!canEdit} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>วิทยากร</label>
            <input value={trainer} onChange={e => setTrainer(e.target.value)} style={inp} disabled={!canEdit} />
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>วันที่อบรม</label>
              <input type="date" value={courseDate} onChange={e => {
                setCourseDate(e.target.value);
                if (e.target.value) {
                  const d   = new Date(e.target.value);
                  const mo  = MONTHS_TH[d.getMonth()];
                  const yr  = d.getFullYear() + 543;
                  setMonthLabel(`${mo} ${yr}`);
                }
              }} style={inp} disabled={!canEdit} />
            </div>
            <div>
              <label style={lbl}>เดือน (auto)</label>
              <input value={monthLabel} onChange={e => setMonthLabel(e.target.value)} style={{ ...inp, background: "#f8fafc" }} disabled={!canEdit} />
            </div>
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>เวลาเริ่ม</label>
              <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} style={inp} disabled={!canEdit} />
            </div>
            <div>
              <label style={lbl}>เวลาสิ้นสุด</label>
              <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={inp} disabled={!canEdit} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>สถานที่</label>
            <input value={location} onChange={e => setLocation(e.target.value)} style={inp} disabled={!canEdit} placeholder="เช่น ห้องประชุม 1 ชั้น 3" />
          </div>

          <div style={row2}>
            <div>
              <label style={lbl}>จำนวนเป้าหมาย (คน)</label>
              <input type="number" value={target} onChange={e => setTarget(e.target.value)} style={inp} min={0} disabled={!canEdit} />
            </div>
            <div>
              <label style={lbl}>งบประมาณ (บาท)</label>
              <input type="number" value={budget} onChange={e => setBudget(e.target.value)} style={inp} min={0} disabled={!canEdit} />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>วัตถุประสงค์</label>
            <textarea value={objectives} onChange={e => setObjectives(e.target.value)} rows={3}
              style={{ ...inp, resize: "vertical" }} disabled={!canEdit} placeholder="ระบุวัตถุประสงค์ของหลักสูตร" />
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={lbl}>เอกสารแนบ (URL)</label>
            <input value={attachmentUrl} onChange={e => setAttachmentUrl(e.target.value)} style={inp} disabled={!canEdit} placeholder="https://..." />
          </div>

          {/* reg_open toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16,
            background: "#f0f5ff", borderRadius: 8, padding: "10px 14px", border: "1px solid #dce4f5" }}>
            <input type="checkbox" id="regOpen" checked={regOpen}
              onChange={e => setRegOpen(e.target.checked)} disabled={!canEdit}
              style={{ width: 16, height: 16, accentColor: "#0038C6", cursor: "pointer" }} />
            <label htmlFor="regOpen" style={{ fontSize: 13, fontWeight: 600, color: "#0a1628", cursor: "pointer" }}>
              เปิดรับลงทะเบียน (QR Check-in)
            </label>
          </div>

          {!isNew && course!.qr_token && (
            <div style={{ marginBottom: 16, background: "#f0f5ff", borderRadius: 8, padding: "12px 16px",
              border: "1px solid #dce4f5", display: "flex", alignItems: "center", gap: 12 }}>
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(
                  `${window.location.origin}/checkin?token=${course!.qr_token}`
                )}`}
                alt="QR" style={{ borderRadius: 6, border: "1px solid #c4cfee" }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#0038C6", marginBottom: 4 }}>QR Code สำหรับเช็คชื่อ</div>
                <div style={{ fontSize: 11, color: "#64748b", wordBreak: "break-all" }}>
                  {window.location.origin}/checkin?token={course!.qr_token}
                </div>
                <button onClick={() => {
                  const url = `${window.location.origin}/checkin?token=${course!.qr_token}`;
                  navigator.clipboard.writeText(url);
                }} style={{ marginTop: 6, fontSize: 11, padding: "4px 10px", borderRadius: 5,
                  border: "1px solid #c4cfee", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>
                  📋 คัดลอก URL
                </button>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", borderRadius: 7, padding: "10px 14px",
              fontSize: 13, color: "#dc2626", marginBottom: 14, border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: "11px 0", borderRadius: 7,
                border: "1.5px solid #c4cfee", background: "#fff",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>ปิด</button>
            {canEdit && (
              <button onClick={save} disabled={saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {saving ? "กำลังบันทึก…" : isNew ? "สร้างหลักสูตร" : "บันทึกการแก้ไข"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
