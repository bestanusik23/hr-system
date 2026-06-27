import { useEffect, useRef, useState } from "react";

interface Course { id: number; course_code: string; course: string; course_date: string | null; status: string; reg_open: number; qr_token: string | null; target: number; actual: number; }
interface Reg {
  id: number; course_id: number; emp_code: string | null; name: string;
  department: string | null; position: string | null; phone: string | null;
  reg_method: string; attendance_status: string; checkin_time: string | null;
}
interface EmpOption { id: number; emp_code: string | null; full_name: string; position: string | null; department_name: string | null; }

const STATUS_LABEL: Record<string, string> = {
  registered: "ลงทะเบียน", checked_in: "เช็คชื่อแล้ว", late: "สาย",
  absent: "ขาด", completed: "เสร็จสิ้น",
};
const STATUS_COLOR: Record<string, string> = {
  registered: "#94a3b8", checked_in: "#16a34a", late: "#d97706",
  absent: "#dc2626", completed: "#0038C6",
};

interface Props { canEdit: boolean; initCourseId: number | null; }

export default function RegTab({ canEdit, initCourseId }: Props) {
  const [courses, setCourses]     = useState<Course[]>([]);
  const [selId, setSelId]         = useState<number | "">("");
  const [regs, setRegs]           = useState<Reg[]>([]);
  const [loading, setLoading]     = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [showQr, setShowQr]       = useState(false);
  const [saving, setSaving]       = useState(false);
  const [selCourse, setSelCourse] = useState<Course | null>(null);

  // new reg form
  const [fEmpCode, setFEmpCode]   = useState("");
  const [fName, setFName]         = useState("");
  const [fDept, setFDept]         = useState("");
  const [fPos, setFPos]           = useState("");
  const [formErr, setFormErr]     = useState("");

  // employee search
  const [empList, setEmpList]         = useState<EmpOption[]>([]);
  const [empSearch, setEmpSearch]     = useState("");
  const [showDrop, setShowDrop]       = useState(false);
  const [autoFilled, setAutoFilled]   = useState(false);
  const searchRef                     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/training/courses")
      .then(r => r.json() as Promise<{ ok: boolean; courses: Course[] }>)
      .then(d => {
        setCourses(d.courses ?? []);
        const startId = initCourseId ?? d.courses[0]?.id;
        if (startId) setSelId(startId);
      });
    fetch("/api/eval/employees")
      .then(r => r.json() as Promise<{ ok: boolean; employees: EmpOption[] }>)
      .then(d => setEmpList(d.employees ?? []));
  }, [initCourseId]);

  // close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDrop(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (!selId) return;
    loadRegs(selId as number);
    setSelCourse(courses.find(c => c.id === selId) ?? null);
  }, [selId, courses]);

  async function loadRegs(id: number) {
    setLoading(true);
    const r = await fetch(`/api/training/registrations?course_id=${id}`);
    const d = await r.json() as { ok: boolean; registrations: Reg[] };
    setRegs(d.registrations ?? []);
    setLoading(false);
  }

  function selectEmp(emp: EmpOption) {
    setFEmpCode(emp.emp_code ?? "");
    setFName(emp.full_name);
    setFDept(emp.department_name ?? "");
    setFPos(emp.position ?? "");
    setEmpSearch(emp.full_name);
    setAutoFilled(true);
    setShowDrop(false);
  }

  function clearForm() {
    setFEmpCode(""); setFName(""); setFDept(""); setFPos("");
    setEmpSearch(""); setAutoFilled(false); setShowDrop(false); setFormErr("");
  }

  const filteredEmps = empSearch.trim().length >= 1
    ? empList.filter(e =>
        e.full_name.toLowerCase().includes(empSearch.toLowerCase()) ||
        (e.emp_code ?? "").toLowerCase().includes(empSearch.toLowerCase())
      ).slice(0, 8)
    : [];

  async function addReg() {
    if (!fName.trim()) { setFormErr("กรุณากรอกชื่อ-นามสกุล"); return; }
    setSaving(true); setFormErr("");
    const r = await fetch("/api/training/registrations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: selId, emp_code: fEmpCode || null, name: fName, department: fDept || null, position: fPos || null, phone: null }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setFormErr(d.error ?? "เกิดข้อผิดพลาด"); return; }
    clearForm(); setShowForm(false);
    loadRegs(selId as number);
  }

  async function updateStatus(id: number, status: string) {
    await fetch(`/api/training/registrations/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attendance_status: status }),
    });
    loadRegs(selId as number);
  }

  async function deleteReg(id: number) {
    await fetch(`/api/training/registrations/${id}`, { method: "DELETE" });
    loadRegs(selId as number);
  }

  const [editCodeId,  setEditCodeId]  = useState<number | null>(null);
  const [editCodeVal, setEditCodeVal] = useState("");
  const [editCodeSaving, setEditCodeSaving] = useState(false);

  async function saveEmpCode(id: number) {
    setEditCodeSaving(true);
    await fetch(`/api/training/registrations/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emp_code: editCodeVal.trim() || null }),
    });
    setEditCodeSaving(false);
    setEditCodeId(null);
    loadRegs(selId as number);
  }

  const checkedIn = regs.filter(r => ["checked_in", "late", "completed"].includes(r.attendance_status)).length;

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 11px", borderRadius: 7,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  return (
    <div>
      {/* Course selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>เลือกหลักสูตร</label>
          <select value={selId} onChange={e => setSelId(Number(e.target.value))}
            style={{ ...inp, borderColor: "#0038C6", fontWeight: 600 }}>
            <option value="">-- เลือกหลักสูตร --</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} · {c.course}</option>)}
          </select>
        </div>
        {selId !== "" && selCourse && (
          <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
            {canEdit && (
              <button onClick={() => setShowForm(true)}
                style={{ padding: "8px 18px", borderRadius: 7, border: "none", background: "#0038C6",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                + เพิ่มผู้เข้าอบรม
              </button>
            )}
            {selCourse.qr_token && (
              <button onClick={() => setShowQr(true)}
                style={{ padding: "8px 18px", borderRadius: 7, border: "1.5px solid #0038C6",
                  background: "#fff", color: "#0038C6", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                📱 แสดง QR Code
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats row */}
      {selId !== "" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 }}>
          {[
            { label: "ลงทะเบียนทั้งหมด", value: regs.length,   color: "#0038C6" },
            { label: "เช็คชื่อแล้ว",      value: checkedIn,     color: "#16a34a" },
            { label: "เป้าหมาย",          value: selCourse?.target ?? 0, color: "#475569" },
            { label: "% เข้าร่วม",        value: selCourse?.target ? `${Math.round(checkedIn / selCourse.target * 100)}%` : "—", color: "#d97706" },
          ].map(s => (
            <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: "14px 18px",
              border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6" }}>
              <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>{s.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {selId === "" ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff",
          borderRadius: 8, border: "1px solid #dce4f5" }}>เลือกหลักสูตรเพื่อดูรายชื่อผู้ลงทะเบียน</div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f4f7ff" }}>
                {["#", "รหัสพนักงาน", "ชื่อ-นามสกุล", "แผนก", "ตำแหน่ง", "เวลาเช็คชื่อ", "วิธี", "สถานะ", canEdit ? "" : ""].map((h, i) => (
                  <th key={i} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700,
                    color: "#475569", borderBottom: "2px solid #dce4f5", fontSize: 11,
                    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>ยังไม่มีผู้ลงทะเบียน</td></tr>
              ) : regs.map((reg, i) => (
                <tr key={reg.id} style={{ borderBottom: "1px solid #f0f5ff", background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                  <td style={{ padding: "10px 14px", color: "#94a3b8", width: 36 }}>{i + 1}</td>
                  <td style={{ padding: "6px 14px", fontSize: 12 }}>
                    {canEdit && editCodeId === reg.id ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        <input
                          value={editCodeVal}
                          onChange={e => setEditCodeVal(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter") saveEmpCode(reg.id); if (e.key === "Escape") setEditCodeId(null); }}
                          autoFocus
                          placeholder="รหัสพนักงาน"
                          style={{ width: 100, padding: "4px 7px", borderRadius: 5, border: "1.5px solid #0038C6",
                            fontSize: 12, fontFamily: "monospace", outline: "none" }} />
                        <button onClick={() => saveEmpCode(reg.id)} disabled={editCodeSaving}
                          style={{ padding: "3px 8px", borderRadius: 5, border: "none", background: "#0038C6",
                            color: "#fff", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                          {editCodeSaving ? "…" : "✓"}
                        </button>
                        <button onClick={() => setEditCodeId(null)}
                          style={{ padding: "3px 7px", borderRadius: 5, border: "1px solid #e2e8f0",
                            background: "#fff", fontSize: 11, cursor: "pointer" }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontFamily: "monospace", color: reg.emp_code ? "#334155" : "#cbd5e1" }}>
                          {reg.emp_code ?? "—"}
                        </span>
                        {canEdit && (
                          <button onClick={() => { setEditCodeId(reg.id); setEditCodeVal(reg.emp_code ?? ""); }}
                            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11,
                              color: reg.emp_code ? "#94a3b8" : "#0038C6", padding: "1px 3px",
                              opacity: 0.7, lineHeight: 1 }}
                            title="แก้ไขรหัสพนักงาน">✏️</button>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0a1628" }}>{reg.name}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{reg.department ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{reg.position ?? "—"}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 11, whiteSpace: "nowrap" }}>
                    {reg.checkin_time ? reg.checkin_time.slice(0, 16).replace("T", " ") : "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ fontSize: 11, background: reg.reg_method === "qr" ? "#e8eeff" : "#f0f9ff",
                      color: reg.reg_method === "qr" ? "#0038C6" : "#0891b2",
                      border: "1px solid #c4cfee", borderRadius: 4, padding: "2px 7px" }}>
                      {reg.reg_method === "qr" ? "QR" : "Manual"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {canEdit ? (
                      <select value={reg.attendance_status}
                        onChange={e => updateStatus(reg.id, e.target.value)}
                        style={{ padding: "4px 8px", borderRadius: 6, fontSize: 12,
                          border: `1.5px solid ${STATUS_COLOR[reg.attendance_status]}40`,
                          background: STATUS_COLOR[reg.attendance_status] + "15",
                          color: STATUS_COLOR[reg.attendance_status], fontFamily: "inherit",
                          fontWeight: 700, cursor: "pointer" }}>
                        {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    ) : (
                      <span style={{ background: STATUS_COLOR[reg.attendance_status] + "20",
                        color: STATUS_COLOR[reg.attendance_status],
                        border: `1px solid ${STATUS_COLOR[reg.attendance_status]}40`,
                        borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                        {STATUS_LABEL[reg.attendance_status]}
                      </span>
                    )}
                  </td>
                  {canEdit && (
                    <td style={{ padding: "10px 14px" }}>
                      <button onClick={() => deleteReg(reg.id)}
                        style={{ padding: "4px 9px", borderRadius: 6, border: "1px solid #fecaca",
                          background: "#fee2e2", color: "#dc2626", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Registration Modal */}
      {showForm && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 480,
            boxShadow: "0 24px 60px rgba(0,56,198,0.25)", border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
            <div style={{ padding: "24px 28px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1628", marginBottom: 18 }}>เพิ่มผู้เข้าอบรม (Manual)</div>

              {/* Employee search */}
              <div ref={searchRef} style={{ marginBottom: 14, position: "relative" }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                  textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                  ค้นหาพนักงาน (ชื่อ หรือ รหัส)
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    value={empSearch}
                    onChange={e => { setEmpSearch(e.target.value); setAutoFilled(false); setShowDrop(true); if (!e.target.value) clearForm(); }}
                    onFocus={() => { if (empSearch) setShowDrop(true); }}
                    placeholder="พิมพ์ชื่อหรือรหัสพนักงาน..."
                    style={{ ...inp, paddingRight: autoFilled ? 32 : 11, borderColor: autoFilled ? "#16a34a" : "#c4cfee" }} />
                  {autoFilled && (
                    <button onClick={clearForm} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer", color: "#94a3b8", fontSize: 16, lineHeight: 1 }}>✕</button>
                  )}
                </div>
                {showDrop && filteredEmps.length > 0 && (
                  <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                    border: "1.5px solid #c4cfee", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,56,198,.12)",
                    zIndex: 50, maxHeight: 220, overflowY: "auto", marginTop: 2 }}>
                    {filteredEmps.map(e => (
                      <div key={e.id} onMouseDown={() => selectEmp(e)}
                        style={{ padding: "10px 14px", cursor: "pointer", borderBottom: "1px solid #f0f5ff",
                          display: "flex", alignItems: "center", gap: 10 }}
                        onMouseEnter={ev => (ev.currentTarget.style.background = "#f4f7ff")}
                        onMouseLeave={ev => (ev.currentTarget.style.background = "")}>
                        <div style={{ fontFamily: "monospace", fontSize: 11, color: "#64748b",
                          background: "#f0f5ff", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>
                          {e.emp_code ?? "—"}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13, color: "#0a1628" }}>{e.full_name}</div>
                          <div style={{ fontSize: 11, color: "#94a3b8" }}>{[e.position, e.department_name].filter(Boolean).join(" · ")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Auto-filled fields (read-only when selected) */}
              {[
                { label: "รหัสพนักงาน", val: fEmpCode, set: setFEmpCode, ph: "EMP-0001" },
                { label: "ชื่อ-นามสกุล *", val: fName, set: setFName, ph: "นาย/นาง/น.ส. ชื่อ นามสกุล" },
                { label: "แผนก", val: fDept, set: setFDept, ph: "แผนก / ฝ่าย" },
                { label: "ตำแหน่ง", val: fPos, set: setFPos, ph: "ตำแหน่งงาน" },
              ].map(f => (
                <div key={f.label} style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>{f.label}</label>
                  <input value={f.val} onChange={e => { f.set(e.target.value); setAutoFilled(false); }}
                    placeholder={f.ph}
                    style={{ ...inp, background: autoFilled ? "#f8faff" : "#fff", color: autoFilled ? "#334155" : "#0a1628" }} />
                </div>
              ))}

              {formErr && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{formErr}</div>}
              <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                <button onClick={() => { setShowForm(false); clearForm(); }}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                    background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
                <button onClick={addReg} disabled={saving}
                  style={{ flex: 2, padding: "10px 0", borderRadius: 7, border: "none",
                    background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {saving ? "กำลังบันทึก…" : "เพิ่มผู้เข้าอบรม"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQr && selCourse?.qr_token && (
        <div onClick={e => { if (e.target === e.currentTarget) setShowQr(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 36, maxWidth: 380, width: "100%",
            boxShadow: "0 24px 60px rgba(0,56,198,0.3)", border: "1px solid #c4cfee", borderTop: "4px solid #0038C6",
            textAlign: "center" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1628", marginBottom: 6 }}>QR Check-in</div>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>{selCourse.course}</div>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                `${window.location.origin}/checkin?token=${selCourse.qr_token}`
              )}`}
              alt="QR Code"
              style={{ borderRadius: 10, border: "3px solid #0038C6", display: "block", margin: "0 auto 20px" }} />
            <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 16, wordBreak: "break-all" }}>
              {window.location.origin}/checkin?token={selCourse.qr_token}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/checkin?token=${selCourse!.qr_token}`)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                📋 คัดลอก URL
              </button>
              <button onClick={() => setShowQr(false)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
