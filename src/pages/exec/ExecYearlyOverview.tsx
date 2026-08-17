import { useEffect, useMemo, useState } from "react";

type KpiKey = "turnover" | "eval_coverage" | "orientation" | "satisfaction" | "probation_pass" | "training_plan" | "license";

interface MonthRow { month: number; numerator: number; denominator: number; pct: number | null; source: "manual" | "computed" }
interface YearlyData { ok: boolean; year: number; kpis: Record<KpiKey, MonthRow[]> }

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
// Below this sample size a month's percentage is too thin to mean much (e.g. 0/1 hires) —
// excluded from insight callouts so the panel doesn't cry wolf over near-empty months.
const MIN_MEANINGFUL_DENOMINATOR = 3;

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

function round1(n: number): number { return Math.round(n * 10) / 10; }

function pctColor(pct: number | null, target: number, lowerIsBetter?: boolean): string {
  if (pct === null) return "#94a3b8";
  const ok = lowerIsBetter ? pct <= target : pct >= target;
  if (ok) return "#16a34a";
  const near = lowerIsBetter ? pct <= target * 2 : pct >= target - 15;
  return near ? "#d97706" : "#dc2626";
}

// Latest month with real data, and the one before it — for the headline number + delta.
function latestAndPrev(months: MonthRow[]): { latest: MonthRow | null; prev: MonthRow | null } {
  const withData = months.filter(m => m.pct !== null);
  const latest = withData.length > 0 ? withData[withData.length - 1] : null;
  const prevIdx = latest ? withData.length - 2 : -1;
  return { latest, prev: prevIdx >= 0 ? withData[prevIdx] : null };
}

function Sparkline({ months, color }: { months: MonthRow[]; color: string }) {
  const vals = months.map(m => m.pct).filter((v): v is number => v !== null);
  if (vals.length < 2) return <svg width={60} height={22} />;
  const max = Math.max(...vals), min = Math.min(...vals);
  const range = max - min || 1;
  const w = 60, h = 22, step = w / (months.length - 1);
  let d = "", started = false;
  months.forEach((m, i) => {
    if (m.pct === null) { started = false; return; }
    const x = i * step, y = h - ((m.pct - min) / range) * h;
    d += (started ? " L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
    started = true;
  });
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" opacity={0.75} />
    </svg>
  );
}

function DeltaCaption({ latest, prev, lowerIsBetter }: { latest: MonthRow; prev: MonthRow | null; lowerIsBetter?: boolean }) {
  if (!prev || prev.pct === null || latest.pct === null) {
    return <span style={{ color: "#b8c2d6" }}>ไม่มีข้อมูลเทียบ</span>;
  }
  const delta = round1(latest.pct - prev.pct);
  if (Math.abs(delta) < 0.05) return <span style={{ color: "#94a3b8" }}>— ไม่เปลี่ยนแปลงจากเดือนก่อน</span>;
  const improved = lowerIsBetter ? delta < 0 : delta > 0;
  return (
    <span style={{ color: improved ? "#16a34a" : "#dc2626" }}>
      {delta > 0 ? "▲" : "▼"} {Math.abs(delta)} จุดจากเดือนก่อน
    </span>
  );
}

function StatTile({ def, months, active, onClick }: { def: KpiDef; months: MonthRow[]; active: boolean; onClick: () => void }) {
  const { latest, prev } = latestAndPrev(months);
  const accent = pctColor(latest?.pct ?? null, def.target, def.lowerIsBetter);
  return (
    <button onClick={onClick} style={{ textAlign: "left", cursor: "pointer", fontFamily: "inherit",
      background: "#fff", borderRadius: 14, border: active ? `1.5px solid ${accent}` : "1px solid #e6ecfb",
      boxShadow: active ? `0 0 0 3px ${accent}1f` : "0 1px 2px rgba(10,22,56,.04)",
      padding: "13px 15px", flex: "1 1 155px", minWidth: 155 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8, gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", lineHeight: 1.35 }}>{def.icon} {def.label}</span>
        <Sparkline months={months} color={accent} />
      </div>
      <div style={{ fontSize: 23, fontWeight: 900, color: accent, lineHeight: 1.1 }}>
        {latest?.pct == null ? "—" : `${latest.pct}%`}
      </div>
      <div style={{ fontSize: 10.5, marginTop: 4 }}>
        {latest ? <DeltaCaption latest={latest} prev={prev} lowerIsBetter={def.lowerIsBetter} /> : <span style={{ color: "#b8c2d6" }}>ยังไม่มีข้อมูล</span>}
      </div>
    </button>
  );
}

function DetailChart({ def, months }: { def: KpiDef; months: MonthRow[] }) {
  const maxBar = Math.max(...months.map(m => m.pct ?? 0), def.target, 10);
  const minWidth = months.length * 46;
  return (
    <div style={{ overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 190, position: "relative", minWidth }}>
        <div style={{ position: "absolute", left: 0, right: 0,
          bottom: `${(def.target / maxBar) * 100}%`, borderTop: "1.5px dashed #dce4f5" }} />
        <div style={{ position: "absolute", left: 0, top: 0, fontSize: 10, color: "#c4cfee" }}>เป้าหมาย {def.target}%</div>
        {months.map(m => (
          <div key={m.month} style={{ flex: "1 0 0", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative" }}>
            {m.pct !== null && (
              <div style={{ fontSize: 11, fontWeight: 700, color: pctColor(m.pct, def.target, def.lowerIsBetter), marginBottom: 4 }}>{m.pct}%</div>
            )}
            <div style={{ width: "62%", maxWidth: 26, borderRadius: "4px 4px 0 0",
              background: pctColor(m.pct, def.target, def.lowerIsBetter),
              height: `${m.pct !== null ? Math.max(2, (m.pct / maxBar) * 100) : 1}%`,
              opacity: m.pct === null ? 0.18 : 1 }} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, minWidth, marginTop: 6 }}>
        {months.map(m => (
          <div key={m.month} style={{ flex: "1 0 0", textAlign: "center" }}>
            <div style={{ fontSize: 10.5, color: "#94a3b8" }}>{MONTH_LABELS[m.month - 1]}</div>
            {m.source === "manual" && <div style={{ fontSize: 8.5, color: "#d97706" }}>กรอกเอง</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

// Short, plain-language callouts derived from the real month-over-month data — flags
// KPIs currently off target (with enough sample size to mean something) and the biggest
// swings since last month — so the panel leads with what actually changed, not noise.
function buildInsights(data: YearlyData): { icon: string; text: string; mag: number }[] {
  const items: { icon: string; text: string; mag: number }[] = [];
  for (const def of KPI_DEFS) {
    const { latest, prev } = latestAndPrev(data.kpis[def.key]);
    if (!latest || latest.pct === null) continue;
    const meaningful = latest.denominator >= MIN_MEANINGFUL_DENOMINATOR;
    const offTarget = def.lowerIsBetter ? latest.pct > def.target : latest.pct < def.target;
    if (offTarget && meaningful) {
      const gap = round1(Math.abs(latest.pct - def.target));
      items.push({ icon: "🔔",  mag: gap + 100,
        text: `${def.label} อยู่ที่ ${latest.pct}% ${def.lowerIsBetter ? "สูงกว่า" : "ต่ำกว่า"}เป้าหมาย ${gap} จุด (${MONTH_LABELS[latest.month - 1]})` });
    }
    if (prev && prev.pct !== null && meaningful) {
      const delta = round1(latest.pct - prev.pct);
      if (Math.abs(delta) >= 5) {
        const improved = def.lowerIsBetter ? delta < 0 : delta > 0;
        items.push({ icon: improved ? "📈" : "📉", mag: Math.abs(delta),
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
  const [selectedKpi, setSelectedKpi] = useState<KpiKey>("license");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/exec/kpi-yearly?year=${year}`).then(r => r.json())
      .then((d: YearlyData) => { if (d.ok) setData(d); })
      .finally(() => setLoading(false));
  }, [year]);

  const yearOptions = Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i));
  const insights = useMemo(() => data ? buildInsights(data) : [], [data]);
  const selectedDef = KPI_DEFS.find(d => d.key === selectedKpi)!;

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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 18 }}>
            {KPI_DEFS.map(def => (
              <StatTile key={def.key} def={def} months={data.kpis[def.key]}
                active={selectedKpi === def.key} onClick={() => setSelectedKpi(def.key)} />
            ))}
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ flex: "2 1 420px", background: "#fff", borderRadius: 16, border: "1px solid #e6ecfb",
              padding: "18px 20px", boxShadow: "0 1px 3px rgba(10,22,56,.06)" }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0a1628", marginBottom: 14 }}>
                {selectedDef.icon} แนวโน้ม 12 เดือน — {selectedDef.label}
              </div>
              <DetailChart def={selectedDef} months={data.kpis[selectedKpi]} />
            </div>

            <div style={{ flex: "1 1 260px", background: "linear-gradient(135deg,#fffbeb,#fff7e6)",
              border: "1px solid #fde9b8", borderRadius: 16, padding: "16px 18px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: "#92640a", marginBottom: 10 }}>💡 สรุปประเด็นสำคัญ</div>
              {insights.length === 0 ? (
                <div style={{ fontSize: 12, color: "#a37a2c" }}>ทุก KPI อยู่ในเกณฑ์ปกติ ไม่มีประเด็นที่ต้องติดตามเป็นพิเศษ</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                  {insights.map((it, i) => (
                    <div key={i} style={{ fontSize: 12, color: "#57330a", display: "flex", gap: 7, lineHeight: 1.4 }}>
                      <span>{it.icon}</span><span>{it.text}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e6ecfb", padding: "16px 18px", overflowX: "auto" }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: "#0a1628", marginBottom: 12 }}>เปรียบเทียบรายเดือนทั้ง 7 ตัวชี้วัด</div>
            <table style={{ borderCollapse: "collapse", fontSize: 11.5, minWidth: 900 }}>
              <thead>
                <tr style={{ background: "#f4f7ff" }}>
                  <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: "#475569", position: "sticky", left: 0, background: "#f4f7ff" }}>ตัวชี้วัด</th>
                  {MONTH_LABELS.map(l => <th key={l} style={{ padding: "6px 8px", textAlign: "center", fontWeight: 700, color: "#475569" }}>{l}</th>)}
                </tr>
              </thead>
              <tbody>
                {KPI_DEFS.map((def, ri) => {
                  const months = data.kpis[def.key];
                  return (
                    <tr key={def.key} style={{ background: ri % 2 === 1 ? "#f8faff" : "#fff" }}>
                      <td style={{ padding: "6px 10px", color: "#334155", fontWeight: 600, whiteSpace: "nowrap",
                        position: "sticky", left: 0, background: ri % 2 === 1 ? "#f8faff" : "#fff" }}>{def.icon} {def.label}</td>
                      {months.map((m, i) => {
                        const prevM = i > 0 ? months[i - 1] : null;
                        const delta = m.pct !== null && prevM?.pct != null ? round1(m.pct - prevM.pct) : null;
                        const improved = delta !== null && (def.lowerIsBetter ? delta < 0 : delta > 0);
                        return (
                          <td key={m.month} style={{ padding: "6px 8px", textAlign: "center", color: pctColor(m.pct, def.target, def.lowerIsBetter), fontWeight: 700 }}>
                            {m.pct === null ? "—" : `${m.pct}%`}
                            {delta !== null && Math.abs(delta) >= 0.05 && (
                              <span style={{ color: improved ? "#16a34a" : "#dc2626", fontWeight: 400 }}> {delta > 0 ? "▲" : "▼"}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
