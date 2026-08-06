import { useMemo } from "react";
import type { ReactNode } from "react";
import { useBarData } from "./barApi";
import {
  SLOT_LABELS, fmt, utilColor, shortMonthLabel, type BarTotals, type DeptBarRow,
} from "./barMath";

/**
 * Executive Dashboard — ภาพรวมสำหรับผู้บริหาร
 * ตัวเลขทุกตัวคำนวณจากข้อมูลจริงในระบบ: Approved Bar (dept_bar_config / manpower_plan),
 * Actual Bar (ไฟล์กะที่นำเข้า), OT Cost (workforce_ot_entries), OT Hours + เหตุผล (ot_approvals)
 */
export default function ExecutiveDashboard({ month, onMonthChange }: {
  month: string; onMonthChange: (m: string) => void;
}) {
  const { rows, totals, monthOptions, hasShiftData, loading } = useBarData(month);

  const insights = useMemo(() => buildInsights(rows, totals), [rows, totals]);
  const withPlan = rows.filter(r => r.approvedBar > 0);
  const overs    = withPlan.filter(r => r.variance > 0);
  const maxOtPerBar = Math.max(...rows.map(r => r.otPerBar), 0.01);

  // เส้นอ้างอิงรายช่วงเวลา: Approved Bar ทั้งวัน ÷ 12 ช่วง (ยังไม่มีการกระจายแผนรายชั่วโมงในระบบ)
  const approvedPerSlot = totals.approvedBar / 12;

  return (
    <div>
      {/* ── แถบเลือกเดือน ── */}
      <div className="toolbar">
        <label className="fld">รอบเดือน (MM/YYYY):</label>
        {monthOptions.length > 0 ? (
          <select value={monthOptions.some(m => m.key === month) ? month : ""}
                  onChange={e => onMonthChange(e.target.value)}>
            <option value="" disabled>เลือกเดือน</option>
            {monthOptions.map(m => (
              <option key={m.key} value={m.key}>{m.label} ({m.dates.length} วัน)</option>
            ))}
          </select>
        ) : (
          <input type="text" value={month} onChange={e => onMonthChange(e.target.value)}
                 style={{ width: 100 }} placeholder="07/2569" />
        )}
        <span className="hint">
          ตัวเลข Bar เป็น <b>ค่าเฉลี่ยต่อวัน</b>ของรอบเดือนนั้น (1 Bar = กะ 8 ชม.)
        </span>
        {loading && <span className="hint">กำลังโหลด…</span>}
      </div>

      {!hasShiftData && (
        <div className="warnbox">
          ⚠ ยังไม่มีข้อมูลตารางกะของเดือน {shortMonthLabel(month)} — คอลัมน์ Actual Bar จะเป็น 0
          กรุณานำเข้าไฟล์กะที่แท็บ <b>Timeline &amp; นำเข้า Excel</b> ก่อน (ยอด OT และ Approved Bar ยังแสดงได้ตามปกติ)
        </div>
      )}

      {/* ── KPI ── */}
      <div className="kpis">
        <Kpi lbl="Approved Bar" icon={<IcUsers />} val={fmt(totals.approvedBar, 0)} unit="Bar" foot="แผนกำลังคนที่อนุมัติต่อวัน" />
        <Kpi lbl="Actual Bar" icon={<IcUser />} val={fmt(totals.actualBar, 1)} unit="Bar" foot="คำนวณจากกะที่ขึ้นจริง" cls="violet" />
        <Kpi lbl="Variance" icon={<IcScale />} cls={totals.variance > 0 ? "red" : "green"}
             val={<span className={totals.variance > 0 ? "up" : "down"}>
               {totals.variance > 0 ? "+" : ""}{fmt(totals.variance, 1)}</span>}
             unit="Bar"
             foot={`${totals.variance > 0 ? "เกินแผน" : "ต่ำกว่าแผน"} ${fmt(Math.abs(totals.utilization - 100), 1)}%`} />
        <Kpi lbl="Bar Utilization" icon={<IcTarget />} val={fmt(totals.utilization, 1)} unit="%"
             cls={totals.utilization > 105 ? "red" : "green"} foot="Actual ÷ Approved" />
        <Kpi lbl="OT Hours" icon={<IcClock />} val={fmt(totals.otHours, 0)} unit="ชม." cls="amber"
             foot="จากคำขออนุมัติ OT ของเดือนนี้" />
        <Kpi lbl="OT Cost" icon={<IcMoney />} val={fmt(totals.otCost, 0)} unit="บาท" cls="amber"
             foot="ยอดที่บันทึกไว้ในระบบ (รายเดือน)" />
        <Kpi lbl="OT per Bar" icon={<IcSpark />} val={fmt(totals.otPerBar, 0)} unit="บาท/Bar" cls="amber"
             foot="OT Cost ÷ Actual Bar" />
        <Kpi lbl="Departments Over Bar" icon={<IcBuild />} val={fmt(totals.overCount, 0)} unit="แผนก"
             cls={totals.overCount > 0 ? "red" : "green"}
             foot={`จาก ${withPlan.length} แผนกที่ตั้ง Approved Bar แล้ว`} />
      </div>

      {/* ── Executive Insight ── */}
      <div className="insight">
        <h3>💡 Executive Insight <span className="tag">สร้างอัตโนมัติจากข้อมูลเดือน {shortMonthLabel(month)}</span></h3>
        <div className="insight-grid">
          {insights.map((x, i) => (
            <div key={i} className={`ins ${x.level}`}>
              <span className="dot" />
              <div><b>{x.title}</b><span>{x.detail}</span></div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 1. สรุปการใช้ Bar รายแผนก ── */}
      <div className="card">
        <div className="card-head">
          <h3><span className="n">1</span>สรุปการใช้ Bar รายแผนก</h3>
          <span className="hint">เรียงจาก OT สูงสุด · แถวสีแดง = ใช้ Bar เกินแผน</span>
        </div>
        <div className="card-body tbl-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>แผนก</th><th style={{ textAlign: "left" }}>ประเภท</th>
                <th>Approved</th><th>Actual</th><th>Variance</th><th>Utilization</th>
                <th>OT (ชม.)</th><th>OT Cost</th><th>OT/Bar</th><th style={{ textAlign: "left" }}>สถานะ OT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.name} className={r.variance > 0 && r.approvedBar > 0 ? "over" : ""}>
                  <td title={r.otReason || undefined}>
                    <span className="rank">{i + 1}</span>{r.name}
                    {r.otReason && <span title={r.otReason} style={{ marginLeft: 5 }}>📝</span>}
                  </td>
                  <td style={{ textAlign: "left" }}><TypeChip type={r.type} /></td>
                  <td className="num">{r.approvedBar > 0 ? fmt(r.approvedBar, 0) : "—"}</td>
                  <td className="num"><b>{r.hasShiftData ? fmt(r.actualBar, 1) : "—"}</b></td>
                  <td className="num">
                    {r.approvedBar > 0 && r.hasShiftData ? (
                      <b className={r.variance > 0 ? "up" : "down"}>
                        {r.variance > 0 ? "+" : ""}{fmt(r.variance, 1)}
                      </b>
                    ) : "—"}
                  </td>
                  <td className="num">
                    {r.approvedBar > 0 && r.hasShiftData ? (
                      <>
                        <span className="mini-bar">
                          <i style={{ width: `${Math.min(100, r.utilization / 1.3)}%`, background: utilColor(r.utilization) }} />
                        </span>
                        <b style={{ color: utilColor(r.utilization) }}>{fmt(r.utilization, 0)}%</b>
                      </>
                    ) : "—"}
                  </td>
                  <td className="num">{r.otHours > 0 ? fmt(r.otHours, 0) : "—"}</td>
                  <td className="num"><b>{r.otCost > 0 ? fmt(r.otCost, 0) : "—"}</b></td>
                  <td className="num">
                    {r.otPerBar > 0 ? (
                      <>
                        <span className="mini-bar">
                          <i style={{ width: `${Math.min(100, r.otPerBar / maxOtPerBar * 100)}%`,
                                     background: "linear-gradient(90deg,#F0797C,#DC2626)" }} />
                        </span>
                        {fmt(r.otPerBar, 0)}
                      </>
                    ) : "—"}
                  </td>
                  <td style={{ textAlign: "left" }}><StatusChip status={r.otStatus} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>รวม {rows.length} แผนก</td>
                <td className="num">{fmt(totals.approvedBar, 0)}</td>
                <td className="num">{fmt(totals.actualBar, 1)}</td>
                <td className="num"><span className={totals.variance > 0 ? "up" : "down"}>
                  {totals.variance > 0 ? "+" : ""}{fmt(totals.variance, 1)}</span></td>
                <td className="num" style={{ color: utilColor(totals.utilization) }}>{fmt(totals.utilization, 0)}%</td>
                <td className="num">{fmt(totals.otHours, 0)}</td>
                <td className="num">{fmt(totals.otCost, 0)}</td>
                <td className="num">{fmt(totals.otPerBar, 0)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── 2. Timeline 24 ชม. ── */}
      <div className="card">
        <div className="card-head">
          <h3><span className="n">2</span>Timeline การใช้ Bar ตามช่วงเวลา (24 ชม.)</h3>
          <div className="legend">
            <span><i style={{ background: "#C9D2E3" }} />Approved (เฉลี่ยต่อช่วง)</span>
            <span><i style={{ background: "#0B4FC7" }} />Actual Bar</span>
            <span><i style={{ background: "#DC2626", height: 2, borderRadius: 1 }} />ส่วนที่เกินแผน</span>
          </div>
        </div>
        <div className="card-body">
          {totals.actualBar === 0 ? (
            <div className="empty">ยังไม่มีข้อมูลกะของเดือนนี้</div>
          ) : (
            <>
              <TimelineChart slotsActual={totals.slotsActual} approvedPerSlot={approvedPerSlot} />
              <BandRow slotsActual={totals.slotsActual} approvedPerSlot={approvedPerSlot} />
              <div className="hint" style={{ marginTop: 8 }}>
                เส้นอ้างอิง = Approved Bar ทั้งวัน ({fmt(totals.approvedBar, 0)} Bar) หารเฉลี่ย 12 ช่วง = {fmt(approvedPerSlot, 2)} Bar/ช่วง —
                ระบบยังไม่ได้เก็บการกระจายแผนกำลังคนรายชั่วโมง จึงใช้ค่าเฉลี่ยเป็นเส้นเทียบ
                (ช่วงกลางคืนจึงมักต่ำกว่าเส้นโดยธรรมชาติ)
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 3. Heat Map ── */}
      <div className="card">
        <div className="card-head">
          <h3><span className="n">3</span>Heat Map การใช้ Bar (แผนก × ช่วงเวลา)</h3>
          <span className="hint">เขียว = ต่ำกว่าแผน · เหลือง = ใกล้เต็ม · ส้ม/แดง = เกินแผน</span>
        </div>
        <div className="card-body tbl-wrap">
          {withPlan.length === 0 || !hasShiftData ? (
            <div className="empty">ต้องมีทั้ง Approved Bar และข้อมูลกะของเดือนนี้จึงจะแสดง Heat Map ได้</div>
          ) : (
            <table className="hm">
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>แผนก</th>
                  {["00-04", "04-08", "08-12", "12-16", "16-20", "20-24"].map(b => <th key={b}>{b}</th>)}
                </tr>
              </thead>
              <tbody>
                {withPlan.filter(r => r.hasShiftData).slice(0, 14).map(r => (
                  <tr key={r.name}>
                    <td className="lbl" title={r.name}>{r.name.length > 14 ? r.name.slice(0, 13) + "…" : r.name}</td>
                    {[0, 1, 2, 3, 4, 5].map(b => {
                      const used = (r.slots[b * 2] ?? 0) + (r.slots[b * 2 + 1] ?? 0);
                      const ref  = r.approvedBar / 6;   // Approved เฉลี่ยต่อช่วง 4 ชม.
                      const u    = ref > 0 ? (used / ref) * 100 : 0;
                      return (
                        <td key={b} className="cell"
                            title={`${r.name} ${b * 4}:00–${(b + 1) * 4}:00 — ใช้จริง ${fmt(used, 2)} Bar / อ้างอิง ${fmt(ref, 2)} Bar`}
                            style={{ background: heatColor(u) }}>
                          {used === 0 ? "–" : fmt(u, 0)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── 4. OT Analysis Top 10 ── */}
      <div className="card">
        <div className="card-head">
          <h3><span className="n">4</span>OT Analysis (Top 10 แผนก)</h3>
          <span className="hint">เรียงจาก OT Cost สูงสุด</span>
        </div>
        <div className="card-body tbl-wrap">
          {totals.otCost === 0 ? (
            <div className="empty">ยังไม่มียอด OT ของเดือนนี้ — บันทึกได้ที่แท็บ OT Approval หรือ Timeline &amp; นำเข้า Excel</div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>อันดับ</th><th>แผนก</th><th>OT Cost (บาท)</th><th>OT Hours (ชม.)</th><th>OT/Bar (บาท)</th>
                </tr>
              </thead>
              <tbody>
                {rows.filter(r => r.otCost > 0).slice(0, 10).map((r, i) => (
                  <tr key={r.name}>
                    <td><span className="rank" style={i < 3 ? { background: "#FDECEC", color: "#DC2626" } : undefined}>{i + 1}</span></td>
                    <td>{r.name}</td>
                    <td className="num"><b>{fmt(r.otCost, 0)}</b></td>
                    <td className="num">{r.otHours > 0 ? fmt(r.otHours, 0) : "—"}</td>
                    <td className="num">
                      {r.otPerBar > 0 ? (
                        <>
                          <span className="mini-bar">
                            <i style={{ width: `${Math.min(100, r.otPerBar / maxOtPerBar * 100)}%`,
                                       background: "linear-gradient(90deg,#F0797C,#DC2626)" }} />
                          </span>
                          {fmt(r.otPerBar, 0)}
                        </>
                      ) : "ยังไม่มี Actual Bar"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="hint" style={{ textAlign: "right", padding: "0 4px 8px" }}>
        1 Bar = 1 หน่วยกำลังคนมาตรฐานต่อวัน (8 ชม. = 1.00 · 10 ชม. = 1.25 · 12 ชม. = 1.50 Bar) ·
        Utilization = Actual ÷ Approved · OT/Bar = OT Cost ÷ Actual Bar · Variance = Actual − Approved ·
        แผนกที่ใช้เกินแผน {overs.length} แผนก
      </div>
    </div>
  );
}

// ─── Timeline: กราฟแท่งคู่ (Approved/Actual) + เส้นประแสดงส่วนเกิน ───────────────
function TimelineChart({ slotsActual, approvedPerSlot }: { slotsActual: number[]; approvedPerSlot: number }) {
  const W = 720, H = 220, ml = 34, mr = 20, mt = 10, mb = 30;
  const iw = W - ml - mr, ih = H - mt - mb;
  const maxBar = Math.max(...slotsActual, approvedPerSlot, 0.1) * 1.18;
  const over = slotsActual.map(v => Math.max(0, v - approvedPerSlot));
  const maxOver = Math.max(0.4, ...over) * 1.9;
  const bw = iw / 12, gw = Math.min(15, bw * 0.32);
  const y  = (v: number) => mt + ih - (v / maxBar) * ih;
  const y2 = (v: number) => mt + ih - (v / maxOver) * ih;

  const gridLines = [0, 1, 2, 3].map(i => {
    const gy = mt + ih * (i / 3), val = maxBar * (1 - i / 3);
    return (
      <g key={i}>
        <line x1={ml} y1={gy} x2={W - mr} y2={gy} stroke="#EDF1F8" strokeWidth={1} />
        <text x={ml - 6} y={gy + 3.5} textAnchor="end" fontSize={9} fill="#8A97B1">{fmt(val, 1)}</text>
      </g>
    );
  });

  const bars = slotsActual.map((ac, i) => {
    const cx = ml + bw * i + bw / 2;
    const isOver = ac > approvedPerSlot;
    return (
      <g key={i}>
        {isOver && <rect x={ml + bw * i} y={mt} width={bw} height={ih} fill="#DC2626" opacity={0.05} />}
        <rect x={cx - gw - 1} y={y(approvedPerSlot)} width={gw} height={mt + ih - y(approvedPerSlot)} rx={2.5} fill="#C9D2E3" />
        <rect x={cx + 1} y={y(ac)} width={gw} height={mt + ih - y(ac)} rx={2.5} fill={isOver ? "#DC2626" : "#0B4FC7"} />
        <text x={cx} y={H - mb + 14} textAnchor="middle" fontSize={8.6} fill="#6B7A99">{SLOT_LABELS[i].split("-")[0]}</text>
      </g>
    );
  });

  const points = over.map((v, i) => `${ml + bw * i + bw / 2},${y2(v)}`).join(" ");
  const overDots = over.map((v, i) => (v > 0.05 ? (
    <g key={i}>
      <circle cx={ml + bw * i + bw / 2} cy={y2(v)} r={2.6} fill="#fff" stroke="#DC2626" strokeWidth={1.8} />
      {v > 0.25 && (
        <text x={ml + bw * i + bw / 2} y={y2(v) - 7} textAnchor="middle" fontSize={8.6} fontWeight={700} fill="#DC2626">
          +{fmt(v, 1)}
        </text>
      )}
    </g>
  ) : null));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: "100%", display: "block" }}>
      {gridLines}
      {bars}
      <polyline points={points} fill="none" stroke="#DC2626" strokeWidth={2} strokeDasharray="5 4" />
      {overDots}
    </svg>
  );
}

// ─── แถบสรุป 5 ช่วงเวลา (เทียบ Utilization เฉลี่ยของแต่ละช่วงกับเส้นอ้างอิง) ─────
function BandRow({ slotsActual, approvedPerSlot }: { slotsActual: number[]; approvedPerSlot: number }) {
  const bands = [
    { n: "ช่วงน้อย", t: "00–06 น.", idx: [0, 1, 2] },
    { n: "ช่วงเริ่มเพิ่มขึ้น", t: "06–10 น.", idx: [3, 4] },
    { n: "ช่วงพีค", t: "10–16 น.", idx: [5, 6, 7] },
    { n: "ช่วงลดลง", t: "16–20 น.", idx: [8, 9] },
    { n: "ช่วงน้อย", t: "20–24 น.", idx: [10, 11] },
  ];
  return (
    <div className="band-row">
      {bands.map((b, i) => {
        const avg = b.idx.reduce((s, k) => s + slotsActual[k], 0) / b.idx.length;
        const u = approvedPerSlot > 0 ? (avg / approvedPerSlot) * 100 : 0;
        const c = utilColor(u);
        const bg = u > 105 ? "#FDECEC" : u >= 95 ? "#FFF6E3" : "#E7F7EE";
        return (
          <div key={i} className="band" style={{ background: bg, color: c }}>
            {b.n}<small>{b.t} · {fmt(u, 0)}%</small>
          </div>
        );
      })}
    </div>
  );
}

// ─── ชิ้นส่วนย่อย ──────────────────────────────────────────────────────────────
function Kpi({ lbl, val, unit, foot, cls = "", icon }: {
  lbl: string; val: ReactNode; unit: string; foot: string; cls?: string; icon: ReactNode;
}) {
  return (
    <div className={`kpi with-icon ${cls}`}>
      <div className="ic">{icon}</div>
      <div className="lbl">{lbl}</div>
      <div className="val num">{val}<small>{unit}</small></div>
      <div className="foot">{foot}</div>
    </div>
  );
}

const svgProps = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const IcUsers  = () => <svg {...svgProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>;
const IcUser   = () => <svg {...svgProps}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
const IcScale  = () => <svg {...svgProps}><path d="M12 3v18M5 7h14M7 7l-3 7h6zM17 7l3 7h-6z" /></svg>;
const IcTarget = () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M9 12l2 2 4-5" /></svg>;
const IcClock  = () => <svg {...svgProps}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
const IcMoney  = () => <svg {...svgProps}><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>;
const IcSpark  = () => <svg {...svgProps}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>;
const IcBuild  = () => <svg {...svgProps}><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-5h6v5" /></svg>;

export function TypeChip({ type }: { type: string }) {
  const k = type === "Support" ? "support" : type === "Back Office" ? "back" : "service";
  return <span className={`chip ${k}`}>{type}</span>;
}

export function StatusChip({ status }: { status: string }) {
  const label: Record<string, string> = {
    none: "— ไม่มีคำขอ", pending: "รออนุมัติ", approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ",
  };
  return <span className={`chip ${status}`}>{label[status] ?? status}</span>;
}

function heatColor(u: number): string {
  if (u <= 0)  return "#E9EDF5";
  if (u < 85)  return "#79C98F";
  if (u < 95)  return "#A9D97C";
  if (u < 105) return "#F3CE4E";
  if (u < 115) return "#F09A45";
  return "#DC5757";
}

interface Insight { level: "ok" | "warn" | "crit"; title: string; detail: string }

/** สร้างข้อความ Executive Insight จากตัวเลขจริง — ไม่มีข้อความตายตัว */
function buildInsights(rows: DeptBarRow[], t: BarTotals): Insight[] {
  const out: Insight[] = [];
  const withPlan = rows.filter(r => r.approvedBar > 0 && r.hasShiftData);

  if (withPlan.length === 0) {
    return [{
      level: "warn",
      title: "ยังตั้งค่าไม่ครบ",
      detail: "ต้องมี Approved Bar (แท็บ Bar Management) และไฟล์กะของเดือนนี้ (แท็บ Timeline) ระบบจึงจะวิเคราะห์ให้ได้",
    }];
  }

  const overs = withPlan.filter(r => r.variance > 0).sort((a, b) => b.utilization - a.utilization);
  if (overs.length > 0) {
    out.push({
      level: "crit",
      title: `มี ${overs.length} แผนกที่ใช้กำลังคนเกินแผน`,
      detail: `รวมเกิน ${fmt(overs.reduce((s, r) => s + r.variance, 0), 1)} Bar — ${overs.slice(0, 3).map(r => r.name).join(" · ")}${overs.length > 3 ? " และอื่น ๆ" : ""}`,
    });
    const w = overs[0];
    out.push({
      level: "crit",
      title: `${w.name} ใช้ Bar เกินแผน ${fmt(w.utilization - 100, 0)}%`,
      detail: `แผน ${fmt(w.approvedBar, 0)} Bar · ใช้จริง ${fmt(w.actualBar, 1)} Bar (+${fmt(w.variance, 1)})${w.otReason ? ` — ${w.otReason}` : " — ยังไม่ได้ระบุเหตุผล OT"}`,
    });
  } else {
    out.push({
      level: "ok",
      title: "ทุกแผนกอยู่ในกรอบ Bar ที่อนุมัติ",
      detail: `Utilization รวม ${fmt(t.utilization, 1)}% — ไม่มีแผนกใดเกินแผนในเดือนนี้`,
    });
  }

  const topOt = [...rows].filter(r => r.otCost > 0).sort((a, b) => b.otCost - a.otCost)[0];
  if (topOt) {
    out.push({
      level: "warn",
      title: `${topOt.name} มี OT สูงสุดของโรงพยาบาล`,
      detail: `${fmt(topOt.otCost, 0)} บาท (${fmt(t.otCost > 0 ? topOt.otCost / t.otCost * 100 : 0, 0)}% ของ OT ทั้งหมด)${topOt.otPerBar > 0 ? ` · ${fmt(topOt.otPerBar, 0)} บาท/Bar` : ""}`,
    });
  }

  const outlier = [...withPlan].filter(r => r.otPerBar > 0).sort((a, b) => b.otPerBar - a.otPerBar)[0];
  if (outlier && t.otPerBar > 0 && outlier.otPerBar > t.otPerBar * 1.35) {
    out.push({
      level: "warn",
      title: `${outlier.name} มี OT ต่อ Bar สูงผิดปกติ`,
      detail: `${fmt(outlier.otPerBar, 0)} บาท/Bar เทียบค่าเฉลี่ยทั้งโรงพยาบาล ${fmt(t.otPerBar, 0)} บาท/Bar — ควรทบทวนการจัดเวรก่อนอนุมัติ OT เพิ่ม`,
    });
  }

  const unders = withPlan.filter(r => r.variance < 0).sort((a, b) => a.utilization - b.utilization);
  if (unders.length > 0) {
    const u = unders[0];
    out.push({
      level: "ok",
      title: `${u.name} ใช้ Bar ต่ำกว่าแผน ${fmt(100 - u.utilization, 0)}%`,
      detail: `เหลือกำลังคนว่าง ${fmt(-u.variance, 1)} Bar — พิจารณาเกลี่ยไปช่วยแผนกที่เกินแผนแทนการอนุมัติ OT`,
    });
  }

  const pending = rows.filter(r => r.otStatus === "pending");
  if (pending.length > 0) {
    out.push({
      level: "warn",
      title: `มีคำขออนุมัติ OT ค้างอยู่ ${pending.length} แผนก`,
      detail: `รวม ${fmt(pending.reduce((s, r) => s + r.otHours, 0), 0)} ชม. — ${pending.slice(0, 3).map(r => r.name).join(" · ")}`,
    });
  }

  const noPlan = rows.filter(r => r.approvedBar === 0).length;
  if (noPlan > 0) {
    out.push({
      level: "warn",
      title: `ยังไม่ได้กำหนด Approved Bar ${noPlan} แผนก`,
      detail: "แผนกเหล่านี้จะไม่ถูกนับใน Variance และ Utilization — ตั้งค่าได้ที่แท็บ Bar Management",
    });
  }

  return out;
}
