import { useEffect, useMemo, useState } from "react";
import { formatThaiDate, toGregorian } from "../../utils/date";
import { EMP_TYPES } from "./MasterEmployeeForm";
import { MANPOWER_ROWS } from "../../data/manpowerPlan";

interface Division { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }

/* ── Position lookup from manpowerPlan ── */
const POSITIONS_BY_PLAN_DIV_ID = (() => {
  const map = new Map<number, string[]>();
  for (const row of MANPOWER_ROWS) {
    if (row.type === "slot" && row.pos.trim()) {
      const arr = map.get(row.divId) ?? [];
      if (!arr.includes(row.pos)) arr.push(row.pos);
      map.set(row.divId, arr);
    }
  }
  return map;
})();

const PLAN_NAME_TO_DIV_ID = (() => {
  const map = new Map<string, number>();
  for (const row of MANPOWER_ROWS) {
    if (row.type === "division") map.set(row.name, row.divId);
  }
  map.set("ฝ่ายบัญชี", 5);
  map.set("ฝ่ายการพยาบาลส่วนใน", 8);
  map.set("ฝ่ายการพยาบาลส่วนหน้า", 9);
  map.set("ศูนย์มะเร็ง", 11);
  map.set("ฝ่ายบริการ", 10);
  return map;
})();

function getPlanDivId(divName: string): number | null {
  if (!divName) return null;
  if (PLAN_NAME_TO_DIV_ID.has(divName)) return PLAN_NAME_TO_DIV_ID.get(divName)!;
  for (const [planName, id] of PLAN_NAME_TO_DIV_ID) {
    if (planName.includes(divName) || divName.includes(planName)) return id;
  }
  return null;
}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 700, color: "#0038c6", letterSpacing: "0.1em",
      textTransform: "uppercase", marginTop: 18, marginBottom: 12, paddingBottom: 8,
      borderBottom: "1.5px solid #eef3ff", display: "flex", alignItems: "center", gap: 6 }}>
      {children}
    </div>
  );
}

export default function NewHireTab({ onSaved }: { onSaved: () => void }) {
  const [divisions, setDivs]    = useState<Division[]>([]);
  const [departments, setDeps]  = useState<Department[]>([]);
  const [fullName, setName]     = useState("");
  const [nameEn, setNameEn]     = useState("");
  const [startDate, setStart]   = useState("");
  const [divId, setDivId]       = useState<number | "">("");
  const [deptId, setDeptId]     = useState<number | "">("");
  const [position, setPos]      = useState("");
  const [empType, setType]      = useState("");
  const [probDays, setProbDays] = useState(119);
  // License
  const [licenseNo, setLicNo]   = useState("");
  const [licenseExp, setLicExp] = useState("");
  // Vehicles
  const [car1, setCar1]         = useState("");
  const [car2, setCar2]         = useState("");
  const [moto1, setMoto1]       = useState("");
  const [moto2, setMoto2]       = useState("");

  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState<{ probation_end_date: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[] }) => {
        setDivs(d.divisions ?? []); setDeps(d.departments ?? []);
      });
  }, []);

  const filteredDepts = departments.filter(d => d.division_id === Number(divId));

  const positionOptions = useMemo(() => {
    const sel = divisions.find(d => d.id === Number(divId));
    if (!sel) return [];
    const planId = getPlanDivId(sel.name);
    return planId !== null ? (POSITIONS_BY_PLAN_DIV_ID.get(planId) ?? []) : [];
  }, [divId, divisions]);

  const handleDivChange = (val: number | "") => {
    setDivId(val); setDeptId(""); setPos("");
  };

  const probEndPreview = useMemo(() => {
    if (!startDate) return null;
    const d = toGregorian(startDate);
    d.setDate(d.getDate() + (probDays || 0));
    return d.toISOString().slice(0, 10);
  }, [startDate, probDays]);

  // Days until license expiry preview
  const licDaysLeft = useMemo(() => {
    if (!licenseExp) return null;
    const diff = Math.ceil((new Date(licenseExp).getTime() - Date.now()) / 86400000);
    return diff;
  }, [licenseExp]);

  function reset() {
    setName(""); setNameEn(""); setStart(""); setDivId(""); setDeptId(""); setPos("");
    setType(""); setProbDays(119);
    setLicNo(""); setLicExp("");
    setCar1(""); setCar2(""); setMoto1(""); setMoto2("");
  }

  async function save() {
    if (!fullName.trim()) { setError("กรุณากรอกชื่อพนักงาน"); return; }
    if (!startDate) { setError("กรุณาระบุวันที่เริ่มงาน"); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/manpower/new-hire", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName, name_en: nameEn || null, start_date: startDate,
          department_id: deptId || null, division_id: divId || null,
          position: position || null, emp_type: empType || null, probation_days: probDays,
          license_number: licenseNo || null, license_expiry: licenseExp || null,
          car_plate_1: car1 || null, car_plate_2: car2 || null,
          moto_plate_1: moto1 || null, moto_plate_2: moto2 || null,
        }),
      });
      let d: { ok: boolean; error?: string; probation_end_date?: string | null };
      try {
        d = await r.json() as typeof d;
      } catch {
        throw new Error(`Server error (${r.status})`);
      }
      if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
      setDone({ probation_end_date: d.probation_end_date ?? null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSaving(false);
    }
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
          {position && <div><b>ตำแหน่ง:</b> {position}</div>}
          {licenseNo && <div><b>ใบประกอบวิชาชีพ:</b> {licenseNo}{licenseExp ? ` (หมด ${formatThaiDate(licenseExp)})` : ""}</div>}
          <div><b>สถานะ:</b> ทดลองงาน (Probation)</div>
          <div><b>ครบทดลองงาน:</b> {formatThaiDate(done.probation_end_date)} ({probDays} วัน)</div>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button onClick={() => { setDone(null); reset(); }}
            style={{ padding: "11px 22px", borderRadius: 8, border: "1.5px solid #c4cfee",
              background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600 }}>
            + เพิ่มคนถัดไป
          </button>
          <button onClick={onSaved}
            style={{ padding: "11px 22px", borderRadius: 8, border: "none",
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

      {/* ── ข้อมูลทั่วไป ── */}
      <Field label="ชื่อ-นามสกุล (ไทย) *">
        <input value={fullName} onChange={e => setName(e.target.value)} style={inp} placeholder="ชื่อ นามสกุล" />
      </Field>
      <Field label="ชื่อ-นามสกุล (English)" hint="ใช้สำหรับบัตรพนักงาน Canva">
        <input value={nameEn} onChange={e => setNameEn(e.target.value)} style={inp} placeholder="Firstname Lastname" />
      </Field>
      <Field label="วันที่เริ่มงาน *">
        <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={inp} />
      </Field>
      <Field label="ฝ่าย">
        <select value={divId} onChange={e => handleDivChange(e.target.value ? Number(e.target.value) : "")} style={inp}>
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
      <Field label={`ตำแหน่ง${positionOptions.length > 0 ? ` (${positionOptions.length} ตำแหน่ง)` : ""}`}>
        {positionOptions.length > 0 ? (
          <select value={position} onChange={e => setPos(e.target.value)} style={inp}>
            <option value="">-- เลือกตำแหน่ง --</option>
            {positionOptions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        ) : (
          <input value={position} onChange={e => setPos(e.target.value)} style={inp}
            placeholder={divId ? "พิมพ์ตำแหน่ง" : "เลือกฝ่ายก่อน"} />
        )}
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

      {/* ── ใบประกอบวิชาชีพ ── */}
      <SectionLabel>📋 ใบประกอบวิชาชีพ (ถ้ามี)</SectionLabel>
      <Field label="เลขใบประกอบวิชาชีพ">
        <input value={licenseNo} onChange={e => setLicNo(e.target.value)} style={inp}
          placeholder="เช่น ภ.12345, ร.ส.6789" />
      </Field>
      <Field label="วันหมดอายุใบประกอบ">
        <input type="date" value={licenseExp} onChange={e => setLicExp(e.target.value)} style={inp} />
        {licenseExp && licDaysLeft !== null && (
          <div style={{
            marginTop: 6, fontSize: 12, fontWeight: 700, padding: "5px 10px", borderRadius: 6, display: "inline-block",
            ...(licDaysLeft <= 15
              ? { background: "#fee2e2", color: "#dc2626" }
              : licDaysLeft <= 30
                ? { background: "#fefce8", color: "#b45309" }
                : { background: "#f0fdf4", color: "#16a34a" }),
          }}>
            {licDaysLeft < 0
              ? `⛔ หมดอายุแล้ว ${Math.abs(licDaysLeft)} วัน`
              : licDaysLeft <= 15
                ? `🔴 หมดใน ${licDaysLeft} วัน — ต้องต่อทะเบียนด่วน`
                : licDaysLeft <= 30
                  ? `🟡 หมดใน ${licDaysLeft} วัน — เตรียมต่ออายุ`
                  : `✅ ยังมีอายุ ${licDaysLeft} วัน`}
          </div>
        )}
      </Field>

      {/* ── ทะเบียนรถ ── */}
      <SectionLabel>🚗 ทะเบียนรถยนต์ (สูงสุด 2 คัน)</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>คันที่ 1</label>
          <input value={car1} onChange={e => setCar1(e.target.value)} style={inp} placeholder="เช่น กก-1234" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>คันที่ 2</label>
          <input value={car2} onChange={e => setCar2(e.target.value)} style={inp} placeholder="เช่น ขข-5678" />
        </div>
      </div>

      <SectionLabel>🏍️ ทะเบียนรถมอเตอร์ไซ์ (สูงสุด 2 คัน)</SectionLabel>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>คันที่ 1</label>
          <input value={moto1} onChange={e => setMoto1(e.target.value)} style={inp} placeholder="เช่น คค-1234" />
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
            letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>คันที่ 2</label>
          <input value={moto2} onChange={e => setMoto2(e.target.value)} style={inp} placeholder="เช่น งง-5678" />
        </div>
      </div>

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
