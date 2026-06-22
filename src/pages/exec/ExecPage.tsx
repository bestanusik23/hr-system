import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";

interface Summary {
  employees: { total: number; probation: number; passed: number; resigned: number; due_eval: number };
  evaluations: {
    total: number; pending: number; approved: number; rejected: number;
    grades: { grade: string; n: number }[];
    by_division: { division: string; avg_score: number; count: number }[];
  };
  transfers: { total: number; pending: number; completed: number; rejected: number };
  training: {
    total: number; done: number; target: number; actual: number;
    cert_count: number; satisfaction_avg: number | null; total_responses: number;
  };
  users: { total: number; active: number; inactive: number; admin_count: number; new_this_month: number };
  recruit: {
    total: number; pending: number; interview: number; passed: number;
    hired: number; rejected: number; hiring_rate: number; no_data: boolean;
  };
  recent_activity: { actor_name: string; module: string; action: string; created_at: string }[];
}

type AlertLevel = "green" | "yellow" | "red";

const ALERT_COLORS: Record<AlertLevel, { bg: string; border: string; text: string; icon: string }> = {
  green:  { bg: "#f0fdf4", border: "#bbf7d0", text: "#16a34a", icon: "🟢" },
  yellow: { bg: "#fffbeb", border: "#fde68a", text: "#b45309", icon: "🟡" },
  red:    { bg: "#fef2f2", border: "#fecaca", text: "#dc2626", icon: "🔴" },
};

const GRADE_COLORS: Record<string, string> = {
  A: "#16a34a", B: "#0891b2", C: "#d97706", D: "#ea580c", E: "#dc2626", F: "#991b1b",
};

const MODULE_LABEL: Record<string, string> = {
  eval: "ประเมินผล", transfer: "ย้ายแผนก", training: "ฝึกอบรม", auth: "ระบบ", admin: "Admin",
};
const ACTION_LABEL: Record<string, string> = {
  login: "เข้าสู่ระบบ", logout: "ออกจากระบบ",
  submit_eval: "ส่งใบประเมิน", approve_eval: "อนุมัติใบประเมิน", reject_eval: "ไม่อนุมัติ",
  submit_transfer: "ส่งคำขอย้าย", head_approve: "หัวหน้าอนุมัติ", hr_approve: "HR อนุมัติ",
};

function satInfo(pct: number | null): { label: string; color: string } {
  if (pct === null) return { label: "ยังไม่มีข้อมูล", color: "#94a3b8" };
  if (pct >= 90) return { label: "ดีเยี่ยม", color: "#16a34a" };
  if (pct >= 80) return { label: "ดีมาก", color: "#0891b2" };
  if (pct >= 70) return { label: "ดี", color: "#0038C6" };
  if (pct >= 60) return { label: "พอใช้", color: "#d97706" };
  return { label: "ควรปรับปรุง", color: "#dc2626" };
}

function calcAlerts(d: Summary) {
  const trainPct = d.training.target > 0 ? (d.training.actual / d.training.target) * 100 : 100;
  const emp: AlertLevel =
    d.employees.due_eval > 5 ? "red" :
    d.employees.due_eval > 0 ? "yellow" : "green";
  const ev: AlertLevel =
    d.evaluations.pending > 10 ? "red" :
    d.evaluations.pending > 3  ? "yellow" : "green";
  const tr: AlertLevel =
    (d.training.satisfaction_avg !== null && d.training.satisfaction_avg < 60) ? "red" :
    (d.training.satisfaction_avg !== null && d.training.satisfaction_avg < 80) ? "yellow" :
    trainPct < 60 ? "yellow" : "green";
  const tx: AlertLevel =
    d.transfers.pending > 10 ? "red" :
    d.transfers.pending > 3  ? "yellow" : "green";
  const us: AlertLevel =
    (d.users.total > 0 && d.users.inactive / d.users.total > 0.5) ? "yellow" : "green";
  const rc: AlertLevel =
    d.recruit.no_data ? "yellow" :
    d.recruit.pending > 20 ? "red" :
    d.recruit.pending > 5  ? "yellow" : "green";
  return { emp, ev, tr, tx, us, rc };
}

function buildAISummary(d: Summary): string[] {
  const trainPct = d.training.target > 0 ? Math.round(d.training.actual / d.training.target * 100) : 0;
  const sat = d.training.satisfaction_avg;
  const satText = sat !== null ? ` ความพึงพอใจ ${sat}% (${satInfo(sat).label})` : "";
  const lines: string[] = [
    `📊 Workforce: พนักงานทั้งหมด ${d.employees.total} ราย — ทดลองงาน ${d.employees.probation} / ผ่านทดลองงาน ${d.employees.passed}${d.employees.due_eval > 0 ? ` — ⚠ ค้างประเมิน ${d.employees.due_eval} ราย` : ""}`,
    `📄 สรรหา: ใบสมัครทั้งหมด ${d.recruit.total} ราย — รอพิจารณา ${d.recruit.pending} / บรรจุ ${d.recruit.hired} (Hiring Rate ${d.recruit.hiring_rate}%)`,
    `📝 ประเมินผล: ใบประเมินทั้งหมด ${d.evaluations.total} ราย — อนุมัติแล้ว ${d.evaluations.approved} / รออนุมัติ ${d.evaluations.pending}${d.evaluations.rejected > 0 ? ` / ไม่ผ่าน ${d.evaluations.rejected}` : ""}`,
    `🎓 ฝึกอบรม: จัดแล้ว ${d.training.done}/${d.training.total} หลักสูตร — ผู้เข้าร่วม ${d.training.actual} ราย (${trainPct}% ของเป้า ${d.training.target} คน)${satText}`,
    `🔄 โอนย้าย: ทั้งหมด ${d.transfers.total} รายการ — รออนุมัติ ${d.transfers.pending} / เสร็จสิ้น ${d.transfers.completed}`,
  ];
  const issues: string[] = [];
  if (d.employees.due_eval > 0) issues.push(`เร่งประเมินพนักงานทดลองงาน ${d.employees.due_eval} ราย`);
  if (!d.recruit.no_data && d.recruit.pending > 5) issues.push(`ตรวจสอบใบสมัครค้างพิจารณา ${d.recruit.pending} ราย`);
  if (d.evaluations.pending > 3) issues.push(`ตรวจสอบใบประเมินค้างอนุมัติ ${d.evaluations.pending} ราย`);
  if (d.training.target > 0 && trainPct < 80) issues.push("ส่งเสริมการเข้าอบรมให้ถึงเป้าหมาย");
  if (sat !== null && sat < 80) issues.push("ทบทวนคุณภาพหลักสูตร (ความพึงพอใจต่ำกว่าเกณฑ์)");
  if (d.transfers.pending > 3) issues.push(`เร่งอนุมัติคำขอย้ายแผนก ${d.transfers.pending} รายการ`);
  lines.push(issues.length > 0
    ? `⚡ Pending Actions: ${issues.join(" · ")}`
    : "✅ ไม่มีรายการที่ต้องดำเนินการเร่งด่วน");
  return lines;
}

function KPI({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "16px 20px",
      border: "1px solid #dce4f5", borderLeft: `4px solid ${color}` }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#475569",
        letterSpacing: "0.08em", textTransform: "uppercase" as const }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 6, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 6 }}>
      <div style={{ width: 4, height: 16, borderRadius: 2, background: "#0038C6" }} />
      {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
      <span style={{ fontSize: 12, fontWeight: 700, color: "#0038C6",
        letterSpacing: "0.07em", textTransform: "uppercase" as const }}>{children}</span>
    </div>
  );
}

function AlertChip({ level, label, detail }: { level: AlertLevel; label: string; detail: string }) {
  const c = ALERT_COLORS[level];
  return (
    <div style={{ background: c.bg, border: `1.5px solid ${c.border}`, borderRadius: 10,
      padding: "11px 15px", flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: c.text, marginBottom: 3 }}>
        {c.icon} {label}
      </div>
      <div style={{ fontSize: 12, color: "#475569" }}>{detail}</div>
    </div>
  );
}

function RowStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
      <span style={{ fontSize: 13, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 800, color }}>{value}</span>
    </div>
  );
}

export default function ExecPage() {
  const [data, setData]           = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/exec/summary").then(r => r.json())
      .then((d: { ok: boolean; error?: string } & Summary) => {
        if (!d.ok) { setError(d.error ?? "ไม่สามารถโหลดข้อมูลได้"); return; }
        setData(d); setLastFetch(new Date());
      }).catch(() => setError("เกิดข้อผิดพลาดในการโหลดข้อมูล"))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

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

  const { employees, evaluations, transfers, training, users, recruit, recent_activity } = data;
  const trainPct   = training.target > 0 ? Math.round(training.actual / training.target * 100) : 0;
  const alerts     = calcAlerts(data);
  const summary    = buildAISummary(data);
  const sat        = satInfo(training.satisfaction_avg);
  const activeRate = users.total > 0 ? Math.round(users.active / users.total * 100) : 0;

  const cardBox: React.CSSProperties = {
    background: "#fff", borderRadius: 8, padding: "18px 22px", border: "1px solid #dce4f5",
  };

  return (
    <PageLayout title="Executive Dashboard">

      {/* AI Executive Summary */}
      <div style={{ background: "linear-gradient(135deg,#0038C6 0%,#1d4ed8 100%)",
        borderRadius: 12, padding: "22px 26px", marginBottom: 28, color: "#fff" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "0.08em",
              textTransform: "uppercase" as const, opacity: 0.8 }}>AI Executive Summary</div>
            <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
              สรุปภาพรวมระบบ HR อัตโนมัติ
              {lastFetch && ` · อัปเดต ${lastFetch.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
          </div>
          <button onClick={load} style={{
            background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
            color: "#fff", borderRadius: 7, padding: "6px 14px", fontSize: 12,
            cursor: "pointer", fontFamily: "inherit", fontWeight: 700,
          }}>↻ รีเฟรช</button>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {summary.map((line, i) => (
            <div key={i} style={{ fontSize: 13, lineHeight: 1.6, opacity: 0.95,
              background: "rgba(255,255,255,0.08)", borderRadius: 7, padding: "8px 12px" }}>
              {line}
            </div>
          ))}
        </div>
      </div>

      {/* KPI Alert Bar */}
      <SectionTitle icon="⚡">KPI Alert — สถานะระบบ</SectionTitle>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 28 }}>
        <AlertChip level={alerts.emp} label="บุคลากร"
          detail={alerts.emp === "green" ? "ปกติ" : `ค้างประเมิน ${employees.due_eval} ราย`} />
        <AlertChip level={alerts.ev} label="ประเมินผล"
          detail={alerts.ev === "green" ? "ปกติ" : `รออนุมัติ ${evaluations.pending} ราย`} />
        <AlertChip level={alerts.tr} label="ฝึกอบรม"
          detail={training.satisfaction_avg !== null
            ? `ความพึงพอใจ ${training.satisfaction_avg}%`
            : `เข้าอบรม ${trainPct}%`} />
        <AlertChip level={alerts.tx} label="โอนย้าย"
          detail={alerts.tx === "green" ? "ปกติ" : `รออนุมัติ ${transfers.pending} รายการ`} />
        <AlertChip level={alerts.us} label="ผู้ใช้งาน"
          detail={`Active ${activeRate}% (${users.active}/${users.total})`} />
        <AlertChip level={alerts.rc} label="สรรหา"
          detail={recruit.no_data ? "ไม่สามารถโหลดข้อมูล" : `รอพิจารณา ${recruit.pending} / บรรจุ ${recruit.hired}`} />
      </div>

      {/* บุคลากร */}
      <SectionTitle icon="👥">บุคลากร</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 28 }}>
        <KPI label="พนักงานทั้งหมด"       value={employees.total}    color="#0038C6" />
        <KPI label="ทดลองงาน"             value={employees.probation} color="#d97706" />
        <KPI label="ผ่านทดลองงาน"         value={employees.passed}    color="#16a34a" />
        <KPI label="ลาออก"               value={employees.resigned}  color="#94a3b8" />
        {employees.due_eval > 0 && (
          <KPI label="ค้างประเมิน 90 วัน" value={employees.due_eval}
            color="#dc2626" sub="⚠ รอดำเนินการ" />
        )}
      </div>

      {/* ประเมินผล */}
      <SectionTitle icon="📋">ผลการประเมินพนักงาน</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
        <KPI label="ใบประเมินทั้งหมด" value={evaluations.total}   color="#0038C6" />
        <KPI label="รออนุมัติ"        value={evaluations.pending}  color="#d97706"
          sub={evaluations.pending > 3 ? "⚠ เกิน SLA" : undefined} />
        <KPI label="อนุมัติแล้ว"      value={evaluations.approved} color="#16a34a" />
        <KPI label="ไม่ผ่าน"          value={evaluations.rejected} color="#dc2626" />
      </div>
      {evaluations.total > 0 && (
        <div style={{ ...cardBox, marginBottom: 16, display: "flex", gap: 20, alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>อัตราผ่านเกณฑ์</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", whiteSpace: "nowrap" }}>
            {Math.round(evaluations.approved / evaluations.total * 100)}%
          </div>
          <div style={{ flex: 1, height: 8, background: "#e8eeff", borderRadius: 4 }}>
            <div style={{
              height: 8, background: "#16a34a", borderRadius: 4, transition: "width .4s",
              width: `${Math.round(evaluations.approved / evaluations.total * 100)}%`,
            }} />
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
            {evaluations.approved}/{evaluations.total} ราย
          </div>
        </div>
      )}

      {/* Grade distribution */}
      {evaluations.grades.length > 0 && (
        <div style={{ ...cardBox, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 14 }}>
            การกระจายเกรด
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {evaluations.grades.map(g => (
              <div key={g.grade} style={{
                textAlign: "center",
                background: (GRADE_COLORS[g.grade] ?? "#94a3b8") + "12",
                border: `1px solid ${(GRADE_COLORS[g.grade] ?? "#94a3b8")}30`,
                borderRadius: 8, padding: "10px 20px",
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: GRADE_COLORS[g.grade] ?? "#94a3b8" }}>{g.grade}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{g.n} คน</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score by division */}
      {evaluations.by_division.length > 0 && (
        <div style={{ ...cardBox, marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 14 }}>
            คะแนนเฉลี่ยรายฝ่าย
          </div>
          {evaluations.by_division.map(d => (
            <div key={d.division} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 150, fontSize: 13, color: "#475569", flexShrink: 0 }}>{d.division ?? "—"}</div>
              <div style={{ flex: 1, height: 8, background: "#e8eeff", borderRadius: 4 }}>
                <div style={{
                  height: 8, background: "#0038C6", borderRadius: 4,
                  width: `${Math.min(100, d.avg_score)}%`, transition: "width .4s",
                }} />
              </div>
              <div style={{ width: 44, textAlign: "right", fontSize: 13, fontWeight: 700, color: "#0038C6" }}>{d.avg_score}</div>
              <div style={{ width: 40, textAlign: "right", fontSize: 11, color: "#94a3b8" }}>{d.count} คน</div>
            </div>
          ))}
        </div>
      )}

      {/* Training + Transfer */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 28 }}>

        {/* Training */}
        <div style={{ ...cardBox, borderLeft: "4px solid #16a34a" }}>
          <SectionTitle icon="🎓">การฝึกอบรม</SectionTitle>
          <RowStat label="หลักสูตรทั้งหมด"           value={training.total}      color="#0038C6" />
          <RowStat label="เสร็จแล้ว"                  value={training.done}       color="#16a34a" />
          <RowStat label="ใบรับรองที่ออกแล้ว"         value={training.cert_count} color="#0891b2" />
          <RowStat
            label={`ผู้เข้าอบรม (เป้า ${training.target} คน)`}
            value={`${training.actual} (${trainPct}%)`}
            color={trainPct >= 80 ? "#16a34a" : trainPct >= 60 ? "#d97706" : "#dc2626"}
          />
          {/* Satisfaction */}
          <div style={{ marginTop: 12, padding: "12px 14px",
            background: sat.color + "10", borderRadius: 8, border: `1px solid ${sat.color}30` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569",
                  textTransform: "uppercase" as const, letterSpacing: "0.07em" }}>ความพึงพอใจ</div>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                  {training.total_responses > 0
                    ? `จาก ${training.total_responses} คำตอบ`
                    : "ยังไม่มีการตอบแบบสอบถาม"}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: sat.color }}>
                  {training.satisfaction_avg !== null ? `${training.satisfaction_avg}%` : "—"}
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: sat.color }}>{sat.label}</div>
              </div>
            </div>
            {training.satisfaction_avg !== null && (
              <div style={{ marginTop: 8, height: 6, background: "#e8eeff", borderRadius: 3 }}>
                <div style={{
                  height: 6, background: sat.color, borderRadius: 3,
                  width: `${training.satisfaction_avg}%`, transition: "width .4s",
                }} />
              </div>
            )}
          </div>
        </div>

        {/* Transfer */}
        <div style={{ ...cardBox, borderLeft: "4px solid #0038C6" }}>
          <SectionTitle icon="🔄">คำขอย้ายแผนก</SectionTitle>
          <RowStat label="ทั้งหมด"      value={transfers.total}     color="#0038C6" />
          <RowStat label="รออนุมัติ"    value={transfers.pending}   color="#d97706" />
          <RowStat label="เสร็จสมบูรณ์" value={transfers.completed} color="#16a34a" />
          <RowStat label="ปฏิเสธ"      value={transfers.rejected}  color="#dc2626" />
          {transfers.total > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                อัตราอนุมัติ {Math.round(transfers.completed / transfers.total * 100)}%
              </div>
              <div style={{ height: 6, background: "#e8eeff", borderRadius: 3 }}>
                <div style={{
                  height: 6, background: "#16a34a", borderRadius: 3, transition: "width .4s",
                  width: `${Math.round(transfers.completed / transfers.total * 100)}%`,
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Management */}
      <SectionTitle icon="👤">ผู้ใช้งานระบบ</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 28 }}>
        <KPI label="ผู้ใช้งานทั้งหมด" value={users.total}         color="#0038C6" />
        <KPI label="Active User"       value={users.active}         color="#16a34a"
          sub={`${activeRate}% ของผู้ใช้ทั้งหมด`} />
        <KPI label="Inactive User"     value={users.inactive}       color="#94a3b8" />
        <KPI label="Administrator"     value={users.admin_count}    color="#7c3aed" />
        <KPI label="ใหม่เดือนนี้"     value={users.new_this_month} color="#0891b2" />
      </div>

      {/* Recruitment */}
      <SectionTitle icon="📄">ระบบสรรหาบุคลากร</SectionTitle>
      {recruit.no_data ? (
        <div style={{ ...cardBox, marginBottom: 28, borderLeft: "4px solid #d97706",
          display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ fontSize: 28 }}>⚠️</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              ดูข้อมูลโดยตรงได้ที่{" "}
              <a href="/recruit" style={{ color: "#0038C6", fontWeight: 700 }}>ระบบสรรหาบุคลากร</a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 16 }}>
            <KPI label="ใบสมัครทั้งหมด"    value={recruit.total}      color="#0038C6" />
            <KPI label="รอพิจารณา"          value={recruit.pending}    color="#d97706"
              sub={recruit.pending > 10 ? "⚠ มากผิดปกติ" : undefined} />
            <KPI label="รอนัดสัมภาษณ์"     value={recruit.interview}  color="#0891b2" />
            <KPI label="ผ่านการสัมภาษณ์"   value={recruit.passed}     color="#7c3aed" />
            <KPI label="รับเข้างาน"         value={recruit.hired}      color="#16a34a" />
            <KPI label="ไม่ผ่าน"            value={recruit.rejected}   color="#dc2626" />
          </div>
          {recruit.total > 0 && (
            <div style={{ ...cardBox, marginBottom: 28, display: "flex", gap: 20, alignItems: "center" }}>
              <div style={{ fontSize: 12, color: "#64748b", whiteSpace: "nowrap" }}>Hiring Rate</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#16a34a", whiteSpace: "nowrap" }}>
                {recruit.hiring_rate}%
              </div>
              <div style={{ flex: 1, height: 8, background: "#e8eeff", borderRadius: 4 }}>
                <div style={{
                  height: 8, background: "#16a34a", borderRadius: 4, transition: "width .4s",
                  width: `${recruit.hiring_rate}%`,
                }} />
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                {recruit.hired}/{recruit.total} คน ·{" "}
                <a href="/recruit" style={{ color: "#0038C6", fontWeight: 700 }}>ดูรายละเอียด</a>
              </div>
            </div>
          )}
        </>
      )}

      {/* Activity log */}
      <SectionTitle icon="📌">กิจกรรมล่าสุด</SectionTitle>
      <div style={{ ...cardBox, overflow: "hidden" }}>
        {recent_activity.length === 0 ? (
          <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>ยังไม่มีกิจกรรม</div>
        ) : recent_activity.map((a, i) => (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 14, padding: "12px 20px",
            borderBottom: i < recent_activity.length - 1 ? "1px solid #f0f5ff" : "none",
          }}>
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
              {new Date(a.created_at).toLocaleString("th-TH", {
                day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
              })}
            </div>
          </div>
        ))}
      </div>
    </PageLayout>
  );
}
