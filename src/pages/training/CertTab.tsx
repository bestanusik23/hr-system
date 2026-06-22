import { useEffect, useState } from "react";
import CertificateView from "./CertificateView";

interface Course { id: number; course_code: string; course: string; course_date: string | null; status: string; }
interface Cert {
  id: number; cert_id: string; full_name: string; position: string | null;
  department: string | null; hours: number | null; course_date: string | null;
  issued_at: string; status: string; qr_token: string; course_name?: string;
  course_code?: string; trainer?: string | null;
}
interface Reg { id: number; name: string; department: string | null; position: string | null; attendance_status: string; }

interface Props { canEdit: boolean; initCourseId: number | null; }

const CERT_STATUS_COLOR: Record<string, string> = { pending: "#d97706", issued: "#16a34a", revoked: "#dc2626" };
const CERT_STATUS_LABEL: Record<string, string> = { pending: "รออนุมัติ", issued: "ออกแล้ว", revoked: "ยกเลิก" };

export default function CertTab({ canEdit, initCourseId }: Props) {
  const [courses, setCourses]     = useState<Course[]>([]);
  const [selId, setSelId]         = useState<number | "">("");
  const [certs, setCerts]         = useState<Cert[]>([]);
  const [regs, setRegs]           = useState<Reg[]>([]);
  const [loading, setLoading]     = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selCert, setSelCert]     = useState<Cert | null>(null);
  const [selCourse, setSelCourse] = useState<Course | null>(null);
  const [selAttendees, setSelAttendees] = useState<Set<number>>(new Set());
  const [showGenForm, setShowGenForm]   = useState(false);
  const [genMsg, setGenMsg]       = useState("");

  // Dashboard totals
  const [allCerts, setAllCerts]   = useState<Cert[]>([]);

  useEffect(() => {
    fetch("/api/training/courses")
      .then(r => r.json() as Promise<{ ok: boolean; courses: Course[] }>)
      .then(d => {
        setCourses(d.courses ?? []);
        const startId = initCourseId ?? (d.courses[0]?.id ?? "");
        if (startId) setSelId(startId as number);
      });
    fetch("/api/training/certificates")
      .then(r => r.json() as Promise<{ ok: boolean; certificates: Cert[] }>)
      .then(d => setAllCerts(d.certificates ?? []));
  }, [initCourseId]);

  useEffect(() => {
    if (!selId) return;
    loadCerts(selId as number);
    setSelCourse(courses.find(c => c.id === selId) ?? null);
    fetch(`/api/training/registrations?course_id=${selId}`)
      .then(r => r.json() as Promise<{ ok: boolean; registrations: Reg[] }>)
      .then(d => setRegs((d.registrations ?? []).filter(r => r.attendance_status === "completed")));
  }, [selId, courses]);

  async function loadCerts(id: number) {
    setLoading(true);
    const r = await fetch(`/api/training/certificates?course_id=${id}`);
    const d = await r.json() as { ok: boolean; certificates: Cert[] };
    setCerts(d.certificates ?? []);
    setLoading(false);
  }

  async function generate() {
    if (!selId) return;
    setGenerating(true); setGenMsg("");
    const ids = selAttendees.size > 0 ? Array.from(selAttendees) : undefined;
    const r = await fetch("/api/training/certificates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ course_id: selId, attendee_ids: ids }),
    });
    const d = await r.json() as { ok: boolean; created: number; error?: string };
    setGenerating(false);
    if (!d.ok) { setGenMsg(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setGenMsg(`สร้างใบประกาศสำเร็จ ${d.created} ใบ`);
    setSelAttendees(new Set()); setShowGenForm(false);
    loadCerts(selId as number);
    // Refresh dashboard
    fetch("/api/training/certificates")
      .then(r2 => r2.json() as Promise<{ ok: boolean; certificates: Cert[] }>)
      .then(d2 => setAllCerts(d2.certificates ?? []));
  }

  function buildCertData(c: Cert): Parameters<typeof CertificateView>[0]["cert"] {
    return {
      cert_id:     c.cert_id,
      full_name:   c.full_name,
      position:    c.position,
      department:  c.department,
      hours:       c.hours,
      course_name: c.course_name ?? selCourse?.course ?? "—",
      course_date: c.course_date,
      issued_at:   c.issued_at,
      status:      c.status,
      qr_token:    c.qr_token,
      trainer:     c.trainer ?? null,
    };
  }

  if (selCert) {
    return <CertificateView cert={buildCertData(selCert)} onClose={() => setSelCert(null)} />;
  }

  return (
    <div>
      {/* Dashboard KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
        {[
          { label: "ใบประกาศทั้งหมด", value: allCerts.length,                                     color: "#0038C6" },
          { label: "ออกแล้ว",         value: allCerts.filter(c => c.status === "issued").length,  color: "#16a34a" },
          { label: "รออนุมัติ",       value: allCerts.filter(c => c.status === "pending").length, color: "#d97706" },
          { label: "ยกเลิก",          value: allCerts.filter(c => c.status === "revoked").length, color: "#dc2626" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: "16px 20px",
            border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6" }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Course selector */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>เลือกหลักสูตร</label>
          <select value={selId} onChange={e => setSelId(Number(e.target.value))}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: "1.5px solid #0038C6",
              fontSize: 13, fontFamily: "inherit", fontWeight: 600, outline: "none" }}>
            <option value="">-- เลือกหลักสูตร --</option>
            {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} · {c.course}</option>)}
          </select>
        </div>
        {selId !== "" && canEdit && (
          <button onClick={() => setShowGenForm(!showGenForm)}
            style={{ padding: "9px 20px", borderRadius: 7, border: "none",
              background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            🎓 สร้างใบประกาศ
          </button>
        )}
      </div>

      {/* Generate form */}
      {showGenForm && selId !== "" && (
        <div style={{ background: "#f0fff4", borderRadius: 8, padding: "18px 20px",
          border: "1px solid #bbf7d0", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 12, fontSize: 14 }}>
            🎓 สร้างใบประกาศสำหรับผู้ที่ "เสร็จสิ้น" (Completed)
          </div>
          {regs.length === 0 ? (
            <div style={{ color: "#64748b", fontSize: 13 }}>ไม่มีผู้เข้าอบรมที่มีสถานะ Completed ในหลักสูตรนี้<br />
              <span style={{ fontSize: 12, color: "#94a3b8" }}>ไปที่แท็บ "ลงทะเบียน" และตั้งสถานะเป็น Completed ก่อน</span>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 10 }}>
                เลือกผู้รับใบประกาศ (ไม่เลือก = สร้างทั้งหมดที่ยังไม่ได้รับ)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 8, marginBottom: 14 }}>
                {regs.map(r => (
                  <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                    background: "#fff", borderRadius: 6, border: "1px solid #dce4f5", cursor: "pointer",
                    borderColor: selAttendees.has(r.id) ? "#16a34a" : "#dce4f5" }}>
                    <input type="checkbox" checked={selAttendees.has(r.id)}
                      onChange={e => setSelAttendees(prev => {
                        const s = new Set(prev);
                        e.target.checked ? s.add(r.id) : s.delete(r.id);
                        return s;
                      })}
                      style={{ accentColor: "#16a34a" }} />
                    <span style={{ fontSize: 13 }}>{r.name}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{r.department ?? ""}</span>
                  </label>
                ))}
              </div>
              {genMsg && <div style={{ fontSize: 13, color: genMsg.includes("สำเร็จ") ? "#16a34a" : "#dc2626", marginBottom: 10 }}>{genMsg}</div>}
              <button onClick={generate} disabled={generating}
                style={{ padding: "9px 24px", borderRadius: 7, border: "none",
                  background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {generating ? "กำลังสร้าง…" : "✅ ยืนยันสร้างใบประกาศ"}
              </button>
            </>
          )}
        </div>
      )}

      {/* Cert table */}
      {selId === "" ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff",
          borderRadius: 8, border: "1px solid #dce4f5" }}>เลือกหลักสูตรเพื่อดูใบประกาศ</div>
      ) : loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f4f7ff" }}>
                {["เลขที่ใบประกาศ", "ชื่อ-นามสกุล", "แผนก", "ชั่วโมง", "วันที่ออก", "สถานะ", ""].map(h => (
                  <th key={h} style={{ padding: "11px 14px", textAlign: "left", fontWeight: 700,
                    color: "#475569", borderBottom: "2px solid #dce4f5", fontSize: 11,
                    letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certs.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: "40px 0", textAlign: "center", color: "#94a3b8" }}>
                  ยังไม่มีใบประกาศ — กด "สร้างใบประกาศ" เพื่อเริ่มต้น
                </td></tr>
              ) : certs.map((c, i) => (
                <tr key={c.id} style={{ borderBottom: "1px solid #f0f5ff", background: i % 2 === 0 ? "#fff" : "#fafcff" }}>
                  <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 11, color: "#0038C6", fontWeight: 700 }}>
                    {c.cert_id}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600, color: "#0a1628" }}>{c.full_name}</td>
                  <td style={{ padding: "10px 14px", color: "#64748b" }}>{c.department ?? "—"}</td>
                  <td style={{ padding: "10px 14px", textAlign: "center", color: "#475569" }}>
                    {c.hours ? `${c.hours} ชม.` : "—"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>
                    {c.issued_at?.slice(0, 10) ?? "—"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span style={{ background: CERT_STATUS_COLOR[c.status] + "20", color: CERT_STATUS_COLOR[c.status],
                      border: `1px solid ${CERT_STATUS_COLOR[c.status]}40`,
                      borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                      {CERT_STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => {
                        setSelCert({ ...c, course_name: selCourse?.course, course_code: selCourse?.course_code });
                      }} style={{ padding: "5px 12px", borderRadius: 6, border: "1.5px solid #0038C6",
                        background: "#f0f5ff", color: "#0038C6", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        🎓 ดู
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
