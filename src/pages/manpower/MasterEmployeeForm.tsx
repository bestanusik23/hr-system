import { useEffect, useState } from "react";

export interface MasterEmployee {
  id: number; emp_code: string | null; full_name: string; name_en: string | null;
  position: string | null;
  start_date: string | null; emp_status: string;
  emp_type: string | null; supervisor: string | null;
  probation_days: number | null; probation_end_date: string | null; remark: string | null;
  resign_date: string | null; resign_reason: string | null; resign_type: string | null;
  department_id: number | null; division_id: number | null;
  department_name: string | null; division_name: string | null;
  color: string | null; initial: string | null;
}

interface Division { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }

export const EMP_TYPES = ["พนักงานประจำ", "สัญญาจ้าง", "สัญญาทุน 5 ปี", "Part time", "รายวัน", "ฝึกงาน"];

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
  fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>{label}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

interface Props { employee: MasterEmployee; onClose: () => void; onSaved: () => void; }

export default function MasterEmployeeForm({ employee, onClose, onSaved }: Props) {
  const [divisions, setDivs]   = useState<Division[]>([]);
  const [departments, setDeps] = useState<Department[]>([]);
  const [empCode, setEmpCode]  = useState(employee.emp_code ?? "");
  const [fullName, setName]    = useState(employee.full_name);
  const [nameEn, setNameEn]    = useState(employee.name_en ?? "");
  const [position, setPos]     = useState(employee.position ?? "");
  const [divId, setDivId]      = useState<number | "">(employee.division_id ?? "");
  const [deptId, setDeptId]    = useState<number | "">(employee.department_id ?? "");
  const [startDate, setStart]  = useState(employee.start_date ?? "");
  const [empType, setType]     = useState(employee.emp_type ?? "");
  const [supervisor, setSup]   = useState(employee.supervisor ?? "");
  const [probDays, setProbDays] = useState<number>(employee.probation_days ?? 119);
  const [empStatus, setStatus] = useState(employee.emp_status);
  const [remark, setRemark]    = useState(employee.remark ?? "");
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState("");

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[] }) => {
        setDivs(d.divisions ?? []); setDeps(d.departments ?? []);
      });
  }, []);

  const filteredDepts = departments.filter(d => d.division_id === Number(divId));

  async function save() {
    if (!fullName.trim()) { setError("กรุณากรอกชื่อ"); return; }
    setSaving(true); setError("");
    const r = await fetch(`/api/manpower/employees/${employee.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        emp_code: empCode || null,
        full_name: fullName, name_en: nameEn || null,
        position: position || null,
        department_id: deptId || null, division_id: divId || null, start_date: startDate || null,
        emp_status: empStatus, emp_type: empType || null, supervisor: supervisor || null,
        probation_days: probDays, remark: remark || null,
      }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 32, width: 480, maxHeight: "90vh",
        overflowY: "auto", boxShadow: "0 24px 60px rgba(0,56,198,0.25)",
        border: "1px solid #c4cfee", borderTop: "4px solid #0891b2" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 22,
          display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0891b2" }} />
          แก้ไขข้อมูลพนักงาน
        </div>

        <Field label="รหัสพนักงาน" hint="Format: EMP0001 (กรอกเพื่อแก้ไข, ระบบออกให้อัตโนมัติเมื่อเพิ่มใหม่)">
          <input value={empCode} onChange={e => setEmpCode(e.target.value.toUpperCase())} style={{ ...inp, fontFamily: "monospace", fontWeight: 700, color: "#0038c6" }}
            placeholder="EMP0001" />
        </Field>
        <Field label="ชื่อ-นามสกุล (ไทย) *">
          <input value={fullName} onChange={e => setName(e.target.value)} style={inp} />
        </Field>
        <Field label="ชื่อ-นามสกุล (English)" hint="ใช้สำหรับบัตรพนักงาน Canva">
          <input value={nameEn} onChange={e => setNameEn(e.target.value)} style={inp}
            placeholder="Firstname Lastname" />
        </Field>
        <Field label="ตำแหน่ง">
          <input value={position} onChange={e => setPos(e.target.value)} style={inp} />
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
        <Field label="ประเภทพนักงาน">
          <input value={empType} onChange={e => setType(e.target.value)} style={inp} list="emp-types" placeholder="เลือกหรือพิมพ์…" />
          <datalist id="emp-types">{EMP_TYPES.map(t => <option key={t} value={t} />)}</datalist>
        </Field>
        <Field label="หัวหน้างาน">
          <input value={supervisor} onChange={e => setSup(e.target.value)} style={inp} />
        </Field>
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Field label="วันที่เริ่มงาน">
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={inp} />
            </Field>
          </div>
          <div style={{ width: 130 }}>
            <Field label="ทดลองงาน (วัน)">
              <input type="number" value={probDays} onChange={e => setProbDays(Number(e.target.value))} style={inp} />
            </Field>
          </div>
        </div>
        <Field label="สถานะ">
          <select value={empStatus} onChange={e => setStatus(e.target.value)} style={inp}>
            <option value="probation">ทดลองงาน</option>
            <option value="passed">ผ่านทดลองงาน (Active)</option>
            <option value="transferred">ย้ายแผนก</option>
            <option value="resigned">ลาออก</option>
          </select>
        </Field>
        <Field label="หมายเหตุ">
          <textarea value={remark} onChange={e => setRemark(e.target.value)} rows={2}
            style={{ ...inp, resize: "vertical" }} />
        </Field>

        {error && (
          <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 7,
            padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{error}</div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
              background: "#fff", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>ยกเลิก</button>
          <button onClick={save} disabled={saving}
            style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
              background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 13,
              cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}
