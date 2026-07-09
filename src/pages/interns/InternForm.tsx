import { useEffect, useState } from "react";

interface Division { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }
interface Institution { id: number; name: string; type: string | null; province: string | null; }

interface RotationRow {
  department_id: number | ""; division_id: number | "";
  start_date: string; end_date: string; supervisor_name: string; note: string;
}
interface PendingDoc { doc_type: string; file_name: string; url: string; }

export interface InternDetail {
  id: number; intern_code: string; prefix: string | null; first_name: string; last_name: string;
  education_level: string | null; faculty: string | null; major: string | null; year_level: string | null;
  phone: string | null; photo_url: string | null;
  institution_id: number | null; institution_name: string | null;
  advisor_name: string | null; advisor_phone: string | null; advisor_email: string | null;
  referral_letter_url: string | null;
  start_date: string; end_date: string; department_id: number | null; division_id: number | null;
  supervisor_name: string | null; supervisor_position: string | null;
  training_type: string | null; work_hours: string | null; note: string | null;
}

const TRAINING_TYPES = ["ฝึกงาน", "สหกิจศึกษา", "ดูงาน", "ฝึกประสบการณ์วิชาชีพ", "อื่นๆ"];
const INSTITUTION_TYPES = ["มหาวิทยาลัย", "วิทยาลัย", "โรงเรียน", "อื่นๆ"];

function daysBetween(start: string, end: string): number | null {
  if (!start || !end) return null;
  const s = new Date(start + "T00:00:00"), e = new Date(end + "T00:00:00");
  const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  return diff > 0 ? diff : null;
}

function readFileAsDataUrl(file: File, compress: boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
    if (!compress) { reader.onload = ev => resolve(ev.target?.result as string); reader.readAsDataURL(file); return; }
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        const MAX = 1000;
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
        if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.onerror = () => reject(new Error("อ่านรูปภาพไม่สำเร็จ"));
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export default function InternForm({ intern, onClose, onSaved }: {
  intern: InternDetail | null; onClose: () => void; onSaved: () => void;
}) {
  const isEdit = !!intern;

  // Section A
  const [prefix, setPrefix]       = useState(intern?.prefix ?? "");
  const [firstName, setFirstName] = useState(intern?.first_name ?? "");
  const [lastName, setLastName]   = useState(intern?.last_name ?? "");
  const [educationLevel, setEducationLevel] = useState(intern?.education_level ?? "");
  const [faculty, setFaculty]     = useState(intern?.faculty ?? "");
  const [major, setMajor]         = useState(intern?.major ?? "");
  const [yearLevel, setYearLevel] = useState(intern?.year_level ?? "");
  const [phone, setPhone]         = useState(intern?.phone ?? "");
  const [photoUrl, setPhotoUrl]   = useState(intern?.photo_url ?? "");

  // Section B
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [instQuery, setInstQuery]     = useState(intern?.institution_name ?? "");
  const [instId, setInstId]           = useState<number | "">(intern?.institution_id ?? "");
  const [instType, setInstType]       = useState("");
  const [instProvince, setInstProvince] = useState("");
  const [showInstList, setShowInstList] = useState(false);
  const [advisorName, setAdvisorName]   = useState(intern?.advisor_name ?? "");
  const [advisorPhone, setAdvisorPhone] = useState(intern?.advisor_phone ?? "");
  const [advisorEmail, setAdvisorEmail] = useState(intern?.advisor_email ?? "");
  const [referralUrl, setReferralUrl]   = useState(intern?.referral_letter_url ?? "");
  const [pendingDocs, setPendingDocs]   = useState<PendingDoc[]>([]);
  const [docUploading, setDocUploading] = useState(false);

  // Section C
  const [startDate, setStartDate] = useState(intern?.start_date ?? "");
  const [endDate, setEndDate]     = useState(intern?.end_date ?? "");
  const [divId, setDivId]         = useState<number | "">(intern?.division_id ?? "");
  const [deptId, setDeptId]       = useState<number | "">(intern?.department_id ?? "");
  const [supervisorName, setSupervisorName] = useState(intern?.supervisor_name ?? "");
  const [supervisorPosition, setSupervisorPosition] = useState(intern?.supervisor_position ?? "");
  const [trainingType, setTrainingType] = useState(intern?.training_type ?? TRAINING_TYPES[0]);
  const [workHours, setWorkHours] = useState(intern?.work_hours ?? "");
  const [note, setNote]           = useState(intern?.note ?? "");
  const [rotations, setRotations] = useState<RotationRow[]>([]);
  const [showRotations, setShowRotations] = useState(false);

  const [divisions, setDivisions]   = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[]; departments: Department[] }) => {
        setDivisions(d.divisions ?? []); setDepartments(d.departments ?? []);
      });
    if (isEdit && intern) {
      fetch(`/api/interns/${intern.id}`).then(r => r.json())
        .then((d: { ok: boolean; rotations?: { department_id: number | null; division_id: number | null; start_date: string; end_date: string; supervisor_name: string | null; note: string | null }[] }) => {
          if (d.ok && d.rotations && d.rotations.length > 0) {
            setRotations(d.rotations.map(r => ({
              department_id: r.department_id ?? "", division_id: r.division_id ?? "",
              start_date: r.start_date, end_date: r.end_date,
              supervisor_name: r.supervisor_name ?? "", note: r.note ?? "",
            })));
            setShowRotations(true);
          }
        });
    }
  }, [isEdit, intern]);

  useEffect(() => {
    if (!instQuery.trim()) { setInstitutions([]); return; }
    const t = setTimeout(() => {
      fetch(`/api/interns/institutions?q=${encodeURIComponent(instQuery.trim())}`).then(r => r.json())
        .then((d: { ok: boolean; institutions: Institution[] }) => setInstitutions(d.institutions ?? []));
    }, 200);
    return () => clearTimeout(t);
  }, [instQuery]);

  const filteredDepts = departments.filter(d => d.division_id === Number(divId));
  const days = daysBetween(startDate, endDate);

  function addRotation() {
    setRotations(r => [...r, { department_id: "", division_id: "", start_date: "", end_date: "", supervisor_name: "", note: "" }]);
  }
  function updateRotation(i: number, patch: Partial<RotationRow>) {
    setRotations(r => r.map((row, idx) => idx === i ? { ...row, ...patch } : row));
  }
  function removeRotation(i: number) {
    setRotations(r => r.filter((_, idx) => idx !== i));
  }

  async function onDocPick(e: React.ChangeEvent<HTMLInputElement>, docType: string) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setDocUploading(true); setErr("");
    try {
      const url = await readFileAsDataUrl(file, file.type.startsWith("image/"));
      if (docType === "หนังสือส่งตัว") setReferralUrl(url);
      else setPendingDocs(p => [...p, { doc_type: docType, file_name: file.name, url }]);
    } catch {
      setErr("อัปโหลดไฟล์ไม่สำเร็จ");
    } finally {
      setDocUploading(false);
    }
  }

  async function ensureInstitutionId(): Promise<number | null> {
    if (instId) return instId;
    const name = instQuery.trim();
    if (!name) return null;
    const r = await fetch("/api/interns/institutions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: instType || null, province: instProvince || null }),
    });
    const d = await r.json() as { ok: boolean; id?: number };
    return d.ok ? d.id ?? null : null;
  }

  async function handleSave() {
    setErr("");
    if (!firstName.trim() || !lastName.trim()) { setErr("กรุณากรอกชื่อ-นามสกุล"); return; }
    if (!startDate || !endDate) { setErr("กรุณากรอกวันที่เริ่มและสิ้นสุดการฝึกงาน"); return; }
    if (endDate < startDate) { setErr("วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม"); return; }

    setSaving(true);
    try {
      const institutionId = await ensureInstitutionId();
      const payload = {
        prefix: prefix || null, first_name: firstName.trim(), last_name: lastName.trim(),
        education_level: educationLevel || null, faculty: faculty || null, major: major || null,
        year_level: yearLevel || null, phone: phone || null, photo_url: photoUrl || null,
        institution_id: institutionId, advisor_name: advisorName || null, advisor_phone: advisorPhone || null,
        advisor_email: advisorEmail || null, referral_letter_url: referralUrl || null,
        start_date: startDate, end_date: endDate, department_id: deptId || null, division_id: divId || null,
        supervisor_name: supervisorName || null, supervisor_position: supervisorPosition || null,
        training_type: trainingType || null, work_hours: workHours || null, note: note || null,
      };

      let internId = intern?.id;
      if (isEdit && internId) {
        const r = await fetch(`/api/interns/${internId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const d = await r.json() as { ok: boolean; error?: string };
        if (!d.ok) { setErr(d.error ?? "บันทึกไม่สำเร็จ"); setSaving(false); return; }
      } else {
        const r = await fetch("/api/interns", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
        });
        const d = await r.json() as { ok: boolean; error?: string; id?: number };
        if (!d.ok || !d.id) { setErr(d.error ?? "บันทึกไม่สำเร็จ"); setSaving(false); return; }
        internId = d.id;
      }

      // Rotations — replace full set
      if (internId) {
        await fetch(`/api/interns/${internId}/rotations`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rotations: rotations.filter(r => r.start_date && r.end_date).map(r => ({
            department_id: r.department_id || null, division_id: r.division_id || null,
            start_date: r.start_date, end_date: r.end_date,
            supervisor_name: r.supervisor_name || null, note: r.note || null,
          })) }),
        });
        // Pending extra documents
        for (const doc of pendingDocs) {
          await fetch(`/api/interns/${internId}/documents`, {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(doc),
          });
        }
      }

      onSaved();
    } catch {
      setErr("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setSaving(false);
    }
  }

  const inp: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 8,
    border: "1.5px solid #dce4f5", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
  const lbl: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#475569", marginBottom: 5 };
  const row2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 };
  const field = (label: string) => <label style={lbl}>{label}</label>;

  function SectionTitle({ children }: { children: React.ReactNode }) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "22px 0 14px",
        fontSize: 13, fontWeight: 800, color: "#7c3aed" }}>
        <div style={{ width: 4, height: 15, borderRadius: 2, background: "#7c3aed" }} />
        {children}
      </div>
    );
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.5)", zIndex: 300,
        display: "flex", justifyContent: "flex-end" }}>
      <div style={{ width: "min(640px, 100vw)", height: "100vh", background: "#fff",
        display: "flex", flexDirection: "column", boxShadow: "-8px 0 32px rgba(0,0,0,.18)" }}>

        {/* Header */}
        <div style={{ padding: "20px 26px", borderBottom: "1px solid #f1f5f9",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628" }}>
              {isEdit ? "แก้ไขข้อมูลนักศึกษาฝึกงาน" : "+ เพิ่มนักศึกษาฝึกงาน"}
            </div>
            {intern?.intern_code && (
              <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>{intern.intern_code}</div>
            )}
            {!isEdit && (
              <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>รหัสนักศึกษาฝึกงานจะสร้างอัตโนมัติเมื่อบันทึก</div>
            )}
          </div>
          <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: 8,
            width: 32, height: 32, cursor: "pointer", fontSize: 16, color: "#64748b" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 26px" }}>

          <SectionTitle>👤 ข้อมูลนักศึกษา</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr", gap: 12, marginBottom: 14 }}>
            <div>{field("คำนำหน้า")}<input style={inp} value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="นาย/นางสาว" /></div>
            <div>{field("ชื่อ *")}<input style={inp} value={firstName} onChange={e => setFirstName(e.target.value)} /></div>
            <div>{field("นามสกุล *")}<input style={inp} value={lastName} onChange={e => setLastName(e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div>{field("ระดับการศึกษา")}<input style={inp} value={educationLevel} onChange={e => setEducationLevel(e.target.value)} placeholder="เช่น ปริญญาตรี" /></div>
            <div>{field("ชั้นปี")}<input style={inp} value={yearLevel} onChange={e => setYearLevel(e.target.value)} placeholder="เช่น ปี 3" /></div>
          </div>
          <div style={row2}>
            <div>{field("คณะ")}<input style={inp} value={faculty} onChange={e => setFaculty(e.target.value)} /></div>
            <div>{field("สาขาวิชา")}<input style={inp} value={major} onChange={e => setMajor(e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div>{field("เบอร์โทรศัพท์")}<input style={inp} value={phone} onChange={e => setPhone(e.target.value)} /></div>
            <div>
              {field("รูปนักศึกษา (ไม่บังคับ)")}
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {photoUrl && <img src={photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }} />}
                <input type="file" accept="image/*" onChange={async e => {
                  const file = e.target.files?.[0]; e.target.value = "";
                  if (!file) return;
                  try { setPhotoUrl(await readFileAsDataUrl(file, true)); } catch { setErr("อัปโหลดรูปไม่สำเร็จ"); }
                }} style={{ fontSize: 12, fontFamily: "inherit" }} />
              </div>
            </div>
          </div>

          <SectionTitle>🏫 ข้อมูลสถาบันการศึกษา</SectionTitle>
          <div style={{ marginBottom: 14, position: "relative" }}>
            {field("ชื่อสถาบันการศึกษา")}
            <input style={inp} value={instQuery}
              onChange={e => { setInstQuery(e.target.value); setInstId(""); setShowInstList(true); }}
              onFocus={() => setShowInstList(true)}
              placeholder="ค้นหาหรือพิมพ์ชื่อสถาบันใหม่..." />
            {showInstList && institutions.length > 0 && (
              <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                border: "1.5px solid #dce4f5", borderRadius: 8, marginTop: 4, zIndex: 10,
                maxHeight: 180, overflowY: "auto", boxShadow: "0 8px 24px rgba(0,0,0,.1)" }}>
                {institutions.map(i => (
                  <div key={i.id} onClick={() => { setInstId(i.id); setInstQuery(i.name); setShowInstList(false); }}
                    style={{ padding: "8px 12px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #f8fafc" }}
                    onMouseDown={e => e.preventDefault()}>
                    {i.name} {i.type && <span style={{ color: "#94a3b8", fontSize: 11 }}>· {i.type}</span>}
                  </div>
                ))}
              </div>
            )}
            {!instId && instQuery.trim() && (
              <div style={{ fontSize: 11, color: "#b45309", marginTop: 4 }}>⚠️ ไม่พบในระบบ — จะเพิ่มเป็นสถาบันใหม่เมื่อบันทึก</div>
            )}
          </div>
          {!instId && instQuery.trim() && (
            <div style={row2}>
              <div>
                {field("ประเภทสถาบัน")}
                <select style={inp} value={instType} onChange={e => setInstType(e.target.value)}>
                  <option value="">-- เลือก --</option>
                  {INSTITUTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>{field("จังหวัด")}<input style={inp} value={instProvince} onChange={e => setInstProvince(e.target.value)} /></div>
            </div>
          )}
          <div style={row2}>
            <div>{field("ชื่ออาจารย์ผู้ประสานงาน")}<input style={inp} value={advisorName} onChange={e => setAdvisorName(e.target.value)} /></div>
            <div>{field("เบอร์โทรอาจารย์ผู้ประสานงาน")}<input style={inp} value={advisorPhone} onChange={e => setAdvisorPhone(e.target.value)} /></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            {field("Email ผู้ประสานงาน")}<input style={inp} value={advisorEmail} onChange={e => setAdvisorEmail(e.target.value)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            {field("หนังสือส่งตัวจากสถาบัน")}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <input type="file" accept="image/*,.pdf" onChange={e => onDocPick(e, "หนังสือส่งตัว")} style={{ fontSize: 12, fontFamily: "inherit" }} />
              {referralUrl && <span style={{ fontSize: 11, color: "#16a34a", fontWeight: 700 }}>✓ อัปโหลดแล้ว</span>}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            {field("เอกสารประกอบอื่นๆ")}
            <input type="file" accept="image/*,.pdf" onChange={e => onDocPick(e, "เอกสารประกอบ")} style={{ fontSize: 12, fontFamily: "inherit" }} disabled={docUploading} />
            {pendingDocs.length > 0 && (
              <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                {pendingDocs.map((d, i) => (
                  <div key={i} style={{ fontSize: 11.5, color: "#475569", display: "flex", alignItems: "center", gap: 6 }}>
                    📎 {d.file_name}
                    <button onClick={() => setPendingDocs(p => p.filter((_, idx) => idx !== i))}
                      style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 11 }}>ลบ</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <SectionTitle>📋 รายละเอียดการฝึกงาน</SectionTitle>
          <div style={row2}>
            <div>{field("วันที่เริ่มฝึกงาน *")}<input type="date" style={inp} value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
            <div>{field("วันที่สิ้นสุดการฝึกงาน *")}<input type="date" style={inp} value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          </div>
          {days !== null && (
            <div style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", borderRadius: 8,
              padding: "8px 14px", fontSize: 12.5, color: "#6d28d9", fontWeight: 700, marginBottom: 14 }}>
              ⏱ ระยะเวลาฝึกงาน {days} วัน
            </div>
          )}
          <div style={row2}>
            <div>
              {field("ฝ่าย")}
              <select style={inp} value={divId} onChange={e => { setDivId(e.target.value ? Number(e.target.value) : ""); setDeptId(""); }}>
                <option value="">-- เลือกฝ่าย --</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              {field("แผนกที่เข้าฝึก")}
              <select style={inp} value={deptId} onChange={e => setDeptId(e.target.value ? Number(e.target.value) : "")} disabled={!divId}>
                <option value="">-- เลือกแผนก --</option>
                {filteredDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div style={row2}>
            <div>{field("ผู้ควบคุมการฝึกงาน")}<input style={inp} value={supervisorName} onChange={e => setSupervisorName(e.target.value)} /></div>
            <div>{field("ตำแหน่งผู้ควบคุม")}<input style={inp} value={supervisorPosition} onChange={e => setSupervisorPosition(e.target.value)} /></div>
          </div>
          <div style={row2}>
            <div>
              {field("รูปแบบการฝึก")}
              <select style={inp} value={trainingType} onChange={e => setTrainingType(e.target.value)}>
                {TRAINING_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>{field("เวลาปฏิบัติงาน")}<input style={inp} value={workHours} onChange={e => setWorkHours(e.target.value)} placeholder="เช่น 08:00–16:00 น." /></div>
          </div>
          <div style={{ marginBottom: 14 }}>
            {field("หมายเหตุ")}
            <textarea style={{ ...inp, minHeight: 60, resize: "vertical" as const }} value={note} onChange={e => setNote(e.target.value)} />
          </div>

          {/* Rotation editor */}
          <div style={{ marginTop: 20 }}>
            {!showRotations ? (
              <button onClick={() => { setShowRotations(true); addRotation(); }}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1.5px dashed #c4b5fd",
                  background: "#f5f3ff", color: "#7c3aed", fontWeight: 700, fontSize: 12.5,
                  cursor: "pointer", fontFamily: "inherit" }}>
                + เพิ่มการหมุนเวียนแผนก (Rotation)
              </button>
            ) : (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#6d28d9" }}>ตาราง Rotation</div>
                  <button onClick={addRotation}
                    style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid #c4b5fd",
                      background: "#f5f3ff", color: "#7c3aed", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                    + เพิ่มแถว
                  </button>
                </div>
                {rotations.map((r, i) => {
                  const rDepts = departments.filter(d => d.division_id === Number(r.division_id));
                  return (
                    <div key={i} style={{ background: "#faf9ff", border: "1px solid #ede9fe", borderRadius: 10,
                      padding: "12px 14px", marginBottom: 10 }}>
                      <div style={row2}>
                        <div>{field("วันที่เริ่ม")}<input type="date" style={inp} value={r.start_date} onChange={e => updateRotation(i, { start_date: e.target.value })} /></div>
                        <div>{field("วันที่สิ้นสุด")}<input type="date" style={inp} value={r.end_date} onChange={e => updateRotation(i, { end_date: e.target.value })} /></div>
                      </div>
                      <div style={row2}>
                        <div>
                          {field("ฝ่าย")}
                          <select style={inp} value={r.division_id} onChange={e => updateRotation(i, { division_id: e.target.value ? Number(e.target.value) : "", department_id: "" })}>
                            <option value="">-- เลือกฝ่าย --</option>
                            {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                        <div>
                          {field("แผนก")}
                          <select style={inp} value={r.department_id} onChange={e => updateRotation(i, { department_id: e.target.value ? Number(e.target.value) : "" })} disabled={!r.division_id}>
                            <option value="">-- เลือกแผนก --</option>
                            {rDepts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                        <div style={{ flex: 1 }}>{field("ผู้ควบคุม")}<input style={inp} value={r.supervisor_name} onChange={e => updateRotation(i, { supervisor_name: e.target.value })} /></div>
                        <button onClick={() => removeRotation(i)}
                          style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid #fecaca",
                            background: "#fff5f5", color: "#dc2626", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>ลบ</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {err && (
            <div style={{ marginTop: 16, background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: 12.5, color: "#dc2626" }}>{err}</div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "16px 26px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} disabled={saving}
            style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1.5px solid #e2e8f0",
              background: "#fff", color: "#64748b", fontWeight: 700, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
            ยกเลิก
          </button>
          <button onClick={handleSave} disabled={saving}
            style={{ flex: 2, padding: "11px 0", borderRadius: 9, border: "none",
              background: saving ? "#c4b5fd" : "#7c3aed", color: "#fff", fontWeight: 800, fontSize: 13.5,
              cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังบันทึก…" : "บันทึกข้อมูล"}
          </button>
        </div>
      </div>
    </div>
  );
}
