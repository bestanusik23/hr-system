import { useEffect, useState } from "react";

type KpiKey = "turnover" | "eval_coverage" | "orientation" | "satisfaction" | "probation_pass" | "training_plan" | "license";

interface MonthRow { month: number; numerator: number; denominator: number; pct: number | null; source: "manual" | "computed" }
interface YearlyData { ok: boolean; year: number; kpis: Record<KpiKey, MonthRow[]> }

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MONTH_COL_WIDTH = 22;

interface KpiDef { key: KpiKey; label: string; icon: string; target: number; lowerIsBetter?: boolean }
const KPI_DEFS: KpiDef[] = [
  { key: "turnover",       label: "ร้อยละพนักงานลาออก",                          icon: "📉", target: 5, lowerIsBetter: true },
  { key: "eval_coverage",  label: "ร้อยละพนักงานใหม่ที่ได้รับการประเมิน",         icon: "📋", target: 100 },
  { key: "orientation",    label: "ร้อยละพนักงานใหม่ที่ผ่านการอบรมปฐมนิเทศ",      icon: "🧑‍🏫", target: 100 },
  { key: "satisfaction",   label: "ร้อยละความพึงพอใจของผู้ได้รับการอบรม",         icon: "⭐", target: 90 },
  { key: "probation_pass", label: "ร้อยละพนักงานใหม่ที่ผ่านการประเมินผลปฏิบัติงาน", icon: "📝", target: 100 },
  { key: "training_plan",  label: "ร้อยละที่อบรมตามแผน",                         icon: "📚", target: 90 },
  { key: "license",        label: "ร้อยละของบุคลากรที่มีใบประกอบวิชาชีพถูกต้อง",   icon: "🪪", target: 100 },
];

function pctColor(pct: number | null, target: number, lowerIsBetter?: boolean): string {
  if (pct === null) return "#94a3b8";
  const ok = lowerIsBetter ? pct <= target : pct >= target;
  if (ok) return "#16a34a";
  const near = lowerIsBetter ? pct <= target * 2 : pct >= target - 15;
  return near ? "#d97706" : "#dc2626";
}

// Latest month with real data, and the one before it — for the headline number + delta chip.
function latestAndPrev(months: MonthRow[]): { latest: MonthRow | null; prev: MonthRow | null } {
  const withData = months.filter(m => m.pct !== null);
  const latest = withData.length > 0 ? withData[withData.length - 1] : null;
  const prevIdx = latest ? withData.length - 2 : -1;
  return { latest, prev: prevIdx >= 0 ? withData[prevIdx] : null };
}

function DeltaChip({ delta, lowerIsBetter }: { delta: number; lowerIsBetter?: boolean }) {
  if (Math.abs(delta) < 0.05) {
    return <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", background: "#f1f5f9",
      borderRadius: 999, padding: "2px 8px" }}>— ไม่เปลี่ยนแปลง</span>;
  }
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  const arrow = delta > 0 ? "▲" : "▼";
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: improved ? "#16a34a" : "#dc2626",
      background: improved ? "#f0fdf4" : "#fef2f2", borderRadius: 999, padding: "2px 8px" }}>
      {arrow} {Math.abs(delta).toFixed(1)} จุด
    </span>
  );
}

function KpiTrendCard({ def, months }: { def: KpiDef; months: MonthRow[] }) {
  const maxBar = Math.max(...months.map(m => m.pct ?? 0), def.target, 10);
  const { latest, prev } = latestAndPrev(months);
  const accent = pctColor(latest?.pct ?? null, def.target, def.lowerIsBetter);
  const totalWidth = months.length * MONTH_COL_WIDTH;

  return (
    <div style={{ position: "relative", background: "#fff", borderRadius: 16, border: "1px solid #e6ecfb",
      padding: "18px 20px", overflow: "hidden", boxShadow: "0 1px 3px rgba(10,22,56,.06)" }}>
      <div style={{ position: "absolute", top: -30, right: -30, width: 100, height: 100, borderRadius: "50%",
        background: accent, opacity: 0.1, pointerEvents: "none" }} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, position: "relative" }}>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: `${accent}1a`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>{def.icon}</span>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: "#475569", lineHeight: 1.3 }}>{def.label}</span>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 3, position: "relative" }}>
        <span style={{ fontSize: 30, fontWeight: 900, color: accent }}>
          {latest?.pct === undefined || latest?.pct === null ? "—" : `${latest.pct}%`}
        </span>
        {prev && latest && <DeltaChip delta={round1(latest.pct! - prev.pct!)} lowerIsBetter={def.lowerIsBetter} />}
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 14 }}>
        {latest ? `${MONTH_LABELS[latest.month - 1]} · ${latest.numerator}/${latest.denominator}` : "ยังไม่มีข้อมูล"}
        {" "}· เป้าหมาย {def.lowerIsBetter ? "≤" : "≥"} {def.target}%
      </div>

      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 0, height: 56, position: "relative", width: totalWidth }}>
          <div style={{ position: "absolute", left: 0, right: 0,
            bottom: `${(def.target / maxBar) * 100}%`, borderTop: "1.5px dashed #dce4f5" }} />
          {months.map(m => (
            <div key={m.month} style={{ width: MONTH_COL_WIDTH, flexShrink: 0, display: "flex",
              alignItems: "flex-end", justifyContent: "center", height: "100%", position: "relative" }}>
              <div style={{ width: "55%", maxWidth: 12, borderRadius: "2px 2px 0 0",
                background: pctColor(m.pct, def.target, def.lowerIsBetter),
                height: `${m.pct !== null ? Math.max(2, (m.pct / maxBar) * 100) : 1}%`,
                opacity: m.denominator === 0 && m.pct === null ? 0.2 : m.month === latest?.month ? 1 : 0.65 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", width: totalWidth, marginTop: 3 }}>
          {months.map(m => (
            <div key={m.month} style={{ width: MONTH_COL_WIDTH, flexShrink: 0, textAlign: "center", fontSize: 8, color: "#b8c4e0" }}>
              {MONTH_LABELS[m.month - 1][0]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function round1(n: number): number { return Math.round(n * 10) / 10; }

// Short, plain-language callouts derived from the real month-over-month data — flags
// KPIs currently off target, and the biggest swings since last month — so the overview
// leads with what actually changed instead of just restating 7 static numbers.
function buildInsights(data: YearlyData): { icon: string; text: string; tone: "warn" | "good" }[] {
  const items: { icon: string; text: string; tone: "warn" | "good"; mag: number }[] = [];
  for (const def of KPI_DEFS) {
    const { latest, prev } = latestAndPrev(data.kpis[def.key]);
    if (!latest || latest.pct === null) continue;
    const offTarget = def.lowerIsBetter ? latest.pct > def.target : latest.pct < def.target;
    if (offTarget) {
      const gap = round1(Math.abs(latest.pct - def.target));
      items.push({ icon: "🔔", tone: "warn", mag: gap + 100,
        text: `${def.label} อยู่ที่ ${latest.pct}% ${def.lowerIsBetter ? "สูงกว่า" : "ต่ำกว่า"}เป้าหมาย ${gap} จุด (${MONTH_LABELS[latest.month - 1]})` });
    }
    if (prev && prev.pct !== null) {
      const delta = round1(latest.pct - prev.pct);
      if (Math.abs(delta) >= 5) {
        const improved = def.lowerIsBetter ? delta < 0 : delta > 0;
        items.push({ icon: improved ? "📈" : "📉", tone: improved ? "good" : "warn", mag: Math.abs(delta),
          text: `${def.label} ${improved ? "ดีขึ้น" : "แย่ลง"} ${Math.abs(delta)} จุดจากเดือนก่อน (${MONTH_LABELS[prev.month - 1]} → ${MONTH_LABELS[latest.month - 1]})` });
      }
    }
  }
  return items.sort((a, b) => b.mag - a.mag).slice(0, 4);
}

export default function ExecYearlyOverview() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<YearlyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/exec/kpi-yearly?year=${year}`).then(r => r.json())
      .then((d: YearlyData) => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
  const insights = data ? buildInsights(data) : [];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <select value={year} onChange={e => setYear(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
            fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
          {yearOptions.map(y => <option key={y} value={y}>ปี {Number(y) + 543}</option>)}
        </select>
      </div>
      {loading || !data ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : (
        <>
          {insights.length > 0 && (
            <div style={{ background: "linear-gradient(135deg,#fffbeb,#fff7e6)", border: "1px solid #fde9b8",
              borderRadius: 14, padding: "14px 18px", marginBottom: 18 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#92640a", marginBottom: 8 }}>💡 สรุปประเด็นสำคัญ</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {insights.map((it, i) => (
                  <div key={i} style={{ fontSize: 12.5, color: "#57330a", display: "flex", gap: 7 }}>
                    <span>{it.icon}</span><span>{it.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
            {KPI_DEFS.map(def => <KpiTrendCard key={def.key} def={def} months={data.kpis[def.key]} />)}
          </div>
        </>
      )}
    </div>
  );
}
