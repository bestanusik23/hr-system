import { useEffect, useMemo, useState } from "react";
import PageLayout from "../../components/PageLayout";
import InternForm, { type InternDetail } from "./InternForm";
import InternProfile from "./InternProfile";
import InternCalendar from "./InternCalendar";

export interface InternListItem {
  id: number; intern_code: string; prefix: string | null; first_name: string; last_name: string;
  education_level: string | null; faculty: string | null; major: string | null; year_level: string | null;
  phone: string | null; institution_id: number | null; institution_name: string | null;
  start_date: string; end_date: string; department_id: number | null; department_name: string | null;
  division_id: number | null; division_name: string | null; supervisor_name: string | null;
  training_type: string | null; is_cancelled: number; referral_letter_url: string | null;
  status: string; days_remaining: number;
}
interface Summary { total: number; active: number; upcoming: number; completed: number; institutions: number; departments: number; }
interface Department { id: number; division_id: number; name: string; }
interface Institution { id: number; name: string; }

type ViewTab = "list" | "calendar";
type CardFilter = "" | "active" | "upcoming" | "completed";
type SortKey = "start_date" | "end_date" | "name";

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  upcoming:     { label: "รอเริ่มฝึก",    color: "#0891b2", bg: "#cffafe" },
  active:       { label: "กำลังฝึกงาน",   color: "#16a34a", bg: "#dcfce7" },
  ending_soon:  { label: "ใกล้สิ้นสุด",   color: "#d97706", bg: "#fef3c7" },
  completed:    { label: "สิ้นสุดแล้ว",   color: "#64748b", bg: "#f1f5f9" },
  cancelled:    { label: "ยกเลิก",        color: "#dc2626", bg: "#fee2e2" },
};

function daysFromToday(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + "T00:00:00");
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}
function fullName(i: { prefix: string | null; first_name: string; last_name: string }) {
  return `${i.prefix ?? ""}${i.first_name} ${i.last_name}`.trim();
}
function thaiDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const MT = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${MT[m - 1]} ${y + 543}`;
}

export default function InternsPage() {
  const [viewTab, setViewTab] = useState<ViewTab>("list");
  const [interns, setInterns] = useState<InternListItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [certifiedIds, setCertifiedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [cardFilter, setCardFilter] = useState<CardFilter>("");
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [instFilter, setInstFilter] = useState<number | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("start_date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [departments, setDepartments] = useState<Department[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InternDetail | null>(null);
  const [profileId, setProfileId] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<InternListItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  function load() {
    setLoading(true);
    fetch("/api/interns").then(r => r.json())
      .then((d: { ok: boolean; interns?: InternListItem[]; summary?: Summary }) => {
        if (d.ok) { setInterns(d.interns ?? []); setSummary(d.summary ?? null); }
      }).finally(() => setLoading(false));
  }
  function loadRefData() {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { departments: Department[] }) => setDepartments(d.departments ?? []));
    fetch("/api/interns/institutions").then(r => r.json())
      .then((d: { ok: boolean; institutions: Institution[] }) => setInstitutions(d.institutions ?? []));
    fetch("/api/interns/certificates").then(r => r.json())
      .then((d: { ok: boolean; certificates?: { intern_id: number; status: string }[] }) => {
        const ids = new Set((d.certificates ?? []).filter(c => c.status === "issued").map(c => c.intern_id));
        setCertifiedIds(ids);
      });
  }
  useEffect(() => { load(); loadRefData(); }, []);

  const filtered = useMemo(() => {
    let rows = interns;
    if (cardFilter === "active") rows = rows.filter(r => r.status === "active" || r.status === "ending_soon");
    else if (cardFilter) rows = rows.filter(r => r.status === cardFilter);
    if (deptFilter)  rows = rows.filter(r => r.department_id === deptFilter);
    if (instFilter)  rows = rows.filter(r => r.institution_id === instFilter);
    if (typeFilter)  rows = rows.filter(r => r.training_type === typeFilter);
    if (q.trim()) {
      const ql = q.trim().toLowerCase();
      rows = rows.filter(r =>
        fullName(r).toLowerCase().includes(ql) ||
        r.intern_code.toLowerCase().includes(ql) ||
        (r.institution_name ?? "").toLowerCase().includes(ql));
    }
    const sorted = [...rows].sort((a, b) => {
      const av = sortKey === "name" ? fullName(a) : a[sortKey];
      const bv = sortKey === "name" ? fullName(b) : b[sortKey];
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [interns, cardFilter, deptFilter, instFilter, typeFilter, q, sortKey, sortDir]);

  const alerts = useMemo(() => {
    const live = interns.filter(i => i.status !== "cancelled");
    return {
      startingSoon: live.filter(i => i.status === "upcoming" && daysFromToday(i.start_date) <= 7),
      endingSoon:   live.filter(i => i.status === "ending_soon"),
      doneNoCert:   live.filter(i => i.status === "completed" && !certifiedIds.has(i.id)),
      missingReferral: live.filter(i => !i.referral_letter_url && i.status !== "completed"),
      noSupervisor:    live.filter(i => !i.supervisor_name && i.status !== "completed"),
    };
  }, [interns, certifiedIds]);

  function openNew() { setEditing(null); setShowForm(true); }
  async function openEdit(row: InternListItem) {
    const r = await fetch(`/api/interns/${row.id}`);
    const d = await r.json() as { ok: boolean; intern?: InternDetail };
    if (d.ok && d.intern) { setEditing(d.intern); setShowForm(true); }
    setOpenMenuId(null);
  }
  async function issueCertificate(row: InternListItem) {
    setOpenMenuId(null);
    await fetch("/api/interns/certificates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ intern_id: row.id }),
    });
    loadRefData();
    setProfileId(row.id);
  }
  async function doCancel() {
    if (!confirmCancel) return;
    setCancelling(true);
    await fetch(`/api/interns/${confirmCancel.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_cancelled: true, cancel_reason: cancelReason || null }),
    });
    setCancelling(false); setConfirmCancel(null); setCancelReason(""); load();
  }

  const cardStyle = (clickable: boolean, active: boolean): React.CSSProperties => ({
    background: "#fff", borderRadius: 12, padding: "16px 18px", border: "1px solid #e5e7eb",
    borderTop: `3px solid ${active ? "#7c3aed" : "#e5e7eb"}`, cursor: clickable ? "pointer" : "default",
    transition: "all .15s", boxShadow: active ? "0 4px 14px rgba(124,58,237,.12)" : "none",
  });

  return (
    <PageLayout title="นักศึกษาฝึกงาน" accent="#7c3aed">
      {/* ── Summary cards ─────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
        <div style={cardStyle(true, cardFilter === "")} onClick={() => setCardFilter("")}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>นักศึกษาฝึกงานทั้งหมด</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0a1628", marginTop: 4 }}>{summary?.total ?? "—"}</div>
        </div>
        <div style={cardStyle(true, cardFilter === "active")} onClick={() => setCardFilter("active")}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>กำลังฝึกงานอยู่</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#16a34a", marginTop: 4 }}>{summary?.active ?? "—"}</div>
        </div>
        <div style={cardStyle(true, cardFilter === "upcoming")} onClick={() => setCardFilter("upcoming")}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>กำลังจะเริ่มฝึกงาน</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0891b2", marginTop: 4 }}>{summary?.upcoming ?? "—"}</div>
        </div>
        <div style={cardStyle(true, cardFilter === "completed")} onClick={() => setCardFilter("completed")}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>สิ้นสุดการฝึกงานแล้ว</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#64748b", marginTop: 4 }}>{summary?.completed ?? "—"}</div>
        </div>
        <div style={cardStyle(false, false)}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>จำนวนสถาบันการศึกษา</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0a1628", marginTop: 4 }}>{summary?.institutions ?? "—"}</div>
        </div>
        <div style={cardStyle(false, false)}>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>จำนวนแผนกที่รับฝึก</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#0a1628", marginTop: 4 }}>{summary?.departments ?? "—"}</div>
        </div>
      </div>

      {/* ── Smart alerts ──────────────────────────────────────── */}
      {(alerts.startingSoon.length + alerts.endingSoon.length + alerts.doneNoCert.length +
        alerts.missingReferral.length + alerts.noSupervisor.length) > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
          {alerts.endingSoon.length > 0 && (
            <AlertBar icon="⏰" color="#d97706" bg="#fffbeb" border="#fde68a"
              text={`มีนักศึกษาฝึกงาน ${alerts.endingSoon.length} คนที่จะสิ้นสุดการฝึกงานภายใน 7 วัน`}
              onClick={() => setCardFilter("active")} />
          )}
          {alerts.startingSoon.length > 0 && (
            <AlertBar icon="🆕" color="#0891b2" bg="#ecfeff" border="#a5f3fc"
              text={`มีนักศึกษาฝึกงาน ${alerts.startingSoon.length} คนที่จะเริ่มฝึกงานภายใน 7 วัน`}
              onClick={() => setCardFilter("upcoming")} />
          )}
          {alerts.doneNoCert.length > 0 && (
            <AlertBar icon="📜" color="#7c3aed" bg="#f5f3ff" border="#ddd6fe"
              text={`มีนักศึกษาฝึกงาน ${alerts.doneNoCert.length} คนที่สิ้นสุดแล้วแต่ยังไม่ได้ออกใบประกาศ`}
              onClick={() => setCardFilter("completed")} />
          )}
          {alerts.missingReferral.length > 0 && (
            <AlertBar icon="📄" color="#dc2626" bg="#fef2f2" border="#fecaca"
              text={`มีนักศึกษาฝึกงาน ${alerts.missingReferral.length} คนที่ยังไม่ได้อัปโหลดหนังสือส่งตัว`}
              onClick={() => setCardFilter("")} />
          )}
          {alerts.noSupervisor.length > 0 && (
            <AlertBar icon="👤" color="#b45309" bg="#fffbeb" border="#fde68a"
              text={`มีนักศึกษาฝึกงาน ${alerts.noSupervisor.length} คนที่ยังไม่ได้กำหนดผู้ควบคุมการฝึกงาน`}
              onClick={() => setCardFilter("")} />
          )}
        </div>
      )}

      {/* ── Tabs + toolbar ────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 2, background: "#fff", borderRadius: 8, padding: 4,
          border: "1px solid #e5e7eb", width: "fit-content" }}>
          {(["list", "calendar"] as ViewTab[]).map(t => (
            <button key={t} onClick={() => setViewTab(t)} style={{
              padding: "8px 16px", borderRadius: 6, border: "none", fontFamily: "inherit",
              fontSize: 12.5, fontWeight: viewTab === t ? 700 : 400, cursor: "pointer",
              background: viewTab === t ? "#7c3aed" : "transparent", color: viewTab === t ? "#fff" : "#64748b",
            }}>
              {t === "list" ? "📋 รายชื่อ" : "📅 ปฏิทินการฝึกงาน"}
            </button>
          ))}
        </div>
        <button onClick={openNew} style={{
          padding: "10px 20px", borderRadius: 9, border: "none", background: "#7c3aed", color: "#fff",
          fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
          boxShadow: "0 2px 10px rgba(124,58,237,.25)",
        }}>
          + เพิ่มนักศึกษาฝึกงาน
        </button>
      </div>

      {viewTab === "calendar" ? (
        <InternCalendar interns={interns} onOpenProfile={id => setProfileId(id)} />
      ) : (
        <>
          {/* Filters */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหาชื่อ / รหัส / สถาบัน…"
              style={{ padding: "8px 14px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5,
                fontFamily: "inherit", width: 220, outline: "none" }} />
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value ? Number(e.target.value) : "")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5, fontFamily: "inherit", background: "#fff" }}>
              <option value="">ทุกแผนก</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select value={instFilter} onChange={e => setInstFilter(e.target.value ? Number(e.target.value) : "")}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5, fontFamily: "inherit", background: "#fff" }}>
              <option value="">ทุกสถาบัน</option>
              {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5, fontFamily: "inherit", background: "#fff" }}>
              <option value="">ทุกรูปแบบ</option>
              {["ฝึกงาน", "สหกิจศึกษา", "ดูงาน", "ฝึกประสบการณ์วิชาชีพ", "อื่นๆ"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={`${sortKey}:${sortDir}`} onChange={e => { const [k, d] = e.target.value.split(":"); setSortKey(k as SortKey); setSortDir(d as "asc" | "desc"); }}
              style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb", fontSize: 12.5, fontFamily: "inherit", background: "#fff" }}>
              <option value="start_date:desc">วันเริ่ม ใหม่→เก่า</option>
              <option value="start_date:asc">วันเริ่ม เก่า→ใหม่</option>
              <option value="end_date:asc">วันสิ้นสุด ใกล้→ไกล</option>
              <option value="name:asc">ชื่อ ก→ฮ</option>
            </select>
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, background: "#fff", borderRadius: 12,
              border: "1px solid #e5e7eb", color: "#94a3b8" }}>ไม่มีข้อมูลนักศึกษาฝึกงาน</div>
          ) : (
            <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", overflow: "hidden" }}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "#faf9ff" }}>
                      {["รหัส", "ชื่อ–นามสกุล", "สถาบันการศึกษา", "สาขาวิชา", "แผนกที่ฝึก", "วันที่เริ่ม", "วันที่สิ้นสุด",
                        "ระยะเวลาคงเหลือ", "สถานะ", "ผู้ควบคุม", ""].map(h => (
                        <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "#475569",
                          borderBottom: "2px solid #e5e7eb", fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => {
                      const meta = STATUS_META[r.status] ?? STATUS_META.upcoming;
                      return (
                        <tr key={r.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafbff" }}>
                          <td style={{ padding: "9px 14px", fontFamily: "monospace", fontSize: 11, color: "#64748b" }}>{r.intern_code}</td>
                          <td style={{ padding: "9px 14px", fontWeight: 700, color: "#0a1628", whiteSpace: "nowrap" }}>{fullName(r)}</td>
                          <td style={{ padding: "9px 14px", color: "#475569", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.institution_name ?? "—"}</td>
                          <td style={{ padding: "9px 14px", color: "#475569" }}>{r.major ?? "—"}</td>
                          <td style={{ padding: "9px 14px", color: "#475569" }}>{r.department_name ?? "—"}</td>
                          <td style={{ padding: "9px 14px", color: "#64748b", whiteSpace: "nowrap" }}>{thaiDate(r.start_date)}</td>
                          <td style={{ padding: "9px 14px", color: "#64748b", whiteSpace: "nowrap" }}>{thaiDate(r.end_date)}</td>
                          <td style={{ padding: "9px 14px", fontWeight: 700,
                            color: r.status === "completed" || r.status === "cancelled" ? "#94a3b8" : r.days_remaining <= 7 ? "#d97706" : "#16a34a" }}>
                            {r.status === "completed" || r.status === "cancelled" ? "—" : `${r.days_remaining} วัน`}
                          </td>
                          <td style={{ padding: "9px 14px" }}>
                            <span style={{ background: meta.bg, color: meta.color, borderRadius: 20, padding: "3px 10px",
                              fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>{meta.label}</span>
                          </td>
                          <td style={{ padding: "9px 14px", color: "#475569" }}>{r.supervisor_name ?? "—"}</td>
                          <td style={{ padding: "9px 14px", position: "relative" }}>
                            <button onClick={() => setOpenMenuId(openMenuId === r.id ? null : r.id)}
                              style={{ border: "1px solid #e5e7eb", background: "#fff", borderRadius: 6,
                                width: 28, height: 28, cursor: "pointer", fontSize: 14, color: "#64748b" }}>⋮</button>
                            {openMenuId === r.id && (
                              <div onMouseLeave={() => setOpenMenuId(null)}
                                style={{ position: "absolute", right: 14, top: 34, background: "#fff",
                                  border: "1px solid #e5e7eb", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                                  zIndex: 20, minWidth: 170, overflow: "hidden" }}>
                                {[
                                  { label: "🔍 ดูรายละเอียด", onClick: () => { setProfileId(r.id); setOpenMenuId(null); } },
                                  { label: "✏️ แก้ไขข้อมูล", onClick: () => openEdit(r) },
                                  { label: "📅 ดูปฏิทิน", onClick: () => { setViewTab("calendar"); setOpenMenuId(null); } },
                                  { label: "📜 ออกใบประกาศ", onClick: () => issueCertificate(r) },
                                  { label: "📋 ดูประวัติ", onClick: () => { setProfileId(r.id); setOpenMenuId(null); } },
                                  ...(r.is_cancelled ? [] : [{ label: "🚫 ยกเลิกการฝึกงาน", onClick: () => { setConfirmCancel(r); setOpenMenuId(null); }, danger: true }]),
                                ].map((item, idx) => (
                                  <button key={idx} onClick={item.onClick}
                                    style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 14px",
                                      border: "none", background: "none", fontSize: 12.5, cursor: "pointer",
                                      fontFamily: "inherit", color: (item as { danger?: boolean }).danger ? "#dc2626" : "#334155" }}>
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {showForm && (
        <InternForm intern={editing} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); loadRefData(); }} />
      )}
      {profileId != null && (
        <InternProfile internId={profileId} onClose={() => setProfileId(null)}
          onChanged={() => { load(); loadRefData(); }} />
      )}
      {confirmCancel && (
        <div onClick={e => { if (e.target === e.currentTarget && !cancelling) setConfirmCancel(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)", zIndex: 400,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 420, width: "100%",
            border: "1px solid #fecaca", borderTop: "4px solid #dc2626" }}>
            <div style={{ fontSize: 28, textAlign: "center", marginBottom: 10 }}>🚫</div>
            <div style={{ fontSize: 15, fontWeight: 800, textAlign: "center", marginBottom: 6 }}>ยืนยันยกเลิกการฝึกงาน?</div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 16 }}>{fullName(confirmCancel)}</div>
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="เหตุผล (ไม่บังคับ)"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #e5e7eb",
                fontSize: 13, fontFamily: "inherit", outline: "none", marginBottom: 16, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmCancel(null)} disabled={cancelling}
                style={{ flex: 1, padding: "10px 0", borderRadius: 8, border: "1.5px solid #e5e7eb",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ปิด</button>
              <button onClick={doCancel} disabled={cancelling}
                style={{ flex: 2, padding: "10px 0", borderRadius: 8, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {cancelling ? "กำลังยกเลิก…" : "🚫 ยืนยันยกเลิก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function AlertBar({ icon, color, bg, border, text, onClick }: {
  icon: string; color: string; bg: string; border: string; text: string; onClick: () => void;
}) {
  return (
    <div onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
      background: bg, border: `1.5px solid ${border}`, borderRadius: 10, padding: "10px 16px" }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 12.5, color, fontWeight: 600, flex: 1 }}>{text}</span>
      <span style={{ fontSize: 11, color, opacity: 0.7 }}>ดูรายชื่อ →</span>
    </div>
  );
}
