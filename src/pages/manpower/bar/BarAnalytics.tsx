import { useMemo } from "react";
import { useBarData, useOtTrend } from "./barApi";
import {
  fmt, shortMonthLabel, utilColor,
  DEPT_TYPES, type DeptType,
} from "./barMath";

/**
 * Bar Analytics — แนวโน้มและประสิทธิภาพการใช้ Bar
 * • แนวโน้มรายเดือน: OT Cost (ทุกเดือนที่บันทึกไว้) + Bar Utilization / OT ต่อ Bar
 *   (เฉพาะเดือนที่มีไฟล์กะ จึงจะคำนวณ Actual Bar ได้)
 * • ประสิทธิภาพแยกตามประเภทงาน (Service / Support / Back Office)
 */
export default function BarAnalytics({ month }: { month: string }) {
  const { rows, totals, standards, parsed, monthOptions, config } = useBarData(month);

  // Approved Bar รวม ณ ปัจจุบัน — ใช้เป็นฐานเทียบทุกเดือน (ระบบเก็บค่าปัจจุบันค่าเดียว ไม่มีประวัติย้อนหลัง)
  const approvedTotal = useMemo(
    () => config.reduce((s, c) => s + (c.active !== 0 ? c.approved_bar : 0), 0) || totals.approvedBar,
    [config, totals.approvedBar],
  );

  /** รวมทุกเดือนที่มีข้อมูลอย่างน้อยหนึ่งอย่าง (ยอด OT หรือไฟล์กะ) — hook เดียวกับ Executive Dashboard */
  const trend = useOtTrend(month, parsed, standards, monthOptions, approvedTotal);

  const maxOt   = Math.max(...trend.map(t => t.otCost), 1);
  const withBar = trend.filter(t => t.hasShift);
  const avgOt   = trend.length ? trend.reduce((s, t) => s + t.otCost, 0) / trend.length : 0;
  const avgUtil = withBar.length ? withBar.reduce((s, t) => s + t.utilization, 0) / withBar.length : 0;
  const avgOtPerBar = withBar.length ? withBar.reduce((s, t) => s + t.otPerBar, 0) / withBar.length : 0;

  // ประสิทธิภาพแยกตามประเภทงาน (เดือนที่เลือก)
  const byType = DEPT_TYPES.map((t: DeptType) => {
    const group = rows.filter(r => r.type === t);
    const approved = group.reduce((s, r) => s + r.approvedBar, 0);
    const actual   = group.reduce((s, r) => s + r.actualBar, 0);
    const otCost   = group.reduce((s, r) => s + r.otCost, 0);
    return {
      type: t, count: group.length, approved, actual, otCost,
      utilization: approved > 0 ? (actual / approved) * 100 : 0,
      otPerBar: actual > 0 ? otCost / actual : 0,
    };
  }).filter(g => g.count > 0);

  // ประสิทธิภาพรายแผนก: OT ต่อ Bar เทียบค่าเฉลี่ยโรงพยาบาล
  const eff = rows.filter(r => r.actualBar > 0 && r.otCost > 0)
    .map(r => ({ ...r, gap: totals.otPerBar > 0 ? (r.otPerBar / totals.otPerBar - 1) * 100 : 0 }))
    .sort((a, b) => b.otPerBar - a.otPerBar);

  return (
    <div>
      <div className="kpis">
        <div className="kpi">
          <div className="lbl">เดือนที่มีข้อมูลในระบบ</div>
          <div className="val num">{fmt(trend.length, 0)}<small>เดือน</small></div>
          <div className="foot">มีไฟล์กะครบ {withBar.length} เดือน</div>
        </div>
        <div className="kpi amber">
          <div className="lbl">OT Cost เฉลี่ยต่อเดือน</div>
          <div className="val num">{fmt(avgOt, 0)}<small>บาท</small></div>
          <div className="foot">จาก {trend.length} เดือนล่าสุด</div>
        </div>
        <div className="kpi violet">
          <div className="lbl">OT ต่อ Bar เฉลี่ย</div>
          <div className="val num">{fmt(avgOtPerBar, 0)}<small>บาท/Bar</small></div>
          <div className="foot">เดือนนี้ {fmt(totals.otPerBar, 0)} บาท/Bar</div>
        </div>
        <div className="kpi" style={{ borderLeftColor: utilColor(avgUtil) }}>
          <div className="lbl">Bar Utilization เฉลี่ย</div>
          <div className="val num" style={{ color: utilColor(avgUtil) }}>{fmt(avgUtil, 1)}<small>%</small></div>
          <div className="foot">เดือนนี้ {fmt(totals.utilization, 1)}%</div>
        </div>
      </div>

      {/* ── แนวโน้มรายเดือน ── */}
      <div className="card">
        <div className="card-head">
          <h3>แนวโน้มย้อนหลัง (สูงสุด 12 เดือน)</h3>
          <div className="legend">
            <span><i style={{ background: "#0B4FC7" }} />OT Cost</span>
            <span><i style={{ background: "#E08C00" }} />Bar Utilization</span>
          </div>
        </div>
        <div className="card-body">
          {trend.length === 0 ? (
            <div className="empty">ยังไม่มีข้อมูลย้อนหลัง — บันทึกยอด OT รายเดือนและนำเข้าไฟล์กะก่อน</div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 180, padding: "14px 0 4px" }}>
                {trend.map(t => (
                  <div key={t.key} style={{ flex: 1, display: "flex", flexDirection: "column",
                                            alignItems: "center", justifyContent: "flex-end", height: "100%", gap: 3 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#6B7A99" }}>
                      {t.otCost > 0 ? `${fmt(t.otCost / 1000, 0)}K` : "—"}
                    </span>
                    <div title={`${t.label} — OT ${fmt(t.otCost, 0)} บาท${t.hasShift ? ` · Utilization ${fmt(t.utilization, 1)}%` : " · ไม่มีไฟล์กะ"}`}
                         style={{ width: "72%", height: `${(t.otCost / maxOt) * 100}%`, minHeight: 2,
                                  borderRadius: "5px 5px 2px 2px", background: "linear-gradient(#26A9E0,#0B4FC7)" }} />
                    {t.hasShift && (
                      <span style={{ fontSize: 8.5, fontWeight: 700, color: utilColor(t.utilization) }}>
                        {fmt(t.utilization, 0)}%
                      </span>
                    )}
                    <span style={{ fontSize: 8.5, color: "#6B7A99", whiteSpace: "nowrap" }}>{t.label}</span>
                  </div>
                ))}
              </div>
              <div className="hint">
                แท่ง = ยอด OT ที่จ่ายจริงรายเดือน · ตัวเลข % ใต้แท่ง = Bar Utilization ของเดือนนั้น
                (แสดงเฉพาะเดือนที่มีไฟล์กะให้คำนวณ Actual Bar) · ฐานเทียบใช้ Approved Bar ปัจจุบันรวม {fmt(approvedTotal, 0)} Bar
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── ประสิทธิภาพตามประเภทงาน ── */}
      <div className="card">
        <div className="card-head">
          <h3>ประสิทธิภาพตามประเภทงาน — เดือน {shortMonthLabel(month)}</h3>
          <span className="hint">ประเภทงานแก้ไขได้ที่แท็บ Bar Management</span>
        </div>
        <div className="card-body tbl-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>ประเภทงาน</th><th>จำนวนแผนก</th><th>Approved Bar</th><th>Actual Bar</th>
                <th>Utilization</th><th>OT Cost</th><th>OT/Bar</th>
              </tr>
            </thead>
            <tbody>
              {byType.map(g => (
                <tr key={g.type}>
                  <td><span className={`chip ${g.type === "Support" ? "support" : g.type === "Back Office" ? "back" : "service"}`}>{g.type}</span></td>
                  <td className="num">{fmt(g.count, 0)}</td>
                  <td className="num">{fmt(g.approved, 0)}</td>
                  <td className="num">{fmt(g.actual, 1)}</td>
                  <td className="num" style={{ color: g.approved > 0 ? utilColor(g.utilization) : undefined }}>
                    {g.approved > 0 && g.actual > 0 ? `${fmt(g.utilization, 0)}%` : "—"}
                  </td>
                  <td className="num">{fmt(g.otCost, 0)}</td>
                  <td className="num">{g.otPerBar > 0 ? fmt(g.otPerBar, 0) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── ประสิทธิภาพรายแผนก ── */}
      <div className="card">
        <div className="card-head">
          <h3>OT ต่อ Bar รายแผนก เทียบค่าเฉลี่ยโรงพยาบาล</h3>
          <span className="hint">ค่าเฉลี่ยเดือนนี้ {fmt(totals.otPerBar, 0)} บาท/Bar</span>
        </div>
        <div className="card-body tbl-wrap">
          {eff.length === 0 ? (
            <div className="empty">ต้องมีทั้งยอด OT และข้อมูลกะของเดือนนี้จึงจะวิเคราะห์ได้</div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>แผนก</th><th>Actual Bar</th><th>OT Cost</th><th>OT/Bar</th>
                  <th>ต่างจากค่าเฉลี่ย</th><th style={{ textAlign: "left" }}>ข้อสังเกต</th>
                </tr>
              </thead>
              <tbody>
                {eff.map(r => (
                  <tr key={r.name} className={r.gap > 35 ? "over" : ""}>
                    <td>{r.name}</td>
                    <td className="num">{fmt(r.actualBar, 1)}</td>
                    <td className="num">{fmt(r.otCost, 0)}</td>
                    <td className="num"><b>{fmt(r.otPerBar, 0)}</b></td>
                    <td className="num">
                      <b className={r.gap > 0 ? "up" : "down"}>{r.gap > 0 ? "+" : ""}{fmt(r.gap, 0)}%</b>
                    </td>
                    <td style={{ textAlign: "left", fontSize: 11.5, color: "#6B7A99" }}>
                      {r.gap > 35
                        ? "จ่าย OT ต่อกำลังคนสูงกว่าที่อื่นมาก — ทบทวนการจัดเวรก่อนอนุมัติเพิ่ม"
                        : r.gap < -35
                          ? "ใช้ OT น้อยกว่าค่าเฉลี่ย — อัตรากำลังน่าจะเพียงพอ"
                          : "อยู่ในช่วงปกติของโรงพยาบาล"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="hint" style={{ padding: "0 4px 10px", lineHeight: 1.8 }}>
        • <b>Cost per Bar (ต้นทุนแรงงานรวมต่อ Bar)</b> ยังคำนวณไม่ได้ เพราะระบบนี้ไม่มีข้อมูลเงินเดือน/ค่าจ้าง —
        มีเฉพาะยอด OT ที่ HR บันทึก ระบบจึงแสดง <b>OT ต่อ Bar</b> แทน หากต้องการ Cost/Bar ต้องนำข้อมูลค่าจ้างเข้าระบบก่อน<br />
        • Bar Utilization ย้อนหลังเทียบกับ Approved Bar <b>ค่าปัจจุบัน</b> (ระบบยังไม่เก็บประวัติการเปลี่ยน Approved Bar รายเดือน)
      </div>
    </div>
  );
}
