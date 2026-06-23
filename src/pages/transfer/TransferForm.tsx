import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Division   { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }
interface Props { onClose: () => void; onSaved: () => void; }

export default function TransferForm({ onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [divisions,   setDivisions]   = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [name,        setName]        = useState("");
  const [position,    setPosition]    = useState("");
  const [fromDeptId,  setFromDeptId]  = useState<number | "">(
    user?.scope_department_id ?? ""
  );
  const [toDivId,     setToDivId]     = useState<number | "">("");
  const [toDeptId,    setToDeptId]    = useState<number | "">("");
  const [newPosition, setNewPosition] = useState("");
  const [reason,      setReason]      = useState("");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  const isHead = user?.role === "head";

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[] }) => {
        setDivisions(d.divisions); setDepartments(d.departments);
      });
  }, []);

  const toDepts = departments.filter(d => d.division_id === Number(toDivId));
  const fromDeptName = departments.find(d => d.id === Number(fromDeptId))?.name ?? "";

  async function save() {
    if (!name.trim() || !toDivId || !toDeptId) { setError("กรุณากรอกข้อมูลให้ครบ"); return; }
    if (!fromDeptId) { setError("กรุณาระบุแผนกต้นทาง"); return; }
    setSaving(true); setError("");
    const r = await fetch("/api/transfer/requests", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, position: position || null,
        from_department_id: fromDeptId,
        to_division_id: toDivId, to_department_id: toDeptId,
        new_position: newPosition || null, reason: reason || null,
      }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 7,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box" as const,
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,56,198,0.25)", border: "1px solid #c4cfee",
        borderTop: "4px solid #0038C6" }}>
        <div style={{ padding: "24px 28px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 6,
            display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
            ส่งคำขอย้ายแผนก
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 22, paddingLeft: 14 }}>
            หัวหน้าแผนกต้นทางยื่นคำขอ → หัวหน้าแผนกปลายทางอนุมัติ → รองผอ.ค่าตอบแทนอนุมัติ
          </div>

          {/* ชื่อพนักงาน */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              ชื่อ-นามสกุลพนักงาน *
            </label>
            <input value={name} onChange={e => setName(e.target.value)} style={inp} placeholder="ชื่อ นามสกุล" />
          </div>

          {/* ตำแหน่งปัจจุบัน */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              ตำแหน่งปัจจุบัน
            </label>
            <input value={position} onChange={e => setPosition(e.target.value)} style={inp} />
          </div>

          {/* แผนกต้นทาง */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              แผนกต้นทาง *
            </label>
            {isHead && user.scope_department_id ? (
              <div style={{ ...inp, background: "#f8faff", color: "#0038C6", fontWeight: 600, cursor: "default" }}>
                {fromDeptName || "แผนกของคุณ"}
              </div>
            ) : (
              <select value={fromDeptId} onChange={e => setFromDeptId(Number(e.target.value))} style={inp}>
                <option value="">-- เลือกแผนกต้นทาง --</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            )}
          </div>

          {/* ฝ่ายปลายทาง */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              ฝ่ายปลายทาง *
            </label>
            <select value={toDivId} onChange={e => { setToDivId(Number(e.target.value)); setToDeptId(""); }} style={inp}>
              <option value="">-- เลือกฝ่าย --</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* แผนกปลายทาง */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              แผนกปลายทาง *
            </label>
            <select value={toDeptId} onChange={e => setToDeptId(Number(e.target.value))} style={inp} disabled={!toDivId}>
              <option value="">-- เลือกแผนก --</option>
              {toDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>

          {/* ตำแหน่งใหม่ */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              ตำแหน่งใหม่
            </label>
            <input value={newPosition} onChange={e => setNewPosition(e.target.value)} style={inp} />
          </div>

          {/* เหตุผล */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
              letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>
              เหตุผลการย้าย
            </label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3}
              style={{ ...inp, resize: "vertical" as const }} />
          </div>

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca",
              borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
              {error}
            </div>
          )}
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: "11px 0", borderRadius: 7,
                border: "1.5px solid #c4cfee", background: "#fff", cursor: "pointer",
                fontFamily: "inherit", fontSize: 13 }}>
              ยกเลิก
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                background: "#0038C6", color: "#fff", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              {saving ? "กำลังส่ง…" : "ส่งคำขอ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
