import { useEffect, useState } from "react";
import InternCertificateView from "./InternCertificateView";

interface InternFull {
  id: number; intern_code: string; prefix: string | null; first_name: string; last_name: string;
  education_level: string | null; faculty: string | null; major: string | null; year_level: string | null;
  phone: string | null; photo_url: string | null;
  institution_name: string | null; institution_type: string | null; institution_province: string | null;
  advisor_name: string | null; advisor_phone: string | null; advisor_email: string | null;
  referral_letter_url: string | null;
  start_date: string; end_date: string; department_name: string | null; division_name: string | null;
  supervisor_name: string | null; supervisor_position: string | null; training_type: string | null;
  work_hours: string | null; note: string | null; is_cancelled: number; cancel_reason: string | null;
  status: string; days_remaining: number; created_by: string | null; created_at: string;
}
interface Rotation {
  id: number; department_name: string | null; division_name: string | null;
  start_date: string; end_date: string; supervisor_name: string | null; note: string | null;
}
interface Doc { id: number; doc_type: string | null; file_name: string | null; url: string; uploaded_at: string; }
interface Cert { id: number; cert_id: string; status: string; issued_at: string; issued_by: string | null;
  full_name: string; institution_name: string | null; faculty: string | null; major: string | null;
  department_name: string | null; start_date: string | null; end_date: string | null; qr_token: string; }
interface Activity { actor_name: string; action: string; detail: string | null; created_at: string; }

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  upcoming:    { label: "รอเริ่มฝึก",  color: "#0891b2", bg: "#cffafe" },
  active:      { label: "กำลังฝึกงาน", color: "#16a34a", bg: "#dcfce7" },
  ending_soon: { label: "ใกล้สิ้นสุด", color: "#d97706", bg: "#fef3c7" },
  completed:   { label: "สิ้นสุดแล้ว", color: "#64748b", bg: "#f1f5f9" },
  cancelled:   { label: "ยกเลิก",      color: "#dc2626", bg: "#fee2e2" },
};
const ACTION_LABEL: Record<string, string> = {
  create: "บันทึกข้อมูล", edit: "แก้ไขข้อมูล", cancel: "ยกเลิกการฝึกงาน", restore: "กู้คืนสถานะ",
  update_rotations: "แก้ไขตาราง Rotation", upload_document: "อัปโหลดเอกสาร", issue_certificate: "ออกใบประกาศ",
};

function thaiDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  const MT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${MT[m - 1]} ${y + 543}`;
}
function fullName(i: { prefix: string | null; first_name: string; last_name: string }) {
  return `${i.prefix ?? ""}${i.first_name} ${i.last_name}`.trim();
}

type Tab = "general" | "placement" | "rotation" | "documents" | "history" | "certificates";
const TABS: { key: Tab; label: string }[] = [
  { key: "general",   label: "ข้อมูลทั่วไป" },
  { key: "placement", label: "รายละเอียดการฝึกงาน" },
  { key: "rotation",  label: "ตาราง Rotation" },
  { key: "documents", label: "เอกสาร" },
  { key: "history",   label: "ประวัติการดำเนินการ" },
  { key: "certificates", label: "ใบประกาศ" },
];

export default function InternProfile({ internId, onClose, onChanged }: {
  internId: number; onClose: () => void; onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>("general");
  const [intern, setIntern]   = useState<InternFull | null>(null);
  const [rotations, setRotations] = useState<Rotation[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [certificates, setCertificates] = useState<Cert[]>([]);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [viewCert, setViewCert] = useState<Cert | null>(null);
  const [confirmDeleteCert, setConfirmDeleteCert] = useState<Cert | null>(null);
  const [certBusyId, setCertBusyId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch(`/api/interns/${internId}`).then(r => r.json())
      .then((d: { ok: boolean; intern?: InternFull; rotations?: Rotation[]; documents?: Doc[]; certificates?: Cert[]; activity?: Activity[] }) => {
        if (d.ok) {
          setIntern(d.intern ?? null); setRotations(d.rotations ?? []); setDocuments(d.documents ?? []);
          setCertificates(d.certificates ?? []); setActivity(d.activity ?? []);
        }
      }).finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [internId]);

  async function issueCert() {
    setIssuing(true);
    await fetch("/api/interns/certificates", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ intern_id: internId }),
    });
    setIssuing(false);
    load(); onChanged();
    setTab("certificates");
  }

  async function toggleCertStatus(cert: Cert) {
    setCertBusyId(cert.id);
    const nextStatus = cert.status === "issued" ? "revoked" : "issued";
    await fetch(`/api/interns/certificates/${cert.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }),
    });
    setCertBusyId(null);
    load(); onChanged();
  }

  async function deleteCert() {
    if (!confirmDeleteCert) return;
    setCertBusyId(confirmDeleteCert.id);
    await fetch(`/api/interns/certificates/${confirmDeleteCert.id}`, { method: "DELETE" });
    setCertBusyId(null);
    setConfirmDeleteCert(null);
    load(); onChanged();
  }

  async function onDocPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      await fetch(`/api/interns/${internId}/documents`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_type: "เอกสารประกอบ", file_name: file.name, url: ev.target?.result }),
      });
      load();
    };
    reader.readAsDataURL(file);
  }
  async function deleteDoc(id: number) {
    await fetch(`/api/interns/${internId}/documents?doc_id=${id}`, { method: "DELETE" });
    load();
  }

  const meta = intern ? (STATUS_META[intern.status] ?? STATUS_META.upcoming) : null;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)", zIndex: 300,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "min(760px, 100%)", maxHeight: "90vh", background: "#fff", borderRadius: 16,
        display: "flex", flexDirection: "column", boxShadow: "0 24px 64px rgba(0,0,0,.25)", overflow: "hidden" }}>

        {loading || !intern ? (
          <div style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด…</div>
        ) : (
          <>
            {/* Header */}
            <div style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)", padding: "22px 28px", color: "#fff", flexShrink: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(255,255,255,.2)",
                    display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0,
                    border: "2px solid rgba(255,255,255,.4)" }}>
                    {intern.photo_url ? <img src={intern.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 20, fontWeight: 800 }}>{intern.first_name.charAt(0)}</span>}
                  </div>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 800 }}>{fullName(intern)}</div>
                    <div style={{ fontSize: 12.5, opacity: 0.9, marginTop: 2 }}>
                      {intern.institution_name ?? "—"} · {intern.faculty ?? "—"} {intern.major ? `/ ${intern.major}` : ""}
                    </div>
                    <div style={{ fontSize: 11.5, opacity: 0.8, marginTop: 4, fontFamily: "monospace" }}>{intern.intern_code}</div>
                  </div>
                </div>
                <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,.2)", borderRadius: 8,
                  width: 30, height: 30, cursor: "pointer", fontSize: 15, color: "#fff", flexShrink: 0 }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "center" }}>
                {meta && <span style={{ background: "rgba(255,255,255,.2)", borderRadius: 20, padding: "3px 12px", fontSize: 11.5, fontWeight: 700 }}>{meta.label}</span>}
                <span style={{ fontSize: 12, opacity: 0.9 }}>{thaiDate(intern.start_date)} – {thaiDate(intern.end_date)}</span>
                {intern.status !== "completed" && intern.status !== "cancelled" && (
                  <span style={{ fontSize: 12, opacity: 0.9 }}>· เหลือ {intern.days_remaining} วัน</span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 2, padding: "10px 20px 0", borderBottom: "1px solid #f1f5f9",
              overflowX: "auto", flexShrink: 0 }}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  padding: "9px 14px", border: "none", background: "none", cursor: "pointer", fontFamily: "inherit",
                  fontSize: 12.5, fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? "#7c3aed" : "#64748b",
                  borderBottom: tab === t.key ? "2.5px solid #7c3aed" : "2.5px solid transparent", whiteSpace: "nowrap",
                }}>{t.label}</button>
              ))}
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px" }}>
              {tab === "general" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
                  <Info label="ระดับการศึกษา" value={intern.education_level} />
                  <Info label="ชั้นปี" value={intern.year_level} />
                  <Info label="คณะ" value={intern.faculty} />
                  <Info label="สาขาวิชา" value={intern.major} />
                  <Info label="เบอร์โทรศัพท์" value={intern.phone} />
                  <Info label="ประเภทสถาบัน" value={intern.institution_type} />
                  <Info label="จังหวัดสถาบัน" value={intern.institution_province} />
                  <div />
                  <Info label="ชื่ออาจารย์ผู้ประสานงาน" value={intern.advisor_name} />
                  <Info label="เบอร์โทรอาจารย์" value={intern.advisor_phone} />
                  <Info label="Email อาจารย์" value={intern.advisor_email} />
                  {intern.is_cancelled === 1 && <Info label="เหตุผลยกเลิก" value={intern.cancel_reason} />}
                </div>
              )}

              {tab === "placement" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 13 }}>
                  <Info label="วันที่เริ่มฝึกงาน" value={thaiDate(intern.start_date)} />
                  <Info label="วันที่สิ้นสุด" value={thaiDate(intern.end_date)} />
                  <Info label="ฝ่าย" value={intern.division_name} />
                  <Info label="แผนกที่เข้าฝึก" value={intern.department_name} />
                  <Info label="ผู้ควบคุมการฝึกงาน" value={intern.supervisor_name} />
                  <Info label="ตำแหน่งผู้ควบคุม" value={intern.supervisor_position} />
                  <Info label="รูปแบบการฝึก" value={intern.training_type} />
                  <Info label="เวลาปฏิบัติงาน" value={intern.work_hours} />
                  <div style={{ gridColumn: "1 / -1" }}><Info label="หมายเหตุ" value={intern.note} /></div>
                </div>
              )}

              {tab === "rotation" && (
                rotations.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>ไม่มีข้อมูลการหมุนเวียนแผนก</div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                    <thead><tr style={{ background: "#faf9ff" }}>
                      {["ช่วงเวลา", "แผนก", "ผู้ควบคุม", "หมายเหตุ"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #f1f5f9" }}>{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {rotations.map(r => (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                          <td style={{ padding: "8px 12px", whiteSpace: "nowrap" }}>{thaiDate(r.start_date)} – {thaiDate(r.end_date)}</td>
                          <td style={{ padding: "8px 12px" }}>{r.department_name ?? "—"}</td>
                          <td style={{ padding: "8px 12px" }}>{r.supervisor_name ?? "—"}</td>
                          <td style={{ padding: "8px 12px", color: "#94a3b8" }}>{r.note ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )
              )}

              {tab === "documents" && (
                <div>
                  <div style={{ marginBottom: 14 }}>
                    <input type="file" accept="image/*,.pdf" onChange={onDocPick} style={{ fontSize: 12.5, fontFamily: "inherit" }} />
                  </div>
                  {intern.referral_letter_url && (
                    <div style={{ marginBottom: 10 }}>
                      <a href={intern.referral_letter_url} target="_blank" rel="noreferrer"
                        style={{ fontSize: 12.5, color: "#7c3aed", fontWeight: 700 }}>📄 หนังสือส่งตัวจากสถาบัน (เปิดดู)</a>
                    </div>
                  )}
                  {documents.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 12.5 }}>ยังไม่มีเอกสารประกอบอื่นๆ</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {documents.map(d => (
                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                          background: "#faf9ff", borderRadius: 8, border: "1px solid #ede9fe" }}>
                          <a href={d.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 12.5, color: "#334155" }}>
                            📎 {d.file_name ?? d.doc_type ?? "เอกสาร"}
                          </a>
                          <button onClick={() => deleteDoc(d.id)}
                            style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 11.5 }}>ลบ</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {tab === "history" && (
                activity.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>ยังไม่มีประวัติการดำเนินการ</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {activity.map((a, i) => (
                      <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#7c3aed", marginTop: 5, flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, color: "#334155" }}>
                            <b>{ACTION_LABEL[a.action] ?? a.action}</b> โดย {a.actor_name}
                            {a.detail && <span style={{ color: "#94a3b8" }}> — {a.detail}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                            {new Date(a.created_at).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {tab === "certificates" && (
                <div>
                  <button onClick={issueCert} disabled={issuing}
                    style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#7c3aed",
                      color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit", marginBottom: 16 }}>
                    {issuing ? "กำลังออกใบประกาศ…" : "📜 ออกใบประกาศฉบับใหม่"}
                  </button>
                  {certificates.length === 0 ? (
                    <div style={{ color: "#94a3b8", fontSize: 12.5 }}>ยังไม่มีการออกใบประกาศ</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {certificates.map(c => (
                        <div key={c.id}
                          style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                            background: "#faf9ff", borderRadius: 8, border: "1px solid #ede9fe" }}>
                          <span onClick={() => setViewCert(c)} style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, cursor: "pointer" }}>
                            <span style={{ fontSize: 16 }}>📜</span>
                            <span>
                              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", fontFamily: "monospace" }}>{c.cert_id}</div>
                              <div style={{ fontSize: 11, color: "#94a3b8" }}>
                                ออกเมื่อ {new Date(c.issued_at).toLocaleDateString("th-TH")} โดย {c.issued_by ?? "—"}
                              </div>
                            </span>
                          </span>
                          <span style={{ fontSize: 11, color: c.status === "issued" ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                            {c.status === "issued" ? "ออกแล้ว" : "ยกเลิก"}
                          </span>
                          <button onClick={() => toggleCertStatus(c)} disabled={certBusyId === c.id}
                            title={c.status === "issued" ? "เพิกถอนใบรับรอง" : "คืนสถานะใบรับรอง"}
                            style={{ border: "1px solid #e2e8f0", background: "#fff", borderRadius: 6,
                              padding: "5px 9px", cursor: "pointer", fontSize: 12, color: "#64748b",
                              opacity: certBusyId === c.id ? 0.5 : 1 }}>
                            {c.status === "issued" ? "🚫 เพิกถอน" : "✅ คืนสถานะ"}
                          </button>
                          <button onClick={() => setConfirmDeleteCert(c)} disabled={certBusyId === c.id}
                            title="ลบใบรับรองนี้"
                            style={{ border: "1px solid #fecaca", background: "#fff5f5", borderRadius: 6,
                              padding: "5px 9px", cursor: "pointer", fontSize: 12, color: "#dc2626",
                              opacity: certBusyId === c.id ? 0.5 : 1 }}>
                            🗑️ ลบ
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {viewCert && (
        <div onClick={e => { if (e.target === e.currentTarget) setViewCert(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 500,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20, overflowY: "auto" }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 1000, width: "100%" }}>
            <InternCertificateView cert={viewCert} onClose={() => setViewCert(null)} />
          </div>
        </div>
      )}

      {confirmDeleteCert && (
        <div onClick={e => { if (e.target === e.currentTarget && certBusyId === null) setConfirmDeleteCert(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)", zIndex: 600,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 26, maxWidth: 400, width: "100%",
            border: "1px solid #fecaca", borderTop: "4px solid #dc2626" }}>
            <div style={{ fontSize: 26, textAlign: "center", marginBottom: 10 }}>🗑️</div>
            <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>ยืนยันลบใบรับรอง?</div>
            <div style={{ fontSize: 12.5, color: "#64748b", textAlign: "center", marginBottom: 18, fontFamily: "monospace" }}>
              {confirmDeleteCert.cert_id}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDeleteCert(null)} disabled={certBusyId !== null}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1.5px solid #e2e8f0",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
              <button onClick={deleteCert} disabled={certBusyId !== null}
                style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {certBusyId !== null ? "กำลังลบ…" : "🗑️ ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.05em", marginBottom: 3 }}>{label}</div>
      <div style={{ color: "#1e293b" }}>{value || "—"}</div>
    </div>
  );
}
