import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { MANPOWER_ROWS } from "../../../data/manpowerPlan";
import { fetchShiftStandards, saveShiftStandard, deleteShiftStandard } from "./barApi";
import { fmt, type ShiftStandardRow } from "./barMath";

/**
 * Shift Standard — กำหนดว่ากะกี่ชั่วโมงคิดเป็นกี่ Bar
 * '*' = ค่ามาตรฐานกลางของโรงพยาบาล (8 = 1.00, 10 = 1.25, 12 = 1.50)
 * ตำแหน่งที่มีเงื่อนไขต่างจากค่ากลาง (เช่น กะ 12 ชม. ของ ICU) ตั้งค่าเฉพาะตำแหน่งทับได้
 * ค่าเหล่านี้คือตัวคูณที่ใช้แปลงกะที่ขึ้นจริง → Actual Bar ในทุกหน้าจอ
 */
export default function ShiftStandard() {
  const { user } = useAuth();
  const canEdit = !!user && ["hr", "admin", "deputyHR"].includes(user.role);

  const [rows, setRows]     = useState<ShiftStandardRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<Record<string, string>>({});
  const [newPos, setNewPos]     = useState("");
  const [newHours, setNewHours] = useState("12");
  const [newBar, setNewBar]     = useState("1.5");
  const [newMsg, setNewMsg]     = useState("");

  const key = (r: { position: string; hours: number }) => `${r.position}|${r.hours}`;

  const load = () => {
    setLoading(true);
    fetchShiftStandards().then(list => {
      setRows(list);
      setDrafts(Object.fromEntries(list.map(r => [key(r), String(r.bar_value)])));
      setLoading(false);
    });
  };
  useEffect(load, []);

  // รายชื่อตำแหน่งจากแผนกำลังคน ใช้เป็นตัวช่วยพิมพ์ (datalist)
  const positions = useMemo(
    () => Array.from(new Set(MANPOWER_ROWS.filter(r => r.type === "slot" && r.pos).map(r => r.pos)))
      .sort((a, b) => a.localeCompare(b, "th")),
    [],
  );

  const central = rows.filter(r => r.position === "*").sort((a, b) => a.hours - b.hours);
  const custom  = rows.filter(r => r.position !== "*")
    .sort((a, b) => a.position.localeCompare(b.position, "th") || a.hours - b.hours);

  async function save(r: ShiftStandardRow) {
    const v = Number(drafts[key(r)]);
    if (!Number.isFinite(v) || v <= 0) {
      setMsg(p => ({ ...p, [key(r)]: "❌ ค่า Bar ไม่ถูกต้อง" }));
      return;
    }
    const res = await saveShiftStandard({ position: r.position, hours: r.hours, bar_value: v, note: r.note ?? "" });
    setMsg(p => ({ ...p, [key(r)]: res.ok ? "✅ บันทึกแล้ว" : `❌ ${res.error ?? "ไม่สำเร็จ"}` }));
    if (res.ok) load();
    setTimeout(() => setMsg(p => { const n = { ...p }; delete n[key(r)]; return n; }), 3000);
  }

  async function remove(r: ShiftStandardRow) {
    const res = await deleteShiftStandard(r.position, r.hours);
    if (res.ok) load();
    else setMsg(p => ({ ...p, [key(r)]: `❌ ${res.error ?? "ลบไม่สำเร็จ"}` }));
  }

  async function addNew() {
    const pos = newPos.trim();
    const h = Number(newHours), b = Number(newBar);
    if (!pos)                        { setNewMsg("❌ ระบุตำแหน่ง"); return; }
    if (!Number.isFinite(h) || h <= 0) { setNewMsg("❌ ชั่วโมงไม่ถูกต้อง"); return; }
    if (!Number.isFinite(b) || b <= 0) { setNewMsg("❌ ค่า Bar ไม่ถูกต้อง"); return; }
    const res = await saveShiftStandard({ position: pos, hours: h, bar_value: b });
    setNewMsg(res.ok ? "✅ เพิ่มแล้ว" : `❌ ${res.error ?? "ไม่สำเร็จ"}`);
    if (res.ok) { setNewPos(""); load(); }
    setTimeout(() => setNewMsg(""), 3000);
  }

  const row = (r: ShiftStandardRow, isCentral: boolean) => (
    <tr key={key(r)}>
      <td>{isCentral ? <b>ค่ามาตรฐานกลาง (ทุกตำแหน่ง)</b> : r.position}</td>
      <td className="num">{fmt(r.hours, 0)} ชม.</td>
      <td className="num">
        {canEdit ? (
          <input type="number" min={0.1} max={5} step={0.05}
                 value={drafts[key(r)] ?? ""}
                 onChange={e => setDrafts(p => ({ ...p, [key(r)]: e.target.value }))}
                 style={{ width: 80, height: 30, textAlign: "right", fontSize: 12.5 }} />
        ) : fmt(r.bar_value, 2)}
      </td>
      <td className="num" style={{ color: "#6B7A99" }}>
        {fmt(Number(drafts[key(r)] ?? r.bar_value) / r.hours * 8, 2)}
      </td>
      <td style={{ textAlign: "left", color: "#6B7A99", fontSize: 11.5 }}>{r.note}</td>
      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
        {canEdit && (
          <>
            <button className="btn primary sm" onClick={() => save(r)}>บันทึก</button>
            {!isCentral && (
              <button className="btn danger sm" style={{ marginLeft: 6 }} onClick={() => remove(r)}>ลบ</button>
            )}
          </>
        )}
        {msg[key(r)] && (
          <span className={msg[key(r)].startsWith("✅") ? "msg-ok" : "msg-err"} style={{ marginLeft: 8 }}>
            {msg[key(r)]}
          </span>
        )}
      </td>
    </tr>
  );

  return (
    <div>
      {!canEdit && (
        <div className="warnbox">
          บัญชีของคุณดูได้อย่างเดียว — การแก้ไขมาตรฐานกะสงวนไว้สำหรับ HR / รอง HR / Admin
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>ค่ามาตรฐานกลาง</h3>
          <span className="hint">ใช้กับทุกตำแหน่งที่ไม่ได้ตั้งค่าเฉพาะไว้</span>
        </div>
        <div className="card-body tbl-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>ขอบเขต</th><th>ความยาวกะ</th><th>= กี่ Bar</th>
                <th>เทียบเท่า Bar/8 ชม.</th><th style={{ textAlign: "left" }}>หมายเหตุ</th><th />
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="empty">กำลังโหลด…</td></tr>
                       : central.map(r => row(r, true))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>มาตรฐานเฉพาะตำแหน่ง</h3>
          <span className="hint">ตั้งไว้เมื่อบางตำแหน่งคิด Bar ต่างจากค่ากลาง — จะถูกใช้ทับค่ากลางเสมอ</span>
        </div>
        <div className="card-body tbl-wrap">
          <table className="dt">
            <thead>
              <tr>
                <th>ตำแหน่ง</th><th>ความยาวกะ</th><th>= กี่ Bar</th>
                <th>เทียบเท่า Bar/8 ชม.</th><th style={{ textAlign: "left" }}>หมายเหตุ</th><th />
              </tr>
            </thead>
            <tbody>
              {custom.length === 0
                ? <tr><td colSpan={6} className="empty">ยังไม่มีการตั้งค่าเฉพาะตำแหน่ง — ทุกตำแหน่งใช้ค่ากลางด้านบน</td></tr>
                : custom.map(r => row(r, false))}
            </tbody>
          </table>

          {canEdit && (
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12,
                          borderTop: "1px solid #E6EBF5", paddingTop: 12 }}>
              <label className="fld">เพิ่มมาตรฐานเฉพาะตำแหน่ง:</label>
              <input list="pos-list" type="text" placeholder="ชื่อตำแหน่ง" value={newPos}
                     onChange={e => setNewPos(e.target.value)} style={{ minWidth: 220 }} />
              <datalist id="pos-list">
                {positions.map(p => <option key={p} value={p} />)}
              </datalist>
              <input type="number" min={1} max={24} step={1} value={newHours}
                     onChange={e => setNewHours(e.target.value)} style={{ width: 70 }} />
              <span className="hint">ชม. =</span>
              <input type="number" min={0.1} max={5} step={0.05} value={newBar}
                     onChange={e => setNewBar(e.target.value)} style={{ width: 80 }} />
              <span className="hint">Bar</span>
              <button className="btn primary" onClick={addNew}>+ เพิ่ม</button>
              {newMsg && <span className={newMsg.startsWith("✅") ? "msg-ok" : "msg-err"}>{newMsg}</span>}
            </div>
          )}
        </div>
      </div>

      <div className="hint" style={{ padding: "0 4px 10px", lineHeight: 1.8 }}>
        • ค่าเหล่านี้คือตัวแปลง <b>กะที่ขึ้นจริง → Actual Bar</b> ที่ Executive Dashboard, Bar Management และ Bar Analytics ใช้ร่วมกัน<br />
        • กะที่ความยาวไม่ตรงกับค่าใดเลย (เช่น 9 ชม.) ระบบจะคิดตามสูตรเดียวกับค่ากลางคือ <b>ชั่วโมง ÷ 8</b><br />
        • คอลัมน์ "เทียบเท่า Bar/8 ชม." ช่วยตรวจว่าค่าที่ตั้งยังสมเหตุสมผล — ถ้าเท่ากับ 1.00 แปลว่าคิดตามสัดส่วนชั่วโมงพอดี
      </div>
    </div>
  );
}
