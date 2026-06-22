import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import EmployeeForm from "./EmployeeForm";
import EvaluationForm from "./EvaluationForm";

interface Employee {
  id: number; emp_code: string | null; full_name: string; position: string | null; start_date: string | null;
  emp_status: string; department_name: string | null; division_name: string | null;
  color: string | null; initial: string | null; department_id: number | null; division_id: number | null;
}
interface EvalSummary { employee_id: number; round: number; status: string; id: number; }

const STATUS_LABEL: Record<string, string> = {
  probation: "ทดลองงาน", passed: "ผ่านทดลองงาน", transferred: "ย้ายแผนก", resigned: "ลาออก",
};
const STATUS_COLOR: Record<string, string> = {
  probation: "#f59e0b", passed: "#16a34a", transferred: "#0891b2", resigned: "#94a3b8",
};

function toGregorian(dateStr: string): Date {
  const d = new Date(dateStr);
  // Year >= 2500 → Buddhist Era, convert to Gregorian
  if (d.getFullYear() >= 2500) return new Date(d.getFullYear() - 543, d.getMonth(), d.getDate());
  return d;
}

function daysSince(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.floor((Date.now() - toGregorian(dateStr).getTime()) / 86400000);
}

// Determine state of each 30/60/90 round for a given employee
function roundState(days: number | null, round: 30 | 60 | 90, evals: EvalSummary[], empId: number) {
  const ev = evals.find(e => e.employee_id === empId && e.round === round);
  if (ev) {
    if (ev.status === "approved") return { state: "done", evalId: ev.id };
    if (["pending_deputy", "pending_hr", "pending_final"].includes(ev.status))
      return { state: "pending", evalId: ev.id };
    return { state: "draft", evalId: ev.id };
  }
  if (days === null) return { state: "waiting", evalId: null };
  const start = round - 7; // alert window: 7 days before due
  if (days >= round) return { state: "overdue", evalId: null };
  if (days >= start) return { state: "soon", evalId: null };
  return { state: "waiting", evalId: null };
}

const ROUND_STATE_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
  done:    { bg: "#dcfce7", color: "#16a34a", border: "#bbf7d0", label: "✓ อนุมัติแล้ว" },
  pending: { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe", label: "⏳ รออนุมัติ" },
  draft:   { bg: "#fef9c3", color: "#b45309", border: "#fde68a", label: "📝 ร่าง" },
  soon:    { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa", label: "⚠ ใกล้ครบ" },
  overdue: { bg: "#fee2e2", color: "#dc2626", border: "#fecaca", label: "🔴 เกินกำหนด" },
  waiting: { bg: "#f1f5f9", color: "#94a3b8", border: "#e2e8f0", label: "รอถึงรอบ" },
};

export default function EmployeeList() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [evals, setEvals]         = useState<EvalSummary[]>([]);
  const [loading, setLoading]     = useState(true);
  const [statusFilter, setStatusFilter] = useState("probation");
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Employee | null>(null);
  const [openEvalId, setOpenEvalId] = useState<number | null>(null);
  const [creatingFor, setCreatingFor] = useState<{ empId: number; round: 30 | 60 | 90 } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);

  const canEdit   = user && ["hr", "admin"].includes(user.role);
  const canDelete = user && ["hr", "admin"].includes(user.role);

  async function load() {
    setLoading(true);
    const [empRes, evalRes] = await Promise.all([
      fetch(`/api/eval/employees?status=${statusFilter}`).then(r => r.json()),
      fetch("/api/eval/evaluations").then(r => r.json()),
    ]);
    setEmployees((empRes as { employees: Employee[] }).employees ?? []);
    setEvals((evalRes as { evaluations: EvalSummary[] }).evaluations ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function deleteEmployee() {
    if (!confirmDelete) return;
    setDeleting(true); setDeleteError("");
    const r = await fetch(`/api/eval/employees/${confirmDelete.id}`, { method: "DELETE" });
    const d = await r.json() as { ok: boolean; error?: string };
    setDeleting(false);
    if (!d.ok) { setDeleteError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setConfirmDelete(null);
    load();
  }

  async function createEval(empId: number, round: 30 | 60 | 90) {
    setCreatingFor({ empId, round });
    const r = await fetch("/api/eval/evaluations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: empId, round }),
    });
    const d = await r.json() as { ok: boolean; id?: number; error?: string };
    setCreatingFor(null);
    if (d.ok && d.id) { await load(); setOpenEvalId(d.id); }
  }

  return (
    <div>
      {/* Filter + Add */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              style={{ padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                fontFamily: "inherit", fontSize: 13, cursor: "pointer",
                borderColor: statusFilter === k ? STATUS_COLOR[k] : "#e2e8f0",
                background:  statusFilter === k ? STATUS_COLOR[k] : "#fff",
                color:       statusFilter === k ? "#fff" : "#475569", fontWeight: statusFilter === k ? 700 : 400 }}>
              {v}
            </button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#0038C6",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 2px 8px rgba(0,56,198,0.25)" }}>
            + เพิ่มพนักงานใหม่
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : employees.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8",
          background: "#fff", borderRadius: 14 }}>ไม่มีพนักงานในสถานะนี้</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {employees.map(emp => {
            const days = daysSince(emp.start_date);
            const rounds = ([30, 60, 90] as const).map(r => ({
              round: r, ...roundState(days, r, evals, emp.id),
            }));
            const hasAlert = rounds.some(r => r.state === "soon" || r.state === "overdue");

            return (
              <div key={emp.id} style={{ background: "#fff", borderRadius: 16,
                boxShadow: "0 1px 6px rgba(0,0,0,.07)",
                border: hasAlert ? "1.5px solid #fed7aa" : "1px solid #f1f5f9",
                overflow: "hidden" }}>

                {/* Top row: avatar + info */}
                <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%",
                    background: emp.color ?? "#0038C6", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                    {emp.initial ?? emp.full_name.charAt(0)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{emp.full_name}</span>
                      {emp.emp_code && (
                        <span style={{ fontSize: 11, fontWeight: 700, color: "#0038C6",
                          background: "#f0f5ff", border: "1px solid #c4cfee",
                          borderRadius: 5, padding: "2px 8px", letterSpacing: "0.04em" }}>
                          {emp.emp_code}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                      {emp.position ?? "—"} · {emp.department_name ?? "—"} · {emp.division_name ?? "—"}
                    </div>
                    {days !== null && emp.emp_status === "probation" && (
                      <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                        เริ่มงาน {emp.start_date} ·{" "}
                        <span style={{ fontWeight: 600, color: days >= 90 ? "#dc2626" : "#0f172a" }}>
                          {days} วัน
                        </span>
                        {days >= 90 && <span style={{ color: "#dc2626", marginLeft: 6 }}>⚠ ครบ 90 วันแล้ว</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ background: STATUS_COLOR[emp.emp_status] + "22",
                      color: STATUS_COLOR[emp.emp_status], borderRadius: 20,
                      padding: "4px 12px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {STATUS_LABEL[emp.emp_status]}
                    </span>
                    {canEdit && (
                      <button onClick={() => { setEditing(emp); setShowForm(true); }}
                        style={{ background: "#f1f5f9", border: "none", borderRadius: 8,
                          padding: "6px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                          color: "#475569" }}>
                        ✏️
                      </button>
                    )}
                    {canDelete && (
                      <button onClick={() => { setConfirmDelete(emp); setDeleteError(""); }}
                        style={{ background: "#fee2e2", border: "none", borderRadius: 8,
                          padding: "6px 12px", cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                          color: "#dc2626" }}
                        title="ลบพนักงาน">
                        🗑️
                      </button>
                    )}
                  </div>
                </div>

                {/* 30/60/90 progress row */}
                {emp.emp_status === "probation" && (
                  <div style={{ borderTop: "1px solid #f8fafc", background: "#fafbff",
                    padding: "12px 20px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {rounds.map(({ round, state, evalId }) => {
                      const s = ROUND_STATE_STYLE[state];
                      const isCreating = creatingFor?.empId === emp.id && creatingFor?.round === round;
                      return (
                        <div key={round} style={{ flex: 1, minWidth: 130, background: s.bg,
                          border: `1.5px solid ${s.border}`, borderRadius: 12,
                          padding: "10px 14px" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: s.color,
                            textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                            รอบ {round} วัน
                          </div>
                          <div style={{ fontSize: 12, color: s.color, fontWeight: 600, marginBottom: 8 }}>
                            {s.label}
                          </div>
                          {evalId ? (
                            <button onClick={() => setOpenEvalId(evalId)}
                              style={{ width: "100%", padding: "5px 0", borderRadius: 8,
                                border: `1px solid ${s.border}`, background: "#fff",
                                color: s.color, fontSize: 12, cursor: "pointer",
                                fontFamily: "inherit", fontWeight: 600 }}>
                              เปิดใบประเมิน
                            </button>
                          ) : (state === "soon" || state === "overdue") && (canEdit || user?.role === "head") ? (
                            <button onClick={() => createEval(emp.id, round)} disabled={!!isCreating}
                              style={{ width: "100%", padding: "5px 0", borderRadius: 8,
                                border: "none", background: s.color, color: "#fff",
                                fontSize: 12, cursor: "pointer",
                                fontFamily: "inherit", fontWeight: 700,
                                opacity: isCreating ? 0.7 : 1 }}>
                              {isCreating ? "กำลังสร้าง…" : "สร้างใบประเมิน"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <EmployeeForm employee={editing} onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }} />
      )}
      {openEvalId !== null && (
        <EvaluationForm evalId={openEvalId} onClose={() => setOpenEvalId(null)}
          onSaved={() => { setOpenEvalId(null); load(); }} />
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: "28px 32px",
            maxWidth: 420, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}>
            <div style={{ fontSize: 36, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "#0f172a", textAlign: "center", marginBottom: 6 }}>
              ยืนยันลบพนักงาน
            </div>
            <div style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 20, lineHeight: 1.6 }}>
              คุณต้องการลบ{" "}
              <span style={{ fontWeight: 700, color: "#dc2626" }}>{confirmDelete.full_name}</span>
              {" "}ออกจากระบบ?<br />
              <span style={{ fontSize: 12 }}>ข้อมูลและใบประเมิน (ที่ยังไม่อนุมัติ) จะถูกลบทั้งหมด</span>
            </div>

            {deleteError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8,
                padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
                {deleteError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setConfirmDelete(null); setDeleteError(""); }}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "1.5px solid #e2e8f0",
                  background: "#fff", color: "#64748b", fontWeight: 700, fontSize: 14,
                  cursor: "pointer", fontFamily: "inherit" }}>
                ยกเลิก
              </button>
              <button onClick={deleteEmployee} disabled={deleting}
                style={{ flex: 1, padding: "11px 0", borderRadius: 9, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, fontSize: 14,
                  cursor: deleting ? "not-allowed" : "pointer", fontFamily: "inherit",
                  opacity: deleting ? 0.7 : 1 }}>
                {deleting ? "กำลังลบ…" : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
