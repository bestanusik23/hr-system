import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import EvaluationForm from "./EvaluationForm";

interface Evaluation {
  id: number; round: number; status: string; grade: string | null; total_score: number | null;
  full_name: string; position: string | null; department_name: string | null; division_name: string | null;
  start_date: string | null; updated_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "ร่าง", head_submitted: "หัวหน้าส่งแล้ว", pending_deputy: "รออนุมัติรอง",
  approved: "อนุมัติแล้ว", rejected: "ไม่อนุมัติ",
};
const STATUS_COLOR: Record<string, string> = {
  draft: "#94a3b8", head_submitted: "#f59e0b", pending_deputy: "#0891b2",
  approved: "#16a34a", rejected: "#ef4444",
};

export default function EvaluationList() {
  const { user } = useAuth();
  const [evals, setEvals] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/eval/evaluations?status=${statusFilter}`);
    const d = await r.json() as { ok: boolean; evaluations: Evaluation[] };
    setEvals(d.evaluations ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  const canCreate = user && ["hr", "head", "admin"].includes(user.role);
  const pendingApproval = user && ["deputy", "deputyHR"].includes(user.role);

  const filters = pendingApproval
    ? [["", "ทั้งหมด"], ["pending_deputy", "รออนุมัติ"], ["approved", "อนุมัติแล้ว"], ["rejected", "ไม่อนุมัติ"]]
    : [["", "ทั้งหมด"], ["draft", "ร่าง"], ["pending_deputy", "รออนุมัติ"], ["approved", "อนุมัติแล้ว"]];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {filters.map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={{
              padding: "6px 14px", borderRadius: 8, border: "1.5px solid",
              borderColor: statusFilter === k ? "#16A34A" : "#e2e8f0",
              background: statusFilter === k ? "#16A34A" : "#fff",
              color: statusFilter === k ? "#fff" : "#475569",
              fontFamily: "inherit", fontSize: 13, cursor: "pointer",
            }}>{v}</button>
          ))}
        </div>
        {canCreate && (
          <button onClick={() => setShowNew(true)} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: "#16A34A", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
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
          {evals.map(ev => (
            <div key={ev.id} onClick={() => setSelected(ev.id)} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, transition: "box-shadow .15s" }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.12)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.07)")}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#16A34A22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                {ev.round === 30 ? "①" : ev.round === 60 ? "②" : "③"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{ev.full_name}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>รอบ {ev.round} วัน · {ev.department_name ?? "—"} · {ev.division_name ?? "—"}</div>
                {ev.total_score !== null && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>คะแนน {ev.total_score}/100{ev.grade ? ` · เกรด ${ev.grade}` : ""}</div>}
              </div>
              <span style={{ background: STATUS_COLOR[ev.status] + "22", color: STATUS_COLOR[ev.status], borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                {STATUS_LABEL[ev.status]}
              </span>
            </div>
          ))}
        </div>
      )}

      {selected !== null && (
        <EvaluationForm evalId={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
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

  const sel: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: "100%", maxWidth: 460, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
        <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 20 }}>สร้างใบประเมินใหม่</div>

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
                style={{ flex: 1, padding: "9px 0", borderRadius: 9, border: "1.5px solid",
                  borderColor: round === r ? "#16A34A" : "#e2e8f0",
                  background: round === r ? "#16A34A" : "#fff",
                  color: round === r ? "#fff" : "#475569", fontFamily: "inherit", fontSize: 14, cursor: "pointer" }}>
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
            <div style={{ marginTop: 6, fontSize: 12, color: "#16a34a", fontWeight: 600 }}>
              ✓ เลือก: {templates.find(t => t.id === templateId)?.name}
            </div>
          )}
        </div>

        {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ยกเลิก</button>
          <button onClick={create} disabled={saving}
            style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#16A34A", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังสร้าง…" : "สร้างใบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6 };
