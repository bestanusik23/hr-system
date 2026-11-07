import { useMemo } from "react";
import {
  buildReportForMonths, previousMonths, ytdMonths, monthAbbr,
  type ApiData, type HqReport, type TemplateLists,
} from "./hqReportCalc";
import { analyze, type Count } from "./hqAnalysis";

// แท็บ "วิเคราะห์" — turnover เทียบเป้า, แนวโน้มอัตรากำลัง, เจาะลึกผู้ลาออก, การสรรหา
// One hue for all bars (single-series charts); status is shown with an icon + label,
// never colour alone. Every bar has a hover title with the exact figure.

const BAR = "#2F5597";
const TRACK = "#EEF2F8";
const INK = "#1E293B", INK2 = "#475569", MUTED = "#6B7A99";
const card: React.CSSProperties = { background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12, padding: 16, boxShadow: "0 4px 14px rgba(20,40,90,.05)", marginBottom: 14 };
const h3: React.CSSProperties = { margin: "0 0 4px", fontSize: 15, color: INK };
const sub: React.CSSProperties = { margin: "0 0 12px", fontSize: 12.5, color: MUTED };
const th: React.CSSProperties = { textAlign: "left", padding: "7px 10px", background: "#F2F5FB", fontWeight: 700, fontSize: 12.5, color: "#334155", borderBottom: "1px solid #E6EBF5", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #EEF2F8", fontSize: 13 };
const num: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

const pct = (v: number, d = 1) => `${(v * 100).toFixed(d)}%`;
const grid: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 };

function Tile({ label, value, note, status }: { label: string; value: string; note?: string; status?: "good" | "bad" }) {
  return (
    <div style={{ ...card, marginBottom: 0, padding: "14px 16px" }}>
      <div style={{ fontSize: 12.5, color: MUTED }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: INK, margin: "4px 0 2px", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {status && (
        <div style={{ fontSize: 12.5, fontWeight: 700, color: status === "good" ? "#1F7A3D" : "#B42318" }}>
          {status === "good" ? "✓ ไม่เกินเป้า" : "▲ สูงกว่าเป้า"}
        </div>
      )}
      {note && <div style={{ fontSize: 12, color: INK2, marginTop: 2 }}>{note}</div>}
    </div>
  );
}

/** Horizontal single-series bars; optional dashed target marker (same scale). */
function Bars({ rows, max, format, target, targetLabel }: {
  rows: { label: string; value: number; title?: string }[]; max?: number; format: (v: number) => string;
  target?: number; targetLabel?: string;
}) {
  const top = Math.max(max ?? 0, target ?? 0, ...rows.map(r => r.value), 1e-9);
  return (
    <div>
      {rows.map(r => (
        <div key={r.label} title={r.title ?? `${r.label}: ${format(r.value)}`}
          style={{ display: "grid", gridTemplateColumns: "150px 1fr 64px", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <div style={{ fontSize: 12.5, color: INK2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</div>
          <div style={{ position: "relative", height: 14, background: TRACK, borderRadius: 4 }}>
            <div style={{ width: `${(r.value / top) * 100}%`, height: "100%", background: BAR, borderRadius: "0 4px 4px 0", minWidth: r.value > 0 ? 3 : 0 }} />
            {target !== undefined && (
              <div style={{ position: "absolute", top: -3, bottom: -3, left: `${(target / top) * 100}%`, borderLeft: "2px dashed #94A3B8" }} />
            )}
          </div>
          <div style={{ fontSize: 12.5, color: INK, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{format(r.value)}</div>
        </div>
      ))}
      {target !== undefined && (
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4 }}>┆ เส้นประ = {targetLabel}</div>
      )}
    </div>
  );
}

const countBars = (c: Count[], total: number) => (
  <Bars rows={c.map(x => ({ label: x.label, value: x.value, title: `${x.label}: ${x.value} คน (${total ? pct(x.value / total, 0) : "0%"})` }))}
    format={v => `${v}`} />
);

export default function AnalysisTab({ data, rep, lists }: { data: ApiData; rep: HqReport; lists: TemplateLists | null }) {
  const target = lists?.turnoverTarget ?? 0.12;
  const cur = useMemo(() => analyze(rep, lists), [rep, lists]);
  const prevRep = useMemo(() => buildReportForMonths(data, previousMonths(rep.months), lists), [data, rep.months, lists]);
  const prev = useMemo(() => analyze(prevRep, lists), [prevRep, lists]);
  const ytdRep = useMemo(() => buildReportForMonths(data, ytdMonths(rep.months), lists), [data, rep.months, lists]);
  const ytd = useMemo(() => analyze(ytdRep, lists), [ytdRep, lists]);

  const range = (r: HqReport) => `${monthAbbr(r.months[0])}–${monthAbbr(r.months[r.months.length - 1])} ${r.year}`;
  const delta = cur.total.annualized - prev.total.annualized;
  const lastMonth = cur.monthly[cur.monthly.length - 1];
  const vacancy = lastMonth && lastMonth.planned > 0 ? 1 - lastMonth.headcount / lastMonth.planned : 0;
  const net = cur.hires - cur.total.resigns;

  return (
    <>
      {/* ── 1. Turnover vs target ── */}
      <div style={{ ...grid, marginBottom: 14 }}>
        <Tile label={`Turnover งวดนี้ (${range(rep)}) คิดเป็นรายปี`} value={pct(cur.total.annualized)}
          status={cur.total.annualized <= target ? "good" : "bad"}
          note={`ลาออก ${cur.total.resigns} คน / เฉลี่ย ${cur.total.avgHeadcount.toFixed(1)} คน · งวดนี้ ${pct(cur.total.rate)} · เป้า ${pct(target, 0)}/ปี`} />
        <Tile label={`Turnover สะสมทั้งปี (${range(ytdRep)}) คิดเป็นรายปี`} value={pct(ytd.total.annualized)}
          status={ytd.total.annualized <= target ? "good" : "bad"}
          note={`ลาออกสะสม ${ytd.total.resigns} คน`} />
        <Tile label={`เทียบงวดก่อน (${range(prevRep)})`} value={`${delta >= 0 ? "+" : ""}${(delta * 100).toFixed(1)} จุด`}
          note={`งวดก่อน ${pct(prev.total.annualized)} → งวดนี้ ${pct(cur.total.annualized)}`} />
        <Tile label={`ตำแหน่งว่าง ณ สิ้น ${lastMonth ? monthAbbr(lastMonth.month) : "—"}`} value={pct(vacancy)}
          note={lastMonth ? `มีคน ${lastMonth.headcount} / แผน ${lastMonth.planned} (ว่าง ${lastMonth.planned - lastMonth.headcount})` : undefined} />
      </div>

      <div style={grid}>
        <div style={card}>
          <h3 style={h3}>Turnover รายปี แยกสายงาน</h3>
          <p style={sub}>อัตราลาออกงวดนี้ ปรับเป็นรายปี เทียบเป้า {pct(target, 0)}</p>
          <Bars rows={cur.byLine.map(b => ({ label: b.line, value: b.annualized, title: `${b.line}: ลาออก ${b.resigns} คน / เฉลี่ย ${b.avgHeadcount.toFixed(1)} คน = ${pct(b.annualized)} ต่อปี` }))}
            format={v => pct(v)} target={target} targetLabel={`เป้า ${pct(target, 0)} ต่อปี`} />
        </div>

        <div style={card}>
          <h3 style={h3}>รายเดือน</h3>
          <p style={sub}>คน ณ สิ้นเดือน · เริ่มงาน/ลาออกตามรอบ 26–25</p>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>เดือน</th><th style={{ ...th, textAlign: "right" }}>แผน</th><th style={{ ...th, textAlign: "right" }}>มีคน</th>
              <th style={{ ...th, textAlign: "right" }}>เริ่มงาน</th><th style={{ ...th, textAlign: "right" }}>ลาออก</th><th style={{ ...th, textAlign: "right" }}>Turnover/เดือน</th></tr></thead>
            <tbody>
              {cur.monthly.map(m => (
                <tr key={m.month}>
                  <td style={td}>{monthAbbr(m.month)}</td><td style={num}>{m.planned}</td><td style={num}>{m.headcount}</td>
                  <td style={num}>{m.hires}</td><td style={num}>{m.resigns}</td><td style={num}>{pct(m.rate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 2. Manpower trend ── */}
      <div style={card}>
        <h3 style={h3}>แนวโน้มอัตรากำลัง — % บรรจุเทียบแผน แยกสายงาน</h3>
        <p style={sub}>มีคน ÷ แผน ณ สิ้นเดือน (แถบเต็ม = 100%) · ชี้ที่แถบเพื่อดูตัวเลข</p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560 }}>
            <thead><tr><th style={th}>สายงาน</th>{rep.months.map(ym => <th key={ym} style={th}>{monthAbbr(ym)}</th>)}</tr></thead>
            <tbody>
              {cur.lineTrend.map(t => (
                <tr key={t.line}>
                  <td style={{ ...td, whiteSpace: "nowrap" }}>{t.line}</td>
                  {t.months.map(m => (
                    <td key={m.month} style={td} title={`${t.line} ${monthAbbr(m.month)}: มีคน ${m.existing} / แผน ${m.planned} = ${pct(m.fill)} (ว่าง ${m.planned - m.existing})`}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 50, height: 10, background: TRACK, borderRadius: 4 }}>
                          <div style={{ width: `${Math.min(1, m.fill) * 100}%`, height: "100%", background: BAR, borderRadius: "0 4px 4px 0" }} />
                        </div>
                        <span style={{ fontSize: 12, color: INK, fontVariantNumeric: "tabular-nums", width: 42, textAlign: "right" }}>{m.planned ? pct(m.fill, 0) : "—"}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. Resignation deep-dive ── */}
      <div style={grid}>
        <div style={card}>
          <h3 style={h3}>ผู้ลาออกตามอายุงาน</h3>
          <p style={sub}>
            ลาออกช่วงทดลองงาน (&lt; 4 เดือน) {cur.probationLeavers} คน
            {cur.total.resigns ? ` (${pct(cur.probationLeavers / cur.total.resigns, 0)} ของผู้ลาออก)` : ""}
          </p>
          {countBars(cur.tenure, cur.total.resigns)}
        </div>
        <div style={card}>
          <h3 style={h3}>ผู้ลาออกตามช่วงอายุ</h3>
          <p style={sub}>{cur.ageMissing > 0 ? `ยังไม่ได้กรอกอายุ ${cur.ageMissing} คน (แท็บผู้ลาออก)` : "กรอกอายุครบแล้ว"} · นับเฉพาะคนที่มีอายุ (เริ่มเก็บ ต.ค. 2569)</p>
          {countBars(cur.age, cur.age.reduce((a, c) => a + c.value, 0))}
        </div>
        <div style={card}>
          <h3 style={h3}>หมวดเหตุผลการลาออก</h3>
          <p style={sub}>
            {cur.leaveType.map(l => `${l.label} ${l.value}`).join(" · ") || "ไม่มีผู้ลาออก"}
          </p>
          {countBars(cur.reasonCat, cur.total.resigns)}
        </div>
      </div>

      {/* ── 4. Recruitment ── */}
      <div style={grid}>
        <div style={card}>
          <h3 style={h3}>รับเข้า vs ลาออก แยกสายงาน</h3>
          <p style={sub}>สุทธิทั้งงวด {net >= 0 ? "+" : ""}{net} คน (รับเข้า {cur.hires} · ลาออก {cur.total.resigns})</p>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>สายงาน</th><th style={{ ...th, textAlign: "right" }}>รับเข้า</th><th style={{ ...th, textAlign: "right" }}>ลาออก</th><th style={{ ...th, textAlign: "right" }}>สุทธิ</th></tr></thead>
            <tbody>
              {cur.hiresVsResigns.map(h => {
                const d = h.hires - h.resigns;
                return (
                  <tr key={h.line}>
                    <td style={td}>{h.line}</td><td style={num}>{h.hires}</td><td style={num}>{h.resigns}</td>
                    <td style={{ ...num, fontWeight: 700 }}>{d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "0"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={card}>
          <h3 style={h3}>ช่องทางสรรหาที่ได้คน</h3>
          <p style={sub}>{cur.channelMissing > 0 ? `ยังไม่ได้เลือกช่องทาง ${cur.channelMissing} คน (แท็บพนักงานใหม่)` : "ระบุช่องทางครบแล้ว"} · เริ่มเก็บ ต.ค. 2569</p>
          {cur.channelCat.length ? countBars(cur.channelCat, cur.channelCat.reduce((a, c) => a + c.value, 0)) : <div style={{ fontSize: 13, color: MUTED }}>ยังไม่มีข้อมูล</div>}
        </div>
      </div>
    </>
  );
}
