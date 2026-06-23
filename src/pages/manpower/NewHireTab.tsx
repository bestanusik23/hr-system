import { useEffect, useMemo, useState } from "react";
import { formatThaiDate, toGregorian } from "../../utils/date";
import { EMP_TYPES } from "./MasterEmployeeForm";

interface Division { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
  fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

export default function NewHireTab({ onSaved }: { onSaved: () => void }) {
  const [divisions, setDivs]   = useState<Division[]>([]);
  const [departments, setDeps] = useState<Department[]>([]);
  const [fullName, setName]    = useState("");
  const [startDate, setStart]  = useState("");
  const [divId, setDivId]      = useState<number | "">("");
  const [deptId, setDeptId]    = useState<number | "">("");
  const [position, setPos]     = useState("");
  const [empType, setType]     = useState("");
  const [probDays, setProbDays] = useState(119);
  const [saving, setSaving]    = useState(false);
  const [error, setError]      = useState("");
  const [done, setDone]        = useState<{ probation_end_date: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[] }) => {
        setDivs(d.divisions ?? []); setDeps(d.departments ?? []);
      });
  }, []);

  const filteredDepts = departments.filter(d => d.division_id === Number(divId));

  // Live preview of probation end
  const probEndPreview = useMemo(() => {
    if (!startDate) return null;
    const d = toGregorian(startDate);
    d.setDate(d.getDate() + (probDays || 0));
    return d.toISOString().slice(0, 10);
  }, [startDate, probDays]);

  async function save() {
    if (!fullName.trim()) { setError("กรุณากรอกชื่อพนักงาน"); return; }
    if (!startDate) { setError("กรุณาระบุวันที่เริ่มงาน"); return; }
    setSaving(true); setError("");
    const r = await fetch("/api/manpower/new-hire", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        full_name: fullName, start_date: startDate, department_id: deptId || null,
        division_id: divId || null, position: position || null,
        emp_type: empType || null, probation_days: probDays,
      }),
    });
    const d = await r.json() as { ok: boolean; error?: string; probation_end_date?: string | null };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setDone({ probation_end_date: d.probation_end_date ?? null });
  }

  if (done) {
    return (
      <div style={{ maxWidth: 520, margin: "0 auto", background: "#fff", borderRadius: 16,
        padding: 40, textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#16a34a", marginBottom: 6 }}>เพิ่มพนักงานสำเร็จ</div>
        <div style={{ fontSize: 14, color: "#475569", marginBottom: 20 }}>
          ข้อมูลถูกบันทึกเข้า Master Database และส่งไปยังระบบประเมินพนักงานอัตโนมัติ
        </div>
        <div style={{ display: "inline-flex", flexDirection: "column", gap: 8, textAlign: "left",
          background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 12, padding: "16px 22px", marginBottom: 24 }}>
          <div><b>ชื่อ:</b> {fullName}</div>
          <div><b>สถานะ:</b> ทดลองงาน (Probation)</div>
          <div><b>ครบทดลองงาน:</b> {formatThaiDate(done.probation_end_date)} ({probDays} วัน)</div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => {
            setDone(null); setName(""); setStart(""); setDivId(""); setDeptId(""); setPos("");
            setType(""); setProbDays(119);
          }} style={{ padding: "11px 22px", borderRadius: 8, border: "1.5px solid #c4cfee",
            background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
            + เพิ่มคนถัดไป
          </button>
          <button onClick={onSaved} style={{ padding: "11px 22px", borderRadius: 8, border: "none",
            background: "#0891b2", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700 }}>
            ไปที่อัตรากำลังพนักงาน
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 16,
      padding: 32, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#0a1628", marginBottom: 4,
        display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0891b2" }} />
        เพิ่มพนักงานเริ่มงานใหม่
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 22, paddingLeft: 14 }}>
        ตั้งสถานะทดลองงานอัตโนมัติ · ส่งเข้าระบบประเมินทันที
      </div>

      <Field label="ชื่อ-นามสกุล *">
        <input value={fullName} onChange={e => setName(e.target.value)} style={inp} placeholder="ชื่อ นามสกุล" />
      </Field>
      <Field label="วันที่เริ่มงาน *">
        <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={inp} />
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
      <Field label="ตำแหน่ง">
        <input value={position} onChange={e => setPos(e.target.value)} style={inp} />
      </Field>
      <Field label="ประเภทพนักงาน">
        <input value={empType} onChange={e => setType(e.target.value)} style={inp} list="newhire-types" placeholder="เลือกหรือพิมพ์…" />
        <datalist id="newhire-types">{EMP_TYPES.map(t => <option key={t} value={t} />)}</datalist>
      </Field>
      <Field label="ระยะทดลองงาน (วัน)">
        <input type="number" value={probDays} onChange={e => setProbDays(Number(e.target.value))} style={inp} />
      </Field>

      {probEndPreview && (
        <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8,
          padding: "10px 14px", fontSize: 13, color: "#0f766e", marginBottom: 14 }}>
          📅 ครบทดลองงาน: <b>{formatThaiDate(probEndPreview)}</b> (เริ่มงาน + {probDays} วัน)
        </div>
      )}
      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 7,
          padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{error}</div>
      )}
      <button onClick={save} disabled={saving}
        style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none",
          background: "#0891b2", color: "#fff", fontWeight: 700, fontSize: 14,
          cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
        {saving ? "กำลังบันทึก…" : "บันทึกพนักงานใหม่"}
      </button>
    </div>
  );
}
