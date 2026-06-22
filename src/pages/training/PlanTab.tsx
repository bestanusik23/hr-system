import { useEffect, useState } from "react";
import CourseForm from "./CourseForm";

interface Course {
  id: number; course_code: string; course: string; course_type: string;
  organizing_dept: string | null; project_owner: string | null; trainer: string | null;
  course_date: string | null; start_time: string | null; end_time: string | null;
  location: string | null; month_label: string | null; target: number;
  budget: number; objectives: string | null; status: string; reg_open: number;
  qr_token: string | null; actual: number; is_cancelled: number; cancel_reason: string | null;
}

type ViewMode = "list" | "calendar";
type CalView  = "month" | "week" | "agenda";
type Tab = "plan" | "reg" | "summary" | "cert";

const STATUS_LABEL: Record<string, string> = { planned: "วางแผน", upcoming: "ใกล้ถึง", done: "เสร็จแล้ว" };
const STATUS_COLOR: Record<string, string> = { planned: "#94a3b8", upcoming: "#d97706", done: "#16a34a" };
const TYPE_LABEL: Record<string, string> = {
  Internal: "Internal", External: "External",
  Mandatory: "Mandatory Training", Continuing: "Continuing Education",
};

interface Props { canEdit: boolean; onNavigate: (t: Tab, courseId?: number) => void; }

export default function PlanTab({ canEdit, onNavigate }: Props) {
  const [courses, setCourses]     = useState<Course[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [viewMode, setViewMode]   = useState<ViewMode>("list");
  const [calView, setCalView]     = useState<CalView>("month");
  const [calYear, setCalYear]     = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]   = useState(new Date().getMonth());
  const [selected, setSelected]   = useState<Course | null>(null);
  const [showNew, setShowNew]     = useState(false);
  const [confirmDel, setConfirmDel]       = useState<Course | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Course | null>(null);
  const [cancelReason, setCancelReason]   = useState("");
  const [cancelling, setCancelling]       = useState(false);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter)  params.set("status",    statusFilter);
    if (typeFilter)    params.set("type",      typeFilter);
    if (showCancelled) params.set("cancelled", "1");
    const r = await fetch(`/api/training/courses?${params}`);
    const d = await r.json() as { ok: boolean; courses: Course[] };
    setCourses(d.courses ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter, typeFilter, showCancelled]);

  async function cancelCourse() {
    if (!confirmCancel) return;
    setCancelling(true);
    await fetch(`/api/training/courses/${confirmCancel.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason: cancelReason || null }),
    });
    setCancelling(false); setConfirmCancel(null); setCancelReason(""); load();
  }

  async function restoreCourse(id: number) {
    await fetch(`/api/training/courses/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    load();
  }

  async function deleteCourse(id: number) {
    await fetch(`/api/training/courses/${id}`, { method: "DELETE" });
    setConfirmDel(null);
    load();
  }

  async function duplicateCourse(c: Course) {
    const body = {
      course: `${c.course} (สำเนา)`,
      course_type: c.course_type, organizing_dept: c.organizing_dept,
      project_owner: c.project_owner, trainer: c.trainer,
      course_date: c.course_date, start_time: c.start_time, end_time: c.end_time,
      location: c.location, month_label: c.month_label,
      target: c.target, budget: c.budget, objectives: c.objectives,
      status: "planned",
    };
    await fetch("/api/training/courses", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    load();
  }

  const totalTarget = courses.reduce((a, c) => a + c.target, 0);
  const totalActual = courses.reduce((a, c) => a + c.actual, 0);
  const done        = courses.filter(c => c.status === "done").length;
  const pct         = totalTarget > 0 ? Math.round(totalActual / totalTarget * 100) : 0;

  // Calendar helpers
  const DAYS    = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
  const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

  function coursesOnDate(dateStr: string) {
    return courses.filter(c => c.course_date === dateStr);
  }

  function calDays() {
    const first   = new Date(calYear, calMonth, 1).getDay();
    const daysInM = new Date(calYear, calMonth + 1, 0).getDate();
    const cells: (number | null)[] = Array(first).fill(null);
    for (let d = 1; d <= daysInM; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }

  function isoDate(day: number) {
    return `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const agendaCourses = courses
    .filter(c => c.course_date)
    .sort((a, b) => (a.course_date ?? "") < (b.course_date ?? "") ? -1 : 1);

  return (
    <div>
      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 24 }}>
        {[
          { label: "หลักสูตรทั้งหมด",      value: courses.length, color: "#0038C6" },
          { label: "เป้าหมายผู้เข้าอบรม",  value: totalTarget,    color: "#1d4ed8" },
          { label: "จัดอบรมแล้ว",           value: done,           color: "#16a34a" },
          { label: "% Completion",          value: `${pct}%`,     color: pct >= 80 ? "#16a34a" : pct >= 50 ? "#d97706" : "#dc2626" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: "16px 20px",
            border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700,
              textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        {/* Status filter */}
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {!showCancelled && [["", "ทั้งหมด"], ["planned", "วางแผน"], ["upcoming", "ใกล้ถึง"], ["done", "เสร็จแล้ว"]].map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              style={{ padding: "6px 14px", borderRadius: 7, border: "1.5px solid",
                borderColor: statusFilter === k ? "#0038C6" : "#dce4f5",
                background:  statusFilter === k ? "#0038C6" : "#fff",
                color:       statusFilter === k ? "#fff" : "#475569",
                fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>{v}</button>
          ))}
          <button onClick={() => { setShowCancelled(!showCancelled); setStatusFilter(""); }}
            style={{ padding: "6px 14px", borderRadius: 7, border: "1.5px solid",
              borderColor: showCancelled ? "#dc2626" : "#dce4f5",
              background:  showCancelled ? "#dc2626" : "#fff",
              color:       showCancelled ? "#fff" : "#64748b",
              fontFamily: "inherit", fontSize: 12, cursor: "pointer" }}>
            🚫 {showCancelled ? "ดูที่ใช้งาน" : "ยกเลิกแล้ว"}
          </button>
        </div>

        {/* Type filter */}
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
            fontSize: 12, fontFamily: "inherit", background: "#fff", color: "#475569" }}>
          <option value="">ประเภทอบรม (ทั้งหมด)</option>
          {Object.entries(TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 2, background: "#f0f5ff", borderRadius: 7,
          padding: 3, border: "1px solid #dce4f5", marginLeft: "auto" }}>
          {(["list", "calendar"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              style={{ padding: "5px 14px", borderRadius: 5, border: "none",
                background:  viewMode === v ? "#0038C6" : "transparent",
                color:       viewMode === v ? "#fff" : "#64748b",
                fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
              {v === "list" ? "📋 รายการ" : "📅 ปฏิทิน"}
            </button>
          ))}
        </div>

        {canEdit && (
          <button onClick={() => setShowNew(true)}
            style={{ padding: "9px 20px", borderRadius: 8, border: "none",
              background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,56,198,0.2)" }}>
            + เพิ่มหลักสูตร
          </button>
        )}
      </div>

      {/* ===== LIST VIEW ===== */}
      {viewMode === "list" && (
        loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
        ) : courses.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, background: "#fff",
            borderRadius: 8, border: "1px solid #dce4f5", color: "#94a3b8" }}>ไม่มีหลักสูตร</div>
        ) : (
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f4f7ff" }}>
                  {["รหัส", "ชื่อหลักสูตร", "ประเภท", "วันที่", "สถานที่", "เป้า", "จริง", "สถานะ", ""].map(h => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700,
                      color: "#475569", borderBottom: "2px solid #dce4f5", fontSize: 11,
                      letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {courses.map((c, i) => (
                  <tr key={c.id} style={{ borderBottom: "1px solid #f0f5ff",
                    background: c.is_cancelled ? "#fff5f5" : i % 2 === 0 ? "#fff" : "#fafcff",
                    opacity: c.is_cancelled ? 0.8 : 1 }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>
                      {c.course_code}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ fontWeight: 700, color: c.is_cancelled ? "#94a3b8" : "#0a1628",
                        textDecoration: c.is_cancelled ? "line-through" : "none" }}>{c.course}</div>
                      {c.trainer && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>👤 {c.trainer}</div>}
                      {c.cancel_reason && <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>🚫 {c.cancel_reason}</div>}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ fontSize: 11, background: "#f0f5ff", color: "#0038C6",
                        border: "1px solid #c4cfee", borderRadius: 5, padding: "2px 8px", fontWeight: 600 }}>
                        {c.course_type}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", color: "#475569", whiteSpace: "nowrap" }}>
                      {c.course_date ?? "—"}
                      {c.start_time && <div style={{ fontSize: 11, color: "#94a3b8" }}>{c.start_time}–{c.end_time}</div>}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#475569", maxWidth: 140,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.location ?? "—"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center", fontWeight: 600 }}>{c.target}</td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span style={{ color: c.actual >= c.target ? "#16a34a" : "#0038C6", fontWeight: 700 }}>{c.actual}</span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      {c.is_cancelled ? (
                        <span style={{ background: "#fee2e2", color: "#dc2626",
                          border: "1px solid #fecaca", borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                          🚫 ยกเลิกแล้ว
                        </span>
                      ) : (
                        <span style={{ background: STATUS_COLOR[c.status] + "20", color: STATUS_COLOR[c.status],
                          border: `1px solid ${STATUS_COLOR[c.status]}40`,
                          borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                          {STATUS_LABEL[c.status]}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div style={{ display: "flex", gap: 4 }}>
                        {!c.is_cancelled && (
                          <button onClick={() => setSelected(c)} style={actionBtn("#0038C6")}>✏️</button>
                        )}
                        {canEdit && !c.is_cancelled && <>
                          <button onClick={() => duplicateCourse(c)}
                            style={actionBtn("#64748b")} title="Duplicate">⎘</button>
                          <button onClick={() => onNavigate("reg", c.id)}
                            style={actionBtn("#16a34a")} title="ลงทะเบียน">✍️</button>
                          <button onClick={() => { setConfirmCancel(c); setCancelReason(""); }}
                            style={actionBtn("#f59e0b")} title="ยกเลิกอบรม">🚫</button>
                          <button onClick={() => setConfirmDel(c)}
                            style={actionBtn("#dc2626")}>🗑</button>
                        </>}
                        {canEdit && c.is_cancelled && (
                          <button onClick={() => restoreCourse(c.id)}
                            style={actionBtn("#16a34a")} title="กู้คืน">↩️ กู้คืน</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* ===== CALENDAR VIEW ===== */}
      {viewMode === "calendar" && (
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", overflow: "hidden" }}>
          {/* Calendar toolbar */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px",
            borderBottom: "1px solid #f0f5ff", background: "#f4f7ff" }}>
            <button onClick={() => {
              if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
              else setCalMonth(m => m - 1);
            }} style={navBtn}>←</button>
            <span style={{ fontWeight: 700, fontSize: 15, color: "#0a1628", minWidth: 120, textAlign: "center" }}>
              {MONTHS_TH[calMonth]} {calYear + 543}
            </span>
            <button onClick={() => {
              if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
              else setCalMonth(m => m + 1);
            }} style={navBtn}>→</button>

            <div style={{ marginLeft: "auto", display: "flex", gap: 3,
              background: "#e8eeff", borderRadius: 6, padding: 2 }}>
              {(["month", "week", "agenda"] as CalView[]).map(v => (
                <button key={v} onClick={() => setCalView(v)}
                  style={{ padding: "4px 12px", borderRadius: 4, border: "none",
                    background: calView === v ? "#0038C6" : "transparent",
                    color: calView === v ? "#fff" : "#475569",
                    fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  {v === "month" ? "เดือน" : v === "week" ? "สัปดาห์" : "รายการ"}
                </button>
              ))}
            </div>
          </div>

          {/* Month View */}
          {calView === "month" && (
            <div style={{ padding: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)",
                background: "#f4f7ff", borderBottom: "1px solid #dce4f5" }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding: "8px 0", textAlign: "center",
                    fontSize: 11, fontWeight: 700, color: "#475569" }}>{d}</div>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
                {calDays().map((day, i) => {
                  const dateStr  = day ? isoDate(day) : "";
                  const dayItems = day ? coursesOnDate(dateStr) : [];
                  const isToday  = day ? dateStr === new Date().toISOString().slice(0, 10) : false;
                  return (
                    <div key={i} style={{
                      minHeight: 90, padding: "6px 6px 4px",
                      borderRight:  i % 7 !== 6 ? "1px solid #f0f5ff" : "none",
                      borderBottom: "1px solid #f0f5ff",
                      background: day ? "#fff" : "#fafcff",
                    }}>
                      {day && (
                        <>
                          <div style={{
                            fontSize: 12, fontWeight: isToday ? 800 : 400,
                            color: isToday ? "#fff" : "#475569",
                            background: isToday ? "#0038C6" : "transparent",
                            width: 22, height: 22, borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            marginBottom: 4,
                          }}>{day}</div>
                          {dayItems.slice(0, 2).map(c => (
                            <div key={c.id} onClick={() => setSelected(c)}
                              style={{ fontSize: 10, background: STATUS_COLOR[c.status] + "20",
                                color: STATUS_COLOR[c.status], border: `1px solid ${STATUS_COLOR[c.status]}40`,
                                borderRadius: 3, padding: "2px 5px", marginBottom: 2,
                                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                cursor: "pointer" }}>
                              {c.start_time && `${c.start_time} `}{c.course}
                            </div>
                          ))}
                          {dayItems.length > 2 && (
                            <div style={{ fontSize: 10, color: "#94a3b8" }}>+{dayItems.length - 2} เพิ่มเติม</div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Agenda View */}
          {calView === "agenda" && (
            <div style={{ padding: 16 }}>
              {agendaCourses.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีหลักสูตร</div>
              ) : agendaCourses.map(c => (
                <div key={c.id} onClick={() => setSelected(c)}
                  style={{ display: "flex", gap: 16, padding: "12px 16px", marginBottom: 8,
                    background: "#fff", borderRadius: 8, border: "1px solid #dce4f5",
                    borderLeft: "4px solid #0038C6", cursor: "pointer" }}>
                  <div style={{ width: 56, textAlign: "center", flexShrink: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#0038C6" }}>
                      {c.course_date ? c.course_date.slice(8) : "—"}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8" }}>
                      {c.course_date ? MONTHS_TH[parseInt(c.course_date.slice(5, 7)) - 1] : ""}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#0a1628" }}>{c.course}</div>
                    <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                      {c.start_time && `🕐 ${c.start_time}–${c.end_time}  `}
                      {c.location && `📍 ${c.location}  `}
                      {c.trainer && `👤 ${c.trainer}`}
                    </div>
                  </div>
                  <span style={{ background: STATUS_COLOR[c.status] + "20", color: STATUS_COLOR[c.status],
                    border: `1px solid ${STATUS_COLOR[c.status]}40`,
                    borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, alignSelf: "center" }}>
                    {STATUS_LABEL[c.status]}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Week View */}
          {calView === "week" && <WeekView courses={courses} calYear={calYear} calMonth={calMonth} onSelect={setSelected} />}
        </div>
      )}

      {/* Delete confirm */}
      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 32, maxWidth: 400, width: "100%",
            border: "1px solid #c4cfee", borderTop: "4px solid #dc2626" }}>
            <div style={{ fontSize: 24, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>ยืนยันการลบ?</div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 20 }}>
              {confirmDel.course}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
              <button onClick={() => deleteCourse(confirmDel.id)}
                style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                ลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel confirm modal */}
      {confirmCancel && (
        <div onClick={e => { if (e.target === e.currentTarget && !cancelling) setConfirmCancel(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 32, maxWidth: 420, width: "100%",
            border: "1px solid #c4cfee", borderTop: "4px solid #f59e0b" }}>
            <div style={{ fontSize: 28, textAlign: "center", marginBottom: 12 }}>🚫</div>
            <div style={{ fontSize: 16, fontWeight: 700, textAlign: "center", marginBottom: 6 }}>ยืนยันยกเลิกอบรม?</div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 16 }}>
              {confirmCancel.course}
            </div>
            <div style={{ background: "#fff8ed", border: "1px solid #fde68a", borderRadius: 8,
              padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 16 }}>
              ⚠️ หลักสูตรจะถูกซ่อนจากรายการปกติ แต่ข้อมูลยังคงอยู่ สามารถกู้คืนได้ภายหลัง
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                เหตุผลการยกเลิก (ไม่บังคับ)
              </label>
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                placeholder="เช่น วิทยากรติดภารกิจ, จำนวนผู้สมัครไม่ถึงเกณฑ์"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7,
                  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmCancel(null)} disabled={cancelling}
                style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ปิด</button>
              <button onClick={cancelCourse} disabled={cancelling}
                style={{ flex: 2, padding: "10px 0", borderRadius: 7, border: "none",
                  background: "#f59e0b", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {cancelling ? "กำลังยกเลิก…" : "🚫 ยืนยันยกเลิกอบรม"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <CourseForm course={selected} onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load(); }} canEdit={canEdit} />
      )}
      {showNew && (
        <CourseForm course={null} onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }} canEdit={canEdit} />
      )}
    </div>
  );
}

function actionBtn(color: string): React.CSSProperties {
  return {
    padding: "4px 8px", borderRadius: 6, border: `1.5px solid ${color}30`,
    background: color + "10", color, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  };
}

const navBtn: React.CSSProperties = {
  padding: "5px 14px", borderRadius: 6, border: "1.5px solid #c4cfee",
  background: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#0038C6",
};

function WeekView({ courses, calYear, calMonth, onSelect }: {
  courses: Course[]; calYear: number; calMonth: number; onSelect: (c: Course) => void;
}) {
  const today    = new Date();
  const startDay = new Date(today); startDay.setDate(today.getDate() - today.getDay());
  const DAYS_TH  = ["อา","จ","อ","พ","พฤ","ศ","ส"];

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDay); d.setDate(startDay.getDate() + i);
    return d;
  });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", minHeight: 300 }}>
      {days.map((d, i) => {
        const iso    = d.toISOString().slice(0, 10);
        const items  = courses.filter(c => c.course_date === iso);
        const isToday = iso === today.toISOString().slice(0, 10);
        return (
          <div key={i} style={{ borderRight: i < 6 ? "1px solid #f0f5ff" : "none", padding: "8px 6px" }}>
            <div style={{ textAlign: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>{DAYS_TH[i]}</div>
              <div style={{
                fontSize: 16, fontWeight: 700,
                color: isToday ? "#fff" : "#0a1628",
                background: isToday ? "#0038C6" : "transparent",
                width: 28, height: 28, borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "2px auto",
              }}>{d.getDate()}</div>
            </div>
            {items.map(c => (
              <div key={c.id} onClick={() => onSelect(c)}
                style={{ fontSize: 10, background: "#e8eeff", color: "#0038C6",
                  borderRadius: 4, padding: "3px 5px", marginBottom: 3, cursor: "pointer",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.course}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
