import { useEffect, useState } from "react";

interface Division   { id: number; name: string; }
interface Department { id: number; name: string; division_id: number; }
interface Position   { position: string; division_id: number; department_id: number | null; }
interface UserRow {
  id: number; username: string; full_name: string; role: string; role_title: string | null;
  scope_division_id: number | null; scope_division_id_2: number | null; scope_division_id_3: number | null;
  scope_department_id: number | null; is_active: number;
}
interface Props { user: UserRow | null; onClose: () => void; onSaved: () => void; }

const ROLES = [
  { value: "hr",       label: "HR — ฝ่ายบุคคล" },
  { value: "head",     label: "หัวหน้าแผนก (Head)" },
  { value: "deputy",   label: "รองผู้อำนวยการ (Deputy)" },
  { value: "deputyHR", label: "รองผู้อำนวยการ ด้าน HR (DeputyHR)" },
  { value: "admin",    label: "ผู้ดูแลระบบ (Admin)" },
];

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7,
  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box" as const, background: "#fff",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
        letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 7 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export default function UserForm({ user, onClose, onSaved }: Props) {
  const isNew = !user;

  const [fullName,     setFullName]     = useState(user?.full_name ?? "");
  const [username,     setUsername]     = useState(user?.username ?? "");
  const [role,         setRole]         = useState(user?.role ?? "hr");
  const [roleTitle,    setRoleTitle]    = useState(user?.role_title ?? "");
  const [customTitle,  setCustomTitle]  = useState("");
  const [useCustom,    setUseCustom]    = useState(false);
  const [divisionId,   setDivisionId]   = useState<number | "">(user?.scope_division_id   ?? "");
  const [divisionId2,  setDivisionId2]  = useState<number | "">(user?.scope_division_id_2 ?? "");
  const [divisionId3,  setDivisionId3]  = useState<number | "">(user?.scope_division_id_3 ?? "");
  const [departmentId, setDepartmentId] = useState<number | "">(user?.scope_department_id ?? "");
  const [isActive,     setIsActive]     = useState(user?.is_active !== 0);
  const [password,     setPassword]     = useState("");
  const [showPwd,      setShowPwd]      = useState(false);

  const [divisions,    setDivisions]    = useState<Division[]>([]);
  const [departments,  setDepartments]  = useState<Department[]>([]);
  const [positions,    setPositions]    = useState<Position[]>([]);

  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[]; positions: Position[] }) => {
        setDivisions(d.divisions ?? []);
        setDepartments(d.departments ?? []);
        setPositions(d.positions ?? []);
      });
  }, []);

  // derived
  const filteredDepts = departments.filter(d => !divisionId || d.division_id === divisionId);

  const filteredPositions = positions.filter(p => {
    if (divisionId && p.division_id !== divisionId) return false;
    if (departmentId && p.department_id !== null && p.department_id !== departmentId) return false;
    return true;
  });
  const uniquePositions = [...new Set(filteredPositions.map(p => p.position))].sort();

  function handleDivisionChange(val: number | "") {
    setDivisionId(val);
    setDepartmentId("");
    setRoleTitle("");
    setCustomTitle("");
    setUseCustom(false);
  }
  function handleDeptChange(val: number | "") {
    setDepartmentId(val);
    setRoleTitle("");
    setCustomTitle("");
    setUseCustom(false);
  }
  function handlePositionChange(val: string) {
    if (val === "__custom__") { setUseCustom(true); setRoleTitle(""); }
    else { setUseCustom(false); setRoleTitle(val); }
  }

  async function save() {
    if (!fullName.trim() || !username.trim()) { setError("กรุณากรอกชื่อและ username"); return; }
    if (isNew && password.length < 6) { setError("Password ต้องมีอย่างน้อย 6 ตัวอักษร"); return; }
    setSaving(true); setError("");

    const finalTitle = useCustom ? customTitle : roleTitle;
    const isDeputy = ["deputy","deputyHR","hr"].includes(role);
    const scopeDivId  = isDeputy ? (divisionId  || null) : null;
    const scopeDivId2 = isDeputy ? (divisionId2 || null) : null;
    const scopeDivId3 = isDeputy ? (divisionId3 || null) : null;
    const scopeDeptId = role === "head" ? (departmentId || null) : null;

    try {
      if (isNew) {
        const r = await fetch("/api/admin/users", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username, password, full_name: fullName, role,
            role_title: finalTitle || null,
            scope_division_id: scopeDivId, scope_division_id_2: scopeDivId2,
            scope_division_id_3: scopeDivId3, scope_department_id: scopeDeptId,
          }),
        });
        const d = await r.json() as { ok: boolean; error?: string };
        if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
      } else {
        const body: Record<string, unknown> = {
          full_name: fullName, role,
          role_title: finalTitle || null,
          scope_division_id: scopeDivId, scope_division_id_2: scopeDivId2,
          scope_division_id_3: scopeDivId3, scope_department_id: scopeDeptId,
          is_active: isActive,
        };
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

  const selectedDivNames = [divisionId, divisionId2, divisionId3]
    .filter(Boolean)
    .map(id => divisions.find(d => d.id === id)?.name)
    .filter(Boolean) as string[];
  const deputyScopeHint = selectedDivNames.length
    ? `🏢 รองผู้อำนวยการ: จะเห็นข้อมูลใน ${selectedDivNames.length} ฝ่าย — ${selectedDivNames.map(n => `"${n}"`).join(", ")}`
    : "🏢 รองผู้อำนวยการ: จะเห็นข้อมูลทุกฝ่าย (หากไม่เลือกฝ่าย)";

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 500,
        maxHeight: "92vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,56,198,0.25)",
        border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
        <div style={{ padding: "26px 28px" }}>

          {/* Title */}
          <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 22,
            display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
            {isNew ? "เพิ่มผู้ใช้งานใหม่" : `แก้ไข: ${user.full_name}`}
          </div>

          {/* ชื่อ */}
          <Field label="ชื่อ-นามสกุล *">
            <input value={fullName} onChange={e => setFullName(e.target.value)}
              style={inp} placeholder="ชื่อ นามสกุล" autoComplete="off" />
          </Field>

          {/* ฝ่าย 1 */}
          <Field label="ฝ่าย (หลัก)">
            <select value={divisionId} onChange={e => handleDivisionChange(e.target.value ? Number(e.target.value) : "")} style={inp}>
              <option value="">-- เลือกฝ่าย --</option>
              {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>

          {/* ฝ่าย 2 + 3 (เฉพาะ deputy / deputyHR) */}
          {["deputy","deputyHR"].includes(role) && (
            <>
              <Field label="ฝ่าย (เพิ่มเติม 1)">
                <select value={divisionId2} onChange={e => setDivisionId2(e.target.value ? Number(e.target.value) : "")} style={inp}>
                  <option value="">-- ไม่มี --</option>
                  {divisions.filter(d => d.id !== divisionId && d.id !== divisionId3).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="ฝ่าย (เพิ่มเติม 2)">
                <select value={divisionId3} onChange={e => setDivisionId3(e.target.value ? Number(e.target.value) : "")} style={inp}>
                  <option value="">-- ไม่มี --</option>
                  {divisions.filter(d => d.id !== divisionId && d.id !== divisionId2).map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </Field>
            </>
          )}

          {/* แผนก (กรองตามฝ่าย) */}
          <Field label="แผนก">
            <select value={departmentId} onChange={e => handleDeptChange(e.target.value ? Number(e.target.value) : "")} style={inp}
              disabled={!divisionId}>
              <option value="">{divisionId ? "-- เลือกแผนก (ไม่บังคับ) --" : "-- เลือกฝ่ายก่อน --"}</option>
              {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>

          {/* ตำแหน่ง (กรองตามฝ่าย+แผนก) */}
          <Field label="ตำแหน่ง">
            {divisionId ? (
              <>
                <select
                  value={useCustom ? "__custom__" : roleTitle}
                  onChange={e => handlePositionChange(e.target.value)}
                  style={inp}>
                  <option value="">-- เลือกตำแหน่ง --</option>
                  {uniquePositions.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="__custom__">✏️ พิมพ์เอง…</option>
                </select>
                {useCustom && (
                  <input value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                    style={{ ...inp, marginTop: 7 }} placeholder="พิมพ์ตำแหน่ง..." autoComplete="off" />
                )}
                {!useCustom && roleTitle && (
                  <div style={{ fontSize: 11, color: "#0038C6", marginTop: 4 }}>
                    ✓ ตำแหน่งที่เลือก: {roleTitle}
                  </div>
                )}
              </>
            ) : (
              <input value={roleTitle} onChange={e => setRoleTitle(e.target.value)}
                style={inp} placeholder="เลือกฝ่ายก่อนเพื่อดูตำแหน่ง หรือพิมพ์ตรงนี้" autoComplete="off" />
            )}
          </Field>

          {/* Username */}
          <Field label="Username *">
            <input value={username} onChange={e => setUsername(e.target.value)}
              style={{ ...inp, background: !isNew ? "#f8fafc" : "#fff" }}
              disabled={!isNew} placeholder="username" autoComplete="off" />
          </Field>

          {/* Role */}
          <Field label="สิทธิ์การใช้งาน *">
            <select value={role} onChange={e => setRole(e.target.value)} style={inp}>
              {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </Field>

          {/* Scope hint */}
          {(role === "head" || ["deputy","deputyHR"].includes(role)) && (
            <div style={{ background: "#f0f5ff", borderRadius: 7, padding: "10px 14px",
              marginBottom: 14, fontSize: 12, color: "#475569", border: "1px solid #dce4f5" }}>
              {role === "head"
                ? `🏥 หัวหน้าแผนก: จะเห็นเฉพาะข้อมูลใน${departmentId ? `แผนก "${filteredDepts.find(d=>d.id===departmentId)?.name ?? ""}"` : "แผนกที่เลือก (กรุณาเลือกแผนก)"}`
                : deputyScopeHint}
            </div>
          )}

          {/* Password */}
          <Field label={isNew ? "Password *" : "เปลี่ยน Password"}>
            <div style={{ position: "relative" }}>
              <input type={showPwd ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                style={{ ...inp, paddingRight: 40 }}
                placeholder={isNew ? "อย่างน้อย 6 ตัวอักษร" : "กรอกเพื่อตั้งรหัสใหม่ (อย่างน้อย 6 ตัว)"}
                autoComplete="new-password" />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: "absolute", right: 8, top: 10,
                  background: "none", border: "none", cursor: "pointer", padding: 4,
                  color: "#94a3b8", display: "flex", alignItems: "center" }}>
                {showPwd
                  ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {!isNew && (
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 5 }}>
                🔒 รหัสผ่านถูกเข้ารหัสไว้ ไม่สามารถแสดงรหัสเดิมได้ — กรอกเพื่อตั้งใหม่เท่านั้น
              </div>
            )}
          </Field>

          {/* สถานะ (edit only) */}
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

          {/* Error */}
          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca",
              borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
              {error}
            </div>
          )}

          {/* Buttons */}
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: "11px 0", borderRadius: 7,
                border: "1.5px solid #c4cfee", background: "#fff",
                cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              ยกเลิก
            </button>
            <button onClick={save} disabled={saving}
              style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                background: saving ? "#94a3b8" : "#0038C6", color: "#fff", fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: 13 }}>
              {saving ? "กำลังบันทึก…" : isNew ? "สร้างผู้ใช้" : "บันทึก"}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
