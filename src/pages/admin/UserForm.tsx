import { useEffect, useState } from "react";

interface Division    { id: number; name: string; }
interface Department  { id: number; name: string; division_id: number; }
interface UserRow {
  id: number; username: string; full_name: string; role: string;
  scope_division_id: number | null; scope_department_id: number | null; is_active: number;
}
interface Props { user: UserRow | null; onClose: () => void; onSaved: () => void; }

const ROLES = [
  { value: "hr",        label: "HR — ฝ่ายบุคคล" },
  { value: "head",      label: "หัวหน้าแผนก (Head)" },
  { value: "deputy",    label: "รองผู้อำนวยการ (Deputy)" },
  { value: "deputyHR",  label: "รองผู้อำนวยการ ด้าน HR (DeputyHR)" },
  { value: "admin",     label: "ผู้ดูแลระบบ (Admin)" },
];

export default function UserForm({ user, onClose, onSaved }: Props) {
  const isNew = !user;
  const [fullName,     setFullName]     = useState(user?.full_name ?? "");
  const [username,     setUsername]     = useState(user?.username ?? "");
  const [role,         setRole]         = useState(user?.role ?? "hr");
  const [divisionId,   setDivisionId]   = useState<number | "">(user?.scope_division_id ?? "");
  const [departmentId, setDepartmentId] = useState<number | "">(user?.scope_department_id ?? "");
  const [isActive,     setIsActive]     = useState(user?.is_active !== 0);
  const [password,     setPassword]     = useState("");
  const [divisions,    setDivisions]    = useState<Division[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [saving,       setSaving]       = useState(false);
  const [error,        setError]        = useState("");

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json()).then((d: { divisions: Division[]; departments: Department[] }) => {
      setDivisions(d.divisions ?? []);
      setDepartments(d.departments ?? []);
    });
  }, []);

  async function save() {
    if (!fullName.trim() || !username.trim()) { setError("กรุณากรอกชื่อและ username"); return; }
    if (isNew && password.length < 6) { setError("Password ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setSaving(true); setError("");

    const scopeDivId  = ["deputy", "deputyHR"].includes(role) ? (divisionId   || null) : null;
    const scopeDeptId = role === "head"                        ? (departmentId || null) : null;

    if (isNew) {
      const r = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, full_name: fullName, role, scope_division_id: scopeDivId, scope_department_id: scopeDeptId }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); setSaving(false); return; }
    } else {
      const body: Record<string, unknown> = { full_name: fullName, role, scope_division_id: scopeDivId, scope_department_id: scopeDeptId, is_active: isActive };
      if (password.length >= 6) body.new_password = password;
      const r = await fetch(`/api/admin/users/${user.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); setSaving(false); return; }
    }
    onSaved();
  }

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit" };

  // Filtered departments for selected division (head uses department, not division)
  const filteredDepts = departments;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: 32, boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 24 }}>
          {isNew ? "เพิ่มผู้ใช้งานใหม่" : `แก้ไข: ${user.full_name}`}
        </div>

        {[
          { label: "ชื่อ-นามสกุล *", el: <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} placeholder="ชื่อ นามสกุล" /> },
          { label: "Username *",      el: <input value={username} onChange={e => setUsername(e.target.value)} style={inp} disabled={!isNew} placeholder="username" /> },
          { label: "สิทธิ์การใช้งาน *", el: (
            <select value={role} onChange={e => { setRole(e.target.value); setDivisionId(""); setDepartmentId(""); }} style={inp}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          )},

          // head → แผนก (department scope)
          ...(role === "head" ? [{ label: "แผนกที่รับผิดชอบ *", el: (
            <select value={departmentId} onChange={e => setDepartmentId(Number(e.target.value))} style={inp}>
              <option value="">-- เลือกแผนก --</option>
              {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}] : []),

          // deputy/deputyHR → ฝ่าย (division scope)
          ...(["deputy", "deputyHR"].includes(role) ? [{ label: "ฝ่ายที่รับผิดชอบ *", el: (
            <select value={divisionId} onChange={e => setDivisionId(Number(e.target.value))} style={inp}>
              <option value="">-- เลือกฝ่าย (เว้นว่าง = ดูแลทุกฝ่าย) --</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          )}] : []),

          { label: isNew ? "Password *" : "Password ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)", el: (
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder={isNew ? "อย่างน้อย 6 ตัวอักษร" : "เว้นว่างถ้าไม่เปลี่ยน"} />
          )},
        ].map(({ label, el }) => (
          <div key={label} style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 }}>{label}</label>
            {el}
          </div>
        ))}

        {!isNew && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>สถานะ</label>
            <button onClick={() => setIsActive(v => !v)}
              style={{ padding: "6px 16px", borderRadius: 9, border: "none", background: isActive ? "#dcfce7" : "#fee2e2", color: isActive ? "#16a34a" : "#dc2626", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              {isActive ? "✓ ใช้งาน" : "✗ ปิดใช้งาน"}
            </button>
          </div>
        )}

        {/* Scope summary */}
        {(role === "head" || ["deputy","deputyHR"].includes(role)) && (
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#64748b" }}>
            {role === "head"
              ? "หัวหน้าแผนก: เห็นเฉพาะข้อมูลในแผนกที่เลือก (พนักงาน / ประเมิน / คำขอย้าย)"
              : "รองผู้อำนวยการ: เห็นเฉพาะข้อมูลในฝ่ายที่เลือก (หากไม่เลือก = เห็นทุกฝ่าย)"}
          </div>
        )}

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving}
            style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังบันทึก…" : isNew ? "สร้างผู้ใช้" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
