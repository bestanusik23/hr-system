import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useBarData, saveOtRequest, decideOtRequest, fetchOtApprovals, type OtApprovalRow } from "./barApi";
import { fmt, shortMonthLabel } from "./barMath";
import { StatusChip } from "./ExecutiveDashboard";

/**
 * OT Approval — อนุมัติ OT เมื่อใช้ Bar เกินแผน
 * Business Rule: Actual Bar > Approved Bar → ต้องระบุจำนวน Bar ที่เกิน + เหตุผล OT
 * ยอดเงิน OT ยังคงมาจาก workforce_ot_entries เหมือนเดิม (กรอกเอง / นำเข้า Excel ค่าเวร)
 */
export default function OtApproval({ month, onMonthChange }: {
  month: string; onMonthChange: (m: string) => void;
}) {
  const { user } = useAuth();
  const canRequest = !!user && ["hr", "admin", "deputyHR"].includes(user.role);
  const canDecide  = !!user && ["deputy", "deputyHR", "admin"].includes(user.role);

  const { rows, totals, monthOptions, loading, reload } = useBarData(month);
  const [approvals, setApprovals] = useState<OtApprovalRow[]>([]);
  const [hours, setHours]   = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [note, setNote]     = useState<Record<string, string>>({});
  const [msg, setMsg]       = useState<Record<string, string>>({});
  const [busy, setBusy]     = useState<string | null>(null);
  const [onlyOver, setOnlyOver] = useState(true);

  const refresh = () => fetchOtApprovals(month).then(setApprovals);
  useEffect(() => { refresh(); }, [month]);

  // ค่าจาก ot_approvals ทยอยมาถึงหลัง rows ถูกสร้างครั้งแรก จึงต้องผูกกับค่าจริง ไม่ใช่จำนวนแถว
  const rowsSignature = rows.map(r => `${r.name}:${r.otHours}:${r.otReason}`).join("|");
  useEffect(() => {
    setHours(Object.fromEntries(rows.map(r => [r.name, r.otHours ? String(r.otHours) : ""])));
    setReason(Object.fromEntries(rows.map(r => [r.name, r.otReason])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsSignature, month]);

  const flash = (dept: string, text: string) => {
    setMsg(p => ({ ...p, [dept]: text }));
    setTimeout(() => setMsg(p => { const n = { ...p }; delete n[dept]; return n; }), 3500);
  };

  async function submit(deptName: string, overBar: number) {
    const h = Number(hours[deptName] || 0);
    if (!Number.isFinite(h) || h < 0) { flash(deptName, "❌ ชั่วโมง OT ไม่ถูกต้อง"); return; }
    const rs = (reason[deptName] ?? "").trim();
    if (overBar > 0 && !rs) { flash(deptName, "❌ แผนกที่เกินแผนต้องระบุเหตุผล OT"); return; }
    setBusy(deptName);
    const res = await saveOtRequest({ month, dept_name: deptName, ot_hours: h, over_bar: overBar, reason: rs });
    setBusy(null);
    flash(deptName, res.ok ? "✅ ส่งคำขอแล้ว (รออนุมัติ)" : `❌ ${res.error ?? "ไม่สำเร็จ"}`);
    if (res.ok) { refresh(); reload(); }
  }

  async function decide(deptName: string, status: "approved" | "rejected") {
    setBusy(deptName);
    const res = await decideOtRequest({ month, dept_name: deptName, status, decision_note: note[deptName] ?? "" });
    setBusy(null);
    flash(deptName, res.ok ? (status === "approved" ? "✅ อนุมัติแล้ว" : "✅ บันทึกไม่อนุมัติแล้ว") : `❌ ${res.error ?? "ไม่สำเร็จ"}`);
    if (res.ok) { refresh(); reload(); }
  }

  const apprMap = new Map(approvals.map(a => [a.dept_name, a]));
  const overRows = rows.filter(r => r.approvedBar > 0 && r.variance > 0);
  const shown = onlyOver
    ? rows.filter(r => r.variance > 0 || r.otCost > 0 || apprMap.has(r.name))
    : rows;

  const pending  = approvals.filter(a => a.status === "pending");
  const approved = approvals.filter(a => a.status === "approved");
  const rejected = approvals.filter(a => a.status === "rejected");

  return (
    <div>
      <div className="toolbar">
        <label className="fld">รอบเดือน:</label>
        {monthOptions.length > 0 ? (
          <select value={monthOptions.some(m => m.key === month) ? month : ""}
                  onChange={e => onMonthChange(e.target.value)}>
            <option value="" disabled>เลือกเดือน</option>
            {monthOptions.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        ) : (
          <input type="text" value={month} onChange={e => onMonthChange(e.target.value)} style={{ width: 100 }} />
        )}
        <label className="fld" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={onlyOver} onChange={e => setOnlyOver(e.target.checked)} />
          แสดงเฉพาะแผนกที่เกินแผน / มี OT
        </label>
        {loading && <span className="hint">กำลังโหลด…</span>}
      </div>

      <div className="kpis">
        <div className="kpi red">
          <div className="lbl">แผนกที่ใช้ Bar เกินแผน</div>
          <div className="val num">{fmt(overRows.length, 0)}<small>แผนก</small></div>
          <div className="foot">รวมเกิน {fmt(overRows.reduce((s, r) => s + r.variance, 0), 1)} Bar</div>
        </div>
        <div className="kpi amber">
          <div className="lbl">รออนุมัติ</div>
          <div className="val num">{fmt(pending.length, 0)}<small>คำขอ</small></div>
          <div className="foot">{fmt(pending.reduce((s, a) => s + a.ot_hours, 0), 0)} ชม.</div>
        </div>
        <div className="kpi green">
          <div className="lbl">อนุมัติแล้ว</div>
          <div className="val num">{fmt(approved.length, 0)}<small>คำขอ</small></div>
          <div className="foot">{fmt(approved.reduce((s, a) => s + a.ot_hours, 0), 0)} ชม.</div>
        </div>
        <div className="kpi">
          <div className="lbl">ยอด OT เดือน {shortMonthLabel(month)}</div>
          <div className="val num">{fmt(totals.otCost, 0)}<small>บาท</small></div>
          <div className="foot">ไม่อนุมัติ {rejected.length} คำขอ</div>
        </div>
      </div>

      {!canRequest && !canDecide && (
        <div className="warnbox">บัญชีของคุณดูได้อย่างเดียว — ไม่มีสิทธิ์ยื่นหรืออนุมัติคำขอ OT</div>
      )}
      {canRequest && !canDecide && (
        <div className="warnbox">
          สิทธิ์ของคุณ: ยื่น/แก้คำขอ OT ได้ — การอนุมัติเป็นสิทธิ์ของผู้บริหาร (รองผู้อำนวยการ / รอง HR / Admin)
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>คำขออนุมัติ OT — เดือน {shortMonthLabel(month)}</h3>
          <span className="hint">แถวสีแดง = Actual Bar เกิน Approved Bar (ต้องระบุเหตุผลก่อนยื่น)</span>
        </div>
        <div className="card-body tbl-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>แผนก</th><th>Approved</th><th>Actual</th><th>เกินแผน (Bar)</th>
                <th>OT Cost (บาท)</th><th>OT (ชม.)</th>
                <th style={{ textAlign: "left" }}>เหตุผล OT</th>
                <th style={{ textAlign: "left" }}>สถานะ</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={9} className="empty">ไม่มีแผนกที่เกินแผนหรือมี OT ในเดือนนี้</td></tr>
              )}
              {shown.map(r => {
                const a = apprMap.get(r.name);
                const overBar = Math.max(0, r.variance);
                return (
                  <tr key={r.name} className={overBar > 0 ? "over" : ""}>
                    <td>{r.name}</td>
                    <td className="num">{r.approvedBar > 0 ? fmt(r.approvedBar, 0) : "—"}</td>
                    <td className="num">{r.hasShiftData ? fmt(r.actualBar, 1) : "—"}</td>
                    <td className="num">
                      {overBar > 0 ? <b className="up">+{fmt(overBar, 1)}</b> : "—"}
                    </td>
                    <td className="num">{r.otCost > 0 ? fmt(r.otCost, 0) : "—"}</td>
                    <td className="num">
                      {canRequest ? (
                        <input type="number" min={0} step={1} value={hours[r.name] ?? ""}
                               onChange={e => setHours(p => ({ ...p, [r.name]: e.target.value }))}
                               placeholder="0" style={{ width: 74, height: 30, textAlign: "right", fontSize: 12.5 }} />
                      ) : (a?.ot_hours ? fmt(a.ot_hours, 0) : "—")}
                    </td>
                    <td style={{ textAlign: "left", minWidth: 220 }}>
                      {canRequest ? (
                        <textarea rows={2} value={reason[r.name] ?? ""}
                                  onChange={e => setReason(p => ({ ...p, [r.name]: e.target.value }))}
                                  placeholder={overBar > 0 ? "จำเป็นต้องระบุ — เช่น ผู้ป่วยวิกฤตเพิ่ม ต้องเปิดเวรพิเศษ" : "ระบุถ้ามี"}
                                  style={{ width: "100%", minWidth: 200 }} />
                      ) : <span style={{ fontSize: 11.5 }}>{a?.reason || "—"}</span>}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <StatusChip status={a?.status ?? "none"} />
                      {a?.decided_by && (
                        <div className="hint" style={{ marginTop: 3 }}>
                          โดย {a.decided_by}{a.decision_note ? ` · ${a.decision_note}` : ""}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {canRequest && (
                        <button className="btn primary sm" disabled={busy === r.name}
                                onClick={() => submit(r.name, overBar)}>
                          {a ? "แก้คำขอ" : "ยื่นคำขอ"}
                        </button>
                      )}
                      {canDecide && a && a.status === "pending" && (
                        <>
                          <button className="btn ok sm" style={{ marginLeft: 6 }} disabled={busy === r.name}
                                  onClick={() => decide(r.name, "approved")}>อนุมัติ</button>
                          <button className="btn danger sm" style={{ marginLeft: 6 }} disabled={busy === r.name}
                                  onClick={() => decide(r.name, "rejected")}>ไม่อนุมัติ</button>
                          <input type="text" placeholder="หมายเหตุผู้อนุมัติ" value={note[r.name] ?? ""}
                                 onChange={e => setNote(p => ({ ...p, [r.name]: e.target.value }))}
                                 style={{ width: 150, height: 29, marginLeft: 6, fontSize: 11.5 }} />
                        </>
                      )}
                      {msg[r.name] && (
                        <div className={msg[r.name].startsWith("✅") ? "msg-ok" : "msg-err"} style={{ marginTop: 4 }}>
                          {msg[r.name]}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="hint" style={{ padding: "0 4px 10px", lineHeight: 1.8 }}>
        • ยอดเงิน OT มาจากที่ HR บันทึกไว้รายเดือน (แท็บ <b>Timeline &amp; นำเข้า Excel</b> — กรอกเองหรือนำเข้าไฟล์ค่าเวร) หน้านี้ไม่แก้ยอดเงิน<br />
        • หน้านี้เพิ่มสิ่งที่ของเดิมไม่มี: <b>ชั่วโมง OT · เหตุผล · สถานะการอนุมัติ</b> ผูกกับจำนวน Bar ที่เกินแผนของเดือนนั้น<br />
        • เมื่อแก้คำขอที่อนุมัติไปแล้ว สถานะจะกลับเป็น "รออนุมัติ" อัตโนมัติ เพื่อให้ผู้บริหารตรวจซ้ำ
      </div>
    </div>
  );
}
