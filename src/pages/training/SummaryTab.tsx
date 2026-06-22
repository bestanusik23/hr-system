import { useEffect, useState } from "react";

interface Course { id: number; course_code: string; course: string; course_type: string; course_date: string | null; start_time: string | null; end_time: string | null; location: string | null; trainer: string | null; target: number; actual: number; status: string; objectives: string | null; }
interface Reg { id: number; emp_code: string | null; name: string; department: string | null; position: string | null; attendance_status: string; checkin_time: string | null; reg_method: string; }
interface Photo { id: number; course_id: number; url: string; photo_type: string; caption: string | null; uploaded_at: string; }

const STATUS_COLOR: Record<string, string> = { registered: "#94a3b8", checked_in: "#16a34a", late: "#d97706", absent: "#dc2626", completed: "#0038C6" };
const STATUS_LABEL: Record<string, string> = { registered: "ลงทะเบียน", checked_in: "เช็คชื่อ", late: "สาย", absent: "ขาด", completed: "เสร็จ" };

interface Props { canEdit: boolean; initCourseId: number | null; }

export default function SummaryTab({ canEdit, initCourseId }: Props) {
  const [courses, setCourses]   = useState<Course[]>([]);
  const [selId, setSelId]       = useState<number | "">("");
  const [course, setCourse]     = useState<Course | null>(null);
  const [regs, setRegs]         = useState<Reg[]>([]);
  const [photos, setPhotos]     = useState<Photo[]>([]);
  const [loading, setLoading]   = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoType, setPhotoType] = useState<"activity" | "trainer" | "participant">("activity");
  const [photoCaption, setPhotoCaption] = useState("");
  const [addingPhoto, setAddingPhoto]   = useState(false);
  const [showPhotoForm, setShowPhotoForm] = useState(false);
  const [lightbox, setLightbox]           = useState<Photo | null>(null);

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

  async function loadAll(id: number) {
    setLoading(true);
    const [regRes, photoRes, courseRes] = await Promise.all([
      fetch(`/api/training/registrations?course_id=${id}`).then(r => r.json() as Promise<{ ok: boolean; registrations: Reg[] }>),
      fetch(`/api/training/photos?course_id=${id}`).then(r => r.json() as Promise<{ ok: boolean; photos: Photo[] }>),
      fetch(`/api/training/courses?`).then(r => r.json() as Promise<{ ok: boolean; courses: Course[] }>),
    ]);
    setRegs(regRes.registrations ?? []);
    setPhotos(photoRes.photos ?? []);
    setCourse((courseRes.courses ?? []).find(c => c.id === id) ?? null);
    setLoading(false);
  }

  async function addPhoto() {
    if (!photoUrl.trim()) return;
    setAddingPhoto(true);
    await fetch("/api/training/photos", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: selId, url: photoUrl, photo_type: photoType, caption: photoCaption || null }),
    });
    setPhotoUrl(""); setPhotoCaption(""); setShowPhotoForm(false); setAddingPhoto(false);
    loadAll(selId as number);
  }

  async function deletePhoto(id: number) {
    await fetch(`/api/training/photos/${id}`, { method: "DELETE" });
    loadAll(selId as number);
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
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0a1628", marginBottom: 12 }}>
                📋 {course.course}
                <span style={{ marginLeft: 10, fontSize: 12, fontFamily: "monospace", color: "#64748b", fontWeight: 400 }}>{course.course_code}</span>
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
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f4f7ff" }}>
                  {["#", "รหัส", "ชื่อ-นามสกุล", "แผนก", "ตำแหน่ง", "เวลาเช็คชื่อ", "สถานะ"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700,
                      color: "#475569", borderBottom: "2px solid #dce4f5", fontSize: 11,
                      letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {regs.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>ยังไม่มีผู้เข้าร่วม</td></tr>
                ) : regs.map((r, i) => (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f0f5ff", background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                    <td style={{ padding: "9px 14px", color: "#94a3b8" }}>{i + 1}</td>
                    <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{r.emp_code ?? "—"}</td>
                    <td style={{ padding: "9px 14px", fontWeight: 600, color: "#0a1628" }}>{r.name}</td>
                    <td style={{ padding: "9px 14px", color: "#64748b" }}>{r.department ?? "—"}</td>
                    <td style={{ padding: "9px 14px", color: "#64748b" }}>{r.position ?? "—"}</td>
                    <td style={{ padding: "9px 14px", color: "#64748b", fontSize: 11 }}>{r.checkin_time ? r.checkin_time.slice(0, 16).replace("T", " ") : "—"}</td>
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

          {/* Photo gallery */}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", padding: "20px 24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: "#0a1628" }}>📸 รูปภาพกิจกรรม</div>
              {canEdit && (
                <button onClick={() => setShowPhotoForm(!showPhotoForm)}
                  style={{ padding: "7px 16px", borderRadius: 7, border: "none",
                    background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                  + เพิ่มรูปภาพ
                </button>
              )}
            </div>

            {showPhotoForm && canEdit && (
              <div style={{ background: "#f0f5ff", borderRadius: 8, padding: "16px 18px", marginBottom: 16,
                border: "1px solid #dce4f5" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>URL รูปภาพ</label>
                    <input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://..." style={inp} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>ประเภท</label>
                    <select value={photoType} onChange={e => setPhotoType(e.target.value as typeof photoType)} style={inp}>
                      <option value="activity">กิจกรรม</option>
                      <option value="trainer">วิทยากร</option>
                      <option value="participant">ผู้เข้าอบรม</option>
                    </select>
                  </div>
                </div>
                <input value={photoCaption} onChange={e => setPhotoCaption(e.target.value)} placeholder="คำบรรยาย (ไม่บังคับ)" style={{ ...inp, marginBottom: 10 }} />
                <button onClick={addPhoto} disabled={addingPhoto}
                  style={{ padding: "8px 20px", borderRadius: 7, border: "none",
                    background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                  {addingPhoto ? "กำลังบันทึก…" : "เพิ่มรูปภาพ"}
                </button>
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
