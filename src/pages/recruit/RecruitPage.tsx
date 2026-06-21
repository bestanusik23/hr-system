import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";

interface Application { _row: string; [key: string]: string; }

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  "รอพิจารณา":        { bg: "#fef9c3", text: "#b45309" },
  "รอกรอกใบสมัคร":   { bg: "#ede9fe", text: "#7c3aed" },
  "ผ่านการสัมภาษณ์": { bg: "#dcfce7", text: "#16a34a" },
  "รับเข้างาน":       { bg: "#dbeafe", text: "#1d4ed8" },
  "ไม่ผ่าน":          { bg: "#fee2e2", text: "#dc2626" },
};

// Internal columns that should never appear in the table
const HIDDEN_COLS = new Set(["_row"]);

// Columns that contain status/result — detected by keyword
function isStatusCol(h: string) {
  return h.includes("ผลการพิจารณา") || h.toLowerCase().includes("status") || h.toLowerCase().includes("result");
}

export default function RecruitPage() {
  const { user } = useAuth();
  const [headers, setHeaders] = useState<string[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail] = useState<Application | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const isHR      = user && ["hr", "admin"].includes(user.role);
  const isDeputy  = user && ["deputy", "deputyHR", "admin"].includes(user.role);
  const canUpdate = isHR || isDeputy;

  // L3 (hr): can set preliminary statuses; L2 (deputy): can set final hiring decisions too
  const HR_STATUSES     = ["รอพิจารณา", "รอกรอกใบสมัคร", "ผ่านการสัมภาษณ์"];
  const DEPUTY_STATUSES = Object.keys(STATUS_COLOR); // includes รับเข้างาน + ไม่ผ่าน
  const allowedStatuses = isDeputy ? DEPUTY_STATUSES : HR_STATUSES;

  const statusColIdx = headers.findIndex(h => isStatusCol(h));
  const statusKey = statusColIdx >= 0 ? headers[statusColIdx] : "";

  async function load() {
    setLoading(true); setError("");
    const r = await fetch("/api/recruit/applications");
    const d = await r.json() as { ok: boolean; applications: Application[]; headers: string[]; error?: string };
    if (!d.ok) { setError(d.error ?? "ไม่สามารถโหลดข้อมูลได้"); setLoading(false); return; }
    setHeaders(d.headers ?? []);
    setApplications(d.applications ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(app: Application, value: string) {
    if (statusColIdx < 0) return;
    const colLetter = String.fromCharCode(65 + statusColIdx);
    setUpdating(app._row);
    await fetch("/api/recruit/applications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: Number(app._row), col: colLetter, value }),
    });
    const updated = { ...app, [statusKey]: value };
    setApplications(prev => prev.map(a => a._row === app._row ? updated : a));
    if (detail?._row === app._row) setDetail(updated);
    setUpdating(null);
  }

  // Show all sheet columns except internal fields and status column (shown separately)
  const visibleCols = headers.filter(h => !HIDDEN_COLS.has(h) && h !== statusKey && h.trim() !== "");

  const allStatuses = statusKey
    ? [...new Set(applications.map(a => a[statusKey] ?? "").filter(Boolean))]
    : [];

  const filtered = applications.filter(a => {
    const matchSearch = !search || Object.values(a).some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || a[statusKey] === statusFilter;
    return matchSearch && matchStatus;
  });

  const StatusBadge = ({ val }: { val: string }) => {
    const c = STATUS_COLOR[val] ?? { bg: "#f1f5f9", text: "#64748b" };
    return (
      <span style={{ background: c.bg, color: c.text, borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
        {val || "—"}
      </span>
    );
  };

  return (
    <PageLayout title="ระบบสรรหาบุคลากร" accent="#0038C6">
      <>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อ ตำแหน่ง..."
          style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", width: 220 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setStatusFilter("")} style={filterBtn(!statusFilter)}>ทั้งหมด ({applications.length})</button>
          {allStatuses.map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={filterBtn(statusFilter === s)}>
              {s} ({applications.filter(a => a[statusKey] === s).length})
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลดจาก Google Sheets…</div>
      ) : error ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, color: "#dc2626" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ไม่สามารถโหลดข้อมูลได้</div>
          <div style={{ fontSize: 13 }}>{error}</div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          {user?.role === "head" ? "ยังไม่มีผู้มาสมัครงานในแผนกของคุณ" : "ไม่มีข้อมูล"}
        </div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={th}>#</th>
                  {visibleCols.map(h => <th key={h} style={th}>{h}</th>)}
                  <th style={th}>ผลการพิจารณา</th>
                  <th style={th}>รายละเอียด</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, ri) => {
                  const curStatus = statusKey ? (app[statusKey] ?? "") : "";
                  return (
                    <tr key={app._row} style={{ borderBottom: "1px solid #f1f5f9", background: ri % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ ...td, color: "#94a3b8", width: 36 }}>{ri + 1}</td>
                      {visibleCols.map(h => (
                        <td key={h} style={{ ...td, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {app[h] ?? "—"}
                        </td>
                      ))}
                      <td style={td}>
                        {canUpdate ? (
                          <select value={curStatus} onChange={e => updateStatus(app, e.target.value)}
                            disabled={updating === app._row}
                            style={{ padding: "4px 8px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 12, fontFamily: "inherit", cursor: "pointer", background: "#fff" }}>
                            <option value="">-- เลือก --</option>
                            {allowedStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <StatusBadge val={curStatus} />
                        )}
                      </td>
                      <td style={td}>
                        <button onClick={() => setDetail(app)}
                          style={{ padding: "5px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#0038C6", fontWeight: 600 }}>
                          🔍 ดูข้อมูล
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.3)" }}>
            {/* Header */}
            <div style={{ padding: "22px 28px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {detail[visibleCols[0] ?? ""] || detail[headers[0]] || "—"}
                  {visibleCols[1] && <span style={{ fontSize: 14, fontWeight: 400, color: "#64748b" }}> — {detail[visibleCols[1]]}</span>}
                </div>
                {statusKey && <div style={{ marginTop: 8 }}><StatusBadge val={detail[statusKey] ?? ""} /></div>}
              </div>
              <button onClick={() => setDetail(null)} style={{ border: "none", background: "#f1f5f9", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>×</button>
            </div>

            {/* Fields */}
            <div style={{ padding: "20px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 24px" }}>
                {visibleCols.map(h => detail[h] ? (
                  <div key={h}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase", marginBottom: 2 }}>{h}</div>
                    <div style={{ fontSize: 13, color: "#1e293b" }}>{detail[h]}</div>
                  </div>
                ) : null)}
              </div>

              {/* Status update (hr = preliminary only, deputy = all including final hire) */}
              {canUpdate && statusKey && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>อัปเดตผลการพิจารณา</div>
                    {!isDeputy && <span style={{ fontSize: 11, background: "#fef9c3", color: "#b45309", borderRadius: 6, padding: "2px 8px" }}>L3 HR — ไม่รวม "รับเข้างาน"</span>}
                    {isDeputy  && <span style={{ fontSize: 11, background: "#ede9fe", color: "#7c3aed", borderRadius: 6, padding: "2px 8px" }}>L2 รองผู้อำนวยการ — อนุมัติรับเข้างาน</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {allowedStatuses.map(s => (
                      <button key={s} onClick={() => updateStatus(detail, s)} disabled={updating === detail._row}
                        style={{ padding: "7px 16px", borderRadius: 9, border: "1.5px solid", cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 600, borderColor: detail[statusKey] === s ? STATUS_COLOR[s].text : "#e2e8f0", background: detail[statusKey] === s ? STATUS_COLOR[s].bg : "#fff", color: detail[statusKey] === s ? STATUS_COLOR[s].text : "#475569" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
    </PageLayout>
  );
}

const th: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 12 };
const td: React.CSSProperties = { padding: "10px 14px", color: "#1e293b", verticalAlign: "middle" };
function filterBtn(active: boolean): React.CSSProperties {
  return { padding: "5px 12px", borderRadius: 8, border: "1.5px solid", fontFamily: "inherit", fontSize: 12, cursor: "pointer", borderColor: active ? "#0038C6" : "#e2e8f0", background: active ? "#0038C6" : "#fff", color: active ? "#fff" : "#475569" };
}
