import { useEffect, useState } from "react";

type KpiKey = "turnover" | "eval_coverage" | "orientation" | "satisfaction" | "probation_pass" | "training_plan" | "license";

interface MonthRow { month: number; numerator: number; denominator: number; pct: number | null; source: "manual" | "computed" }
interface YearlyData { ok: boolean; year: number; kpis: Record<KpiKey, MonthRow[]> }

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const ROW_LABEL_WIDTH = 130;
const MONTH_COL_WIDTH = 36;

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

function KpiTrendCard({ def, months }: { def: KpiDef; months: MonthRow[] }) {
  const maxBar = Math.max(...months.map(m => m.pct ?? 0), def.target, 10);
  const totalWidth = ROW_LABEL_WIDTH + months.length * MONTH_COL_WIDTH;
  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #dce4f5", padding: "16px 18px", marginBottom: 14 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0a1628", marginBottom: 10 }}>{def.icon} {def.label}</div>
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 0, height: 70, position: "relative", width: totalWidth }}>
          <div style={{ position: "absolute", left: ROW_LABEL_WIDTH, right: 0,
            bottom: `${(def.target / maxBar) * 100}%`, borderTop: "1.5px dashed #c4cfee" }} />
          <div style={{ width: ROW_LABEL_WIDTH, flexShrink: 0, fontSize: 10.5, color: "#94a3b8", alignSelf: "center" }}>
            เป้าหมาย {def.lowerIsBetter ? "≤" : "≥"} {def.target}%
          </div>
          {months.map(m => (
            <div key={m.month} style={{ width: MONTH_COL_WIDTH, flexShrink: 0, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative" }}>
              {m.pct !== null && (
                <div style={{ fontSize: 8.5, color: pctColor(m.pct, def.target, def.lowerIsBetter), fontWeight: 700, marginBottom: 2 }}>{m.pct}</div>
              )}
              <div style={{ width: "60%", maxWidth: 14, borderRadius: "3px 3px 0 0",
                background: pctColor(m.pct, def.target, def.lowerIsBetter),
                height: `${m.pct !== null ? Math.max(2, (m.pct / maxBar) * 100) : 1}%`,
                opacity: m.denominator === 0 ? 0.25 : 1 }} />
            </div>
          ))}
        </div>
        <div style={{ display: "flex", width: totalWidth }}>
          <div style={{ width: ROW_LABEL_WIDTH, flexShrink: 0 }} />
          {months.map(m => (
            <div key={m.month} style={{ width: MONTH_COL_WIDTH, flexShrink: 0, textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#94a3b8" }}>{MONTH_LABELS[m.month - 1]}</div>
              {m.source === "manual" && <div style={{ fontSize: 7.5, color: "#d97706" }}>กรอกเอง</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
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
        KPI_DEFS.map(def => <KpiTrendCard key={def.key} def={def} months={data.kpis[def.key]} />)
      )}
    </div>
  );
}
