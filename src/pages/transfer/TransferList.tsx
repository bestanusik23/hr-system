import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import TransferDetail from "./TransferDetail";

interface TransferRequest {
  id: number; name: string; position: string | null; reason: string | null;
  from_dept_name: string | null; to_dept_name: string | null;
  from_division_name: string | null; to_division_name: string | null;
  head_status: string; deputy_status: string; hr_status: string; overall_status: string;
  new_position: string | null; created_at: string;
}

const STATUS_LABEL: Record<string, string> = {
  submitted:       "① รอหัวหน้าแผนกรับรอง",
  head_approved:   "② รอรองผู้อำนวยการอนุมัติ",
  deputy_approved: "③ รอ HR ดำเนินการ",
  completed:       "เสร็จสมบูรณ์",
  rejected:        "ไม่อนุมัติ",
};
const STATUS_COLOR: Record<string, string> = {
  submitted: "#f59e0b", head_approved: "#7c3aed", deputy_approved: "#0891b2",
  completed: "#16a34a", rejected: "#ef4444",
};

export default function TransferList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/transfer/requests?status=${filter}`);
    const d = await r.json() as { ok: boolean; requests: TransferRequest[] };
    setRequests(d.requests ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  const isHR      = user && ["hr", "admin"].includes(user.role);
  const isHead    = user?.role === "head";
  const isDeputy  = user && ["deputy", "deputyHR", "admin"].includes(user.role);

  const filters: [string, string][] = [
    ["", "ทั้งหมด"],
    ...(isHead    ? [["submitted",       "รอฉันรับรอง"] as [string,string]] : []),
    ...(isDeputy  ? [["head_approved",   "รอฉันอนุมัติ"] as [string,string]] : []),
    ...(isHR      ? [["deputy_approved", "รอดำเนินการ"] as [string,string]] : []),
    ["completed", "เสร็จสมบูรณ์"],
    ["rejected",  "ไม่อนุมัติ"],
  ];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {filters.map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "6px 14px", borderRadius: 8, border: "1.5px solid", fontFamily: "inherit",
            borderColor: filter === k ? "#E0533D" : "#e2e8f0",
            background: filter === k ? "#E0533D" : "#fff",
            color: filter === k ? "#fff" : "#475569", fontSize: 13, cursor: "pointer",
          }}>{v}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>ไม่มีคำขอ</div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {requests.map(req => (
            <div key={req.id} onClick={() => setSelected(req.id)}
              style={{ background: "#fff", borderRadius: 14, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,.07)", cursor: "pointer", display: "flex", alignItems: "center", gap: 16 }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,.12)")}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,.07)")}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "#E0533D22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>📑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{req.name}</div>
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>
                  {req.from_dept_name ?? "—"} → {req.to_dept_name ?? "—"}
                </div>
                {req.reason && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>เหตุผล: {req.reason}</div>}
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ background: (STATUS_COLOR[req.overall_status] ?? "#94a3b8") + "22", color: STATUS_COLOR[req.overall_status] ?? "#94a3b8", borderRadius: 8, padding: "4px 12px", fontSize: 12, fontWeight: 600 }}>
                  {STATUS_LABEL[req.overall_status] ?? req.overall_status}
                </span>
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {new Date(req.created_at).toLocaleDateString("th-TH")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected !== null && (
        <TransferDetail requestId={selected} onClose={() => setSelected(null)} onSaved={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}
