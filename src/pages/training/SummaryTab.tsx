import { useEffect, useState } from "react";

interface Course { id: number; course_code: string; course: string; course_type: string; course_date: string | null; start_time: string | null; end_time: string | null; location: string | null; trainer: string | null; target: number; actual: number; status: string; objectives: string | null; reg_open: number; }

function toThaiTime(utc: string | null): string {
  if (!utc) return "—";
  const d = new Date(utc.replace(" ", "T") + (utc.includes("Z") ? "" : "Z"));
  return new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16).replace("T", " ");
}
interface Reg { id: number; emp_code: string | null; name: string; department: string | null; position: string | null; attendance_status: string; checkin_time: string | null; reg_method: string; participant_type?: string; }
interface Photo { id: number; course_id: number; url: string; photo_type: string; caption: string | null; uploaded_at: string; }
interface Survey { id: number; q1: number; q2: number; q3: number; q4: number; q5: number; comment: string | null; submitted_at: string; }

const STATUS_COLOR: Record<string, string> = { registered: "#94a3b8", checked_in: "#16a34a", late: "#d97706", absent: "#dc2626", completed: "#0038C6" };
const STATUS_LABEL: Record<string, string> = { registered: "ลงทะเบียน", checked_in: "เช็คชื่อ", late: "สาย", absent: "ขาด", completed: "เสร็จ" };

const Q_LABELS = [
  "เนื้อหาเหมาะสม", "วิทยากรชัดเจน", "นำไปใช้ได้จริง", "ระยะเวลาเหมาะสม", "พึงพอใจโดยรวม",
];

function satLevel(pct: number) {
  if (pct >= 90) return { label: "ดีเยี่ยม",    color: "#16a34a" };
  if (pct >= 80) return { label: "ดีมาก",        color: "#0038C6" };
  if (pct >= 70) return { label: "ดี",            color: "#059669" };
  if (pct >= 60) return { label: "พอใช้",         color: "#d97706" };
  return             { label: "ควรปรับปรุง",  color: "#dc2626" };
}

interface Props { canEdit: boolean; initCourseId: number | null; }

export default function SummaryTab({ canEdit, initCourseId }: Props) {
  const [courses, setCourses]   = useState<Course[]>([]);
  const [selId, setSelId]       = useState<number | "">("");
  const [course, setCourse]     = useState<Course | null>(null);
  const [surveys, setSurveys]   = useState<Survey[]>([]);
  const [regs, setRegs]         = useState<Reg[]>([]);
  const [photos, setPhotos]     = useState<Photo[]>([]);
  const [loading, setLoading]   = useState(false);
  const [photoType, setPhotoType] = useState<"activity" | "trainer" | "participant">("activity");
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [lightbox, setLightbox]           = useState<Photo | null>(null);
  const [uploadFiles,    setUploadFiles]    = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [uploading,      setUploading]      = useState(false);

  useEffect(() => {
    fetch("/api/training/courses")
      .then(r => r.json() as Promise<{ ok: boolean; courses: Course[] }>)
      .then(d => {
        setCourses(d.courses ?? []);
        const startId = initCourseId ?? (d.courses[0]?.id ?? "");
        if (startId) setSelId(startId as number);
      });
  }, [initCourseId]);

  useEffect(() => {
    if (!selId) return;
    loadAll(selId as number);
  }, [selId]);

  async function toggleRegOpen() {
    if (!course || !selId) return;
    const newVal = course.reg_open ? 0 : 1;
    await fetch(`/api/training/courses/${selId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_reg", reg_open: newVal === 1 }),
    });
    setCourse({ ...course, reg_open: newVal });
  }

  async function loadAll(id: number) {
    setLoading(true);
    const [regRes, photoRes, courseRes, surveyRes] = await Promise.all([
      fetch(`/api/training/registrations?course_id=${id}`).then(r => r.json() as Promise<{ ok: boolean; registrations: Reg[] }>),
      fetch(`/api/training/photos?course_id=${id}`).then(r => r.json() as Promise<{ ok: boolean; photos: Photo[] }>),
      fetch(`/api/training/courses?`).then(r => r.json() as Promise<{ ok: boolean; courses: Course[] }>),
      fetch(`/api/training/survey?course_id=${id}`).then(r => r.json() as Promise<{ ok: boolean; surveys: Survey[] }>),
    ]);
    setRegs(regRes.registrations ?? []);
    setPhotos(photoRes.photos ?? []);
    setCourse((courseRes.courses ?? []).find(c => c.id === id) ?? null);
    setSurveys(surveyRes.surveys ?? []);
    setLoading(false);
  }

  function compressImage(file: File): Promise<string> {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          const MAX = 800;
          if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
          if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
          const canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.75));
        };
        img.src = ev.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - photos.length);
    if (!files.length) return;
    setUploadFiles(prev => [...prev, ...files].slice(0, 3));
    files.forEach(f => {
      const reader = new FileReader();
      reader.onload = ev => setUploadPreviews(prev => [...prev, ev.target?.result as string].slice(0, 3));
      reader.readAsDataURL(f);
    });
    e.target.value = "";
  }

  function removePreview(i: number) {
    setUploadFiles(prev => prev.filter((_, idx) => idx !== i));
    setUploadPreviews(prev => prev.filter((_, idx) => idx !== i));
  }

  async function uploadPhotos() {
    if (!uploadFiles.length) return;
    setUploading(true);
    for (const file of uploadFiles) {
      const dataUrl = await compressImage(file);
      await fetch("/api/training/photos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course_id: selId, url: dataUrl, photo_type: photoType, caption: null }),
      });
    }
    setUploadFiles([]); setUploadPreviews([]); setShowPhotoForm(false); setUploading(false);
    loadAll(selId as number);
  }

  async function deletePhoto(id: number) {
    await fetch(`/api/training/photos/${id}`, { method: "DELETE" });
    loadAll(selId as number);
  }

  function printList() {
    if (!course) return;
    const attendees = regs.filter(r => !r.participant_type || r.participant_type === "attendee");
    const trainers  = regs.filter(r => r.participant_type === "trainer");
    const checked   = regs.filter(r => ["checked_in", "late", "completed"].includes(r.attendance_status)).length;
    const badgeClass = (s: string) => s === "checked_in" ? "bc" : s === "late" ? "bl" : s === "absent" ? "ba" : "br";
    const badgeLabel = (s: string) => s === "checked_in" ? "เช็คชื่อ" : s === "late" ? "สาย" : s === "absent" ? "ขาด" : "ลงทะเบียน";
    const win = window.open("", "_blank", "width=1000,height=750");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="th"><head><meta charset="UTF-8">
<title>รายชื่อผู้เข้าอบรม</title>
<style>
  @page{size:A4;margin:18mm}
  body{font-family:Sarabun,Arial,sans-serif;font-size:11pt;color:#111;margin:0}
  .hdr{display:flex;align-items:center;gap:14px;border-bottom:3px solid #0038C6;padding-bottom:12px;margin-bottom:16px}
  .logo{width:44px;height:44px;background:#0038C6;border-radius:8px;color:#fff;font-weight:900;font-size:10pt;display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.2;flex-shrink:0}
  h1{font-size:15pt;color:#0038C6;margin:0 0 2px}
  .sub{font-size:9pt;color:#64748b}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;font-size:10pt;margin-bottom:16px;background:#f0f5ff;padding:10px 14px;border-radius:6px;border:1px solid #dce4f5}
  table{width:100%;border-collapse:collapse;font-size:10pt}
  th{background:#e8eeff;color:#0038C6;border:1px solid #c4cfee;padding:7px 10px;text-align:left}
  td{border:1px solid #dce4f5;padding:6px 10px;vertical-align:middle}
  tr:nth-child(even) td{background:#f8faff}
  .bc{background:#dcfce7;color:#16a34a;padding:1px 7px;border-radius:4px;font-size:9pt}
  .bl{background:#fef3c7;color:#d97706;padding:1px 7px;border-radius:4px;font-size:9pt}
  .ba{background:#fee2e2;color:#dc2626;padding:1px 7px;border-radius:4px;font-size:9pt}
  .br{background:#f0f5ff;color:#0038C6;padding:1px 7px;border-radius:4px;font-size:9pt}
  .sect{background:#eff4ff;color:#0038C6;font-weight:700;padding:7px 10px;border:1px solid #c4cfee}
  .summary{margin-top:14px;font-size:10pt;display:flex;gap:20px}
  .sig{margin-top:44px;display:grid;grid-template-columns:1fr 1fr;gap:50px}
  .sigbox{text-align:center;font-size:10pt}
  .sigline{border-top:1px solid #000;margin-bottom:6px}
  .foot{margin-top:16px;font-size:8pt;color:#94a3b8;text-align:right}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="hdr">
  <div class="logo">RAM+</div>
  <div>
    <div class="sub">โรงพยาบาลเชียงราย ราม · Human Resource Development</div>
    <h1>${course.course}</h1>
    <div class="sub">${course.course_code}</div>
  </div>
</div>
<div class="meta">
  <div>📅 วันที่อบรม : <strong>${course.course_date ?? "—"}</strong></div>
  <div>🕐 เวลา : <strong>${course.start_time ?? "—"} – ${course.end_time ?? "—"} น.</strong></div>
  <div>📍 สถานที่ : <strong>${course.location ?? "—"}</strong></div>
  <div>👤 วิทยากร : <strong>${course.trainer ?? "—"}</strong></div>
  <div>🎯 เป้าหมาย : <strong>${course.target} คน</strong></div>
  <div>✅ เช็คชื่อ : <strong>${checked} / ${regs.length} คน</strong></div>
</div>
<table>
<thead><tr><th>#</th><th>รหัสพนักงาน</th><th>ชื่อ-นามสกุล</th><th>แผนก</th><th>ตำแหน่ง</th><th>เวลาเช็คชื่อ</th><th>สถานะ</th><th style="width:80px">ลายเซ็น</th></tr></thead>
<tbody>
${attendees.map((r, i) => {
  const ct = r.checkin_time
    ? (() => { const d = new Date((r.checkin_time as string).replace(" ","T") + ((r.checkin_time as string).includes("Z") ? "" : "Z")); return new Date(d.getTime() + 7*3600000).toISOString().slice(0,16).replace("T"," "); })()
    : "—";
  return `<tr>
  <td>${i + 1}</td>
  <td style="font-family:monospace;font-size:9pt">${r.emp_code ?? "—"}</td>
  <td><strong>${r.name}</strong></td>
  <td>${r.department ?? "—"}</td>
  <td>${r.position ?? "—"}</td>
  <td>${ct}</td>
  <td><span class="${badgeClass(r.attendance_status)}">${badgeLabel(r.attendance_status)}</span></td>
  <td></td>
</tr>`;}).join("")}
${trainers.length > 0 ? `<tr><td colspan="8" class="sect">🎤 วิทยากร</td></tr>
${trainers.map((r, i) => `<tr><td>${i + 1}</td><td style="font-family:monospace;font-size:9pt">${r.emp_code ?? "—"}</td><td><strong>${r.name}</strong></td><td>${r.department ?? "—"}</td><td>${r.position ?? "—"}</td><td colspan="3"></td></tr>`).join("")}` : ""}
</tbody></table>
<div class="summary">
  <span>ลงทะเบียนทั้งหมด <strong>${regs.length}</strong> คน</span>
  <span>เช็คชื่อแล้ว <strong>${checked}</strong> คน</span>
  <span>สาย <strong>${regs.filter(r => r.attendance_status === "late").length}</strong> คน</span>
  <span>ขาด <strong>${regs.filter(r => r.attendance_status === "absent").length}</strong> คน</span>
</div>
<div class="sig">
  <div class="sigbox"><div style="height:44px"></div><div class="sigline"></div><div>ผู้รับผิดชอบโครงการ</div></div>
  <div class="sigbox"><div style="height:44px"></div><div class="sigline"></div><div>ฝ่ายทรัพยากรบุคคล (HRD)</div></div>
</div>
<div class="foot">พิมพ์เมื่อ ${new Date().toLocaleString("th-TH")}</div>
<div class="noprint" style="margin-top:16px">
  <button onclick="window.print()" style="padding:9px 24px;background:#0038C6;color:#fff;border:none;border-radius:7px;cursor:pointer;font-size:12pt">🖨️ พิมพ์รายชื่อ</button>
</div>
</body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  }

  const checkedIn = regs.filter(r => ["checked_in", "late", "completed"].includes(r.attendance_status)).length;
  const pct       = regs.length > 0 ? Math.round(checkedIn / regs.length * 100) : 0;

  const PHOTO_GROUPS = [
    { key: "activity",    label: "🎯 กิจกรรม" },
    { key: "trainer",     label: "👤 วิทยากร" },
    { key: "participant", label: "👥 ผู้เข้าอบรม" },
  ] as const;

  const inp: React.CSSProperties = {
    width: "100%", padding: "8px 11px", borderRadius: 7,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };

  return (
    <div>
      {/* Course selector */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>เลือกหลักสูตร</label>
        <select value={selId} onChange={e => setSelId(Number(e.target.value))}
          style={{ ...inp, maxWidth: 500, borderColor: "#0038C6", fontWeight: 600 }}>
          <option value="">-- เลือกหลักสูตร --</option>
          {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} · {c.course}</option>)}
        </select>
      </div>

      {selId === "" ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff",
          borderRadius: 8, border: "1px solid #dce4f5" }}>เลือกหลักสูตรเพื่อดูสรุปผล</div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : (
        <>
          {/* Summary card */}
          {course && (
            <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5",
              borderLeft: "4px solid #0038C6", padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628" }}>
                  📋 {course.course}
                  <span style={{ marginLeft: 10, fontSize: 12, fontFamily: "monospace", color: "#64748b", fontWeight: 400 }}>{course.course_code}</span>
                </div>
                {/* Registration status + toggle */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, marginLeft: 16 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                    background: course.reg_open ? "#dcfce7" : "#fee2e2",
                    color: course.reg_open ? "#16a34a" : "#dc2626",
                    border: `1px solid ${course.reg_open ? "#86efac" : "#fca5a5"}`,
                  }}>
                    {course.reg_open ? "🔓 เปิดรับลงทะเบียน" : "🔒 ปิดรับลงทะเบียน"}
                  </span>
                  {canEdit && (
                    <button onClick={toggleRegOpen} style={{
                      padding: "5px 14px", borderRadius: 6, border: "1.5px solid",
                      borderColor: course.reg_open ? "#dc2626" : "#16a34a",
                      background: course.reg_open ? "#fee2e2" : "#dcfce7",
                      color: course.reg_open ? "#dc2626" : "#16a34a",
                      fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      {course.reg_open ? "ปิดรับลงทะเบียน" : "เปิดรับลงทะเบียน"}
                    </button>
                  )}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 8, fontSize: 13, color: "#475569" }}>
                <div>📅 {course.course_date ?? "—"}</div>
                <div>🕐 {course.start_time ?? "—"} – {course.end_time ?? "—"}</div>
                <div>📍 {course.location ?? "—"}</div>
                <div>👤 {course.trainer ?? "—"}</div>
                <div>🎯 ประเภท: {course.course_type}</div>
                <div>👥 เป้าหมาย: {course.target} คน</div>
              </div>
            </div>
          )}

          {/* Attendance KPIs */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "ลงทะเบียน",  value: regs.length, color: "#0038C6" },
              { label: "เช็คชื่อ",   value: checkedIn,   color: "#16a34a" },
              { label: "ขาด",        value: regs.filter(r => r.attendance_status === "absent").length, color: "#dc2626" },
              { label: "สาย",        value: regs.filter(r => r.attendance_status === "late").length,   color: "#d97706" },
              { label: "% เข้าร่วม", value: `${pct}%`,  color: pct >= 80 ? "#16a34a" : "#d97706" },
            ].map(s => (
              <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: "14px 16px",
                border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6", textAlign: "center" }}>
                <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 20, background: "#fff", borderRadius: 8, padding: "16px 20px",
            border: "1px solid #dce4f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8,
              fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: "#0a1628" }}>อัตราการเข้าร่วม</span>
              <span style={{ color: pct >= 80 ? "#16a34a" : "#d97706" }}>{pct}%</span>
            </div>
            <div style={{ height: 10, background: "#e8eeff", borderRadius: 5 }}>
              <div style={{ height: 10, width: `${pct}%`, borderRadius: 5, transition: "width .5s",
                background: pct >= 80 ? "#16a34a" : pct >= 60 ? "#d97706" : "#dc2626" }} />
            </div>
          </div>

          {/* Participant table */}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5",
            overflow: "hidden", marginBottom: 24 }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #f0f5ff",
              display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700, color: "#0a1628" }}>รายชื่อผู้เข้าร่วม</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={printList}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #0038C6",
                    background: "#0038C6", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>
                  🖨️ พิมพ์
                </button>
                <button onClick={() => {
                  const rows = regs.map((r, i) =>
                    `${i+1}\t${r.emp_code??""}\t${r.name}\t${r.department??""}\t${r.position??""}\t${r.checkin_time?.slice(0,16)??""}\t${STATUS_LABEL[r.attendance_status]??r.attendance_status}`
                  ).join("\n");
                  navigator.clipboard.writeText("ลำดับ\tรหัส\tชื่อ\tแผนก\tตำแหน่ง\tเวลา\tสถานะ\n" + rows);
                }} style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #c4cfee",
                  background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#475569" }}>
                  📋 คัดลอก
                </button>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f4f7ff" }}>
                  {["#", "รหัสพนักงาน", "ชื่อ-นามสกุล", "แผนก", "ตำแหน่ง", "เวลาเช็คชื่อ", "สถานะ"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700,
                      color: "#475569", borderBottom: "2px solid #dce4f5", fontSize: 11,
                      letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regs.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>ยังไม่มีผู้เข้าร่วม</td></tr>
                ) : regs.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f0f5ff", background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                    <td style={{ padding: "9px 14px", color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{r.emp_code ?? "—"}</td>
                    <td style={{ padding: "9px 14px", fontWeight: 600, color: "#0a1628" }}>{r.name}</td>
                    <td style={{ padding: "9px 14px", color: "#64748b" }}>{r.department ?? "—"}</td>
                    <td style={{ padding: "9px 14px", color: "#64748b" }}>{r.position ?? "—"}</td>
                    <td style={{ padding: "9px 14px", color: "#64748b", fontSize: 11 }}>{toThaiTime(r.checkin_time)}</td>
                    <td style={{ padding: "9px 14px" }}>
                      <span style={{ background: STATUS_COLOR[r.attendance_status] + "20", color: STATUS_COLOR[r.attendance_status],
                        border: `1px solid ${STATUS_COLOR[r.attendance_status]}40`,
                        borderRadius: 5, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
                        {STATUS_LABEL[r.attendance_status] ?? r.attendance_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Satisfaction Survey Dashboard */}
          <SatisfactionDashboard surveys={surveys} regs={regs} />

          {/* Photo gallery */}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: "#0a1628" }}>📸 รูปภาพกิจกรรม</div>
              {canEdit && (
                <button onClick={() => { setShowPhotoForm(!showPhotoForm); if (showPhotoForm) { setUploadFiles([]); setUploadPreviews([]); } }}
                  style={{ padding: "7px 16px", borderRadius: 7, border: "none",
                    background: showPhotoForm ? "#64748b" : "#0038C6",
                    color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  {showPhotoForm ? "ปิด" : `+ เพิ่มรูปภาพ (${photos.length}/∞)`}
                </button>
              )}
            </div>

            {showPhotoForm && canEdit && (
              <div style={{ background: "#f0f5ff", borderRadius: 8, padding: "18px 20px", marginBottom: 16,
                border: "1px solid #dce4f5" }}>

                {/* Category selector */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>ประเภทรูปภาพ</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {(["activity", "trainer", "participant"] as const).map(t => (
                      <button key={t} onClick={() => setPhotoType(t)}
                        style={{ padding: "6px 14px", borderRadius: 7, border: "1.5px solid",
                          borderColor: photoType === t ? "#0038C6" : "#c4cfee",
                          background: photoType === t ? "#0038C6" : "#fff",
                          color: photoType === t ? "#fff" : "#475569",
                          fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: photoType === t ? 700 : 400 }}>
                        {t === "activity" ? "🎯 กิจกรรม" : t === "trainer" ? "👤 วิทยากร" : "👥 ผู้เข้าอบรม"}
                      </button>
                    ))}
                  </div>
                </div>

                {/* File picker + previews */}
                <div style={{ marginBottom: 14 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: "#475569",
                    textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 6 }}>
                    เลือกรูปภาพ (สูงสุด 3 ภาพ)
                  </label>
                  {uploadPreviews.length < 3 && (
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 8,
                      padding: "9px 18px", borderRadius: 7, border: "1.5px dashed #0038C6",
                      background: "#eff4ff", color: "#0038C6", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                      📁 เลือกไฟล์ภาพ (.jpg, .png)
                      <input type="file" accept="image/*" multiple onChange={onFilePick}
                        style={{ display: "none" }} disabled={uploadPreviews.length >= 3} />
                    </label>
                  )}
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6 }}>
                    {uploadPreviews.length}/3 ภาพ · ระบบบีบอัดอัตโนมัติ (max 800px)
                  </div>
                  {uploadPreviews.length > 0 && (
                    <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
                      {uploadPreviews.map((src, i) => (
                        <div key={i} style={{ position: "relative", width: 100, height: 100,
                          borderRadius: 8, overflow: "hidden", border: "2px solid #0038C6" }}>
                          <img src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          <button onClick={() => removePreview(i)}
                            style={{ position: "absolute", top: 3, right: 3,
                              width: 22, height: 22, borderRadius: "50%", border: "none",
                              background: "#dc2626", color: "#fff", cursor: "pointer",
                              fontSize: 12, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={uploadPhotos}
                    disabled={uploading || uploadFiles.length === 0}
                    style={{ padding: "9px 22px", borderRadius: 7, border: "none",
                      background: uploadFiles.length === 0 ? "#94a3b8" : "#0038C6",
                      color: "#fff", fontWeight: 700, fontSize: 13, cursor: uploadFiles.length === 0 ? "not-allowed" : "pointer",
                      fontFamily: "inherit" }}>
                    {uploading ? "กำลังอัพโหลด…" : `📤 อัพโหลด ${uploadFiles.length} ภาพ`}
                  </button>
                  <button onClick={() => { setShowPhotoForm(false); setUploadFiles([]); setUploadPreviews([]); }}
                    style={{ padding: "9px 16px", borderRadius: 7, border: "1.5px solid #c4cfee",
                      background: "#fff", fontSize: 13, cursor: "pointer", fontFamily: "inherit", color: "#475569" }}>
                    ยกเลิก
                  </button>
                </div>
              </div>
            )}

            {PHOTO_GROUPS.map(group => {
              const groupPhotos = photos.filter(p => p.photo_type === group.key);
              if (groupPhotos.length === 0 && !showPhotoForm) return null;
              return (
                <div key={group.key} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 10 }}>{group.label}</div>
                  {groupPhotos.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 13, fontStyle: "italic" }}>ยังไม่มีรูปภาพ</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px,1fr))", gap: 10 }}>
                      {groupPhotos.map(p => (
                        <div key={p.id} style={{ position: "relative", borderRadius: 8, overflow: "hidden",
                          border: "1px solid #dce4f5", cursor: "pointer" }} onClick={() => setLightbox(p)}>
                          <img src={p.url} alt={p.caption ?? group.label}
                            style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                            onError={e => { (e.currentTarget as HTMLImageElement).src = "https://placehold.co/160x120?text=No+Image"; }} />
                          {p.caption && (
                            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                              background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 10, padding: "4px 8px" }}>
                              {p.caption}
                            </div>
                          )}
                          {canEdit && (
                            <button onClick={e => { e.stopPropagation(); deletePhoto(p.id); }}
                              style={{ position: "absolute", top: 4, right: 4, background: "#dc2626",
                                color: "#fff", border: "none", borderRadius: 4, padding: "2px 6px",
                                fontSize: 12, cursor: "pointer" }}>✕</button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {photos.length === 0 && !showPhotoForm && (
              <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", background: "#f8fafc",
                borderRadius: 8, border: "1px dashed #dce4f5" }}>ยังไม่มีรูปภาพ</div>
            )}
          </div>
        </>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.85)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 500, padding: 20 }}>
          <img src={lightbox.url} alt={lightbox.caption ?? ""}
            style={{ maxWidth: "90%", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }} />
          {lightbox.caption && (
            <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
              color: "#fff", background: "rgba(0,0,0,0.6)", padding: "6px 16px", borderRadius: 20, fontSize: 13 }}>
              {lightbox.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SatisfactionDashboard({ surveys, regs }: { surveys: Survey[]; regs: Reg[] }) {
  const attendees  = regs.filter(r => !r.participant_type || r.participant_type === "attendee").length;
  const n          = surveys.length;
  const responseRate = attendees > 0 ? Math.round(n / attendees * 100) : 0;

  const totalScore   = surveys.reduce((s, sv) => s + sv.q1 + sv.q2 + sv.q3 + sv.q4 + sv.q5, 0);
  const maxScore     = n * 5 * 4;
  const satPct       = maxScore > 0 ? Math.round(totalScore / maxScore * 100) : 0;
  const avgScore     = n > 0 ? (totalScore / (n * 5)).toFixed(2) : "—";
  const level        = satLevel(satPct);

  const qAvgs = [1, 2, 3, 4, 5].map(i =>
    n > 0 ? surveys.reduce((s, sv) => s + sv[`q${i}` as keyof Survey] as number, 0) / n : 0
  );

  const comments = surveys.filter(sv => sv.comment).map(sv => sv.comment!);

  return (
    <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5",
      padding: "20px 24px", marginBottom: 24 }}>

      <div style={{ fontWeight: 700, color: "#0a1628", marginBottom: 16, fontSize: 15 }}>
        📊 ผลประเมินความพึงพอใจ
      </div>

      {n === 0 ? (
        <div style={{ textAlign: "center", padding: "32px 0", color: "#94a3b8" }}>
          ยังไม่มีข้อมูลแบบสอบถาม
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10, marginBottom: 20 }}>
            {[
              { label: "ผู้เข้าอบรม",    value: attendees,         color: "#0038C6" },
              { label: "ตอบแบบสอบถาม",  value: n,                  color: "#16a34a" },
              { label: "Response Rate",  value: `${responseRate}%`, color: responseRate >= 80 ? "#16a34a" : "#d97706" },
              { label: "คะแนนเฉลี่ย",   value: avgScore,           color: "#0038C6" },
              { label: "% ความพึงพอใจ", value: `${satPct}%`,       color: level.color },
            ].map(s => (
              <div key={s.label} style={{ background: "#f8faff", borderRadius: 8, padding: "12px 14px",
                border: "1px solid #dce4f5", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700,
                  textTransform: "uppercase", letterSpacing: "0.07em" }}>{s.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Satisfaction level badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
            background: level.color + "12", border: `1px solid ${level.color}30`,
            borderRadius: 10, padding: "12px 18px" }}>
            <div style={{ fontSize: 28 }}>
              {satPct >= 90 ? "🌟" : satPct >= 80 ? "✅" : satPct >= 70 ? "👍" : satPct >= 60 ? "😐" : "⚠️"}
            </div>
            <div>
              <div style={{ fontWeight: 800, color: level.color, fontSize: 16 }}>{level.label}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>
                คะแนนรวม {totalScore} / {maxScore} คะแนน ({satPct}%)
              </div>
            </div>
          </div>

          {/* Per-question bar chart */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#475569",
              textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 12 }}>
              คะแนนเฉลี่ยรายข้อ (เต็ม 4)
            </div>
            {Q_LABELS.map((label, i) => {
              const avg = qAvgs[i];
              const pct = (avg / 4) * 100;
              const barColor = avg >= 3.5 ? "#16a34a" : avg >= 3 ? "#0038C6" : avg >= 2 ? "#d97706" : "#dc2626";
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 12, marginBottom: 5, color: "#0a1628" }}>
                    <span>{i + 1}. {label}</span>
                    <span style={{ fontWeight: 700, color: barColor }}>{avg.toFixed(2)}</span>
                  </div>
                  <div style={{ height: 8, background: "#e8eeff", borderRadius: 4 }}>
                    <div style={{ height: 8, width: `${pct}%`, borderRadius: 4,
                      background: barColor, transition: "width .5s" }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Score level breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 20 }}>
            {[
              { label: "มากที่สุด (4)", val: 4, color: "#16a34a" },
              { label: "มาก (3)",       val: 3, color: "#0038C6" },
              { label: "ปานกลาง (2)",  val: 2, color: "#d97706" },
              { label: "ปรับปรุง (1)", val: 1, color: "#dc2626" },
            ].map(lv => {
              const cnt = surveys.reduce((s, sv) =>
                s + [sv.q1, sv.q2, sv.q3, sv.q4, sv.q5].filter(q => q === lv.val).length, 0);
              return (
                <div key={lv.val} style={{ background: lv.color + "10", border: `1px solid ${lv.color}30`,
                  borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: lv.color, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.05em" }}>{lv.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: lv.color, marginTop: 4 }}>{cnt}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8" }}>ครั้ง</div>
                </div>
              );
            })}
          </div>

          {/* Comments */}
          {comments.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                ข้อเสนอแนะ ({comments.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {comments.map((c, i) => (
                  <div key={i} style={{ background: "#f8faff", borderRadius: 7, padding: "10px 14px",
                    border: "1px solid #e8eeff", fontSize: 13, color: "#0a1628", lineHeight: 1.5 }}>
                    💬 {c}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
