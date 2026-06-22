import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";
import CourseForm from "./CourseForm";

interface Course {
  id: number; course: string; trainer: string | null; course_date: string | null;
  month_label: string | null; target: number; actual: number; status: string;
}

const STATUS_LABEL: Record<string, string> = { planned: "วางแผน", upcoming: "ใกล้ถึง", done: "เสร็จแล้ว" };
const STATUS_COLOR: Record<string, string> = { planned: "#94a3b8", upcoming: "#d97706", done: "#16a34a" };

export default function TrainingPage() {
  const { user } = useAuth();
  const [courses, setCourses]           = useState<Course[]>([]);
  const [loading, setLoading]           = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected]         = useState<Course | null>(null);
  const [showNew, setShowNew]           = useState(false);

  const canEdit = user && ["hr", "admin"].includes(user.role);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/training/courses?status=${statusFilter}`);
    const d = await r.json() as { ok: boolean; courses: Course[] };
    setCourses(d.courses ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  const totalTarget = courses.reduce((a, c) => a + c.target, 0);
  const totalActual = courses.reduce((a, c) => a + c.actual, 0);
  const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  return (
    <PageLayout title="ระบบข้อมูลฝึกอบรม" accent="#0038C6">
      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "หลักสูตรทั้งหมด",       value: courses.length,              color: "#0038C6" },
          { label: "เป้าหมายผู้เข้าอบรม",   value: totalTarget,                 color: "#475569" },
          { label: "ผู้เข้าอบรมจริง",        value: `${totalActual} (${pct}%)`, color: "#16a34a" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: "18px 22px",
            border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[["", "ทั้งหมด"], ["planned", "วางแผน"], ["upcoming", "ใกล้ถึง"], ["done", "เสร็จแล้ว"]].map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={{
              padding: "7px 16px", borderRadius: 7, border: "1.5px solid",
              borderColor: statusFilter === k ? "#0038C6" : "#dce4f5",
              background: statusFilter === k ? "#0038C6" : "#fff",
              color: statusFilter === k ? "#fff" : "#475569",
              fontFamily: "inherit", fontSize: 12, fontWeight: statusFilter === k ? 700 : 400,
              cursor: "pointer", transition: "all .15s",
            }}>{v}</button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)} style={{
            padding: "10px 22px", borderRadius: 8, border: "none",
            background: "#0038C6", color: "#fff", fontWeight: 700,
            fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px rgba(0,56,198,0.25)",
          }}>+ เพิ่มหลักสูตร</button>
        )}
      </div>

      {/* Course list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : courses.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8",
          background: "#fff", borderRadius: 8, border: "1px solid #dce4f5" }}>
          ไม่มีหลักสูตร
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {courses.map(c => {
            const pctCourse = c.target > 0 ? Math.min(100, Math.round(c.actual / c.target * 100)) : 0;
            return (
              <div key={c.id} onClick={() => setSelected(c)}
                style={{ background: "#fff", borderRadius: 8, padding: "16px 20px",
                  border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
                  transition: "box-shadow .15s, transform .15s" }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,56,198,0.12)"; e.currentTarget.style.transform = "translateX(2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: "#e8eeff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎓</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1628" }}>{c.course}</div>
                  <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                    {c.trainer ?? "—"} · {c.course_date ?? "—"}{c.month_label ? ` (${c.month_label})` : ""}
                  </div>
                  {/* Progress bar */}
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ flex: 1, height: 5, background: "#e8eeff", borderRadius: 3 }}>
                      <div style={{ height: 5, background: "#0038C6", borderRadius: 3, width: `${pctCourse}%`, transition: "width .4s" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap" }}>{c.actual}/{c.target} คน</span>
                  </div>
                </div>
                <span style={{
                  background: (STATUS_COLOR[c.status]) + "18",
                  color: STATUS_COLOR[c.status],
                  border: `1px solid ${STATUS_COLOR[c.status]}40`,
                  borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                }}>
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <CourseForm course={selected} onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load(); }} canEdit={!!canEdit} />
      )}
      {showNew && (
        <CourseForm course={null} onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); load(); }} canEdit={!!canEdit} />
      )}
    </PageLayout>
  );
}
