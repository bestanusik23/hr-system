import { useEffect, useState } from "react";
import { formatThaiDate } from "../../utils/date";
import { useAuth } from "../../context/AuthContext";

interface ActiveEmp {
  id: number; full_name: string; position: string | null;
  department_name: string | null; division_name: string | null; start_date: string | null;
}

interface ExitItem {
  key: string; label: string;
  completed: boolean; completed_at: string | null; note: string | null;
}

const RESIGN_TYPES = ["ลาออกเอง", "เลิกจ้าง", "เกษียณ"];

const inp: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
  fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
        letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 7 }}>{label}</label>
      {children}
    </div>
  );
}

export default function ResignTab({ onSaved }: { onSaved: () => void }) {
  const { user } = useAuth();
  const isHR = user && ["hr", "admin"].includes(user.role);

  const [list, setList]       = useState<ActiveEmp[]>([]);
  const [search, setSearch]   = useState("");
  const [empId, setEmpId]     = useState<number | "">("");
  const [resignDate, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [resignType, setType] = useState("ลาออกเอง");
  const [reason, setReason]   = useState("");
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");

  const [exitItems, setExitItems]   = useState<ExitItem[]>([]);
  const [savingKey, setSavingKey]   = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/manpower/employees").then(r => r.json())
      .then((d: { employees: ActiveEmp[] & { emp_status?: string }[] }) => {
        const arr = (d.employees ?? []) as (ActiveEmp & { emp_status: string })[];
        setList(arr.filter(e => e.emp_status !== "resigned"));
      });
  }, []);

  // Load exit checklist when employee is selected
  useEffect(() => {
    if (!empId) { setExitItems([]); return; }
    fetch(`/api/manpower/exit-checklist?employee_id=${empId}`)
      .then(r => r.json())
      .then((d: { ok: boolean; items: ExitItem[] }) => {
        if (d.ok) setExitItems(d.items);
      })
      .catch(() => {});
  }, [empId]);

  const selected = list.find(e => e.id === empId) ?? null;
  const filtered = list.filter(e =>
    !search || e.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const exitDone  = exitItems.filter(i => i.completed).length;
  const exitTotal = exitItems.length;
  const allClear  = exitTotal === 0 || exitDone === exitTotal;

  async function toggleExit(key: string, currentVal: boolean) {
    if (!isHR || !empId) return;
    setSavingKey(key);
    const res = await fetch("/api/manpower/exit-checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: Number(empId), key, completed: !currentVal }),
    });
    const d = await res.json() as { ok: boolean };
    if (d.ok) {
      setExitItems(prev => prev.map(i =>
        i.key === key ? { ...i, completed: !currentVal, completed_at: !currentVal ? new Date().toISOString() : null } : i
      ));
    }
    setSavingKey(null);
  }

  async function save() {
    if (!empId) { setError("กรุณาเลือกพนักงาน"); return; }
    if (!resignDate) { setError("กรุณาระบุวันที่ลาออก"); return; }
    if (!allClear) { setError("กรุณาทำ Exit Checklist ให้ครบก่อนปิดเคส"); return; }
    setSaving(true); setError("");
    const r = await fetch("/api/manpower/resign", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: empId, resign_date: resignDate, resign_reason: reason || null, resign_type: resignType }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", background: "#fff", borderRadius: 16,
      padding: 32, boxShadow: "0 1px 6px rgba(0,0,0,.06)" }}>
      <div style={{ fontSize: 17, fontWeight: 800, color: "#0a1628", marginBottom: 4,
        display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 4, height: 18, borderRadius: 2, background: "#dc2626" }} />
        เพิ่มพนักงานลาออก
      </div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 22, paddingLeft: 14 }}>
        เปลี่ยนสถานะเป็น "ลาออก" · ตัดออกจากพนักงาน Active · ปิดรายการประเมินอัตโนมัติ
      </div>

      <Field label="ค้นหาพนักงาน">
        <input value={search} onChange={e => setSearch(e.target.value)} style={inp} placeholder="🔍 ชื่อ หรือ รหัสพนักงาน…" />
      </Field>
      <Field label="เลือกพนักงาน *">
        <select value={empId} onChange={e => setEmpId(Number(e.target.value))} style={inp}>
          <option value="">-- เลือกพนักงาน --</option>
          {filtered.map(e => (
            <option key={e.id} value={e.id}>
              {e.full_name}{e.department_name ? ` (${e.department_name})` : ""}
            </option>
          ))}
        </select>
      </Field>

      {selected && (
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10,
          padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
          <b style={{ color: "#0a1628" }}>{selected.full_name}</b><br />
          {selected.position ?? "—"} · {selected.department_name ?? "—"} · {selected.division_name ?? "—"}<br />
          เริ่มงาน {formatThaiDate(selected.start_date)}
        </div>
      )}

      {/* ── Exit Clearance Checklist ── */}
      {empId !== "" && exitItems.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", letterSpacing: "0.08em",
            textTransform: "uppercase", marginBottom: 10, display: "flex", alignItems: "center",
            justifyContent: "space-between" }}>
            <span>🚪 Exit Clearance Checklist</span>
            <span style={{ fontWeight: 800, fontSize: 13,
              color: allClear ? "#16a34a" : "#dc2626" }}>
              {exitDone}/{exitTotal}
              {allClear ? " ✅ ครบแล้ว" : " — ยังไม่ครบ"}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {exitItems.map(item => (
              <div key={item.key}
                onClick={() => toggleExit(item.key, item.completed)}
                style={{
                  display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                  borderRadius: 10, border: `1.5px solid ${item.completed ? "#bbf7d0" : "#fecaca"}`,
                  background: item.completed ? "#f0fdf4" : "#fff5f5",
                  cursor: isHR ? "pointer" : "default",
                  opacity: savingKey === item.key ? 0.6 : 1, transition: "all .15s",
                }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 6, flexShrink: 0,
                  background: item.completed ? "#16a34a" : "#fff",
                  border: `2px solid ${item.completed ? "#16a34a" : "#fca5a5"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, color: "#fff",
                }}>
                  {item.completed ? "✓" : ""}
                </div>
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600,
                  color: item.completed ? "#15803d" : "#dc2626",
                  textDecoration: item.completed ? "line-through" : "none" }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
          {!allClear && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "#fef2f2",
              border: "1px solid #fecaca", borderRadius: 8, fontSize: 12, color: "#dc2626", fontWeight: 600 }}>
              ⚠️ ต้องทำ Checklist ให้ครบก่อนจึงจะปิดเคสได้
            </div>
          )}
        </div>
      )}

      <Field label="วันที่ลาออก *">
        <input type="date" value={resignDate} onChange={e => setDate(e.target.value)} style={inp} />
      </Field>
      <Field label="ประเภทการลาออก">
        <div style={{ display: "flex", gap: 8 }}>
          {RESIGN_TYPES.map(t => (
            <button key={t} onClick={() => setType(t)} style={{
              flex: 1, padding: "9px 0", borderRadius: 8, border: "1.5px solid",
              borderColor: resignType === t ? "#dc2626" : "#e2e8f0",
              background: resignType === t ? "#dc2626" : "#fff",
              color: resignType === t ? "#fff" : "#475569",
              fontSize: 13, fontWeight: resignType === t ? 700 : 400, cursor: "pointer", fontFamily: "inherit",
            }}>{t}</button>
          ))}
        </div>
      </Field>
      <Field label="เหตุผลการลาออก">
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} style={{ ...inp, resize: "vertical" }} />
      </Field>

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 7,
          padding: "10px 14px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>{error}</div>
      )}
      <button onClick={save} disabled={saving || (!allClear && exitItems.length > 0)}
        style={{ width: "100%", padding: "13px 0", borderRadius: 8, border: "none",
          background: (!allClear && exitItems.length > 0) ? "#9ca3af" : "#dc2626",
          color: "#fff", fontWeight: 700, fontSize: 14,
          cursor: (saving || (!allClear && exitItems.length > 0)) ? "not-allowed" : "pointer",
          fontFamily: "inherit", opacity: saving ? 0.7 : 1 }}>
        {saving ? "กำลังบันทึก…" : (!allClear && exitItems.length > 0) ? "⚠️ ทำ Checklist ให้ครบก่อน" : "บันทึกการลาออก"}
      </button>
    </div>
  );
}
