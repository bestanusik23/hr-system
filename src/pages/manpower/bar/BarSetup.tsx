import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useBarData, saveBarConfig } from "./barApi";
import { DEPT_TYPES, fmt, utilColor, type DeptType } from "./barMath";
import { TypeChip } from "./ExecutiveDashboard";

/**
 * Bar Management — กำหนด Approved Bar และประเภทงานของแต่ละแผนก
 * ค่าที่บันทึกที่นี่คือ "เพดานที่โรงพยาบาลยอมจ่ายต่อวัน" ที่ทุกหน้าจออื่นใช้เทียบ
 * ถ้าแผนกใดยังไม่ตั้งค่า ระบบจะใช้ plan_qty จาก manpower_plan เป็นค่าเริ่มต้นให้ก่อน
 */
export default function BarSetup({ month }: { month: string }) {
  const { user } = useAuth();
  const canEdit = !!user && ["hr", "admin", "deputyHR"].includes(user.role);
  const { rows, totals, config, loading, reload, hasShiftData } = useBarData(month);

  const [draftBar,  setDraftBar]  = useState<Record<string, string>>({});
  const [draftType, setDraftType] = useState<Record<string, DeptType>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg]       = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [bulkMsg, setBulkMsg] = useState("");

  // ตั้งค่าเริ่มต้นของช่องกรอกจากค่าที่ระบบใช้อยู่จริง (config → ไม่มีก็ manpower_plan)
  // ใช้ลายเซ็นของค่าจริงเป็น dependency เพราะค่า Approved Bar ทยอยมาถึงหลัง rows ถูกสร้างครั้งแรก
  const rowsSignature = rows.map(r => `${r.name}:${r.approvedBar}:${r.type}`).join("|");
  useEffect(() => {
    const bar: Record<string, string> = {};
    const typ: Record<string, DeptType> = {};
    for (const r of rows) { bar[r.name] = String(r.approvedBar); typ[r.name] = r.type; }
    setDraftBar(bar); setDraftType(typ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsSignature]);

  const configured = new Set(config.map(c => c.dept_name));

  async function save(deptName: string) {
    const raw = (draftBar[deptName] ?? "").trim();
    const value = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      setMsg(p => ({ ...p, [deptName]: "❌ ตัวเลขไม่ถูกต้อง" }));
      return;
    }
    setSaving(deptName);
    const res = await saveBarConfig({
      dept_name: deptName,
      approved_bar: value,
      dept_type: draftType[deptName] ?? "Service",
    });
    setSaving(null);
    setMsg(p => ({ ...p, [deptName]: res.ok ? "✅ บันทึกแล้ว" : `❌ ${res.error ?? "บันทึกไม่สำเร็จ"}` }));
    if (res.ok) reload();
    setTimeout(() => setMsg(p => { const n = { ...p }; delete n[deptName]; return n; }), 3000);
  }

  /** บันทึกทุกแผนกที่ยังไม่เคยตั้งค่า โดยใช้ค่าที่ระบบเสนอไว้ (จาก manpower_plan) */
  async function saveAllUnset() {
    const targets = rows.filter(r => !configured.has(r.name) && (Number(draftBar[r.name]) || 0) > 0);
    if (targets.length === 0) { setBulkMsg("ไม่มีแผนกที่ต้องบันทึกเพิ่ม"); return; }
    setBulkMsg(`กำลังบันทึก ${targets.length} แผนก…`);
    let ok = 0;
    for (const r of targets) {
      const res = await saveBarConfig({
        dept_name: r.name,
        approved_bar: Number(draftBar[r.name]) || 0,
        dept_type: draftType[r.name] ?? "Service",
      });
      if (res.ok) ok++;
    }
    setBulkMsg(`บันทึกแล้ว ${ok}/${targets.length} แผนก`);
    reload();
    setTimeout(() => setBulkMsg(""), 4000);
  }

  const shown = search.trim()
    ? rows.filter(r => r.name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  return (
    <div>
      <div className="toolbar">
        <input type="text" placeholder="ค้นหาแผนก" value={search}
               onChange={e => setSearch(e.target.value)} style={{ minWidth: 180 }} />
        <span className="hint">
          ตั้งค่าแล้ว <b>{config.length}</b> / {rows.length} แผนก · รวม Approved Bar <b>{fmt(totals.approvedBar, 0)}</b> Bar/วัน
        </span>
        {canEdit && (
          <button className="btn" onClick={saveAllUnset}>
            ⬇ บันทึกค่าที่ระบบเสนอ (แผนกที่ยังไม่ตั้งค่า)
          </button>
        )}
        {bulkMsg && <span className="hint">{bulkMsg}</span>}
        {loading && <span className="hint">กำลังโหลด…</span>}
      </div>

      {!canEdit && (
        <div className="warnbox">
          บัญชีของคุณดูได้อย่างเดียว — การแก้ไข Approved Bar และประเภทงานสงวนไว้สำหรับ HR / รอง HR / Admin
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>กำหนด Approved Bar และประเภทงานรายแผนก</h3>
          <span className="hint">1 Bar = กะ 8 ชม. · ค่าที่กรอกคือจำนวน Bar ต่อวันที่ยอมจ่าย</span>
        </div>
        <div className="card-body tbl-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>แผนก</th>
                <th style={{ textAlign: "left" }}>ประเภทงาน</th>
                <th>Approved Bar</th>
                <th>Actual Bar<br />({month})</th>
                <th>Variance</th>
                <th>Utilization</th>
                <th style={{ textAlign: "left" }}>สถานะการตั้งค่า</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => {
                const isSet = configured.has(r.name);
                return (
                  <tr key={r.name} className={r.variance > 0 && r.approvedBar > 0 ? "over" : ""}>
                    <td>{r.name}</td>
                    <td style={{ textAlign: "left" }}>
                      {canEdit ? (
                        <select value={draftType[r.name] ?? "Service"}
                                onChange={e => setDraftType(p => ({ ...p, [r.name]: e.target.value as DeptType }))}
                                style={{ height: 30, fontSize: 12 }}>
                          {DEPT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      ) : <TypeChip type={r.type} />}
                    </td>
                    <td className="num">
                      {canEdit ? (
                        <input type="number" min={0} step={0.5}
                               value={draftBar[r.name] ?? ""}
                               onChange={e => setDraftBar(p => ({ ...p, [r.name]: e.target.value }))}
                               style={{ width: 88, height: 30, textAlign: "right", fontSize: 12.5 }} />
                      ) : fmt(r.approvedBar, 1)}
                    </td>
                    <td className="num">{r.hasShiftData ? fmt(r.actualBar, 1) : "—"}</td>
                    <td className="num">
                      {r.approvedBar > 0 && r.hasShiftData
                        ? <b className={r.variance > 0 ? "up" : "down"}>{r.variance > 0 ? "+" : ""}{fmt(r.variance, 1)}</b>
                        : "—"}
                    </td>
                    <td className="num" style={{ color: r.approvedBar > 0 ? utilColor(r.utilization) : undefined }}>
                      {r.approvedBar > 0 && r.hasShiftData ? `${fmt(r.utilization, 0)}%` : "—"}
                    </td>
                    <td style={{ textAlign: "left" }}>
                      <span className={`chip ${isSet ? "approved" : "none"}`}>
                        {isSet ? "ตั้งค่าแล้ว" : "ใช้ค่าจากแผนกำลังคน"}
                      </span>
                    </td>
                    <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                      {canEdit && (
                        <button className="btn primary sm" disabled={saving === r.name}
                                onClick={() => save(r.name)}>
                          {saving === r.name ? "…" : "บันทึก"}
                        </button>
                      )}
                      {msg[r.name] && (
                        <span className={msg[r.name].startsWith("✅") ? "msg-ok" : "msg-err"}
                              style={{ marginLeft: 8 }}>{msg[r.name]}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>รวม {shown.length} แผนก</td>
                <td className="num">{fmt(totals.approvedBar, 0)}</td>
                <td className="num">{fmt(totals.actualBar, 1)}</td>
                <td className="num"><span className={totals.variance > 0 ? "up" : "down"}>
                  {totals.variance > 0 ? "+" : ""}{fmt(totals.variance, 1)}</span></td>
                <td className="num">{fmt(totals.utilization, 0)}%</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="hint" style={{ padding: "0 4px 10px", lineHeight: 1.8 }}>
        • <b>Approved Bar</b> = เพดานกำลังคนต่อวันที่โรงพยาบาลยอมจ่าย ไม่ใช่จำนวนหัวคน — แผนกหนึ่งอาจมีพนักงาน 15 คน
        เพื่อหมุนเวรให้ครบ 10 Bar ต่อวัน<br />
        • <b>Actual Bar</b> คำนวณจากไฟล์กะที่นำเข้า (คน-ชั่วโมง ÷ 8) จึงเทียบกับ Approved Bar ได้ตรงหน่วย
        {!hasShiftData && " — เดือนนี้ยังไม่มีไฟล์กะ จึงยังไม่มีค่า"}<br />
        • <b>ประเภทงาน</b> (Service / Support / Back Office) แก้ไขได้ที่คอลัมน์ที่ 2 ใช้จัดกลุ่มในรายงานและ Bar Analytics
      </div>
    </div>
  );
}
