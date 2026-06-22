import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";

interface Application { _row: string; [key: string]: string; }

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  "รอพิจารณา":        { bg: "#fef9c3", text: "#b45309",  border: "#fde68a" },
  "รอนัดสัมภาษณ์":   { bg: "#fff7ed", text: "#c2410c",  border: "#fed7aa" },
  "รอกรอกใบสมัคร":   { bg: "#ede9fe", text: "#7c3aed",  border: "#ddd6fe" },
  "ผ่านการสัมภาษณ์": { bg: "#dcfce7", text: "#16a34a",  border: "#bbf7d0" },
  "รับเข้างาน":       { bg: "#dbeafe", text: "#1d4ed8",  border: "#bfdbfe" },
  "ไม่ผ่าน":          { bg: "#fee2e2", text: "#dc2626",  border: "#fecaca" },
};

const HIDDEN_COLS = new Set(["_row"]);
function isHiddenCol(h: string) {
  return HIDDEN_COLS.has(h)
    || h.includes("ประทับเวลา")
    || h.toLowerCase().includes("timestamp")
    || h.includes("ทราบข่าว")
    || h.includes("ชื่อเล่น")
    || h.includes("วันเดือนปีเกิด")
    || h.includes("วันเกิด")
    || h.toLowerCase().includes("birthdate")
    || h.toLowerCase().includes("birthday")
    || h.toLowerCase().includes("nickname")
    || h.includes("ศาสนา")
    || h.toLowerCase().includes("religion")
    || h.includes("เลขที่บัตร")
    || h.includes("บัตรประจำตัว")
    || h.toLowerCase().includes("id card")
    || h.toLowerCase().includes("national id");
}
function isStatusCol(h: string) {
  return h.includes("ผลการพิจารณา") || h.toLowerCase().includes("status") || h.toLowerCase().includes("result");
}

// Fixed 5 table columns with keyword matching against Sheets headers
const TABLE_COL_DEFS = [
  { label: "วันที่เขียนใบสมัคร", keys: ["วันที่เขียน", "วันที่สมัคร", "วันที่", "date"] },
  { label: "แผนกที่สมัคร",        keys: ["แผนก", "ตำแหน่งที่สมัคร", "สมัครงาน", "สมัคร", "department"] },
  { label: "อัตราจ้างที่คาดหวัง",  keys: ["อัตราจ้าง", "อัตรา", "เงินเดือน", "ค่าจ้าง", "salary", "คาดหวัง"] },
  { label: "ชื่อ-นามสกุล",         keys: ["ชื่อ-นามสกุล", "ชื่อและนามสกุล", "ชื่อ นามสกุล", "full name", "fullname", "ชื่อ"] },
  { label: "ระยะเวลาลาออก",        keys: ["ระยะเวลาในการลาออก", "ระยะเวลาลาออก", "ลาออกให้ถูกต้อง", "กี่วัน", "notice"] },
] as const;

function findColKey(dataCols: string[], keys: readonly string[]): string | undefined {
  for (const kw of keys) {
    const match = dataCols.find(h => h.toLowerCase().includes(kw.toLowerCase()));
    if (match) return match;
  }
  return undefined;
}

export default function RecruitPage() {
  const { user } = useAuth();
  const [headers, setHeaders]           = useState<string[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState("");
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detail, setDetail]             = useState<Application | null>(null);
  const [updating, setUpdating]         = useState<string | null>(null);

  const isHR      = user && ["hr", "admin"].includes(user.role);
  const isDeputy  = user && ["deputy", "deputyHR", "admin"].includes(user.role);
  const isHead    = user?.role === "head";
  const canUpdate = isHR || isDeputy;

  const HR_STATUSES     = ["รอพิจารณา", "รอนัดสัมภาษณ์", "รอกรอกใบสมัคร", "ผ่านการสัมภาษณ์"];
  const DEPUTY_STATUSES = Object.keys(STATUS_COLOR);
  const allowedStatuses = isDeputy ? DEPUTY_STATUSES : HR_STATUSES;

  const statusColIdx = headers.findIndex(h => isStatusCol(h));
  const statusKey    = statusColIdx >= 0 ? headers[statusColIdx] : "";

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

  const allDataCols = headers.filter(h => !isHiddenCol(h) && h !== statusKey && h.trim() !== "");

  // Resolve the 5 fixed columns to their actual Sheets header keys
  const resolvedTableCols = TABLE_COL_DEFS.map(def => ({
    label: def.label,
    key: findColKey(allDataCols, def.keys),
  }));

  // Detect phone/contact column dynamically
  const phoneKey = allDataCols.find(h =>
    h.includes("โทร") || h.toLowerCase().includes("phone") || h.toLowerCase().includes("tel") || h.includes("ติดต่อ")
  );

  const interviewQueue = statusKey
    ? applications.filter(a => a[statusKey] === "รอนัดสัมภาษณ์")
    : [];

  const allStatuses = statusKey
    ? [...new Set(applications.map(a => a[statusKey] ?? "").filter(Boolean))]
    : [];

  const filtered = applications.filter(a => {
    const matchSearch = !search || Object.values(a).some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || a[statusKey] === statusFilter;
    return matchSearch && matchStatus;
  });

  // When HR views interview queue, show cards instead of table
  const isInterviewQueueView = isHR && statusFilter === "รอนัดสัมภาษณ์";

  const StatusBadge = ({ val }: { val: string }) => {
    const c = STATUS_COLOR[val] ?? { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
    return (
      <span style={{
        background: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
        borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700,
        whiteSpace: "nowrap", display: "inline-block",
      }}>{val || "—"}</span>
    );
  };

  return (
    <PageLayout title="ระบบสรรหาบุคลากร" accent="#0038C6">
      <>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="ผู้สมัครทั้งหมด" value={applications.length} color="#0038C6" />
        {allStatuses.map(s => (
          <StatCard key={s} label={s} value={applications.filter(a => a[statusKey] === s).length}
            color={STATUS_COLOR[s]?.text ?? "#64748b"} />
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา..."
          style={{ padding: "9px 16px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", width: 220, outline: "none" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <FilterBtn label={`ทั้งหมด (${applications.length})`} active={!statusFilter} onClick={() => setStatusFilter("")} />

          {/* HR special: interview queue button with orange accent */}
          {isHR && interviewQueue.length > 0 && (
            <button onClick={() => setStatusFilter("รอนัดสัมภาษณ์")}
              style={{ padding: "6px 14px", borderRadius: 20, border: `2px solid ${statusFilter === "รอนัดสัมภาษณ์" ? "#c2410c" : "#fed7aa"}`,
                fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 700,
                background: statusFilter === "รอนัดสัมภาษณ์" ? "#c2410c" : "#fff7ed",
                color: statusFilter === "รอนัดสัมภาษณ์" ? "#fff" : "#c2410c",
                display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
              📞 คิวโทรนัดสัมภาษณ์
              <span style={{ background: statusFilter === "รอนัดสัมภาษณ์" ? "rgba(255,255,255,.25)" : "#fed7aa",
                borderRadius: 10, padding: "0 7px", fontSize: 11, fontWeight: 800 }}>
                {interviewQueue.length}
              </span>
            </button>
          )}

          {allStatuses.filter(s => s !== "รอนัดสัมภาษณ์" || !isHR).map(s => (
            <FilterBtn key={s} label={`${s} (${applications.filter(a => a[statusKey] === s).length})`}
              active={statusFilter === s} onClick={() => setStatusFilter(s)} />
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
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", background: "#fff", borderRadius: 14 }}>
          {user?.role === "head" ? "ยังไม่มีผู้มาสมัครงานในแผนกของคุณ" : "ไม่มีข้อมูล"}
        </div>
      ) : isInterviewQueueView ? (

        /* ── HR Interview Queue Card View ── */
        <div>
          <div style={{ background: "linear-gradient(135deg,#fff7ed,#fef3c7)", border: "2px solid #fed7aa",
            borderRadius: 14, padding: "16px 22px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28 }}>📞</span>
            <div>
              <div style={{ fontWeight: 800, color: "#92400e", fontSize: 15 }}>รายการรอโทรนัดสัมภาษณ์</div>
              <div style={{ fontSize: 13, color: "#b45309", marginTop: 2 }}>
                หัวหน้าแผนกส่งมา {filtered.length} ราย — กรุณาโทรนัดและอัปเดตสถานะ
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: 14 }}>
            {filtered.map((app, ri) => (
              <div key={app._row} style={{ background: "#fff", borderRadius: 14, padding: "18px 22px",
                boxShadow: "0 2px 8px rgba(0,0,0,.07)", border: "1.5px solid #fed7aa",
                display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
                {/* Avatar */}
                <div style={{ width: 46, height: 46, borderRadius: 12, background: "#fff7ed",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20, fontWeight: 800, color: "#c2410c", flexShrink: 0 }}>
                  {ri + 1}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a", marginBottom: 4 }}>
                    {resolvedTableCols[3].key ? app[resolvedTableCols[3].key] || "—" : "—"}
                  </div>
                  {resolvedTableCols[1].key && (
                    <div style={{ fontSize: 13, color: "#64748b", marginBottom: 6 }}>
                      แผนก: <span style={{ fontWeight: 600, color: "#334155" }}>{app[resolvedTableCols[1].key] || "—"}</span>
                    </div>
                  )}
                  {phoneKey && app[phoneKey] && (
                    <div style={{ fontSize: 13, color: "#0038C6", fontWeight: 700 }}>
                      📱 {app[phoneKey]}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button onClick={() => setDetail(app)}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0",
                      background: "#f8fafc", fontSize: 12, cursor: "pointer", fontFamily: "inherit",
                      color: "#475569", fontWeight: 600 }}>
                    🔍 ดูข้อมูล
                  </button>
                  <button onClick={() => updateStatus(app, "รอกรอกใบสมัคร")} disabled={updating === app._row}
                    style={{ padding: "7px 16px", borderRadius: 9, border: "none",
                      background: "#ede9fe", fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit", color: "#7c3aed", fontWeight: 700,
                      opacity: updating === app._row ? 0.6 : 1 }}>
                    ✓ นัดสัมภาษณ์แล้ว
                  </button>
                  <button onClick={() => updateStatus(app, "ผ่านการสัมภาษณ์")} disabled={updating === app._row}
                    style={{ padding: "7px 16px", borderRadius: 9, border: "none",
                      background: "#dcfce7", fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit", color: "#16a34a", fontWeight: 700,
                      opacity: updating === app._row ? 0.6 : 1 }}>
                    🎉 ผ่านการสัมภาษณ์
                  </button>
                  <button onClick={() => updateStatus(app, "ไม่ผ่าน")} disabled={updating === app._row}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #fecaca",
                      background: "#fff", fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit", color: "#dc2626", fontWeight: 600,
                      opacity: updating === app._row ? 0.6 : 1 }}>
                    ✗ ไม่เหมาะสม
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      ) : (

        /* ── Regular Table View ── */
        <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 8px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                  <th style={TH}>#</th>
                  {resolvedTableCols.map(col => <th key={col.label} style={TH}>{col.label}</th>)}
                  <th style={TH}>ผลพิจารณา</th>
                  <th style={{ ...TH, textAlign: "center" }}>ข้อมูล</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, ri) => {
                  const curStatus = statusKey ? (app[statusKey] ?? "") : "";
                  const sc = STATUS_COLOR[curStatus];
                  return (
                    <tr key={app._row}
                      style={{ borderBottom: "1px solid #f1f5f9", background: ri % 2 === 0 ? "#fff" : "#fafbff", transition: "background .15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f0f6ff")}
                      onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? "#fff" : "#fafbff")}>
                      <td style={{ ...TD, color: "#94a3b8", width: 36, textAlign: "center", fontWeight: 600 }}>{ri + 1}</td>
                      {resolvedTableCols.map((col, ci) => (
                        <td key={col.label} style={{
                          ...TD,
                          fontWeight: ci === 3 ? 700 : 400,
                          color: ci === 3 ? "#1e293b" : "#475569",
                          maxWidth: ci === 3 ? 200 : 150,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {col.key ? (app[col.key] || "—") : <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                      ))}
                      <td style={TD}>
                        {canUpdate ? (
                          <select value={curStatus} onChange={e => updateStatus(app, e.target.value)}
                            disabled={updating === app._row}
                            style={{ padding: "5px 10px", borderRadius: 20, fontSize: 12, fontFamily: "inherit",
                              cursor: "pointer", fontWeight: 600,
                              border: `1.5px solid ${sc?.border ?? "#e2e8f0"}`,
                              background: sc?.bg ?? "#f8fafc", color: sc?.text ?? "#64748b" }}>
                            <option value="">-- เลือก --</option>
                            {allowedStatuses.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <StatusBadge val={curStatus} />
                        )}
                      </td>
                      <td style={{ ...TD, textAlign: "center" }}>
                        <button onClick={() => setDetail(app)}
                          title="ดูข้อมูลเพิ่มเติม"
                          style={{ width: 34, height: 34, borderRadius: 9, border: "1.5px solid #dbeafe",
                            background: "#eff6ff", fontSize: 16, cursor: "pointer",
                            display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
                          🔍
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "12px 20px", borderTop: "1px solid #f1f5f9", fontSize: 12, color: "#94a3b8", textAlign: "right" }}>
            แสดง {filtered.length} รายการ จาก {applications.length} ทั้งหมด
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {detail && (
        <div onClick={e => { if (e.target === e.currentTarget) setDetail(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 680,
            maxHeight: "92vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,.3)" }}>

            {/* Modal Header */}
            <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #f1f5f9",
              display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div>
                <div style={{ fontSize: 19, fontWeight: 800, color: "#0f172a", marginBottom: 6 }}>
                  {resolvedTableCols[3].key ? detail[resolvedTableCols[3].key] || "—" : "—"}
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 13, color: "#64748b", marginBottom: 10, flexWrap: "wrap" }}>
                  {resolvedTableCols[1].key && <span>แผนก: <b style={{ color: "#334155" }}>{detail[resolvedTableCols[1].key] || "—"}</b></span>}
                  {resolvedTableCols[0].key && <span>วันที่สมัคร: <b style={{ color: "#334155" }}>{detail[resolvedTableCols[0].key] || "—"}</b></span>}
                </div>
                {statusKey && <StatusBadge val={detail[statusKey] ?? ""} />}
              </div>
              <button onClick={() => setDetail(null)}
                style={{ border: "none", background: "#f1f5f9", borderRadius: 10, width: 36, height: 36,
                  cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#64748b" }}>×</button>
            </div>

            {/* All Fields */}
            <div style={{ padding: "20px 28px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 28px" }}>
                {allDataCols.map(h => (
                  <div key={h} style={{ borderBottom: "1px solid #f8fafc", paddingBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase",
                      letterSpacing: "0.05em", marginBottom: 4 }}>{h}</div>
                    <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, wordBreak: "break-word" }}>
                      {detail[h] || <span style={{ color: "#cbd5e1" }}>—</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Head action: send to HR for interview ── */}
              {isHead && statusKey && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "2px solid #f1f5f9" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 12 }}>
                    การดำเนินการ
                  </div>
                  {detail[statusKey] === "รอนัดสัมภาษณ์" ? (
                    <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 12,
                      padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>📞</span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#c2410c", fontSize: 14 }}>ส่งให้ HR เรียกสัมภาษณ์แล้ว</div>
                        <div style={{ fontSize: 12, color: "#b45309", marginTop: 2 }}>รอ HR ติดต่อผู้สมัคร</div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => updateStatus(detail, "รอนัดสัมภาษณ์")} disabled={updating === detail._row}
                      style={{ width: "100%", padding: "14px 24px", borderRadius: 12, border: "none",
                        background: "linear-gradient(135deg,#c2410c,#ea580c)",
                        color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
                        fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 10, opacity: updating === detail._row ? 0.7 : 1,
                        boxShadow: "0 4px 14px rgba(194,65,12,.35)", transition: "opacity .15s" }}>
                      <span style={{ fontSize: 20 }}>📞</span>
                      ส่งให้ HR เรียกสัมภาษณ์
                    </button>
                  )}
                </div>
              )}

              {/* ── HR/Deputy status update panel ── */}
              {canUpdate && statusKey && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "2px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>อัปเดตผลการพิจารณา</div>
                    {!isDeputy && <span style={{ fontSize: 11, background: "#fef9c3", color: "#b45309", borderRadius: 8, padding: "2px 10px", fontWeight: 600 }}>HR</span>}
                    {isDeputy  && <span style={{ fontSize: 11, background: "#ede9fe", color: "#7c3aed", borderRadius: 8, padding: "2px 10px", fontWeight: 600 }}>รองผู้อำนวยการ</span>}
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {allowedStatuses.map(s => {
                      const c = STATUS_COLOR[s] ?? { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
                      const active = detail[statusKey] === s;
                      return (
                        <button key={s} onClick={() => updateStatus(detail, s)} disabled={updating === detail._row}
                          style={{ padding: "8px 18px", borderRadius: 20, border: `2px solid ${active ? c.text : c.border}`,
                            cursor: "pointer", fontFamily: "inherit", fontSize: 13, fontWeight: 700,
                            background: active ? c.bg : "#fff", color: active ? c.text : "#64748b",
                            transform: active ? "scale(1.05)" : "scale(1)", transition: "all .15s",
                            opacity: updating === detail._row ? 0.6 : 1 }}>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ padding: "12px 28px 20px", textAlign: "right" }}>
              <button onClick={() => setDetail(null)}
                style={{ padding: "9px 24px", borderRadius: 10, border: "1.5px solid #e2e8f0",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13, color: "#475569" }}>
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}
      </>
    </PageLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "14px 20px",
      boxShadow: "0 1px 4px rgba(0,0,0,.06)", borderLeft: `4px solid ${color}`, minWidth: 120 }}>
      <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

function FilterBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${active ? "#0038C6" : "#e2e8f0"}`,
        fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: active ? 700 : 400,
        background: active ? "#0038C6" : "#fff", color: active ? "#fff" : "#64748b", transition: "all .15s" }}>
      {label}
    </button>
  );
}

const TH: React.CSSProperties = {
  padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#475569",
  fontSize: 12, whiteSpace: "nowrap", letterSpacing: "0.03em",
};
const TD: React.CSSProperties = {
  padding: "12px 16px", color: "#334155", verticalAlign: "middle",
};
