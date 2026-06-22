import { useEffect, useRef, useState } from "react";

interface Division { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }
interface Template { id: number; name: string; }
interface Employee {
  id: number; full_name: string; position: string | null; start_date: string | null;
  emp_status: string; department_id: number | null; division_id: number | null;
  color: string | null; initial: string | null;
}

interface Props { employee: Employee | null; onClose: () => void; onSaved: () => void; }

const COLORS = ["#0038C6","#16A34A","#7C3AED","#E0533D","#0891B2","#D97706","#DB2777","#059669"];

export default function EmployeeForm({ employee, onClose, onSaved }: Props) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [divId, setDivId] = useState<number | "">(employee?.division_id ?? "");
  const [deptId, setDeptId] = useState<number | "">(employee?.department_id ?? "");
  const [fullName, setFullName] = useState(employee?.full_name ?? "");
  const [position, setPosition] = useState(employee?.position ?? "");
  const [posSearch, setPosSearch] = useState(employee?.position ?? "");
  const [posOpen, setPosOpen] = useState(false);
  const [startDate, setStartDate] = useState(employee?.start_date ?? "");
  const [empStatus, setEmpStatus] = useState(employee?.emp_status ?? "probation");
  const [color, setColor] = useState(employee?.color ?? COLORS[0]);
  const [initial, setInitial] = useState(employee?.initial ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const posRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/eval/org").then(r => r.json()),
      fetch("/api/eval/templates").then(r => r.json()),
    ]).then(([od, td]) => {
      setDivisions((od as { divisions: Division[] }).divisions);
      setDepartments((od as { departments: Department[] }).departments);
      setTemplates((td as { templates: Template[] }).templates ?? []);
    });
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (posRef.current && !posRef.current.contains(e.target as Node)) setPosOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filteredPos = posSearch.trim()
    ? templates.filter(t => t.name.toLowerCase().includes(posSearch.toLowerCase()))
    : templates;

  const filteredDepts = departments.filter(d => d.division_id === Number(divId));

  async function save() {
    if (!fullName.trim()) { setError("กรุณากรอกชื่อ"); return; }
    setSaving(true); setError("");
    const body = { full_name: fullName, position: position || null, department_id: deptId || null, division_id: divId || null, start_date: startDate || null, emp_status: empStatus, color, initial: initial || null };
    const url = employee ? `/api/eval/employees/${employee.id}` : "/api/eval/employees";
    const method = employee ? "PUT" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 32, width: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,56,198,0.25)", border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 22, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
          {employee ? "แก้ไขข้อมูลพนักงาน" : "เพิ่มพนักงานใหม่"}
        </div>

        <Field label="ชื่อ-นามสกุล *">
          <input value={fullName} onChange={e => setFullName(e.target.value)} style={inp} placeholder="ชื่อ นามสกุล" />
        </Field>
        <Field label="ตำแหน่ง">
          <div ref={posRef} style={{ position: "relative" }}>
            <input
              value={posSearch}
              onChange={e => { setPosSearch(e.target.value); setPosition(e.target.value); setPosOpen(true); }}
              onFocus={() => setPosOpen(true)}
              style={inp} placeholder="🔍 ค้นหาหรือพิมพ์ตำแหน่ง…"
            />
            {posOpen && filteredPos.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1.5px solid #c4cfee", borderRadius: 7, boxShadow: "0 8px 24px rgba(0,56,198,.14)", zIndex: 200, maxHeight: 200, overflowY: "auto" }}>
                {filteredPos.slice(0, 30).map(t => (
                  <div key={t.id} onClick={() => { setPosition(t.name); setPosSearch(t.name); setPosOpen(false); }}
                    style={{ padding: "8px 12px", cursor: "pointer", fontSize: 13 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f0f5ff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    {t.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>
        <Field label="ฝ่าย">
          <select value={divId} onChange={e => { setDivId(Number(e.target.value)); setDeptId(""); }} style={inp}>
            <option value="">-- เลือกฝ่าย --</option>
            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="แผนก">
          <select value={deptId} onChange={e => setDeptId(Number(e.target.value))} style={inp} disabled={!divId}>
            <option value="">-- เลือกแผนก --</option>
            {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="วันที่เริ่มงาน">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={inp} />
        </Field>
        {employee && (
          <Field label="สถานะ">
            <select value={empStatus} onChange={e => setEmpStatus(e.target.value)} style={inp}>
              <option value="probation">ทดลองงาน</option>
              <option value="passed">ผ่านทดลองงาน</option>
              <option value="transferred">ย้ายแผนก</option>
              <option value="resigned">ลาออก</option>
            </select>
          </Field>
        )}
        <Field label="ชื่อย่อ (สำหรับ Avatar)">
          <input value={initial} onChange={e => setInitial(e.target.value.slice(0,2).toUpperCase())} style={inp} placeholder="2 ตัวอักษร" maxLength={2} />
        </Field>
        <Field label="สีประจำตัว">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{ width: 28, height: 28, borderRadius: "50%", background: c, border: color === c ? "3px solid #0f172a" : "2px solid transparent", cursor: "pointer" }} />
            ))}
          </div>
        </Field>

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "1.5px solid #c4cfee", background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving} style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none", background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid #c4cfee", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
