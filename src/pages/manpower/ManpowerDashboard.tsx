import { useEffect, useState } from "react";
import { daysUntil, formatThaiDate } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";
import OnboardingChecklist from "./OnboardingChecklist";
import ExitChecklistModal from "./ExitChecklistModal";

interface NewHireRow  { id: number; full_name: string; position: string; start_date: string; emp_type: string; division_name: string }
interface ResignRow   { id: number; full_name: string; position: string; resign_date: string; resign_reason: string; division_name: string }

interface Summary {
  cards: {
    headcount: number; active: number; probation: number;
    new_this_month: number; resigned_this_month: number; turnover_rate: number;
  };
  period_label: string;
  by_division: { division: string; n: number }[];
  by_type: { type: string; n: number }[];
  by_status: { status: string; n: number }[];
  trend: { hires: { m: string; n: number }[]; resigns: { m: string; n: number }[] };
  near_probation: {
    id: number; emp_code: string; full_name: string; position: string;
    probation_end_date: string; color: string; initial: string; department_name: string;
  }[];
  new_hire_list: NewHireRow[];
  resign_list: ResignRow[];
}

interface SnapshotItem {
  snapshot_month: string; headcount: number; active: number;
  turnover_rate: number; created_by: string; created_at: string;
}

interface SnapshotDetail {
  snapshot_month: string; headcount: number; active: number; probation: number;
  new_this_month: number; resigned_this_month: number; turnover_rate: number;
  period_label: string;
  by_division: { division: string; n: number }[];
  by_type:     { type: string; n: number }[];
  by_status:   { status: string; n: number }[];
  created_by: string; created_at: string;
}

type Modal = "newhire" | "resign" | null;

const CARD_DEFS: { key: keyof Summary["cards"]; label: string; icon: string; color: string; suffix?: string; modal?: Modal }[] = [
  { key: "headcount",           label: "อัตรากำลังทั้งหมด",  icon: "👥", color: "#0038C6" },
  { key: "active",             label: "พนักงาน Active",     icon: "✅", color: "#16a34a" },
  { key: "probation",          label: "ทดลองงาน",          icon: "🕐", color: "#d97706" },
  { key: "new_this_month",     label: "เข้าใหม่เดือนนี้",    icon: "➕", color: "#0891b2", modal: "newhire" },
  { key: "resigned_this_month",label: "ลาออกเดือนนี้",      icon: "📤", color: "#dc2626", modal: "resign"  },
  { key: "turnover_rate",      label: "Turnover Rate",      icon: "📉", color: "#7c3aed", suffix: "%" },
];

function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const mo = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${mo.getFullYear()}-${String(mo.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("th-TH", { month: "short", year: "numeric" });
}

function probBucket(end: string): { label: string; color: string; bg: string } {
  const d = daysUntil(end);
  if (d === null)  return { label: "—", color: "#94a3b8", bg: "#f1f5f9" };
  if (d < 0)       return { label: `เกิน ${Math.abs(d)} วัน`, color: "#7f1d1d", bg: "#fee2e2" };
  if (d <= 7)      return { label: `🔴 เหลือ ${d} วัน (เร่งด่วน)`, color: "#dc2626", bg: "#fee2e2" };
  if (d <= 15)     return { label: `🟠 เหลือ ${d} วัน (แจ้ง HR)`, color: "#c2410c", bg: "#fff7ed" };
  if (d <= 30)     return { label: `🟡 เหลือ ${d} วัน (แจ้งหัวหน้า)`, color: "#b45309", bg: "#fefce8" };
  return { label: `เหลือ ${d} วัน`, color: "#16a34a", bg: "#dcfce7" };
}

const PALETTE = ["#0038C6", "#16a34a", "#0891b2", "#7c3aed", "#d97706", "#db2777", "#0d9488", "#dc2626", "#64748b"];
const STATUS_COLOR: Record<string, string> = {
  "ผ่านทดลองงาน": "#16a34a", "ทดลองงาน": "#d97706", "ย้ายแผนก": "#0891b2",
};

function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function ManpowerDashboard() {
  const { user }  = useAuth();
  const canSave   = user && ["hr", "admin", "deputyHR"].includes(user.role);

  const [data, setData]         = useState<Summary | null>(null);
  const [loading, setLoad]      = useState(true);
  const [error, setError]       = useState("");
  const [modal, setModal]       = useState<Modal>(null);

  // Snapshot state
  const [months, setMonths]     = useState<SnapshotItem[]>([]);
  const [histMonth, setHist]    = useState<string>("");          // "" = live
  const [histData, setHistData] = useState<SnapshotDetail | null>(null);
  const [histLoad, setHL]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState("");
  const [checklistEmp, setChecklistEmp]         = useState<{ id: number; name: string } | null>(null);
  const [exitChecklistEmp, setExitChecklistEmp] = useState<{ id: number; name: string } | null>(null);

  // Load live summary
  useEffect(() => {
    fetch("/api/manpower/summary").then(r => r.json())
      .then((d: Summary & { ok: boolean; error?: string }) => {
        if (!d.ok) setError(d.error ?? "โหลดไม่สำเร็จ");
        else setData(d);
        setLoad(false);
      })
      .catch(() => { setError("เกิดข้อผิดพลาด"); setLoad(false); });
  }, []);

  // Load snapshot list
  useEffect(() => {
    fetch("/api/manpower/snapshot").then(r => r.json())
      .then((d: { ok: boolean; months: SnapshotItem[] }) => {
        if (d.ok) setMonths(d.months ?? []);
      });
  }, [saving]);

  // Load historical snapshot when month changes
  useEffect(() => {
    if (!histMonth) { setHistData(null); return; }
    setHL(true);
    fetch(`/api/manpower/snapshot?month=${histMonth}`).then(r => r.json())
      .then((d: { ok: boolean; snapshot: SnapshotDetail }) => {
        if (d.ok) setHistData(d.snapshot);
        setHL(false);
      });
  }, [histMonth]);

  async function saveSnapshot() {
    setSaving(true); setSaveMsg("");
    const r  = await fetch("/api/manpower/snapshot", { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month: currentYM() }) });
    const d  = await r.json() as { ok: boolean; headcount?: number; error?: string };
    setSaving(false);
    if (d.ok) setSaveMsg(`✅ บันทึกแล้ว — ${d.headcount} คน`);
    else      setSaveMsg(`❌ ${d.error}`);
    setTimeout(() => setSaveMsg(""), 4000);
  }

  // ─── Derived display values ───────────────────────────────────────────
  const isHist    = !!histMonth && !!histData;
  const cards     = isHist
    ? { headcount: histData!.headcount, active: histData!.active, probation: histData!.probation,
        new_this_month: histData!.new_this_month, resigned_this_month: histData!.resigned_this_month,
        turnover_rate: histData!.turnover_rate }
    : data?.cards;

  const byDivision  = isHist ? histData!.by_division  : (data?.by_division ?? []);
  const byType      = isHist ? histData!.by_type       : (data?.by_type ?? []);
  const byStatus    = isHist ? histData!.by_status     : (data?.by_status ?? []);
  const periodLabel = isHist ? histData!.period_label  : data?.period_label;

  const divMax      = Math.max(1, ...byDivision.map(d => d.n));
  const typeTotal   = Math.max(1, byType.reduce((s, t) => s + t.n, 0));
  const statusTotal = Math.max(1, byStatus.reduce((s, t) => s + t.n, 0));
  const TYPE_MULTI  = byType.length > 1;

  const months6     = lastMonths(6);
  const hireMap     = Object.fromEntries((data?.trend.hires ?? []).map(x => [x.m, x.n]));
  const resignMap   = Object.fromEntries((data?.trend.resigns ?? []).map(x => [x.m, x.n]));
  const trendMax    = Math.max(1, ...months6.map(m => Math.max(hireMap[m] ?? 0, resignMap[m] ?? 0)));

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>;
  if (error || !data) return (
    <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, color: "#dc2626" }}>
      {error || "ไม่มีข้อมูล"}
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>

      {/* ── History bar ─────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "12px 18px",
        boxShadow: "0 1px 4px rgba(0,0,0,.05)",
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>

        <span style={{ fontSize: 13, fontWeight: 700, color: "#0a1628" }}>📅 ดูข้อมูลย้อนหลัง</span>

        <select value={histMonth} onChange={e => setHist(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
            fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff" }}>
          <option value="">▶ ข้อมูลปัจจุบัน (Real-time)</option>
          {months.map(s => (
            <option key={s.snapshot_month} value={s.snapshot_month}>
              {monthLabel(s.snapshot_month)} — {s.headcount} คน (บันทึกโดย {s.created_by})
            </option>
          ))}
        </select>

        {months.length === 0 && (
          <span style={{ fontSize: 12, color: "#94a3b8" }}>ยังไม่มีประวัติ — กด "บันทึก" เพื่อเริ่มเก็บ</span>
        )}

        <div style={{ flex: 1 }} />

        {canSave && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {saveMsg && (
              <span style={{ fontSize: 12, color: saveMsg.startsWith("✅") ? "#16a34a" : "#dc2626" }}>
                {saveMsg}
              </span>
            )}
            <button onClick={saveSnapshot} disabled={saving}
              style={{ padding: "8px 16px", borderRadius: 8, border: "none",
                background: saving ? "#c4cfee" : "#0038c6", color: "#fff",
                fontWeight: 700, fontSize: 12, cursor: saving ? "not-allowed" : "pointer",
                fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              {saving ? "กำลังบันทึก…" : "💾 บันทึกข้อมูลเดือนนี้"}
            </button>
          </div>
        )}
      </div>

      {/* ── Historical mode badge ──────────────────────────────────────── */}
      {isHist && (
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
          padding: "10px 16px", fontSize: 13, color: "#92400e",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>
            📂 กำลังดูข้อมูลย้อนหลัง: <b>{monthLabel(histData!.snapshot_month)}</b>
            {" "}· รอบ {histData!.period_label}
            {" "}· บันทึกโดย <b>{histData!.created_by}</b>
          </span>
          <button onClick={() => setHist("")}
            style={{ background: "none", border: "1px solid #fde68a", borderRadius: 6,
              padding: "3px 12px", cursor: "pointer", fontSize: 12, color: "#92400e",
              fontFamily: "inherit" }}>
            กลับสู่ปัจจุบัน ✕
          </button>
        </div>
      )}

      {/* ── Employee Detail Modal ─────────────────────────────────────── */}
      {modal && !isHist && (
        <div onClick={() => setModal(null)} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 999,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: "#fff", borderRadius: 18, width: "100%", maxWidth: 700,
            maxHeight: "82vh", display: "flex", flexDirection: "column",
            boxShadow: "0 8px 40px rgba(0,0,0,.18)" }}>
            <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9",
              display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: "#0a1628" }}>
                  {modal === "newhire" ? "พนักงานเข้าใหม่" : "พนักงานลาออก"}
                </div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 3 }}>รอบ {data.period_label}</div>
              </div>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none",
                fontSize: 20, cursor: "pointer", color: "#94a3b8", lineHeight: 1, padding: 4 }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", padding: "16px 24px 24px" }}>
              {modal === "newhire" && (
                data.new_hire_list.length === 0
                  ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีพนักงานเข้าใหม่ในรอบนี้</div>
                  : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr style={{ background: "#f8fafc" }}>
                        {["#","ชื่อ-นามสกุล","ตำแหน่ง","ฝ่าย","ประเภท","วันที่เริ่มงาน","Onboarding"].map(h => (
                          <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 12,
                            fontWeight: 700, color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {data.new_hire_list.map((e, i) => (
                          <tr key={e.id} style={{ background: i % 2 === 0 ? "#fafbff" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#94a3b8" }}>{i + 1}</td>
                            <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600, color: "#0a1628" }}>{e.full_name}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#475569" }}>{e.position}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>{e.division_name}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>{e.emp_type || "—"}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#0891b2", fontWeight: 600 }}>{formatThaiDate(e.start_date)}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <button onClick={() => setChecklistEmp({ id: e.id, name: e.full_name })}
                                style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #c4cfee",
                                  background: "#f4f7ff", fontSize: 11, cursor: "pointer",
                                  color: "#0038C6", fontWeight: 700, fontFamily: "inherit",
                                  whiteSpace: "nowrap" }}>
                                📋 Checklist
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}
              {modal === "resign" && (
                data.resign_list.length === 0
                  ? <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีพนักงานลาออกในรอบนี้</div>
                  : <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead><tr style={{ background: "#f8fafc" }}>
                        {["#","ชื่อ-นามสกุล","ตำแหน่ง","ฝ่าย","วันสุดท้าย","เหตุผล","Clearance"].map(h => (
                          <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontSize: 12,
                            fontWeight: 700, color: "#475569", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {data.resign_list.map((e, i) => (
                          <tr key={e.id} style={{ background: i % 2 === 0 ? "#fafbff" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#94a3b8" }}>{i + 1}</td>
                            <td style={{ padding: "9px 12px", fontSize: 13, fontWeight: 600, color: "#0a1628" }}>{e.full_name}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#475569" }}>{e.position}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#64748b" }}>{e.division_name}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#dc2626", fontWeight: 600 }}>{formatThaiDate(e.resign_date)}</td>
                            <td style={{ padding: "9px 12px", fontSize: 12, color: "#94a3b8" }}>{e.resign_reason || "—"}</td>
                            <td style={{ padding: "9px 12px" }}>
                              <button onClick={() => setExitChecklistEmp({ id: e.id, name: e.full_name })}
                                style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #fecaca",
                                  background: "#fff5f5", fontSize: 11, cursor: "pointer",
                                  color: "#dc2626", fontWeight: 700, fontFamily: "inherit",
                                  whiteSpace: "nowrap" }}>
                                🚪 Clearance
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Onboarding Checklist Modal ───────────────────────────────── */}
      {checklistEmp && (
        <OnboardingChecklist
          employeeId={checklistEmp.id}
          employeeName={checklistEmp.name}
          onClose={() => setChecklistEmp(null)}
        />
      )}
      {exitChecklistEmp && (
        <ExitChecklistModal
          employeeId={exitChecklistEmp.id}
          employeeName={exitChecklistEmp.name}
          onClose={() => setExitChecklistEmp(null)}
        />
      )}

      {/* ── Summary cards ───────────────────────────────────────────────── */}
      {histLoad ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลดข้อมูลย้อนหลัง…</div>
      ) : (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {CARD_DEFS.map(c => {
          const clickable = !!c.modal && !isHist;
          const val = cards?.[c.key] ?? 0;
          return (
            <div key={c.key}
              onClick={clickable ? () => setModal(c.modal!) : undefined}
              style={{ background: "#fff", borderRadius: 14, padding: "18px 20px",
                boxShadow: "0 1px 6px rgba(0,0,0,.06)", borderTop: `3px solid ${c.color}`,
                cursor: clickable ? "pointer" : "default", position: "relative",
                transition: "transform .12s, box-shadow .12s" }}
              onMouseEnter={clickable ? e => { (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 18px rgba(0,0,0,.12)"; } : undefined}
              onMouseLeave={clickable ? e => { (e.currentTarget as HTMLDivElement).style.transform = ""; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 6px rgba(0,0,0,.06)"; } : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{c.label}</span>
                <span style={{ fontSize: 18 }}>{c.icon}</span>
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color: c.color, marginTop: 8 }}>
                {val}{c.suffix ?? ""}
              </div>
              {clickable && (
                <div style={{ fontSize: 10.5, color: c.color, marginTop: 4, opacity: 0.75 }}>คลิกดูรายชื่อ →</div>
              )}
              {clickable && c.key === "new_this_month" && (
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>รอบ {periodLabel}</div>
              )}
            </div>
          );
        })}
      </div>
      )}

      {!histLoad && (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

        {/* By division */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628", marginBottom: 16 }}>จำนวนพนักงานแยกตามฝ่าย</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {byDivision.length === 0 ? <div style={{ color: "#94a3b8", fontSize: 13 }}>ไม่มีข้อมูล</div> :
              byDivision.map((d, i) => (
                <div key={d.division}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                    <span style={{ color: "#475569" }}>{d.division}</span>
                    <span style={{ fontWeight: 700, color: "#0a1628" }}>{d.n}</span>
                  </div>
                  <div style={{ height: 9, background: "#f1f5f9", borderRadius: 5 }}>
                    <div style={{ height: 9, borderRadius: 5, width: `${(d.n / divMax) * 100}%`,
                      background: PALETTE[i % PALETTE.length] }} />
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* By status + type */}
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)",
          display: "flex", flexDirection: "column", gap: 20 }}>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0a1628", marginBottom: 12 }}>สัดส่วนสถานะพนักงาน</div>
            <div style={{ display: "flex", height: 14, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              {byStatus.map(t => (
                <div key={t.status} title={`${t.status}: ${t.n}`}
                  style={{ width: `${(t.n / statusTotal) * 100}%`, background: STATUS_COLOR[t.status] ?? "#64748b" }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {byStatus.map(t => (
                <div key={t.status} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: STATUS_COLOR[t.status] ?? "#64748b" }} />
                  <span style={{ color: "#475569", flex: 1 }}>{t.status}</span>
                  <span style={{ fontWeight: 700, color: "#0a1628" }}>{t.n}</span>
                  <span style={{ color: "#94a3b8", width: 38, textAlign: "right" }}>{Math.round((t.n / statusTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0a1628", marginBottom: 12,
              display: "flex", alignItems: "center", gap: 8 }}>
              สัดส่วนประเภทพนักงาน
              {!TYPE_MULTI && (
                <span style={{ fontSize: 10, fontWeight: 400, color: "#94a3b8",
                  background: "#f1f5f9", padding: "2px 8px", borderRadius: 4 }}>
                  แก้ไขประเภทพนักงานในหน้า Master List
                </span>
              )}
            </div>
            <div style={{ display: "flex", height: 14, borderRadius: 6, overflow: "hidden", marginBottom: 12 }}>
              {byType.map((t, i) => (
                <div key={t.type} title={`${t.type}: ${t.n}`}
                  style={{ width: `${(t.n / typeTotal) * 100}%`, background: PALETTE[i % PALETTE.length] }} />
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {byType.map((t, i) => (
                <div key={t.type} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: PALETTE[i % PALETTE.length] }} />
                  <span style={{ color: "#475569", flex: 1 }}>{t.type}</span>
                  <span style={{ fontWeight: 700, color: "#0a1628" }}>{t.n}</span>
                  <span style={{ color: "#94a3b8", width: 38, textAlign: "right" }}>{Math.round((t.n / typeTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      )}

      {/* ── Trend (live only) ──────────────────────────────────────────── */}
      {!isHist && !histLoad && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: "#0a1628" }}>แนวโน้ม เข้าใหม่ vs ลาออก (6 เดือน)</span>
            <div style={{ display: "flex", gap: 14, fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: "#16a34a" }} /> เข้าใหม่
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 11, height: 11, borderRadius: 3, background: "#dc2626" }} /> ลาออก
              </span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 150, paddingTop: 10 }}>
            {months6.map(m => {
              const h = hireMap[m] ?? 0, r = resignMap[m] ?? 0;
              return (
                <div key={m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 120 }}>
                    <div title={`เข้าใหม่ ${h}`} style={{ width: 16, background: "#16a34a", borderRadius: "4px 4px 0 0",
                      height: `${(h / trendMax) * 110 + (h > 0 ? 6 : 0)}px` }} />
                    <div title={`ลาออก ${r}`} style={{ width: 16, background: "#dc2626", borderRadius: "4px 4px 0 0",
                      height: `${(r / trendMax) * 110 + (r > 0 ? 6 : 0)}px` }} />
                  </div>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{monthLabel(m)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Near probation (live only) ─────────────────────────────────── */}
      {!isHist && !histLoad && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628", marginBottom: 4 }}>
            พนักงานใกล้ครบทดลองงาน
          </div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            แจ้งเตือนล่วงหน้า — เหลือ 30 วัน (แจ้งหัวหน้า) · 15 วัน (แจ้ง HR) · 7 วัน (เร่งด่วน)
          </div>
          {data.near_probation.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13, padding: "10px 0" }}>ไม่มีพนักงานใกล้ครบทดลองงานใน 30 วันนี้</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.near_probation.map(e => {
                const b = probBucket(e.probation_end_date);
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px", borderRadius: 10, background: b.bg, border: `1px solid ${b.color}22` }}>
                    <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                      background: e.color ?? "#0891b2", color: "#fff", display: "flex",
                      alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>
                      {e.initial ?? e.full_name.charAt(0)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#0a1628" }}>{e.full_name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {e.position ?? "—"} · {e.department_name ?? "—"} · ครบ {formatThaiDate(e.probation_end_date)}
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: b.color, whiteSpace: "nowrap" }}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Snapshot list (when historical) ───────────────────────────── */}
      {isHist && !histLoad && months.length > 0 && (
        <div style={{ background: "#fff", borderRadius: 14, padding: 22, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#0a1628", marginBottom: 14 }}>ประวัติ Snapshot ทั้งหมด</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {months.map(s => (
              <div key={s.snapshot_month} onClick={() => setHist(s.snapshot_month)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 14px",
                  borderRadius: 8, cursor: "pointer",
                  background: s.snapshot_month === histMonth ? "#eef3ff" : "#fafbff",
                  border: `1px solid ${s.snapshot_month === histMonth ? "#c4cfee" : "#f1f5f9"}` }}>
                <span style={{ fontSize: 20 }}>📁</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#0a1628" }}>{monthLabel(s.snapshot_month)}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>บันทึกโดย {s.created_by} · {s.created_at?.slice(0,16).replace("T"," ")}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#0038c6" }}>{s.headcount} คน</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>Turnover {s.turnover_rate}%</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
