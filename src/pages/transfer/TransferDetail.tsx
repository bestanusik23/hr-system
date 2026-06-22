import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface TRequest {
  id: number; name: string; position: string | null; reason: string | null; new_position: string | null;
  from_dept_name: string | null; to_dept_name: string | null;
  from_division_name: string | null; to_division_name: string | null;
  head_status: string; deputy_status: string; hr_status: string; overall_status: string; created_at: string;
}
interface Approval { step: string; status: string; note: string | null; created_at: string; approver_name: string; }
const STEP_LABEL: Record<string, string> = {
  head: "หัวหน้าแผนก", deputy: "รองผู้อำนวยการ", hr: "HR ดำเนินการ",
};
interface Props { requestId: number; onClose: () => void; onSaved: () => void; }

export default function TransferDetail({ requestId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [req, setReq]             = useState<TRequest | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [note, setNote]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

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
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 40, color: "#0038C6", fontWeight: 600 }}>กำลังโหลด…</div>
    </div>
  );

  const isHead   = user && ["head",   "admin"].includes(user.role);
  const isDeputy = user && ["deputy", "deputyHR", "admin"].includes(user.role);
  const isHR     = user && ["hr",     "admin"].includes(user.role);

  const canHeadApprove   = isHead   && req.overall_status === "submitted";
  const canDeputyApprove = isDeputy && req.overall_status === "head_approved";
  const canHRApprove     = isHR     && req.overall_status === "deputy_approved";
  const canAct = canHeadApprove || canDeputyApprove || canHRApprove;

  const steps = [
    { label: "① ส่งคำขอ",                   done: true,                                                                               rejected: false },
    { label: "② หัวหน้าแผนกรับรอง",          done: ["head_approved","deputy_approved","completed"].includes(req.overall_status),        rejected: req.overall_status === "rejected" && req.head_status === "rejected" },
    { label: "③ รองผู้อำนวยการอนุมัติ",       done: ["deputy_approved","completed"].includes(req.overall_status),                       rejected: req.overall_status === "rejected" && req.deputy_status === "rejected" },
    { label: "④ HR ดำเนินการ — เสร็จสมบูรณ์", done: req.overall_status === "completed",                                                rejected: req.overall_status === "rejected" && req.hr_status === "rejected" },
  ];

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 7,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box" as const, resize: "vertical" as const,
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#f0f5ff", borderRadius: 10, width: "100%", maxWidth: 560,
        maxHeight: "90vh", overflowY: "auto",
        boxShadow: "0 24px 60px rgba(0,56,198,0.25)", border: "1px solid #c4cfee" }}>

        {/* Header */}
        <div style={{ background: "#0038C6", borderRadius: "10px 10px 0 0", padding: "20px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 11, letterSpacing: "0.15em", color: "rgba(255,255,255,0.55)", fontFamily: "monospace", marginBottom: 6 }}>
                TRANSFER REQUEST #{req.id}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{req.name}</div>
              {req.position && <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 4 }}>{req.position}</div>}
            </div>
            <button onClick={onClose}
              style={{ border: "none", background: "rgba(255,255,255,0.15)", borderRadius: 6,
                width: 32, height: 32, cursor: "pointer", color: "#fff", fontSize: 18,
                display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
          </div>
        </div>

        <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Info */}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5",
            borderLeft: "4px solid #0038C6", padding: "16px 20px" }}>
            {([
              ["ตำแหน่งปัจจุบัน", req.position],
              ["แผนกปัจจุบัน",    req.from_dept_name],
              ["ย้ายไปแผนก",      req.to_dept_name],
              ["ตำแหน่งใหม่",     req.new_position],
              ["เหตุผล",          req.reason],
            ] as [string, string | null][]).filter(([, v]) => !!v).map(([label, val]) => (
              <div key={label} style={{ display: "flex", gap: 12, marginBottom: 10 }}>
                <div style={{ width: 130, fontSize: 12, color: "#64748b", flexShrink: 0, fontWeight: 600 }}>{label}</div>
                <div style={{ fontSize: 13, color: "#0a1628" }}>{val}</div>
              </div>
            ))}
          </div>

          {/* Approval steps */}
          <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", padding: "16px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#0038C6", letterSpacing: "0.1em", marginBottom: 14 }}>
              สายอนุมัติ
            </div>
            {steps.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: s.done ? "#16a34a" : s.rejected ? "#ef4444" : "#e8eeff",
                  color: s.done || s.rejected ? "#fff" : "#94a3b8" }}>
                  {s.done ? "✓" : s.rejected ? "✗" : i + 1}
                </div>
                <span style={{ fontSize: 13, color: s.done ? "#16a34a" : s.rejected ? "#ef4444" : "#94a3b8",
                  fontWeight: s.done ? 600 : 400 }}>{s.label}</span>
              </div>
            ))}
          </div>

          {/* History */}
          {approvals.length > 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              {approvals.map((a, i) => (
                <div key={i} style={{ background: "#fff", borderRadius: 7, padding: "10px 14px",
                  border: "1px solid #dce4f5", fontSize: 13, color: "#475569",
                  display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                    background: a.status === "approved" ? "#dcfce7" : "#fee2e2",
                    color: a.status === "approved" ? "#16a34a" : "#dc2626",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>
                    {a.status === "approved" ? "✓" : "✗"}
                  </div>
                  <div>
                    <span style={{ fontWeight: 700 }}>{STEP_LABEL[a.step] ?? a.step}</span>
                    <span style={{ color: "#64748b" }}> — {a.approver_name}</span>
                    {a.note && <span style={{ color: "#94a3b8" }}> ({a.note})</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Note field */}
          {canAct && (
            <div style={{ background: "#fff8ed", border: "1px solid #fde68a",
              borderLeft: "4px solid #d97706", borderRadius: 7, padding: "14px 18px" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#b45309",
                letterSpacing: "0.1em", marginBottom: 8 }}>
                หมายเหตุการอนุมัติ (ถ้ามี)
              </label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} style={inp} />
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fecaca",
              borderRadius: 7, padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose}
              style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
              ปิด
            </button>

            {canHeadApprove && <>
              <button onClick={() => act("head_reject")} disabled={saving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ไม่รับรอง
              </button>
              <button onClick={() => act("head_approve")} disabled={saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {saving ? "กำลังบันทึก…" : "✓ รับรองคำขอ"}
              </button>
            </>}

            {canDeputyApprove && <>
              <button onClick={() => act("deputy_reject")} disabled={saving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ไม่อนุมัติ
              </button>
              <button onClick={() => act("deputy_approve")} disabled={saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {saving ? "กำลังอนุมัติ…" : "✓ อนุมัติ (รอง ผอ.)"}
              </button>
            </>}

            {canHRApprove && <>
              <button onClick={() => act("hr_reject")} disabled={saving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ยกเลิก
              </button>
              <button onClick={() => act("hr_approve")} disabled={saving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                  background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {saving ? "กำลังดำเนินการ…" : "✓ HR ดำเนินการเสร็จสิ้น"}
              </button>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
