import { useEffect, useState } from "react";

interface Division   { id: number; name: string; }
interface Department { id: number; name: string; division_id: number; }
interface UserRow {
  id: number; username: string; full_name: string; role: string;
  scope_division_id: number | null; scope_department_id: number | null; is_active: number;
}
interface Props { user: UserRow | null; onClose: () => void; onSaved: () => void; }

const ROLES = [
  { value: "hr",       label: "HR — ฝ่ายบุคคล" },
  { value: "head",     label: "หัวหน้าแผนก (Head)" },
  { value: "deputy",   label: "รองผู้อำนวยการ (Deputy)" },
  { value: "deputyHR", label: "รองผู้อำนวยการ ด้าน HR (DeputyHR)" },
  { value: "admin",    label: "ผู้ดูแลระบบ (Admin)" },
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
  const [showPwd,      setShowPwd]      = useState(false);

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[] }) => {
        setDivisions(d.divisions ?? []); setDepartments(d.departments ?? []);
      });
  }, []);

  async function save() {
    if (!fullName.trim() || !username.trim()) { setError("กรุณากรอกชื่อและ username"); return; }
    if (isNew && password.length < 6) { setError("Password ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setSaving(true); setError("");

    try {
      const scopeDivId  = ["deputy","deputyHR"].includes(role) ? (divisionId   || null) : null;
      const scopeDeptId = role === "head"                       ? (departmentId || null) : null;

      if (isNew) {
        const r = await fetch("/api/admin/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, full_name: fullName, role, scope_division_id: scopeDivId, scope_department_id: scopeDeptId }),
        });
        const d = await r.json() as { ok: boolean; error?: string };
        if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
      } else {
        const body: Record<string, unknown> = { full_name: fullName, role, scope_division_id: scopeDivId, scope_department_id: scopeDeptId, is_active: isActive };
        if (password.length >= 6) body.new_password = password;
        const r = await fetch(`/api/admin/users/${user.id}`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
        });
        const d = await r.json() as { ok: boolean; error?: string };
        if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
      }
      onSaved();
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 7,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box" as const,
  };

  const fields = [
    { label: "ชื่อ-นามสกุล *", el: <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} placeholder="ชื่อ นามสกุล" autoComplete="off" /> },
    { label: "Username *",     el: <input value={username} onChange={e => setUsername(e.target.value)} style={inp} disabled={!isNew} placeholder="username" autoComplete="off" /> },
    { label: "สิทธิ์การใช้งาน *", el: (
        <select value={role} onChange={e => { setRole(e.target.value); setDivisionId(""); setDepartmentId(""); }} style={inp}>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
    )},
    ...(role === "head" ? [{ label: "แผนกที่รับผิดชอบ *", el: (
        <select value={departmentId} onChange={e => setDepartmentId(Number(e.target.value))} style={inp}>
          <option value="">-- เลือกแผนก --</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
    )}] : []),
    ...(["deputy","deputyHR"].includes(role) ? [{ label: "ฝ่ายที่รับผิดชอบ *", el: (
        <select value={divisionId} onChange={e => setDivisionId(Number(e.target.value))} style={inp}>
          <option value="">-- เลือกฝ่าย (เว้นว่าง = ดูแลทุกฝ่าย) --</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
    )}] : []),
    { label: isNew ? "Password *" : "Password ใหม่ (เว้นว่างถ้าไม่เปลี่ยน)", el: (
        <div style={{ position: "relative" }}>
          <input type={showPwd ? "text" : "password"} value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ ...inp, paddingRight: 40 }}
            placeholder={isNew ? "อย่างน้อย 6 ตัวอักษร" : "เว้นว่างถ้าไม่เปลี่ยน"}
            autoComplete="new-password" />
          <button type="button" onClick={() => setShowPwd(v => !v)}
            style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", padding: 4,
              color: "#94a3b8", display: "flex", alignItems: "center" }}>
            {showPwd
              ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
            }
          </button>
        </div>
    )},
  ];

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 480,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,56,198,0.25)",
        border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
        <div style={{ padding: "26px 28px" }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 22,
            display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
            {isNew ? "เพิ่มผู้ใช้งานใหม่" : `แก้ไข: ${user.full_name}`}
          </div>

          {fields.map(({ label, el }) => (
            <div key={label} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 7 }}>
                {label}
              </label>
              {el}
            </div>
          ))}

          {!isNew && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#475569", letterSpacing: "0.08em" }}>สถานะ</label>
              <button onClick={() => setIsActive(v => !v)}
                style={{ padding: "6px 18px", borderRadius: 7,
                  border: `1.5px solid ${isActive ? "#bbf7d0" : "#fecaca"}`,
                  background: isActive ? "#dcfce7" : "#fee2e2",
                  color: isActive ? "#16a34a" : "#dc2626",
                  fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 12 }}>
                {isActive ? "✓ ใช้งาน" : "✗ ปิดใช้งาน"}
              </button>
            </div>
          )}

          {(role === "head" || ["deputy","deputyHR"].includes(role)) && (
            <div style={{ background: "#f0f5ff", borderRadius: 7, padding: "10px 14px",
              marginBottom: 14, fontSize: 12, color: "#475569", border: "1px solid #dce4f5" }}>
              {role === "head"
                ? "หัวหน้าแผนก: เห็นเฉพาะข้อมูลในแผนกที่เลือก"
                : "รองผู้อำนวยการ: เห็นเฉพาะข้อมูลในฝ่ายที่เลือก (หากไม่เลือก = เห็นทุกฝ่าย)"}
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca",
              borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: "11px 0", borderRadius: 7,
                border: "1.5px solid #c4cfee", background: "#fff",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              ยกเลิก
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                background: "#0038C6", color: "#fff", fontWeight: 700,
                cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              {saving ? "กำลังบันทึก…" : isNew ? "สร้างผู้ใช้" : "บันทึก"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
