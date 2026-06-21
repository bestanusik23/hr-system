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

const MODULE_LABEL: Record<string, string> = { eval: "ประเมินผล", transfer: "ย้ายแผนก", training: "ฝึกอบรม", auth: "ระบบ" };
const ACTION_LABEL: Record<string, string> = {
  login: "เข้าสู่ระบบ", logout: "ออกจากระบบ",
  submit_eval: "ส่งใบประเมิน", approve_eval: "อนุมัติใบประเมิน", reject_eval: "ไม่อนุมัติ",
  submit_transfer: "ส่งคำขอย้าย", head_approve: "หัวหน้าอนุมัติ", hr_approve: "HR อนุมัติ",
};

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
      <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ExecPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/exec/summary").then(r => r.json())
      .then((d: { ok: boolean; error?: string } & Summary) => {
        if (!d.ok) { setError(d.error ?? "ไม่สามารถโหลดข้อมูลได้"); return; }
        setData(d);
      }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <PageLayout title="Executive Dashboard" accent="#0891B2">
      <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลดข้อมูล…</div>
    </PageLayout>
  );
  if (error || !data) return (
    <PageLayout title="Executive Dashboard" accent="#0891B2">
      <div style={{ textAlign: "center", padding: 60, color: "#ef4444" }}>{error || "ไม่มีข้อมูล"}</div>
    </PageLayout>
  );

  const { employees, evaluations, transfers, training, recent_activity } = data;
  const trainPct = training.target > 0 ? Math.round(training.actual / training.target * 100) : 0;
  const gradeColors: Record<string, string> = { A: "#16a34a", "B+": "#0891b2", B: "#7C3AED", "C+": "#f59e0b", C: "#ea580c", D: "#ef4444" };

  return (
    <PageLayout title="Executive Dashboard" accent="#0891B2">
      {/* Section: พนักงาน */}
      <SectionTitle>บุคลากร</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        <KPI label="พนักงานทั้งหมด" value={employees.total} color="#0891B2" />
        <KPI label="ทดลองงาน" value={employees.probation} color="#f59e0b" />
        <KPI label="ผ่านทดลองงาน" value={employees.passed} color="#16a34a" />
        <KPI label="ลาออก" value={employees.resigned} color="#94a3b8" />
        {employees.due_eval > 0 && (
          <KPI label="ค้างประเมิน 90 วัน" value={employees.due_eval} color="#ef4444" sub="⚠ รอดำเนินการ" />
        )}
      </div>

      {/* Section: ประเมินผล */}
      <SectionTitle>ผลการประเมินพนักงาน</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 16 }}>
        <KPI label="ใบประเมินทั้งหมด" value={evaluations.total} color="#7C3AED" />
        <KPI label="รออนุมัติ" value={evaluations.pending} color="#f59e0b" />
        <KPI label="อนุมัติแล้ว" value={evaluations.approved} color="#16a34a" />
        <KPI label="ไม่ผ่าน" value={evaluations.rejected} color="#ef4444" />
      </div>

      {/* Grade distribution */}
      {evaluations.grades.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: "#475569" }}>การกระจายเกรด</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {evaluations.grades.map(g => (
              <div key={g.grade} style={{ textAlign: "center", background: (gradeColors[g.grade] ?? "#94a3b8") + "18", borderRadius: 10, padding: "10px 18px" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: gradeColors[g.grade] ?? "#94a3b8" }}>{g.grade}</div>
                <div style={{ fontSize: 13, color: "#64748b" }}>{g.n} คน</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avg score by division */}
      {evaluations.by_division.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", marginBottom: 24, boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 14, color: "#475569" }}>คะแนนเฉลี่ยรายฝ่าย</div>
          {evaluations.by_division.map(d => (
            <div key={d.division} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 160, fontSize: 13, color: "#475569", flexShrink: 0 }}>{d.division ?? "—"}</div>
              <div style={{ flex: 1, height: 10, background: "#e2e8f0", borderRadius: 5 }}>
                <div style={{ height: 10, background: "#7C3AED", borderRadius: 5, width: `${Math.min(100, d.avg_score)}%`, transition: "width .4s" }} />
              </div>
              <div style={{ width: 50, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#7C3AED" }}>{d.avg_score}</div>
              <div style={{ width: 40, textAlign: "right", fontSize: 11, color: "#94a3b8" }}>{d.count} คน</div>
            </div>
          ))}
        </div>
      )}

      {/* Transfer + Training side by side */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#475569" }}>คำขอย้ายแผนก</div>
          {[
            { label: "ทั้งหมด", value: transfers.total, color: "#E0533D" },
            { label: "รออนุมัติ", value: transfers.pending, color: "#f59e0b" },
            { label: "เสร็จสมบูรณ์", value: transfers.completed, color: "#16a34a" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{r.label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "#475569" }}>การฝึกอบรม</div>
          {[
            { label: "หลักสูตรทั้งหมด", value: training.total, color: "#7C3AED" },
            { label: "เสร็จแล้ว", value: training.done, color: "#16a34a" },
            { label: `ผู้เข้าอบรม (เป้า ${training.target})`, value: `${training.actual} (${trainPct}%)`, color: "#0891b2" },
          ].map(r => (
            <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#64748b" }}>{r.label}</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: r.color }}>{r.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent activity */}
      <SectionTitle>กิจกรรมล่าสุด</SectionTitle>
      <div style={{ background: "#fff", borderRadius: 14, padding: "14px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
        {recent_activity.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 16 }}>ยังไม่มีกิจกรรม</div>
        ) : recent_activity.map((a, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < recent_activity.length - 1 ? "1px solid #f1f5f9" : "none" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#0891B2", flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{a.actor_name}</span>
              <span style={{ fontSize: 13, color: "#64748b" }}> — {ACTION_LABEL[a.action] ?? a.action} ({MODULE_LABEL[a.module] ?? a.module})</span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap" }}>
              {new Date(a.created_at).toLocaleString("th-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 14, fontWeight: 700, color: "#475569", marginBottom: 12 }}>{children}</div>;
}
