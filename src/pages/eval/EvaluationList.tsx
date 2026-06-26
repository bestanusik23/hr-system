import { useEffect, useState } from "react";
import { useAuth, hasRole } from "../../context/AuthContext";
import EvaluationForm from "./EvaluationForm";

interface Evaluation {
  id: number; round: number; status: string; grade: string | null; total_score: number | null;
  full_name: string; emp_code: string | null; position: string | null; department_name: string | null; division_name: string | null;
  start_date: string | null; updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft:          "ร่าง (รอ HR ส่ง)",
  pending_head:   "รอหัวหน้าแผนก",
  pending_deputy: "รอรองผู้อำนวยการ",
  pending_hr:     "รอ HR ประเมิน",
  pending_final:  "รออนุมัติสุดท้าย",
  approved:       "อนุมัติแล้ว",
  rejected:       "ไม่อนุมัติ",
};
const STATUS_COLOR: Record<string, string> = {
  draft:          "#94a3b8",
  pending_head:   "#d97706",
  pending_deputy: "#c2410c",
  pending_hr:     "#1d4ed8",
  pending_final:  "#7c3aed",
  approved:       "#16a34a",
  rejected:       "#ef4444",
};

function gradeFromScore(s: number | null): string {
  if (s === null) return "—";
  if (s >= 90) return "A"; if (s >= 80) return "B"; if (s >= 70) return "C";
  if (s >= 60) return "D"; if (s >= 50) return "E"; return "F";
}

export default function EvaluationList() {
  const { user } = useAuth();
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  function showToast(msg: string, type: "success" | "error" = "success") {
    console.log("[EvaluationList] showToast:", msg, type);
    const el = document.createElement("div");
    el.textContent = msg;
    Object.assign(el.style, {
      position: "fixed", bottom: "28px", left: "50%", transform: "translateX(-50%)",
      background: type === "error" ? "#dc2626" : "#16a34a",
      color: "#fff", borderRadius: "10px", padding: "13px 22px",
      fontSize: "14px", fontWeight: "600", fontFamily: "inherit",
      boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
      zIndex: "99999", whiteSpace: "nowrap", maxWidth: "90vw",
    });
    document.body.appendChild(el);
    setTimeout(() => { if (document.body.contains(el)) document.body.removeChild(el); }, 3500);
  }

  async function deleteEval(ev: Evaluation, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`ยืนยันลบใบประเมินของ "${ev.full_name}" รอบ ${ev.round} วัน?`)) return;
    setDeleting(ev.id);
    const r = await fetch(`/api/eval/evaluations/${ev.id}`, { method: "DELETE" });
    const d = await r.json() as { ok: boolean; error?: string };
    setDeleting(null);
    if (!d.ok) { alert(d.error ?? "ลบไม่สำเร็จ"); return; }
    setEvals(prev => prev.filter(x => x.id !== ev.id));
  }

  async function sendToHead(ev: Evaluation, e: React.MouseEvent) {
    e.stopPropagation();
    setDeleting(ev.id);
    const r = await fetch(`/api/eval/evaluations/${ev.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_to_head" }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setDeleting(null);
    if (!d.ok) { showToast(d.error ?? "ส่งไม่สำเร็จ", "error"); return; }
    setEvals(prev => prev.map(x => x.id === ev.id ? { ...x, status: "pending_head" } : x));
    showToast(`✅ ส่งใบประเมินของ "${ev.full_name}" ให้หัวหน้าแผนกเรียบร้อยแล้ว`);
  }

  async function sendToDeputyDirect(ev: Evaluation, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm(`ส่งตรงถึงรองผู้อำนวยการ (ข้ามหัวหน้าแผนก) สำหรับ "${ev.full_name}"?`)) return;
    setDeleting(ev.id);
    const r = await fetch(`/api/eval/evaluations/${ev.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send_to_deputy_direct" }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setDeleting(null);
    if (!d.ok) { showToast(d.error ?? "ส่งไม่สำเร็จ", "error"); return; }
    setEvals(prev => prev.map(x => x.id === ev.id ? { ...x, status: "pending_deputy" } : x));
    showToast(`✅ ส่งตรงรองผู้อำนวยการเรียบร้อยแล้ว`);
  }

  const isHR = user && hasRole(user, "hr", "admin");

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/eval/evaluations?status=${statusFilter}`);
    const d = await r.json() as { ok: boolean; evaluations: Evaluation[] };
    setEvals(d.evaluations ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  const canCreate = user && hasRole(user, "hr", "head", "admin");

  // Filter tabs scoped to what each role cares about
  const filters: [string, string][] =
    user?.role === "head"      ? [["", "ทั้งหมด"], ["pending_head", "รอฉันประเมิน"], ["pending_deputy", "รอรองฯ"], ["approved", "อนุมัติแล้ว"]]
    : user?.role === "deputy"  ? [["", "ทั้งหมด"], ["pending_deputy", "รอฉันอนุมัติ"], ["approved", "อนุมัติแล้ว"], ["rejected", "ไม่อนุมัติ"]]
    : user?.role === "hr"      ? [["", "ทั้งหมด"], ["draft", "รอส่งให้หัวหน้า"], ["pending_head", "รอหัวหน้าประเมิน"], ["pending_hr", "รอ HR ประเมิน"], ["approved", "อนุมัติแล้ว"]]
    : user?.role === "deputyHR"? [["", "ทั้งหมด"], ["pending_final", "รอฉันอนุมัติ"], ["approved", "อนุมัติแล้ว"], ["rejected", "ไม่อนุมัติ"]]
    : [["", "ทั้งหมด"], ["draft", "ร่าง"], ["pending_head", "รอหัวหน้า"], ["pending_deputy", "รอรองฯ"], ["pending_hr", "รอ HR"], ["pending_final", "รออนุมัติสุดท้าย"], ["approved", "อนุมัติแล้ว"]];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {filters.map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={{
              padding: "7px 16px", borderRadius: 7, border: "1.5px solid",
              borderColor: statusFilter === k ? "#0038C6" : "#dce4f5",
              background: statusFilter === k ? "#0038C6" : "#fff",
              color: statusFilter === k ? "#fff" : "#475569",
              fontFamily: "inherit", fontSize: 12, fontWeight: statusFilter === k ? 700 : 400,
              cursor: "pointer", transition: "all .15s",
            }}>{v}</button>
          ))}
        </div>
        {canCreate && (
          <button onClick={() => setShowNew(true)} style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,56,198,0.25)" }}>
            + สร้างใบประเมิน
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : evals.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีใบประเมิน</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {evals.map(ev => {
            const accentColor = ev.status === "draft" ? "#94a3b8"
              : ev.status === "pending_head" ? "#d97706"
              : "#0038C6";
            return (
            <div key={ev.id} onClick={() => setSelected(ev.id)} style={{ background: "#fff", borderRadius: 8, padding: "16px 20px", border: "1px solid #dce4f5", borderLeft: `4px solid ${accentColor}`, cursor: "pointer", display: "flex", alignItems: "center", gap: 16, transition: "box-shadow .15s, transform .15s" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,56,198,0.12)"; e.currentTarget.style.transform = "translateX(2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${accentColor}18`, color: accentColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, flexShrink: 0 }}>
                {ev.round === 30 ? "①" : ev.round === 60 ? "②" : "③"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {ev.emp_code && <span style={{ fontFamily: "monospace", fontSize: 11, color: "#0038c6", fontWeight: 700, marginRight: 6, background: "#eff6ff", padding: "2px 6px", borderRadius: 5 }}>{ev.emp_code}</span>}
                  {ev.full_name}
                </div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>รอบ {ev.round} วัน · {ev.department_name ?? "—"} · {ev.division_name ?? "—"}</div>
                {ev.total_score !== null && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>คะแนน {ev.total_score}/100 · เกรด {gradeFromScore(ev.total_score)}</div>}
              </div>
              <span style={{ background: STATUS_COLOR[ev.status] + "22", color: STATUS_COLOR[ev.status], borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                {STATUS_LABEL[ev.status]}
              </span>
              {/* HR quick-send buttons on draft cards */}
              {ev.status === "draft" && isHR && (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button
                    onClick={e => sendToHead(ev, e)}
                    disabled={deleting === ev.id}
                    title="ส่งให้หัวหน้าแผนกประเมิน"
                    style={{ padding: "5px 12px", borderRadius: 7, border: "none",
                      background: "#0038C6", color: "#fff", fontSize: 11, cursor: "pointer",
                      fontFamily: "inherit", fontWeight: 700,
                      opacity: deleting === ev.id ? 0.5 : 1 }}>
                    {deleting === ev.id ? "…" : "ส่งหัวหน้า →"}
                  </button>
                  <button
                    onClick={e => sendToDeputyDirect(ev, e)}
                    disabled={deleting === ev.id}
                    title="ส่งตรงรองผู้อำนวยการ (ข้ามหัวหน้าแผนก)"
                    style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #c2410c",
                      background: "#fff5f5", color: "#c2410c", fontSize: 11, cursor: "pointer",
                      fontFamily: "inherit", fontWeight: 700,
                      opacity: deleting === ev.id ? 0.5 : 1 }}>
                    ส่งตรงรองฯ →
                  </button>
                </div>
              )}
              {/* Delete button: HR/admin can delete any status */}
              {(isHR || ["draft", "pending_head"].includes(ev.status)) && (
                <button
                  onClick={e => deleteEval(ev, e)}
                  disabled={deleting === ev.id}
                  title="ลบใบประเมิน"
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1.5px solid #fecaca",
                    background: "#fff", color: "#dc2626", fontSize: 16, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    opacity: deleting === ev.id ? 0.5 : 1, transition: "all .15s" }}>
                  {deleting === ev.id ? "…" : "×"}
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {selected !== null && (
        <EvaluationForm evalId={selected} onClose={() => setSelected(null)}
          onSaved={(msg?: string) => { setSelected(null); load(); showToast(msg ?? "✅ บันทึกเรียบร้อยแล้ว"); }} />
      )}
      {showNew && (
        <NewEvalDialog onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />
      )}

    </div>
  );
}

function NewEvalDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [employees,  setEmployees]  = useState<{ id: number; full_name: string }[]>([]);
  const [templates,  setTemplates]  = useState<{ id: number; name: string }[]>([]);
  const [empId,      setEmpId]      = useState<number | "">("");
  const [round,      setRound]      = useState<30 | 60 | 90>(30);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [search,     setSearch]     = useState("");
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/eval/employees?status=probation").then(r => r.json()),
      fetch("/api/eval/templates").then(r => r.json()),
    ]).then(([ed, td]) => {
      setEmployees((ed as { employees: { id: number; full_name: string }[] }).employees ?? []);
      setTemplates((td as { templates: { id: number; name: string }[] }).templates ?? []);
    });
  }, []);

  const filteredTemplates = search.trim()
    ? templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))
    : templates;

  async function create() {
    if (!empId) { setError("กรุณาเลือกพนักงาน"); return; }
    setSaving(true);
    const r = await fetch("/api/eval/evaluations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: empId, round, template_id: templateId || null }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  const sel: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid #c4cfee", fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 10, padding: 32, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,56,198,0.25)", border: "1px solid #c4cfee", borderTop: "4px solid #0038C6" }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
          สร้างใบประเมินใหม่
        </div>

        {/* Employee */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>พนักงาน *</label>
          <select value={empId} onChange={e => setEmpId(Number(e.target.value))} style={sel}>
            <option value="">-- เลือกพนักงาน --</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>

        {/* Round */}
        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>รอบประเมิน *</label>
          <div style={{ display: "flex", gap: 8 }}>
            {([30, 60, 90] as const).map(r => (
              <button key={r} onClick={() => setRound(r)}
                style={{ flex: 1, padding: "9px 0", borderRadius: 7, border: "1.5px solid",
                  borderColor: round === r ? "#0038C6" : "#dce4f5",
                  background: round === r ? "#0038C6" : "#fff",
                  color: round === r ? "#fff" : "#475569", fontFamily: "inherit", fontSize: 14, fontWeight: round === r ? 700 : 400, cursor: "pointer" }}>
                {r} วัน
              </button>
            ))}
          </div>
        </div>

        {/* Template */}
        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>แบบประเมินตามตำแหน่ง <span style={{ color: "#94a3b8", fontWeight: 400 }}>(เว้นว่าง = ใช้แบบมาตรฐาน 10 ข้อ)</span></label>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาตำแหน่ง เช่น พยาบาล, บัญชี…"
            style={{ ...sel, marginBottom: 6 }} />
          <select value={templateId} onChange={e => setTemplateId(e.target.value ? Number(e.target.value) : "")} style={sel} size={5}>
            <option value="">— ใช้แบบมาตรฐาน 10 ข้อ —</option>
            {filteredTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {templateId && (
            <div style={{ marginTop: 6, fontSize: 12, color: "#0038C6", fontWeight: 600 }}>
              ✓ เลือก: {templates.find(t => t.id === templateId)?.name}
            </div>
          )}
        </div>

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "1.5px solid #c4cfee", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
          <button onClick={create} disabled={saving}
            style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none", background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังสร้าง…" : "สร้างใบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 };
