import { useEffect, useState } from "react";

interface Division { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }
interface Props { onClose: () => void; onSaved: () => void; }

export default function TransferForm({ onClose, onSaved }: Props) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [fromDeptId, setFromDeptId] = useState<number | "">("");
  const [toDivId, setToDivId] = useState<number | "">("");
  const [toDeptId, setToDeptId] = useState<number | "">("");
  const [newPosition, setNewPosition] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[] }) => {
        setDivisions(d.divisions); setDepartments(d.departments);
      });
  }, []);

  const toDepts = departments.filter(d => d.division_id === Number(toDivId));

  async function save() {
    if (!name.trim() || !toDivId || !toDeptId) { setError("กรุณากรอกข้อมูลให้ครบ"); return; }
    setSaving(true); setError("");
    const r = await fetch("/api/transfer/requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, position: position || null, from_department_id: fromDeptId || null, to_division_id: toDivId, to_department_id: toDeptId, new_position: newPosition || null, reason: reason || null }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", outline: "none" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 32, boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 22 }}>ส่งคำขอย้ายแผนก</div>

        {[
          { label: "ชื่อ-นามสกุลพนักงาน *", el: <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="ชื่อ นามสกุล" /> },
          { label: "ตำแหน่งปัจจุบัน", el: <input value={position} onChange={e => setPosition(e.target.value)} style={inp} /> },
          { label: "แผนกปัจจุบัน", el: (
            <select value={fromDeptId} onChange={e => setFromDeptId(Number(e.target.value))} style={inp}>
              <option value="">-- เลือกแผนก --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )},
          { label: "ฝ่ายที่ย้ายไป *", el: (
            <select value={toDivId} onChange={e => { setToDivId(Number(e.target.value)); setToDeptId(""); }} style={inp}>
              <option value="">-- เลือกฝ่าย --</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )},
          { label: "แผนกที่ย้ายไป *", el: (
            <select value={toDeptId} onChange={e => setToDeptId(Number(e.target.value))} style={inp} disabled={!toDivId}>
              <option value="">-- เลือกแผนก --</option>
              {toDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )},
          { label: "ตำแหน่งใหม่", el: <input value={newPosition} onChange={e => setNewPosition(e.target.value)} style={inp} /> },
          { label: "เหตุผลการย้าย", el: <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} /> },
        ].map(({ label, el }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>{label}</label>
            {el}
          </div>
        ))}

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#E0533D", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังส่ง…" : "ส่งคำขอ"}
          </button>
        </div>
      </div>
    </div>
  );
}
