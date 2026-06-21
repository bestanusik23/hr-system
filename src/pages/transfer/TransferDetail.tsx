import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface TRequest {
  id: number; name: string; position: string | null; reason: string | null; new_position: string | null;
  from_dept_name: string | null; to_dept_name: string | null;
  from_division_name: string | null; to_division_name: string | null;
  head_status: string; hr_status: string; overall_status: string; created_at: string;
}
interface Approval { step: string; status: string; note: string | null; created_at: string; approver_name: string; }

const STEP_MAP: Record<string, { label: string; color: string }> = {
  submitted:     { label: "① ส่งคำขอแล้ว", color: "#f59e0b" },
  head_approved: { label: "② หัวหน้าอนุมัติ", color: "#0891b2" },
  completed:     { label: "③ HR อนุมัติ — เสร็จสมบูรณ์", color: "#16a34a" },
  rejected:      { label: "ไม่อนุมัติ", color: "#ef4444" },
};

interface Props { requestId: number; onClose: () => void; onSaved: () => void; }

export default function TransferDetail({ requestId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [req, setReq] = useState<TRequest | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/transfer/requests/${requestId}`).then(r => r.json())
      .then((d: { ok: boolean; request: TRequest; approvals: Approval[] }) => {
        setReq(d.request); setApprovals(d.approvals ?? []);
      });
  }, [requestId]);

  async function act(action: string) {
    setSaving(true); setError("");
    const r = await fetch(`/api/transfer/requests/${requestId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  if (!req) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40 }}>กำลังโหลด…</div>
    </div>
  );

  const canHeadApprove = user && ["head", "admin"].includes(user.role) && req.overall_status === "submitted";
  const canHRApprove   = user && ["hr", "admin"].includes(user.role) && req.overall_status === "head_approved";
  const step = STEP_MAP[req.overall_status] ?? { label: req.overall_status, color: "#94a3b8" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
        <div style={{ padding: "24px 28px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>คำขอย้ายแผนก</div>
            <span style={{ background: step.color + "22", color: step.color, borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>{step.label}</span>
          </div>
        </div>

        <div style={{ padding: "20px 28px" }}>
          {/* Info rows */}
          {[
            ["ชื่อ-นามสกุล", req.name],
            ["ตำแหน่งปัจจุบัน", req.position],
            ["แผนกปัจจุบัน", req.from_dept_name],
            ["ย้ายไปแผนก", req.to_dept_name],
            ["ตำแหน่งใหม่", req.new_position],
            ["เหตุผล", req.reason],
          ].map(([label, val]) => val ? (
            <div key={label} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
              <div style={{ width: 130, fontSize: 13, color: "#64748b", flexShrink: 0 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{val}</div>
            </div>
          ) : null)}

          {/* Timeline */}
          <div style={{ marginTop: 20, background: "#f8fafc", borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>ขั้นตอนการอนุมัติ</div>
            {[
              { step: "ส่งคำขอ", done: true },
              { step: "หัวหน้าอนุมัติ", done: ["head_approved","completed"].includes(req.overall_status), rejected: req.overall_status === "rejected" && req.head_status === "rejected" },
              { step: "HR อนุมัติ", done: req.overall_status === "completed", rejected: req.overall_status === "rejected" && req.hr_status === "rejected" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: s.done ? "#16a34a" : s.rejected ? "#ef4444" : "#e2e8f0", color: s.done || s.rejected ? "#fff" : "#94a3b8" }}>
                  {s.done ? "✓" : s.rejected ? "✗" : i + 1}
                </div>
                <span style={{ fontSize: 13, color: s.done ? "#16a34a" : s.rejected ? "#ef4444" : "#94a3b8" }}>{s.step}</span>
              </div>
            ))}
          </div>

          {/* Approval history */}
          {approvals.length > 0 && (
            <div style={{ marginTop: 14 }}>
              {approvals.map((a, i) => (
                <div key={i} style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
                  <b>{a.step === "head" ? "หัวหน้า" : "HR"}</b> {a.approver_name} — {a.status === "approved" ? "✅ อนุมัติ" : "❌ ไม่อนุมัติ"}{a.note ? ` (${a.note})` : ""}
                </div>
              ))}
            </div>
          )}

          {/* Note + actions */}
          {(canHeadApprove || canHRApprove) && (
            <div style={{ marginTop: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>หมายเหตุ (ถ้ามี)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit" }} />
            </div>
          )}

          {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</div>}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ปิด</button>
            {canHeadApprove && <>
              <button onClick={() => act("head_reject")} disabled={saving} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ไม่อนุมัติ</button>
              <button onClick={() => act("head_approve")} disabled={saving} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#E0533D", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "กำลังอนุมัติ…" : "✓ อนุมัติ"}</button>
            </>}
            {canHRApprove && <>
              <button onClick={() => act("hr_reject")} disabled={saving} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>ไม่อนุมัติ</button>
              <button onClick={() => act("hr_approve")} disabled={saving} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#E0533D", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{saving ? "กำลังอนุมัติ…" : "✓ HR อนุมัติขั้นสุดท้าย"}</button>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
