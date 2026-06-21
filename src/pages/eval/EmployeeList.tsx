import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import EmployeeForm from "./EmployeeForm";

interface Employee {
  id: number; full_name: string; position: string | null; start_date: string | null;
  emp_status: string; department_name: string | null; division_name: string | null;
  color: string | null; initial: string | null; department_id: number | null; division_id: number | null;
}

const STATUS_LABEL: Record<string, string> = {
  probation: "ทดลองงาน", passed: "ผ่านทดลองงาน", transferred: "ย้ายแผนก", resigned: "ลาออก",
};
const STATUS_COLOR: Record<string, string> = {
  probation: "#f59e0b", passed: "#16a34a", transferred: "#0891b2", resigned: "#94a3b8",
};

export default function EmployeeList() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("probation");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);

  const canEdit = user && ["hr", "admin"].includes(user.role);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/eval/employees?status=${statusFilter}`);
    const d = await r.json() as { ok: boolean; employees: Employee[] };
    setEmployees(d.employees ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  function daysSince(dateStr: string | null) {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <button key={k} onClick={() => setStatusFilter(k)} style={{
              padding: "6px 14px", borderRadius: 8, border: "1.5px solid", fontFamily: "inherit",
              fontSize: 13, cursor: "pointer",
              borderColor: statusFilter === k ? STATUS_COLOR[k] : "#e2e8f0",
              background: statusFilter === k ? STATUS_COLOR[k] : "#fff",
              color: statusFilter === k ? "#fff" : "#475569",
            }}>{v}</button>
          ))}
        </div>
        {canEdit && (
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{
            padding: "8px 18px", borderRadius: 10, border: "none", background: "#16A34A",
            color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
          }}>+ เพิ่มพนักงาน</button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : employees.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีพนักงานในสถานะนี้</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {employees.map(emp => {
            const days = daysSince(emp.start_date);
            return (
              <div key={emp.id} style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: emp.color ?? "#0038C6", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                  {emp.initial ?? emp.full_name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{emp.full_name}</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                    {emp.position ?? "—"} · {emp.department_name ?? "—"} · {emp.division_name ?? "—"}
                  </div>
                  {days !== null && (
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                      เริ่มงาน {emp.start_date} · {days} วัน
                      {days >= 90 && emp.emp_status === "probation" && <span style={{ color: "#ef4444", marginLeft: 6 }}>⚠ ครบ 90 วันแล้ว</span>}
                    </div>
                  )}
                </div>
                <span style={{ background: STATUS_COLOR[emp.emp_status] + "22", color: STATUS_COLOR[emp.emp_status], borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  {STATUS_LABEL[emp.emp_status]}
                </span>
                {canEdit && (
                  <button onClick={() => { setEditing(emp); setShowForm(true); }} style={{ background: "#f1f5f9", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                    แก้ไข
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <EmployeeForm
          employee={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); load(); }}
        />
      )}
    </div>
  );
}
