import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";

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

interface KpiSummary {
  ok: boolean;
  period_label: string;
  turnover:       { pct: number; resigned: number; headcount: number };
  eval_coverage:  { pct: number | null; received: number; total: number };
  orientation:    { pct: number | null; passed: number; total: number };
  satisfaction:   { pct: number | null; responses: number };
  probation_pass: { pct: number | null; passed: number; total: number };
  training_plan:  { pct: number | null; actual: number; cancelled: number; total: number };
  new_hire_list: { full_name: string; position: string | null; start_date: string }[];
  resign_list: { full_name: string; position: string | null; resign_date: string; resign_reason: string | null }[];
  eval_coverage_list: { id: number; full_name: string; position: string | null; start_date: string; has_eval: boolean }[];
  orientation_list: { id: number; full_name: string; position: string | null; start_date: string; oriented: boolean }[];
  satisfaction_list: { course_id: number; course: string; course_date: string | null; avg_pct: number; n: number }[];
  probation_pass_list: { eval_id: number; employee_id: number; full_name: string; position: string | null; decision: string | null; updated_at: string }[];
  training_plan_list: { id: number; course: string; course_date: string | null; status: string; is_cancelled: boolean }[];
}

type KpiKey = "turnover" | "eval_coverage" | "orientation" | "satisfaction" | "probation_pass" | "training_plan";

const REPORT_DOC_APPROVER = { name: "นายแพทย์วัชระ  เตชะธีราวัฒน์", title: "ผู้อำนวยการโรงพยาบาล" };
const DEFAULT_ACK = { name: "อนุสิกข์  ทองแผ่น", title: "รองผู้อำนวยการฝ่ายบริหารค่าตอบแทนและพัฒนาคุณภาพ" };

function fmtShortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const MT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
  return `${d} ${MT[m - 1]} ${y + 543}`;
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

function pctColorHigh(pct: number | null): string {
  if (pct === null) return "#94a3b8";
  if (pct >= 90) return "#16a34a";
  if (pct >= 75) return "#0891b2";
  if (pct >= 60) return "#d97706";
  return "#dc2626";
}
function pctColorLow(pct: number): string {
  if (pct <= 2)  return "#16a34a";
  if (pct <= 5)  return "#0891b2";
  if (pct <= 10) return "#d97706";
  return "#dc2626";
}

function KpiCard({ label, icon, pct, sub, color, onClick }: { label: string; icon: string; pct: number | null; sub: string; color: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{ background: "#fff", borderRadius: 12, padding: "18px 20px",
      border: "1px solid #dce4f5", borderTop: `4px solid ${color}`,
      cursor: onClick ? "pointer" : "default", transition: "box-shadow .15s, transform .15s" }}
      onMouseEnter={e => { if (onClick) { e.currentTarget.style.boxShadow = "0 4px 14px rgba(0,56,198,.12)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "none"; }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#475569" }}>{label}</span>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, color }}>{pct === null ? "—" : `${pct}%`}</div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>
      {pct !== null && (
        <div style={{ marginTop: 10, height: 6, background: "#e8eeff", borderRadius: 3 }}>
          <div style={{ height: 6, background: color, borderRadius: 3,
            width: `${Math.min(100, pct)}%`, transition: "width .4s" }} />
        </div>
      )}
      {onClick && (
        <div style={{ marginTop: 8, fontSize: 10.5, color: "#0038C6", fontWeight: 700 }}>ดูรายละเอียด →</div>
      )}
    </div>
  );
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

function currentYM(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ExecPage() {
  const { user } = useAuth();
  const [data, setData]           = useState<Summary | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // HR KPI section (5 core metrics, selectable period)
  const [kpiPeriodType, setKpiPeriodType] = useState<"month" | "year">("month");
  const [kpiMonth, setKpiMonth]           = useState(currentYM);
  const [kpiYear, setKpiYear]             = useState(() => String(new Date().getFullYear()));
  const [kpiData, setKpiData]             = useState<KpiSummary | null>(null);
  const [kpiDetail, setKpiDetail]         = useState<KpiKey | null>(null);
  const [kpiLoading, setKpiLoading]       = useState(true);
  const kpiValue = kpiPeriodType === "month" ? kpiMonth : kpiYear;

  // Monthly report print dialog
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  const [preparerName, setPreparerName] = useState("");
  const [preparerTitle, setPreparerTitle] = useState("");
  const [ackName, setAckName]   = useState(DEFAULT_ACK.name);
  const [ackTitle, setAckTitle] = useState(DEFAULT_ACK.title);

  function openPrintDialog() {
    setPreparerName(user?.full_name ?? "");
    setPreparerTitle(user?.role_title ?? "");
    setShowPrintDialog(true);
  }

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

  useEffect(() => {
    setKpiLoading(true);
    fetch(`/api/exec/kpi?period=${kpiPeriodType}&value=${kpiValue}`).then(r => r.json())
      .then((d: { ok: boolean } & KpiSummary) => { if (d.ok) setKpiData(d); })
      .finally(() => setKpiLoading(false));
  }, [kpiPeriodType, kpiValue]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));

  function printMonthlyExecReport() {
    if (!kpiData) return;
    setShowPrintDialog(false);

    const hires   = kpiData.new_hire_list;
    const resigns = kpiData.resign_list;
    const kpiRows: { label: string; pct: number | null; detail: string }[] = [
      { label: "ร้อยละพนักงานลาออก", pct: kpiData.turnover.pct,
        detail: `ลาออก ${kpiData.turnover.resigned} / พนักงาน ${kpiData.turnover.headcount} คน` },
      { label: "ร้อยละพนักงานใหม่ที่ได้รับการประเมิน", pct: kpiData.eval_coverage.pct,
        detail: kpiData.eval_coverage.total > 0 ? `ได้รับประเมิน ${kpiData.eval_coverage.received} / พนักงานใหม่ ${kpiData.eval_coverage.total} คน` : "ไม่มีพนักงานใหม่ในช่วงนี้" },
      { label: "ร้อยละพนักงานใหม่ที่ผ่านการอบรมปฐมนิเทศ", pct: kpiData.orientation.pct,
        detail: kpiData.orientation.total > 0 ? `ผ่าน ${kpiData.orientation.passed} / พนักงานใหม่ ${kpiData.orientation.total} คน` : "ไม่มีพนักงานใหม่ในช่วงนี้" },
      { label: "ร้อยละความพึงพอใจของผู้ได้รับการอบรม", pct: kpiData.satisfaction.pct,
        detail: kpiData.satisfaction.responses > 0 ? `จาก ${kpiData.satisfaction.responses} คำตอบ` : "ยังไม่มีการตอบแบบสอบถาม" },
      { label: "ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลปฏิบัติงาน", pct: kpiData.probation_pass.pct,
        detail: kpiData.probation_pass.total > 0 ? `ผ่าน ${kpiData.probation_pass.passed} / ประเมินแล้ว ${kpiData.probation_pass.total} คน` : "ยังไม่มีการประเมินครบกำหนดในช่วงนี้" },
      { label: "ร้อยละที่อบรมตามแผน", pct: kpiData.training_plan.pct,
        detail: kpiData.training_plan.total > 0
          ? `จัดจริง ${kpiData.training_plan.actual} / ยกเลิก ${kpiData.training_plan.cancelled} / แผนทั้งหมด ${kpiData.training_plan.total} หลักสูตร`
          : "ยังไม่มีแผนอบรมในช่วงนี้" },
    ];

    // Shrink type density as content grows, so the report reliably fits one landscape A4 page.
    const totalRows = hires.length + resigns.length;
    const density = totalRows > 16 ? "density-ultra" : totalRows > 8 ? "density-compact" : "";

    const win = window.open("", "_blank", "width=1200,height=800");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>สรุปผลการทำงานประจำเดือน ${kpiData.period_label}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page{size:A4 landscape;margin:12mm 14mm}
  *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact;color-adjust:exact}
  body{font-family:'Sarabun',Arial,sans-serif;font-size:10.5pt;color:#222;margin:0}
  .paper{height:186mm;overflow:hidden}
  .hdr{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;
    border-bottom:3px solid #0038C6;padding-bottom:10px;margin-bottom:14px}
  .hdr-left{display:flex;align-items:center;gap:14px}
  .logo{width:44px;height:44px;background:#0038C6;border-radius:10px;color:#fff;
    font-weight:900;font-size:9.5pt;display:flex;align-items:center;justify-content:center;text-align:center;
    line-height:1.2;flex-shrink:0}
  h1{font-size:15pt;color:#0038C6;margin:0 0 2px;font-weight:800}
  .sub{font-size:8.5pt;color:#64748b}
  .doccode{border:1.5px solid #c4cfee;background:#F4F7FB;border-radius:8px;padding:7px 12px;
    text-align:center;font-size:8pt;color:#0038C6;font-weight:700;white-space:nowrap}
  .sect{font-size:11pt;font-weight:800;color:#0038C6;margin:14px 0 6px}
  .cols{display:grid;grid-template-columns:1fr 1fr;gap:16px}
  table{width:100%;border-collapse:collapse;font-size:9pt}
  th{background:#0038C6;color:#fff;padding:6px 7px;text-align:left;font-weight:700}
  td{border-bottom:1px solid #eef2fb;padding:5px 7px;vertical-align:middle}
  tr:nth-child(even) td{background:#F4F7FB}
  .kpi-table td.pct{font-weight:800;color:#0038C6;text-align:center;width:70px}
  .sigrow{display:grid;grid-template-columns:1fr 1fr 1fr;gap:30px;margin-top:26px}
  .sigbox{text-align:center;font-size:9pt}
  .sigline{border-top:1px solid #94a3b8;margin:32px 10px 8px}
  .signame{font-weight:700;color:#111}
  .sigtitle{color:#64748b;font-size:8pt;margin-top:1px}
  .foot{margin-top:12px;font-size:7.5pt;color:#94a3b8;text-align:right}
  @media print{.noprint{display:none}}

  body.density-compact .sect{font-size:10pt;margin:9px 0 5px}
  body.density-compact table{font-size:8pt}
  body.density-compact th,body.density-compact td{padding:4px 6px}
  body.density-compact .sigrow{margin-top:14px}
  body.density-compact .sigline{margin:18px 10px 6px}

  body.density-ultra .hdr{padding-bottom:6px;margin-bottom:8px}
  body.density-ultra h1{font-size:13pt}
  body.density-ultra .sub{font-size:7.5pt}
  body.density-ultra .sect{font-size:9pt;margin:6px 0 4px}
  body.density-ultra table{font-size:7.5pt}
  body.density-ultra th,body.density-ultra td{padding:3px 5px}
  body.density-ultra .sigrow{margin-top:8px}
  body.density-ultra .sigline{margin:10px 10px 4px}
  body.density-ultra .sigbox{font-size:8pt}
  body.density-ultra .sigtitle{font-size:7pt}
  body.density-ultra .foot{margin-top:5px}
</style></head><body class="${density}">
<div class="paper">
<div class="hdr">
  <div class="hdr-left">
    <div class="logo">RAM+</div>
    <div>
      <div class="sub">โรงพยาบาลเชียงราย ราม · Human Resource Development</div>
      <h1>สรุปผลการทำงานประจำเดือน ${kpiData.period_label}</h1>
    </div>
  </div>
  <div class="doccode">รหัสเอกสาร<br>FM-HRD-02-08 REV 01</div>
</div>

<div class="cols">
  <div>
    <div class="sect">พนักงานเริ่มงานใหม่ประจำเดือน ${kpiData.period_label}</div>
    <table>
      <thead><tr><th style="width:34px">ลำดับที่</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่งงาน</th><th style="width:110px">วันที่เริ่มงาน</th></tr></thead>
      <tbody>
        ${hires.length === 0
          ? `<tr><td colspan="4" style="text-align:center;color:#94a3b8;padding:14px">ไม่มีพนักงานเริ่มงานใหม่ในช่วงนี้</td></tr>`
          : hires.map((h, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${h.full_name}</td><td>${h.position ?? "—"}</td><td>${fmtShortDate(h.start_date)}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>
  <div>
    <div class="sect">พนักงานลาออกประจำเดือน ${kpiData.period_label}</div>
    <table>
      <thead><tr><th style="width:34px">ลำดับที่</th><th>ชื่อ-นามสกุล</th><th>ตำแหน่งงาน</th><th style="width:110px">วันที่ทำงานวันสุดท้าย</th><th>หมายเหตุ</th></tr></thead>
      <tbody>
        ${resigns.length === 0
          ? `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:14px">ไม่มีพนักงานลาออกในช่วงนี้</td></tr>`
          : resigns.map((r, i) => `<tr><td style="text-align:center">${i + 1}</td><td>${r.full_name}</td><td>${r.position ?? "—"}</td><td>${fmtShortDate(r.resign_date)}</td><td>${r.resign_reason ?? ""}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>
</div>

<div class="sect">รายงาน KPI ของ HR ประจำเดือน ${kpiData.period_label}</div>
<table class="kpi-table">
  <thead><tr><th>ตัวชี้วัด</th><th style="width:70px">ร้อยละ</th><th>รายละเอียด</th></tr></thead>
  <tbody>
    ${kpiRows.map(k => `<tr><td>${k.label}</td><td class="pct">${k.pct === null ? "—" : k.pct + "%"}</td><td>${k.detail}</td></tr>`).join("")}
  </tbody>
</table>

<div class="sigrow">
  <div class="sigbox"><div class="sigline"></div><div class="signame">${preparerName || "……………………………"}</div><div class="sigtitle">${preparerTitle ? preparerTitle + " " : ""}(ผู้จัดทำ)</div></div>
  <div class="sigbox"><div class="sigline"></div><div class="signame">${ackName || "……………………………"}</div><div class="sigtitle">${ackTitle} (ผู้รับทราบ)</div></div>
  <div class="sigbox"><div class="sigline"></div><div class="signame">${REPORT_DOC_APPROVER.name}</div><div class="sigtitle">${REPORT_DOC_APPROVER.title} (ผู้อนุมัติ)</div></div>
</div>
<div class="foot">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
</div>
<div class="noprint" style="margin-top:14px;text-align:center">
  <button onclick="window.print()" style="padding:9px 24px;background:#0038C6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12pt">🖨️ พิมพ์รายงาน</button>
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

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

      {/* 5 ตัวชี้วัด HR KPI */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
        flexWrap: "wrap", gap: 10, marginBottom: 12, marginTop: 6 }}>
        <SectionTitle icon="🎯">5 ตัวชี้วัด HR KPI{kpiData ? ` — ${kpiData.period_label}` : ""}</SectionTitle>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", background: "#f1f5f9", borderRadius: 8, padding: 3 }}>
            {(["month", "year"] as const).map(t => (
              <button key={t} onClick={() => setKpiPeriodType(t)}
                style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontFamily: "inherit",
                  fontSize: 12, fontWeight: kpiPeriodType === t ? 700 : 400, cursor: "pointer",
                  background: kpiPeriodType === t ? "#0038C6" : "transparent",
                  color: kpiPeriodType === t ? "#fff" : "#64748b" }}>
                {t === "month" ? "รายเดือน" : "รายปี"}
              </button>
            ))}
          </div>
          {kpiPeriodType === "month" ? (
            <input type="month" value={kpiMonth} onChange={e => setKpiMonth(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
                fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" }} />
          ) : (
            <select value={kpiYear} onChange={e => setKpiYear(e.target.value)}
              style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
                fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
              {yearOptions.map(y => <option key={y} value={y}>{Number(y) + 543}</option>)}
            </select>
          )}
          <button onClick={openPrintDialog} disabled={!kpiData}
            style={{ padding: "7px 16px", borderRadius: 7, border: "none",
              background: kpiData ? "#0038C6" : "#c4cfee", color: "#fff", fontWeight: 700, fontSize: 12,
              cursor: kpiData ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            🖨️ พิมพ์รายงานประจำเดือน
          </button>
        </div>
      </div>
      {kpiLoading || !kpiData ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด KPI…</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: 14, marginBottom: 28 }}>
          <KpiCard label="ร้อยละพนักงานลาออก" icon="📉"
            pct={kpiData.turnover.pct} color={pctColorLow(kpiData.turnover.pct)}
            sub={`ลาออก ${kpiData.turnover.resigned} / พนักงาน ${kpiData.turnover.headcount} คน`}
            onClick={() => setKpiDetail("turnover")} />
          <KpiCard label="ร้อยละพนักงานใหม่ที่ได้รับการประเมิน" icon="📋"
            pct={kpiData.eval_coverage.pct} color={pctColorHigh(kpiData.eval_coverage.pct)}
            sub={kpiData.eval_coverage.total > 0
              ? `ได้รับประเมิน ${kpiData.eval_coverage.received} / พนักงานใหม่ ${kpiData.eval_coverage.total} คน`
              : "ไม่มีพนักงานใหม่ในช่วงนี้"}
            onClick={() => setKpiDetail("eval_coverage")} />
          <KpiCard label="ร้อยละพนักงานใหม่ที่ผ่านการอบรมปฐมนิเทศ" icon="🧑‍🏫"
            pct={kpiData.orientation.pct} color={pctColorHigh(kpiData.orientation.pct)}
            sub={kpiData.orientation.total > 0
              ? `ผ่าน ${kpiData.orientation.passed} / พนักงานใหม่ ${kpiData.orientation.total} คน`
              : "ไม่มีพนักงานใหม่ในช่วงนี้"}
            onClick={() => setKpiDetail("orientation")} />
          <KpiCard label="ร้อยละความพึงพอใจของผู้ได้รับการอบรม" icon="⭐"
            pct={kpiData.satisfaction.pct} color={pctColorHigh(kpiData.satisfaction.pct)}
            sub={kpiData.satisfaction.responses > 0
              ? `จาก ${kpiData.satisfaction.responses} คำตอบ`
              : "ยังไม่มีการตอบแบบสอบถาม"}
            onClick={() => setKpiDetail("satisfaction")} />
          <KpiCard label="ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลปฏิบัติงาน" icon="📝"
            pct={kpiData.probation_pass.pct} color={pctColorHigh(kpiData.probation_pass.pct)}
            sub={kpiData.probation_pass.total > 0
              ? `ผ่าน ${kpiData.probation_pass.passed} / ประเมินแล้ว ${kpiData.probation_pass.total} คน`
              : "ยังไม่มีการประเมินครบกำหนดในช่วงนี้"}
            onClick={() => setKpiDetail("probation_pass")} />
          <KpiCard label="ร้อยละที่อบรมตามแผน" icon="📚"
            pct={kpiData.training_plan.pct} color={pctColorHigh(kpiData.training_plan.pct)}
            sub={kpiData.training_plan.total > 0
              ? `จัดจริง ${kpiData.training_plan.actual} / ยกเลิก ${kpiData.training_plan.cancelled} / แผนทั้งหมด ${kpiData.training_plan.total} หลักสูตร`
              : "ยังไม่มีแผนอบรมในช่วงนี้"}
            onClick={() => setKpiDetail("training_plan")} />
        </div>
      )}

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

      {showPrintDialog && (() => {
        const rowStyle: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 };
        const inp: React.CSSProperties = { width: "100%", padding: "8px 11px", borderRadius: 7,
          border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
        const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
          textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, marginTop: 12 };
        return (
          <div onClick={e => { if (e.target === e.currentTarget) setShowPrintDialog(false); }}
            style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 480, width: "100%",
              maxHeight: "88vh", overflowY: "auto", border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628", marginBottom: 4 }}>
                🖨️ พิมพ์รายงานประจำเดือน — {kpiData?.period_label}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 6 }}>
                แก้ไขชื่อหรือตำแหน่งผู้จัดทำ/ผู้รับทราบได้ก่อนพิมพ์ · ผู้อนุมัติกำหนดตายตัว
              </div>

              <label style={lbl}>ผู้จัดทำ</label>
              <div style={rowStyle}>
                <input style={inp} placeholder="ชื่อ-นามสกุล" value={preparerName} onChange={e => setPreparerName(e.target.value)} />
                <input style={inp} placeholder="ตำแหน่ง" value={preparerTitle} onChange={e => setPreparerTitle(e.target.value)} />
              </div>

              <label style={lbl}>ผู้รับทราบ</label>
              <div style={rowStyle}>
                <input style={inp} placeholder="ชื่อ-นามสกุล" value={ackName} onChange={e => setAckName(e.target.value)} />
                <input style={inp} placeholder="ตำแหน่ง" value={ackTitle} onChange={e => setAckTitle(e.target.value)} />
              </div>

              <label style={lbl}>ผู้อนุมัติ (ตายตัว)</label>
              <div style={{ background: "#f0f5ff", border: "1px solid #dce4f5", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, color: "#475569" }}>
                <b>{REPORT_DOC_APPROVER.name}</b> — {REPORT_DOC_APPROVER.title}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => setShowPrintDialog(false)}
                  style={{ flex: 1, padding: "10px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                    background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
                <button onClick={printMonthlyExecReport}
                  style={{ flex: 2, padding: "10px 0", borderRadius: 7, border: "none",
                    background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  🖨️ พิมพ์รายงาน
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {kpiDetail && kpiData && (() => {
        const CONFIG: Record<KpiKey, { title: string; icon: string; modulePath: string; moduleLabel: string }> = {
          turnover:        { title: "รายชื่อพนักงานลาออก", icon: "📉", modulePath: "/manpower", moduleLabel: "ไปที่ระบบอัตรากำลัง →" },
          eval_coverage:   { title: "พนักงานใหม่ที่ได้รับ/ยังไม่ได้รับการประเมิน", icon: "📋", modulePath: "/eval", moduleLabel: "ไปที่ระบบประเมินผล →" },
          orientation:     { title: "พนักงานใหม่ที่ผ่าน/ยังไม่ผ่านการอบรมปฐมนิเทศ", icon: "🧑‍🏫", modulePath: "/training", moduleLabel: "ไปที่ระบบฝึกอบรม →" },
          satisfaction:    { title: "ความพึงพอใจของผู้เข้าอบรม แยกตามหลักสูตร", icon: "⭐", modulePath: "/training", moduleLabel: "ไปที่ระบบฝึกอบรม →" },
          probation_pass:  { title: "ผลการประเมินทดลองงาน (รอบสุดท้าย) ที่อนุมัติในช่วงนี้", icon: "📝", modulePath: "/eval", moduleLabel: "ไปที่ระบบประเมินผล →" },
          training_plan:   { title: "หลักสูตรอบรมตามแผนในช่วงนี้", icon: "📚", modulePath: "/training", moduleLabel: "ไปที่ระบบฝึกอบรม →" },
        };
        const cfg = CONFIG[kpiDetail];
        const thStyle: React.CSSProperties = { padding: "8px 12px", textAlign: "left", fontWeight: 700,
          color: "#475569", borderBottom: "2px solid #dce4f5", fontSize: 11, letterSpacing: "0.06em",
          textTransform: "uppercase" as const, background: "#f4f7ff" };
        const tdStyle: React.CSSProperties = { padding: "9px 12px", fontSize: 13, borderBottom: "1px solid #f0f5ff" };
        const badge = (ok: boolean, yes: string, no: string) => (
          <span style={{ padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
            background: ok ? "#f0fdf4" : "#fef2f2", color: ok ? "#16a34a" : "#dc2626" }}>{ok ? yes : no}</span>
        );

        let rows: React.ReactNode;
        if (kpiDetail === "turnover") {
          rows = kpiData.resign_list.length === 0
            ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>ไม่มีพนักงานลาออกในช่วงนี้</td></tr>
            : kpiData.resign_list.map((r, i) => (
              <tr key={i}><td style={tdStyle}>{r.full_name}<div style={{ fontSize: 11, color: "#94a3b8" }}>{r.position ?? "—"}</div></td>
                <td style={tdStyle}>{fmtShortDate(r.resign_date)}</td><td style={tdStyle}>{r.resign_reason ?? "—"}</td></tr>
            ));
        } else if (kpiDetail === "eval_coverage") {
          rows = kpiData.eval_coverage_list.length === 0
            ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>ไม่มีพนักงานใหม่ในช่วงนี้</td></tr>
            : kpiData.eval_coverage_list.map(r => (
              <tr key={r.id}><td style={tdStyle}>{r.full_name}<div style={{ fontSize: 11, color: "#94a3b8" }}>{r.position ?? "—"}</div></td>
                <td style={tdStyle}>{fmtShortDate(r.start_date)}</td>
                <td style={tdStyle}>{badge(r.has_eval, "ได้รับประเมินแล้ว", "ยังไม่ได้ประเมิน")}</td></tr>
            ));
        } else if (kpiDetail === "orientation") {
          rows = kpiData.orientation_list.length === 0
            ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>ไม่มีพนักงานใหม่ในช่วงนี้</td></tr>
            : kpiData.orientation_list.map(r => (
              <tr key={r.id}><td style={tdStyle}>{r.full_name}<div style={{ fontSize: 11, color: "#94a3b8" }}>{r.position ?? "—"}</div></td>
                <td style={tdStyle}>{fmtShortDate(r.start_date)}</td>
                <td style={tdStyle}>{badge(r.oriented, "ผ่านแล้ว", "ยังไม่ผ่าน")}</td></tr>
            ));
        } else if (kpiDetail === "satisfaction") {
          rows = kpiData.satisfaction_list.length === 0
            ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>ยังไม่มีการตอบแบบสอบถามในช่วงนี้</td></tr>
            : kpiData.satisfaction_list.map(r => (
              <tr key={r.course_id}><td style={tdStyle}>{r.course}</td>
                <td style={tdStyle}>{r.course_date ? fmtShortDate(r.course_date) : "—"}</td>
                <td style={tdStyle}><b style={{ color: "#0038C6" }}>{r.avg_pct}%</b> ({r.n} คำตอบ)</td></tr>
            ));
        } else if (kpiDetail === "probation_pass") {
          rows = kpiData.probation_pass_list.length === 0
            ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>ยังไม่มีการประเมินครบกำหนดในช่วงนี้</td></tr>
            : kpiData.probation_pass_list.map(r => (
              <tr key={r.eval_id}><td style={tdStyle}>{r.full_name}<div style={{ fontSize: 11, color: "#94a3b8" }}>{r.position ?? "—"}</div></td>
                <td style={tdStyle}>{fmtShortDate(r.updated_at.slice(0, 10))}</td>
                <td style={tdStyle}>{badge(r.decision === "บรรจุเป็นพนักงานประจำ", r.decision ?? "—", r.decision ?? "—")}</td></tr>
            ));
        } else {
          rows = kpiData.training_plan_list.length === 0
            ? <tr><td colSpan={3} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8" }}>ยังไม่มีแผนอบรมในช่วงนี้</td></tr>
            : kpiData.training_plan_list.map(r => (
              <tr key={r.id}><td style={tdStyle}>{r.course}</td>
                <td style={tdStyle}>{r.course_date ? fmtShortDate(r.course_date) : "—"}</td>
                <td style={tdStyle}>{r.is_cancelled ? badge(false, "", "ยกเลิก") : badge(r.status === "done", "จัดแล้ว", r.status)}</td></tr>
            ));
        }

        const headCols: [string, string, string] =
          kpiDetail === "turnover"       ? ["ชื่อ-นามสกุล", "วันที่ลาออก", "เหตุผล"] :
          kpiDetail === "satisfaction"    ? ["หลักสูตร", "วันที่อบรม", "คะแนนเฉลี่ย"] :
          kpiDetail === "training_plan"   ? ["หลักสูตร", "วันที่อบรม", "สถานะ"] :
          kpiDetail === "eval_coverage"   ? ["ชื่อ-นามสกุล", "วันที่เริ่มงาน", "สถานะประเมิน"] :
          kpiDetail === "orientation"     ? ["ชื่อ-นามสกุล", "วันที่เริ่มงาน", "สถานะปฐมนิเทศ"] :
                                             ["ชื่อ-นามสกุล", "วันที่อนุมัติ", "ผลการประเมิน"];

        return (
          <div onClick={e => { if (e.target === e.currentTarget) setKpiDetail(null); }}
            style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)",
              display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 620, width: "100%",
              maxHeight: "84vh", display: "flex", flexDirection: "column",
              border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628" }}>{cfg.icon} {cfg.title}</div>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{kpiData.period_label}</div>
                </div>
                <button onClick={() => setKpiDetail(null)}
                  style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ overflowY: "auto", marginTop: 12, marginBottom: 4, border: "1px solid #f0f5ff", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead><tr>{headCols.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
                  <tbody>{rows}</tbody>
                </table>
              </div>
              <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
                <a href={cfg.modulePath} style={{ padding: "9px 18px", borderRadius: 7, background: "#0038C6",
                  color: "#fff", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                  {cfg.moduleLabel}
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </PageLayout>
  );
}
