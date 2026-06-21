import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";
import CourseForm from "./CourseForm";

interface Course {
  id: number; course: string; trainer: string | null; course_date: string | null;
  month_label: string | null; target: number; actual: number; status: string;
}

const STATUS_LABEL: Record<string, string> = { planned: "วางแผน", upcoming: "ใกล้ถึง", done: "เสร็จแล้ว" };
const STATUS_COLOR: Record<string, string> = { planned: "#94a3b8", upcoming: "#f59e0b", done: "#16a34a" };

export default function TrainingPage() {
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<Course | null>(null);
  const [showNew, setShowNew] = useState(false);

  const canEdit = user && ["hr", "admin"].includes(user.role);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/training/courses?status=${statusFilter}`);
    const d = await r.json() as { ok: boolean; courses: Course[] };
    setCourses(d.courses ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  // summary stats
  const totalTarget = courses.reduce((a, c) => a + c.target, 0);
  const totalActual = courses.reduce((a, c) => a + c.actual, 0);
  const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  return (
    <PageLayout title="ระบบข้อมูลฝึกอบรม" accent="#7C3AED">
      {/* Dashboard summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        {[
          { label: "หลักสูตรทั้งหมด", value: courses.length, color: "#7C3AED" },
          { label: "เป้าหมายผู้เข้าอบรม", value: totalTarget, color: "#0891b2" },
          { label: "ผู้เข้าอบรมจริง", value: `${totalActual} (${pct}%)`, color: "#16a34a" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontSize: 13, color: "#64748b" }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters + Add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {[["", "ทั้งหมด"], ["planned", "วางแผน"], ["upcoming", "ใกล้ถึง"], ["done", "เสร็จแล้ว"]].map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid", fontFamily: "inherit", fontSize: 13, cursor: "pointer", borderColor: statusFilter === k ? "#7C3AED" : "#e2e8f0", background: statusFilter === k ? "#7C3AED" : "#fff", color: statusFilter === k ? "#fff" : "#475569" }}>{v}</button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => setShowNew(true)} style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "#7C3AED", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>+ เพิ่มหลักสูตร</button>
        )}
      </div>

      {/* Course list */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : courses.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีหลักสูตร</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {courses.map(c => (
            <div key={c.id} onClick={() => setSelected(c)}
              style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.12)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.07)")}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#7C3AED22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>🎓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.course}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  {c.trainer ?? "—"} · {c.course_date ?? "—"}{c.month_label ? ` (${c.month_label})` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: "#7C3AED" }}>{c.actual}<span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>/{c.target} คน</span></div>
                <div style={{ marginTop: 6 }}>
                  <div style={{ height: 6, background: "#e2e8f0", borderRadius: 3, width: 80 }}>
                    <div style={{ height: 6, background: "#7C3AED", borderRadius: 3, width: `${c.target > 0 ? Math.min(100, Math.round(c.actual / c.target * 100)) : 0}%` }} />
                  </div>
                </div>
              </div>
              <span style={{ background: STATUS_COLOR[c.status] + "22", color: STATUS_COLOR[c.status], borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                {STATUS_LABEL[c.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <CourseForm course={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} canEdit={!!canEdit} />
      )}
      {showNew && (
        <CourseForm course={null} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} canEdit={!!canEdit} />
      )}
    </PageLayout>
  );
}
