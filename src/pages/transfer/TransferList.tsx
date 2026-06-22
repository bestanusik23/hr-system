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
  submitted:       "#d97706",
  head_approved:   "#7c3aed",
  deputy_approved: "#0891b2",
  completed:       "#16a34a",
  rejected:        "#ef4444",
};

export default function TransferList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const r = await fetch(`/api/transfer/requests?status=${filter}`);
    const d = await r.json() as { ok: boolean; requests: TransferRequest[] };
    setRequests(d.requests ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter]);

  const isHR     = user && ["hr", "admin"].includes(user.role);
  const isHead   = user?.role === "head";
  const isDeputy = user && ["deputy", "deputyHR", "admin"].includes(user.role);

  const filters: [string, string][] = [
    ["", "ทั้งหมด"],
    ...(isHead   ? [["submitted",       "รอฉันรับรอง"]  as [string, string]] : []),
    ...(isDeputy ? [["head_approved",   "รอฉันอนุมัติ"] as [string, string]] : []),
    ...(isHR     ? [["deputy_approved", "รอดำเนินการ"]  as [string, string]] : []),
    ["completed", "เสร็จสมบูรณ์"],
    ["rejected",  "ไม่อนุมัติ"],
  ];

  return (
    <div>
      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {filters.map(([k, v]) => (
          <button key={k} onClick={() => setFilter(k)} style={{
            padding: "7px 16px", borderRadius: 7, border: "1.5px solid",
            borderColor: filter === k ? "#0038C6" : "#dce4f5",
            background: filter === k ? "#0038C6" : "#fff",
            color: filter === k ? "#fff" : "#475569",
            fontSize: 12, fontWeight: filter === k ? 700 : 400,
            cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
          }}>{v}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : requests.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8",
          background: "#fff", borderRadius: 10, border: "1px solid #dce4f5" }}>
          ไม่มีคำขอ
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {requests.map(req => (
            <div key={req.id} onClick={() => setSelected(req.id)}
              style={{ background: "#fff", borderRadius: 8, padding: "16px 20px",
                border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 16,
                transition: "box-shadow .15s, transform .15s" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,56,198,0.12)"; e.currentTarget.style.transform = "translateX(2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = ""; e.currentTarget.style.transform = ""; }}>
              <div style={{ width: 42, height: 42, borderRadius: 10,
                background: "#e8eeff", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📑</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1628" }}>{req.name}</div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                  {req.from_dept_name ?? "—"} → {req.to_dept_name ?? "—"}
                </div>
                {req.reason && (
                  <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>เหตุผล: {req.reason}</div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{
                  background: (STATUS_COLOR[req.overall_status] ?? "#94a3b8") + "18",
                  color: STATUS_COLOR[req.overall_status] ?? "#94a3b8",
                  borderRadius: 6, padding: "4px 12px", fontSize: 11, fontWeight: 700,
                  border: `1px solid ${(STATUS_COLOR[req.overall_status] ?? "#94a3b8")}30`,
                }}>
                  {STATUS_LABEL[req.overall_status] ?? req.overall_status}
                </span>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5, fontFamily: "monospace" }}>
                  {new Date(req.created_at).toLocaleDateString("th-TH")}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected !== null && (
        <TransferDetail requestId={selected}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); load(); }} />
      )}
    </div>
  );
}
