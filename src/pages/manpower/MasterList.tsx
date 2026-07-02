import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { tenure, formatThaiDate } from "../../utils/date";
import MasterEmployeeForm, { type MasterEmployee } from "./MasterEmployeeForm";

interface Division { id: number; name: string; }

// Keyword → candidate substrings to look for in the real division names (fetched live from
// /api/eval/org, not hardcoded IDs — the actual division list/IDs can differ from any static
// assumption, e.g. "ฝ่ายบัญชี" and "ศูนย์มะเร็ง" turned out to be their own divisions rather
// than folded into "ฝ่ายการเงิน"/"ฝ่ายเทคนิคบริการ"). First matching hint wins.
const POSITION_DIVISION_HINTS: [RegExp, string[]][] = [
  [/ผู้ป่วยใน|ห้องผ่าตัด|ห้องคลอด|ผู้ป่วยหนัก|ผู้ป่วยเด็ก|จ่ายกลาง|เครื่องมือแพทย์/, ["บริการส่วนใน", "บริการ"]],
  [/ผู้ป่วยนอก|อุบัติเหตุ|ฉุกเฉิน|ศูนย์สุขภาพ|sleep|คลินิก|บริการส่วนหน้า/i, ["พยาบาลส่วนหน้า", "บริการส่วนหน้า"]],
  [/เภสัช|รังสี|เทคนิคการแพทย์|กายภาพ/, ["เทคนิคบริการ"]],
  [/มะเร็ง|เคมีบำบัด/, ["มะเร็ง", "เทคนิคบริการ"]],
  [/บัญชี|สินทรัพย์/, ["บัญชี"]],
  [/การเงิน|จัดซื้อ|พัสดุ|คลังยา/, ["การเงิน"]],
  [/ทรัพยากรบุคคล|พัฒนาคุณภาพ/, ["ค่าตอบแทน", "บุคคล"]],
  [/การตลาด|ประชาสัมพันธ์|ขายและ|ต้อนรับ/, ["พัฒนาองค์กร", "การตลาด"]],
  [/ซ่อมบำรุง|อาคารสถานที่|แม่บ้าน|โภชนาการ|ซักฟอก|ยานยนต์|เวรเปล/, ["สนับสนุน"]],
  [/เลขานุการ|ธุรการ|ประสานสิทธิ|เวชระเบียน|เวชสถิติ|สารสนเทศ|ประสานงานแพทย์|ทบทวนการใช้ทรัพยากร|^UR/i, ["ผู้อำนวยการ", "สำนักงาน"]],
  [/แพทย์(?!ฉุกเฉิน)/, ["การแพทย์"]],
];

function suggestDivisionId(position: string, divisions: Division[]): number | "" {
  for (const [re, hints] of POSITION_DIVISION_HINTS) {
    if (!re.test(position)) continue;
    for (const hint of hints) {
      const match = divisions.find(d => d.name.includes(hint));
      if (match) return match.id;
    }
  }
  return "";
}

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
  const [loadErr, setLoadErr] = useState("");
  const [autoAssignOpen, setAutoAssignOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Record<number, number | "">>({});
  const [savingBulk, setSavingBulk] = useState(false);
  const [bulkErr, setBulkErr] = useState("");
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);

  const canEdit = user && ["hr", "admin"].includes(user.role);

  async function load() {
    setLoading(true);
    setLoadErr("");
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (divId)  params.set("division_id", divId);
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/manpower/employees?${params}`);
      const d = await r.json() as { ok?: boolean; employees: MasterEmployee[]; error?: string };
      if (d.ok === false) { setLoadErr(d.error ?? "โหลดข้อมูลไม่สำเร็จ"); setLoading(false); return; }
      setRows(d.employees ?? []);
    } catch {
      setLoadErr("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    }
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

  function openAutoAssign() {
    const initial: Record<number, number | ""> = {};
    for (const e of rows) initial[e.id] = suggestDivisionId(e.position ?? "", divisions);
    setSuggestions(initial);
    setBulkErr("");
    setAutoAssignOpen(true);
  }

  async function saveAutoAssign() {
    const entries = Object.entries(suggestions).filter(([, v]) => v !== "");
    if (entries.length === 0) { setBulkErr("ยังไม่ได้เลือกฝ่ายให้ใครเลย"); return; }
    setSavingBulk(true); setBulkErr("");
    setBulkProgress({ done: 0, total: entries.length });
    let failed = 0;
    for (let i = 0; i < entries.length; i++) {
      const [empId, division_id] = entries[i];
      try {
        const r = await fetch(`/api/manpower/employees/${empId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ division_id }),
        });
        const d = await r.json() as { ok: boolean };
        if (!d.ok) failed++;
      } catch {
        failed++;
      }
      setBulkProgress({ done: i + 1, total: entries.length });
    }
    setSavingBulk(false);
    if (failed > 0) { setBulkErr(`บันทึกไม่สำเร็จ ${failed} รายการ จากทั้งหมด ${entries.length} รายการ`); }
    else { setAutoAssignOpen(false); }
    load(); onChanged();
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
          <option value="none" style={{ color: "#dc2626" }}>⚠ ไม่ระบุฝ่าย</option>
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
        {canEdit && divId === "none" && rows.length > 0 && (
          <button onClick={openAutoAssign}
            style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: "#7c3aed",
              color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
            🪄 เดาฝ่ายจากตำแหน่งอัตโนมัติ
          </button>
        )}
        <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: "auto" }}>{rows.length} คน</span>
      </div>

      {loadErr ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, color: "#dc2626" }}>
          {loadErr}
        </div>
      ) : loading ? (
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
                  <th style={th}>รหัสพนักงาน</th>
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
                      <td style={{ ...td, fontFamily: "monospace", fontSize: 12, color: "#0038c6", fontWeight: 700 }}>
                        {(e as unknown as { emp_code?: string }).emp_code ?? "—"}
                      </td>
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

      {autoAssignOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "24px 28px", maxWidth: 640, width: "100%",
            maxHeight: "85vh", display: "flex", flexDirection: "column",
            boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>🪄 เดาฝ่ายจากตำแหน่งอัตโนมัติ</div>
            <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
              ตรวจสอบและแก้ไขฝ่ายที่ระบบเดาให้ก่อนบันทึก ({rows.length} คน)
            </div>

            <div style={{ overflowY: "auto", flex: 1, border: "1px solid #e2e8f0", borderRadius: 10 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                    <th style={th}>ชื่อ</th>
                    <th style={th}>ตำแหน่ง</th>
                    <th style={th}>ฝ่ายที่เลือก</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(e => (
                    <tr key={e.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={td}>{e.full_name}</td>
                      <td style={td}>{e.position || "-"}</td>
                      <td style={{ ...td, whiteSpace: "normal" }}>
                        <select value={suggestions[e.id] ?? ""}
                          onChange={ev => setSuggestions(prev => ({ ...prev, [e.id]: ev.target.value ? Number(ev.target.value) : "" }))}
                          style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                            fontSize: 12.5, fontFamily: "inherit", background: "#fff", cursor: "pointer", width: "100%" }}>
                          <option value="">-- เลือก --</option>
                          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {bulkErr && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, color: "#dc2626", marginTop: 14 }}>{bulkErr}</div>
            )}
            {bulkProgress && savingBulk && (
              <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 10 }}>
                กำลังบันทึก {bulkProgress.done} / {bulkProgress.total}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <button onClick={() => setAutoAssignOpen(false)} disabled={savingBulk}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#64748b", fontWeight: 700, fontSize: 14,
                  cursor: savingBulk ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                ยกเลิก
              </button>
              <button onClick={saveAutoAssign} disabled={savingBulk}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none",
                  background: "#7c3aed", color: "#fff", fontWeight: 700, fontSize: 14,
                  cursor: savingBulk ? "not-allowed" : "pointer", fontFamily: "inherit", opacity: savingBulk ? 0.7 : 1 }}>
                {savingBulk ? "กำลังบันทึก…" : "บันทึกทั้งหมด"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
