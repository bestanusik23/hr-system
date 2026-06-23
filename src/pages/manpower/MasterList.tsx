import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { tenure, formatThaiDate } from "../../utils/date";
import MasterEmployeeForm, { type MasterEmployee } from "./MasterEmployeeForm";

interface Division { id: number; name: string; }

const STATUS_FILTERS: [string, string][] = [
  ["", "ทั้งหมด"],
  ["active", "Active"],
  ["probation", "ทดลองงาน"],
  ["resigned", "ลาออก"],
];

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  probation:   { label: "ทดลองงาน",      color: "#d97706", bg: "#fef3c7" },
  passed:      { label: "Active",        color: "#16a34a", bg: "#dcfce7" },
  transferred: { label: "ย้ายแผนก",      color: "#0891b2", bg: "#cffafe" },
  resigned:    { label: "ลาออก",         color: "#64748b", bg: "#f1f5f9" },
};

export default function MasterList({ onChanged }: { onChanged: () => void }) {
  const { user } = useAuth();
  const [rows, setRows]       = useState<MasterEmployee[]>([]);
  const [divisions, setDivs]  = useState<Division[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ]             = useState("");
  const [status, setStatus]   = useState("");
  const [divId, setDivId]     = useState("");
  const [editing, setEditing] = useState<MasterEmployee | null>(null);
  const [confirmDel, setConfirmDel] = useState<MasterEmployee | null>(null);
  const [delErr, setDelErr]   = useState("");
  const [deleting, setDeleting] = useState(false);

  const canEdit = user && ["hr", "admin"].includes(user.role);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (divId)  params.set("division_id", divId);
    if (q.trim()) params.set("q", q.trim());
    const r = await fetch(`/api/manpower/employees?${params}`);
    const d = await r.json() as { employees: MasterEmployee[] };
    setRows(d.employees ?? []);
    setLoading(false);
  }

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { divisions: Division[] }) => setDivs(d.divisions ?? []));
  }, []);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q, status, divId]);

  async function doDelete() {
    if (!confirmDel) return;
    setDeleting(true); setDelErr("");
    const r = await fetch(`/api/manpower/employees/${confirmDel.id}`, { method: "DELETE" });
    const d = await r.json() as { ok: boolean; error?: string };
    setDeleting(false);
    if (!d.ok) { setDelErr(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setConfirmDel(null); load(); onChanged();
  }

  const th: React.CSSProperties = { padding: "10px 12px", textAlign: "left", fontWeight: 700,
    color: "#475569", borderBottom: "2px solid #e2e8f0", fontSize: 11.5, whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", fontSize: 12.5, color: "#1e293b", whiteSpace: "nowrap" };

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="🔍 ค้นหาชื่อ / ตำแหน่ง…"
          style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", width: 240 }} />
        <select value={divId} onChange={e => setDivId(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}>
          <option value="">ทุกฝ่าย</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div style={{ display: "flex", gap: 6 }}>
          {STATUS_FILTERS.map(([k, v]) => (
            <button key={k} onClick={() => setStatus(k)} style={{
              padding: "7px 14px", borderRadius: 20, border: "1.5px solid",
              borderColor: status === k ? "#0891b2" : "#e2e8f0",
              background: status === k ? "#0891b2" : "#fff",
              color: status === k ? "#fff" : "#475569",
              fontSize: 12, fontWeight: status === k ? 700 : 400, cursor: "pointer", fontFamily: "inherit",
            }}>{v}</button>
          ))}
        </div>
        <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: "auto" }}>{rows.length} คน</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 50, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: 50, color: "#94a3b8", background: "#fff", borderRadius: 12 }}>
          ไม่พบข้อมูลพนักงาน
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={th}>ชื่อ-นามสกุล</th>
                  <th style={th}>ตำแหน่ง</th>
                  <th style={th}>แผนก</th>
                  <th style={th}>ฝ่าย</th>
                  <th style={th}>ประเภท</th>
                  <th style={th}>เริ่มงาน</th>
                  <th style={th}>อายุงาน</th>
                  <th style={th}>หัวหน้างาน</th>
                  <th style={th}>สถานะ</th>
                  {canEdit && <th style={{ ...th, textAlign: "center" }}>จัดการ</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((e, i) => {
                  const badge = STATUS_BADGE[e.emp_status] ?? STATUS_BADGE.probation;
                  return (
                    <tr key={e.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 ? "#fafbff" : "#fff",
                      opacity: e.emp_status === "resigned" ? 0.6 : 1 }}>
                      <td style={{ ...td, fontWeight: 600 }}>{e.full_name}</td>
                      <td style={td}>{e.position ?? "—"}</td>
                      <td style={td}>{e.department_name ?? "—"}</td>
                      <td style={td}>{e.division_name ?? "—"}</td>
                      <td style={td}>{e.emp_type ?? "—"}</td>
                      <td style={td}>{formatThaiDate(e.start_date)}</td>
                      <td style={td}>{tenure(e.start_date)}</td>
                      <td style={td}>{e.supervisor ?? "—"}</td>
                      <td style={td}>
                        <span style={{ background: badge.bg, color: badge.color, borderRadius: 20,
                          padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{badge.label}</span>
                      </td>
                      {canEdit && (
                        <td style={{ ...td, textAlign: "center" }}>
                          <button onClick={() => setEditing(e)} title="แก้ไข"
                            style={{ background: "#f1f5f9", border: "none", borderRadius: 7, padding: "5px 9px",
                              cursor: "pointer", fontSize: 13, marginRight: 4 }}>✏️</button>
                          <button onClick={() => { setConfirmDel(e); setDelErr(""); }} title="ลบ"
                            style={{ background: "#fee2e2", border: "none", borderRadius: 7, padding: "5px 9px",
                              cursor: "pointer", fontSize: 13 }}>🗑️</button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {editing && (
        <MasterEmployeeForm employee={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); onChanged(); }} />
      )}

      {confirmDel && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px", maxWidth: 420, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 800, fontSize: 16, textAlign: "center", marginBottom: 6 }}>ยืนยันลบพนักงาน</div>
            <div style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              ลบ <b style={{ color: "#dc2626" }}>{confirmDel.full_name}</b> ออกจากฐานข้อมูล?<br />
              <span style={{ fontSize: 12 }}>หากพนักงานลาออก แนะนำให้ใช้เมนู “บันทึกลาออก” แทนการลบ</span>
            </div>
            {delErr && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{delErr}</div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDel(null)}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#64748b", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                ยกเลิก
              </button>
              <button onClick={doDelete} disabled={deleting}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 14,
                  cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: deleting ? 0.7 : 1 }}>
                {deleting ? "กำลังลบ…" : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
