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

  // เส้นอ้างอิงรายช่วงเวลา: Approved Bar ทั้งวัน ÷ 12 ช่วง (ยังไม่มีการกระจายแผนรายชั่วโมงในระบบ)
  const approvedPerSlot = totals.approvedBar / 12;
  const maxSlot = Math.max(...totals.slotsActual, approvedPerSlot, 0.1);

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
        <Kpi lbl="Approved Bar" val={fmt(totals.approvedBar, 0)} unit="Bar" foot="แผนกำลังคนที่อนุมัติต่อวัน" />
        <Kpi lbl="Actual Bar" val={fmt(totals.actualBar, 1)} unit="Bar" foot="คำนวณจากกะที่ขึ้นจริง" cls="violet" />
        <Kpi lbl="Variance" cls={totals.variance > 0 ? "red" : "green"}
             val={<span className={totals.variance > 0 ? "up" : "down"}>
               {totals.variance > 0 ? "+" : ""}{fmt(totals.variance, 1)}</span>}
             unit="Bar"
             foot={`${totals.variance > 0 ? "เกินแผน" : "ต่ำกว่าแผน"} ${fmt(Math.abs(totals.utilization - 100), 1)}%`} />
        <Kpi lbl="Bar Utilization" val={fmt(totals.utilization, 1)} unit="%" cls={totals.utilization > 105 ? "red" : "green"}
             foot="Actual ÷ Approved" />
        <Kpi lbl="OT Hours" val={fmt(totals.otHours, 0)} unit="ชม." cls="amber"
             foot="จากคำขออนุมัติ OT ของเดือนนี้" />
        <Kpi lbl="OT Cost" val={fmt(totals.otCost, 0)} unit="บาท" cls="amber"
             foot="ยอดที่บันทึกไว้ในระบบ (รายเดือน)" />
        <Kpi lbl="OT per Bar" val={fmt(totals.otPerBar, 0)} unit="บาท/Bar" cls="amber"
             foot="OT Cost ÷ Actual Bar" />
        <Kpi lbl="Departments Over Bar" val={fmt(totals.overCount, 0)} unit="แผนก"
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
              {rows.map(r => (
                <tr key={r.name} className={r.variance > 0 && r.approvedBar > 0 ? "over" : ""}>
                  <td title={r.otReason || undefined}>
                    {r.name}
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
                  <td className="num">{r.otPerBar > 0 ? fmt(r.otPerBar, 0) : "—"}</td>
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
            <span><i style={{ background: "#0B4FC7" }} />Actual Bar</span>
            <span><i style={{ background: "#DC2626" }} />เกินเส้นอ้างอิง</span>
            <span><i style={{ background: "#C9D2E3" }} />Approved เฉลี่ยต่อช่วง</span>
          </div>
        </div>
        <div className="card-body">
          {totals.actualBar === 0 ? (
            <div className="empty">ยังไม่มีข้อมูลกะของเดือนนี้</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 170, padding: "10px 0" }}>
                {totals.slotsActual.map((v, i) => {
                  const over = v > approvedPerSlot;
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end", position: "relative" }}>
                      <span style={{ fontSize: 9, fontWeight: 700, color: over ? "#DC2626" : "#6B7A99" }}>{fmt(v, 1)}</span>
                      <div title={`${SLOT_LABELS[i]} น. — ใช้จริง ${fmt(v, 2)} Bar / อ้างอิง ${fmt(approvedPerSlot, 2)} Bar`}
                           style={{ width: "70%", height: `${(v / maxSlot) * 100}%`, minHeight: 2, borderRadius: "5px 5px 2px 2px",
                                    background: over ? "linear-gradient(#F0797C,#DC2626)" : "linear-gradient(#26A9E0,#0B4FC7)" }} />
                      <span style={{ fontSize: 8.5, color: "#6B7A99" }}>{SLOT_LABELS[i].split("-")[0]}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ position: "relative", height: 1, background: "#C9D2E3", marginTop: -34, marginBottom: 34 }} />
              <div className="hint">
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
          <h3><span className="n">4</span>OT Analysis — Top 10 แผนกที่มี OT Cost สูงสุด</h3>
        </div>
        <div className="card-body">
          {totals.otCost === 0 ? (
            <div className="empty">ยังไม่มียอด OT ของเดือนนี้ — บันทึกได้ที่แท็บ OT Approval หรือ Timeline &amp; นำเข้า Excel</div>
          ) : (
            <div>
              {rows.filter(r => r.otCost > 0).slice(0, 10).map((r, i) => {
                const max = rows[0]?.otCost || 1;
                return (
                  <div key={r.name} style={{ display: "grid", gridTemplateColumns: "22px 1fr 130px", gap: 8,
                                             alignItems: "center", padding: "5px 0", borderBottom: "1px solid #F4F7FC" }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: i < 3 ? "#DC2626" : "#6B7A99" }}>{i + 1}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.name}</div>
                      <div style={{ height: 7, background: "#F1F4FA", borderRadius: 99, overflow: "hidden", marginTop: 4 }}>
                        <div style={{ height: "100%", width: `${(r.otCost / max) * 100}%`, borderRadius: 99,
                                      background: "linear-gradient(90deg,#F0797C,#DC2626)" }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <b className="num" style={{ fontSize: 12.5 }}>{fmt(r.otCost, 0)} บาท</b>
                      <div className="hint">
                        {r.otHours > 0 ? `${fmt(r.otHours, 0)} ชม. · ` : ""}
                        {r.otPerBar > 0 ? `${fmt(r.otPerBar, 0)} บาท/Bar` : "ยังไม่มี Actual Bar"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
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

// ─── ชิ้นส่วนย่อย ──────────────────────────────────────────────────────────────
function Kpi({ lbl, val, unit, foot, cls = "" }: {
  lbl: string; val: ReactNode; unit: string; foot: string; cls?: string;
}) {
  return (
    <div className={`kpi ${cls}`}>
      <div className="lbl">{lbl}</div>
      <div className="val num">{val}<small>{unit}</small></div>
      <div className="foot">{foot}</div>
    </div>
  );
}

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
