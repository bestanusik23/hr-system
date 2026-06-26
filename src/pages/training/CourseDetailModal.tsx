import { useAuth } from "../../context/AuthContext";

interface Course {
  id: number; course_code: string; course: string; course_type: string;
  organizing_dept: string | null; project_owner: string | null; trainer: string | null;
  course_date: string | null; start_time: string | null; end_time: string | null;
  location: string | null; month_label: string | null; target: number;
  budget: number; objectives: string | null; status: string; reg_open: number;
  qr_token: string | null; actual: number; is_cancelled: number;
}

interface Props {
  course: Course;
  onClose: () => void;
  onEdit: () => void;
  onAdvanced: () => void;
  onNavigateReg: () => void;
}

const WORKFLOW: { key: string; label: string; icon: string; color: string; next: string }[] = [
  { key: "planned",  label: "วางแผน",      icon: "📋", color: "#94a3b8", next: "approved" },
  { key: "approved", label: "อนุมัติแล้ว",  icon: "✅", color: "#7c3aed", next: "open" },
  { key: "open",     label: "เปิดรับสมัคร", icon: "📝", color: "#0891b2", next: "upcoming" },
  { key: "upcoming", label: "กำลังอบรม",    icon: "🎯", color: "#d97706", next: "done" },
  { key: "done",     label: "เสร็จสิ้น",    icon: "🏆", color: "#16a34a", next: "" },
];

const TYPE_COLOR: Record<string, string> = {
  Internal: "#0038C6", External: "#7c3aed", Mandatory: "#dc2626", Continuing: "#0891b2",
};

const MONTHS_TH = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];

export default function CourseDetailModal({ course, onClose, onEdit, onAdvanced, onNavigateReg }: Props) {
  const { user } = useAuth();
  const isHR = user && ["hr", "admin"].includes(user.role);

  const curIdx = WORKFLOW.findIndex(w => w.key === course.status);
  const cur    = WORKFLOW[curIdx] ?? WORKFLOW[0];
  const next   = cur.next ? WORKFLOW.find(w => w.key === cur.next) : null;

  async function advance() {
    if (!next) return;
    await fetch(`/api/training/courses/${course.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "set_status", status: next.key }),
    });
    onAdvanced();
  }

  function formatDate(d: string | null) {
    if (!d) return "—";
    const dt = new Date(d);
    return `${dt.getDate()} ${MONTHS_TH[dt.getMonth()]} ${dt.getFullYear() + 543}`;
  }

  const fillPct = course.target > 0 ? Math.min(Math.round(course.actual / course.target * 100), 100) : 0;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 300, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560,
        maxHeight: "92vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,.28)" }}>

        {/* Header */}
        <div style={{ background: `linear-gradient(135deg,${cur.color},${cur.color}cc)`,
          padding: "22px 24px 20px", borderRadius: "16px 16px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.7)",
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                {course.course_code} · {course.course_type}
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1.3 }}>
                {course.course}
              </div>
            </div>
            <button onClick={onClose}
              style={{ border: "none", background: "rgba(255,255,255,.18)", color: "#fff",
                borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 20, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>

        {/* 5-step stepper */}
        <div style={{ padding: "20px 24px 0" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>ขั้นตอนการดำเนินงาน</div>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
            {WORKFLOW.map((w, i) => {
              const done   = i < curIdx;
              const active = i === curIdx;
              return (
                <div key={w.key} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: "50%", fontSize: 17,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: active ? w.color : done ? w.color + "25" : "#f1f5f9",
                      border: `2.5px solid ${active ? w.color : done ? w.color + "80" : "#e2e8f0"}`,
                      color: active ? "#fff" : done ? w.color : "#94a3b8",
                      fontWeight: 700, boxShadow: active ? `0 4px 14px ${w.color}55` : "none",
                      transition: "all .2s",
                    }}>
                      {done ? "✓" : w.icon}
                    </div>
                    <div style={{ fontSize: 10, marginTop: 5, fontWeight: active ? 700 : 400,
                      color: active ? w.color : done ? "#475569" : "#94a3b8",
                      textAlign: "center", whiteSpace: "nowrap" }}>
                      {w.label}
                    </div>
                  </div>
                  {i < WORKFLOW.length - 1 && (
                    <div style={{ height: 3, width: "100%", flexShrink: 1, maxWidth: 24,
                      background: done ? cur.color + "60" : "#e2e8f0", marginBottom: 20 }} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Advance button */}
          {isHR && next && !course.is_cancelled && (
            <button onClick={advance}
              style={{ width: "100%", padding: "11px 0", borderRadius: 9, border: "none",
                background: next.color, color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: "pointer", fontFamily: "inherit", marginBottom: 16,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                boxShadow: `0 4px 16px ${next.color}44`, transition: "all .15s" }}>
              {next.icon} ขยับสู่ขั้นตอนถัดไป: {next.label} →
            </button>
          )}
          {(!next || course.is_cancelled) && (
            <div style={{ background: course.is_cancelled ? "#fff5f5" : "#f0fdf4",
              border: `1px solid ${course.is_cancelled ? "#fecaca" : "#bbf7d0"}`,
              borderRadius: 9, padding: "10px 14px", fontSize: 13,
              color: course.is_cancelled ? "#dc2626" : "#16a34a",
              fontWeight: 600, textAlign: "center", marginBottom: 16 }}>
              {course.is_cancelled ? "🚫 ยกเลิกอบรม" : "🏆 เสร็จสิ้นทุกขั้นตอนแล้ว"}
            </div>
          )}
        </div>

        {/* Details */}
        <div style={{ padding: "0 24px 24px", display: "grid", gap: 12 }}>
          {/* Date/Time/Location row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <InfoCard icon="📅" label="วันที่อบรม" value={formatDate(course.course_date)} />
            <InfoCard icon="🕐" label="เวลา"
              value={course.start_time ? `${course.start_time} – ${course.end_time ?? "—"}` : "—"} />
          </div>
          <InfoCard icon="📍" label="สถานที่" value={course.location ?? "—"} />
          {course.trainer && <InfoCard icon="👤" label="วิทยากร" value={course.trainer} />}
          {course.organizing_dept && <InfoCard icon="🏢" label="แผนกผู้จัดอบรม" value={course.organizing_dept} />}
          {course.project_owner && <InfoCard icon="🙋" label="ผู้รับผิดชอบ" value={course.project_owner} />}

          {/* Attendee progress */}
          <div style={{ background: "#f4f7ff", borderRadius: 10, padding: "12px 16px",
            border: "1px solid #dce4f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>ผู้เข้าอบรม</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: fillPct >= 100 ? "#16a34a" : "#0038C6" }}>
                {course.actual} / {course.target} คน ({fillPct}%)
              </span>
            </div>
            <div style={{ background: "#dce4f5", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ background: fillPct >= 100 ? "#16a34a" : "#0038C6",
                width: `${fillPct}%`, height: "100%", borderRadius: 6, transition: "width .4s" }} />
            </div>
          </div>

          {/* Budget */}
          {course.budget > 0 && (
            <InfoCard icon="💰" label="งบประมาณ"
              value={`${course.budget.toLocaleString()} บาท`} />
          )}

          {/* Objectives */}
          {course.objectives && (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a",
              borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e",
                textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>วัตถุประสงค์</div>
              <div style={{ fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>{course.objectives}</div>
            </div>
          )}

          {/* QR info */}
          {course.reg_open === 1 && course.qr_token && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10,
              padding: "10px 14px", fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
              📱 QR Check-in เปิดรับสมัครอยู่
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            {isHR && (
              <button onClick={onEdit}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1.5px solid #c4cfee",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
                ✏️ แก้ไขข้อมูล
              </button>
            )}
            <button onClick={onNavigateReg}
              style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "none",
                background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13,
                cursor: "pointer", fontFamily: "inherit" }}>
              ✍️ ดูรายชื่อ/ลงทะเบียน
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div style={{ background: "#f8fafc", borderRadius: 9, padding: "10px 13px",
      border: "1px solid #e2e8f0" }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8",
        textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#0a1628" }}>{value}</div>
    </div>
  );
}
