import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";

interface Summary {
  employees: { total: number; probation: number; passed: number; resigned: number; due_eval: number };
  evaluations: {
    total: number; pending: number; approved: number; rejected: number;
    grades: { grade: string; n: number }[];
    by_division: { division: string; avg_score: number; count: number }[];
  };
  transfers: { total: number; pending: number; completed: number };
  training: { total: number; done: number; target: number; actual: number };
  recent_activity: { actor_name: string; module: string; action: string; created_at: string }[];
}

const MODULE_LABEL: Record<string, string> = { eval: "ประเมินผล", transfer: "ย้ายแผนก", training: "ฝึกอบรม", auth: "ระบบ", admin: "Admin" };
const ACTION_LABEL: Record<string, string> = {
  login: "เข้าสู่ระบบ", logout: "ออกจากระบบ",
  submit_eval: "ส่งใบประเมิน", approve_eval: "อนุมัติใบประเมิน", reject_eval: "ไม่อนุมัติ",
  submit_transfer: "ส่งคำขอย้าย", head_approve: "หัวหน้าอนุมัติ", hr_approve: "HR อนุมัติ",
};
const GRADE_COLORS: Record<string, string> = { A: "#16a34a", B: "#0891b2", C: "#d97706", D: "#ea580c", E: "#dc2626", F: "#991b1b" };

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "18px 22px",
      border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 8, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 8 }}>
      <div style={{ width: 4, height: 16, borderRadius: 2, background: "#0038C6" }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: "#0038C6", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{children}</span>
    </div>
  );
}

export default function ExecPage() {
  const [data, setData]     = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState("");

  useEffect(() => {
    fetch("/api/exec/summary").then(r => r.json())
      .then((d: { ok: boolean; error?: string } & Summary) => {
        if (!d.ok) { setError(d.error ?? "ไม่สามารถโหลดข้อมูลได้"); return; }
        setData(d);
      }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <PageLayout title="Executive Dashboard">
      <div style={{ textAlign: "center", padding: 80, color: "#94a3b8" }}>กำลังโหลดข้อมูล…</div>
    </PageLayout>
  );
  if (error || !data) return (
    <PageLayout title="Executive Dashboard">
      <div style={{ textAlign: "center", padding: 80, color: "#dc2626" }}>{error || "ไม่มีข้อมูล"}</div>
    </PageLayout>
  );

  const { employees, evaluations, transfers, training, recent_activity } = data;
  const trainPct = training.target > 0 ? Math.round(training.actual / training.target * 100) : 0;

  return (
    <PageLayout title="Executive Dashboard">
      {/* บุคลากร */}
      <SectionTitle>บุคลากร</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 28 }}>
        <KPI label="พนักงานทั้งหมด" value={employees.total}    color="#0038C6" />
        <KPI label="ทดลองงาน"       value={employees.probation} color="#d97706" />
        <KPI label="ผ่านทดลองงาน"   value={employees.passed}    color="#16a34a" />
        <KPI label="ลาออก"          value={employees.resigned}  color="#94a3b8" />
        {employees.due_eval > 0 && (
          <KPI label="ค้างประเมิน 90 วัน" value={employees.due_eval} color="#dc2626" sub="⚠ รอดำเนินการ" />
        )}
      </div>

      {/* ประเมินผล */}
      <SectionTitle>ผลการประเมินพนักงาน</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 12, marginBottom: 16 }}>
        <KPI label="ใบประเมินทั้งหมด" value={evaluations.total}    color="#0038C6" />
        <KPI label="รออนุมัติ"        value={evaluations.pending}   color="#d97706" />
        <KPI label="อนุมัติแล้ว"      value={evaluations.approved}  color="#16a34a" />
        <KPI label="ไม่ผ่าน"          value={evaluations.rejected}  color="#dc2626" />
      </div>

      {/* Grade distribution */}
      {evaluations.grades.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "18px 22px",
          marginBottom: 16, border: "1px solid #dce4f5" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 14 }}>
            การกระจายเกรด
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {evaluations.grades.map(g => (
              <div key={g.grade} style={{ textAlign: "center",
                background: (GRADE_COLORS[g.grade] ?? "#94a3b8") + "12",
                border: `1px solid ${(GRADE_COLORS[g.grade] ?? "#94a3b8")}30`,
                borderRadius: 8, padding: "10px 20px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: GRADE_COLORS[g.grade] ?? "#94a3b8" }}>{g.grade}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{g.n} คน</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score by division */}
      {evaluations.by_division.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 8, padding: "18px 22px",
          marginBottom: 28, border: "1px solid #dce4f5" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 14 }}>
            คะแนนเฉลี่ยรายฝ่าย
          </div>
          {evaluations.by_division.map(d => (
            <div key={d.division} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 150, fontSize: 13, color: "#475569", flexShrink: 0 }}>{d.division ?? "—"}</div>
              <div style={{ flex: 1, height: 8, background: "#e8eeff", borderRadius: 4 }}>
                <div style={{ height: 8, background: "#0038C6", borderRadius: 4, width: `${Math.min(100, d.avg_score)}%`, transition: "width .4s" }} />
              </div>
              <div style={{ width: 44, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0038C6" }}>{d.avg_score}</div>
              <div style={{ width: 40, textAlign: "right", fontSize: 11, color: "#94a3b8" }}>{d.count} คน</div>
            </div>
          ))}
        </div>
      )}

      {/* Transfer + Training */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>
        <div style={{ background: "#fff", borderRadius: 8, padding: "18px 22px",
          border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6" }}>
          <SectionTitle>คำขอย้ายแผนก</SectionTitle>
          {[
            { label: "ทั้งหมด",      value: transfers.total,     color: "#0038C6" },
            { label: "รออนุมัติ",    value: transfers.pending,   color: "#d97706" },
            { label: "เสร็จสมบูรณ์", value: transfers.completed, color: "#16a34a" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{r.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 8, padding: "18px 22px",
          border: "1px solid #dce4f5", borderLeft: "4px solid #16a34a" }}>
          <SectionTitle>การฝึกอบรม</SectionTitle>
          {[
            { label: "หลักสูตรทั้งหมด",                            value: training.total,                      color: "#0038C6" },
            { label: "เสร็จแล้ว",                                   value: training.done,                       color: "#16a34a" },
            { label: `ผู้เข้าอบรม (เป้า ${training.target})`,       value: `${training.actual} (${trainPct}%)`, color: "#475569" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{r.label}</span>
              <span style={{ fontSize: 20, fontWeight: 800, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity log */}
      <SectionTitle>กิจกรรมล่าสุด</SectionTitle>
      <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", overflow: "hidden" }}>
        {recent_activity.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>ยังไม่มีกิจกรรม</div>
        ) : recent_activity.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
            borderBottom: i < recent_activity.length - 1 ? "1px solid #f0f5ff" : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0038C6", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: "#0a1628" }}>{a.actor_name}</span>
              <span style={{ fontSize: 13, color: "#64748b" }}>
                {" "}— {ACTION_LABEL[a.action] ?? a.action}
                <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 6 }}>
                  ({MODULE_LABEL[a.module] ?? a.module})
                </span>
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", fontFamily: "monospace" }}>
              {new Date(a.created_at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
