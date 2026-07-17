import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";

interface Application { _row: string; [key: string]: string; }
interface Appointment { appointment_date: string; note: string; has_filled_application: boolean; }

function formatApptDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const months = ["", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  return `${d} ${months[m]} ${y + 543}`;
}

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  "รอพิจารณา":                 { bg: "#fef9c3", text: "#b45309", border: "#fde68a" },
  "กรอกใบสมัครและสัมภาษณ์":    { bg: "#ede9fe", text: "#7c3aed", border: "#ddd6fe" },
  "ไม่ผ่านการพิจารณา":         { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
  "ผ่านการพิจารณา":            { bg: "#dcfce7", text: "#16a34a", border: "#bbf7d0" },
  "ผู้สมัครยกเลิกการสัมภาษณ์": { bg: "#e2e8f0", text: "#475569", border: "#cbd5e1" },
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
  { label: "วันที่เขียนใบสมัคร", keys: ["วันที่เขียน", "วันที่สมัคร", "วันที่", "date"],                              salaryCol: false },
  { label: "แผนกที่สมัคร",        keys: ["แผนก", "ตำแหน่งที่สมัคร", "สมัครงาน", "สมัคร", "department"],              salaryCol: false },
  { label: "อัตราจ้างที่คาดหวัง",  keys: ["อัตราจ้าง", "อัตรา", "เงินเดือน", "ค่าจ้าง", "salary", "คาดหวัง"],        salaryCol: true  },
  { label: "ชื่อ-นามสกุล",         keys: ["ชื่อ-นามสกุล", "ชื่อและนามสกุล", "ชื่อ นามสกุล", "full name", "fullname", "ชื่อ"], salaryCol: false },
] as const;

const SALARY_KEYWORDS = ["อัตราจ้าง", "อัตรา", "เงินเดือน", "ค่าจ้าง", "salary", "คาดหวัง", "เงิน"];
function isSalaryCol(h: string): boolean {
  const low = h.toLowerCase();
  return SALARY_KEYWORDS.some(k => low.includes(k.toLowerCase()));
}

// คอลัมน์ระยะเวลาลาออก — แสดงใน detail modal เท่านั้น (ไม่แสดงในตาราง)
const NOTICE_KEYS = [
  "ระยะเวลาในการลาออก", "ระยะเวลาลาออก", "ลาออกให้ถูกต้อง", "กี่วัน", "notice",
  "ยังไม่ออกจากงาน", "ออกจากงานเดิม", "ลาออกตามระเบียบ", "ระเบียบกี่วัน",
  "คัดเลือกเข้าทำงาน", "ท่านต้องใช้ระยะเวลา",
];

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
  const [page, setPage]                 = useState(1);
  const [detail, setDetail]             = useState<Application | null>(null);
  const [updating, setUpdating]         = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Record<string, Appointment>>({});
  const [apptDraft, setApptDraft]       = useState<Appointment>({ appointment_date: "", note: "", has_filled_application: false });
  const [savingAppt, setSavingAppt]     = useState(false);
  const [queueSubFilter, setQueueSubFilter] = useState<"all" | "filled" | "not_filled">("all");

  const isHR        = user && ["hr", "deputyHR", "admin"].includes(user.role);
  const isHead      = user?.role === "head";
  const isDeputy    = user?.role === "deputy";
  const canUpdate   = !!isHR;
  const canSendToHR = isHead || isDeputy;

  const ALL_STATUSES = Object.keys(STATUS_COLOR);
  const allowedStatuses = ALL_STATUSES;

  const statusColIdx = headers.findIndex(h => isStatusCol(h));
  const statusKey    = statusColIdx >= 0 ? headers[statusColIdx] : "";

  async function load() {
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/recruit/applications");
      const d = await r.json() as { ok: boolean; applications: Application[]; headers: string[]; error?: string };
      if (!d.ok) { setError(d.error ?? "ไม่สามารถโหลดข้อมูลได้"); return; }
      setHeaders(d.headers ?? []);
      setApplications(d.applications ?? []);
    } catch {
      setError("ไม่สามารถเชื่อมต่อได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  async function loadAppointments() {
    try {
      const r = await fetch("/api/recruit/appointments");
      const d = await r.json() as { ok: boolean; appointments: { row_idx: number; appointment_date: string; note: string; has_filled_application: number }[] };
      if (!d.ok) return;
      const map: Record<string, Appointment> = {};
      for (const a of d.appointments) map[String(a.row_idx)] = {
        appointment_date: a.appointment_date, note: a.note, has_filled_application: !!a.has_filled_application,
      };
      setAppointments(map);
    } catch { /* non-fatal — appointment fields just show empty */ }
  }

  async function saveAppointment() {
    if (!detail) return;
    setSavingAppt(true);
    try {
      await fetch("/api/recruit/appointments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ row_idx: Number(detail._row), ...apptDraft }),
      });
      setAppointments(prev => ({ ...prev, [detail._row]: { ...apptDraft } }));
    } finally {
      setSavingAppt(false);
    }
  }

  useEffect(() => { load(); loadAppointments(); }, []);

  useEffect(() => {
    if (!detail) return;
    const existing = appointments[detail._row];
    setApptDraft({
      appointment_date: existing?.appointment_date ?? "", note: existing?.note ?? "",
      has_filled_application: existing?.has_filled_application ?? false,
    });
  }, [detail]); // eslint-disable-line

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

  const allDataCols = headers.filter(h => {
    if (isHiddenCol(h) || h === statusKey || h.trim() === "") return false;
    if (!isHR && isSalaryCol(h)) return false;
    return true;
  });

  // Resolve the fixed columns to their actual Sheets header keys (skip salary for non-HR)
  const resolvedTableCols = TABLE_COL_DEFS
    .filter(def => isHR || !def.salaryCol)
    .map(def => ({
      label: def.label,
      key: findColKey(allDataCols, def.keys as unknown as string[]),
    }));

  // Name column — always the last TABLE_COL_DEF; safe regardless of salary filter
  const nameCol = resolvedTableCols.find(c => c.label === "ชื่อ-นามสกุล");

  // Detect phone/contact column dynamically
  const phoneKey = allDataCols.find(h =>
    h.includes("โทร") || h.toLowerCase().includes("phone") || h.toLowerCase().includes("tel") || h.includes("ติดต่อ")
  );

  // คอลัมน์ระยะเวลาลาออก — ค้นจาก headers ทั้งหมด
  const noticeKey = headers.find(h =>
    NOTICE_KEYS.some(kw => h.toLowerCase().includes(kw.toLowerCase()))
  );

  // คอลัมน์วันเกิด (ซ่อนในตาราง แต่ใช้คำนวณอายุใน modal)
  const birthKey = headers.find(h =>
    h.includes("วันเดือนปีเกิด") || h.includes("วันเกิด") ||
    h.toLowerCase().includes("birthdate") || h.toLowerCase().includes("birthday")
  );

  // Normalize: empty / null status → "รอพิจารณา"
  function getAppStatus(app: Application): string {
    return statusKey ? (app[statusKey] || "รอพิจารณา") : "รอพิจารณา";
  }

  const interviewQueue = applications.filter(a => getAppStatus(a) === "กรอกใบสมัครและสัมภาษณ์");

  // Always show all 4 defined statuses
  const allStatuses = Object.keys(STATUS_COLOR);

  const filtered = applications.filter(a => {
    const matchSearch = !search || Object.values(a).some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || getAppStatus(a) === statusFilter;
    return matchSearch && matchStatus;
  });

  const PAGE_SIZE = 15;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageStart = (pageSafe - 1) * PAGE_SIZE;
  const paged = filtered.slice(pageStart, pageStart + PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  // When HR views interview queue, show cards instead of table
  const isInterviewQueueView = isHR && statusFilter === "กรอกใบสมัครและสัมภาษณ์";

  const StatusBadge = ({ val }: { val: string }) => {
    const display = val || "รอพิจารณา";
    const c = STATUS_COLOR[display] ?? { bg: "#f1f5f9", text: "#64748b", border: "#e2e8f0" };
    return (
      <span style={{
        background: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
        borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700,
        whiteSpace: "nowrap", display: "inline-block",
      }}>{display}</span>
    );
  };

  return (
    <PageLayout title="ระบบสรรหาบุคลากร" accent="#0038C6">
      <>
      {/* Stats bar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <StatCard label="ผู้สมัครทั้งหมด" value={applications.length} color="#0038C6" />
        {allStatuses.map(s => (
          <StatCard key={s} label={s} value={applications.filter(a => getAppStatus(a) === s).length}
            color={STATUS_COLOR[s]?.text ?? "#64748b"} />
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา..."
          style={{ padding: "9px 16px", borderRadius: 7, border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit", width: 220, outline: "none" }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <FilterBtn label={`ทั้งหมด (${applications.length})`} active={!statusFilter} onClick={() => setStatusFilter("")} />

          {/* HR special: interview queue button with purple accent */}
          {isHR && interviewQueue.length > 0 && (
            <button onClick={() => setStatusFilter("กรอกใบสมัครและสัมภาษณ์")}
              style={{ padding: "6px 14px", borderRadius: 20, border: `2px solid ${statusFilter === "กรอกใบสมัครและสัมภาษณ์" ? "#7c3aed" : "#ddd6fe"}`,
                fontFamily: "inherit", fontSize: 12, cursor: "pointer", fontWeight: 700,
                background: statusFilter === "กรอกใบสมัครและสัมภาษณ์" ? "#7c3aed" : "#ede9fe",
                color: statusFilter === "กรอกใบสมัครและสัมภาษณ์" ? "#fff" : "#7c3aed",
                display: "flex", alignItems: "center", gap: 6, transition: "all .15s" }}>
              📋 คิวสัมภาษณ์
              <span style={{ background: statusFilter === "กรอกใบสมัครและสัมภาษณ์" ? "rgba(255,255,255,.25)" : "#ddd6fe",
                borderRadius: 10, padding: "0 7px", fontSize: 11, fontWeight: 800 }}>
                {interviewQueue.length}
              </span>
            </button>
          )}

          {allStatuses.filter(s => s !== "กรอกใบสมัครและสัมภาษณ์" || !isHR).map(s => (
            <FilterBtn key={s} label={`${s} (${applications.filter(a => getAppStatus(a) === s).length})`}
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
          <div style={{ background: "linear-gradient(135deg,#f5f3ff,#ede9fe)", border: "2px solid #ddd6fe",
            borderRadius: 14, padding: "16px 22px", marginBottom: 20,
            display: "flex", alignItems: "center", gap: 14 }}>
            <span style={{ fontSize: 28 }}>📋</span>
            <div>
              <div style={{ fontWeight: 800, color: "#5b21b6", fontSize: 15 }}>รายการกรอกใบสมัครและสัมภาษณ์</div>
              <div style={{ fontSize: 13, color: "#7c3aed", marginTop: 2 }}>
                {filtered.length} ราย — กรุณาดำเนินการสัมภาษณ์และอัปเดตผล
              </div>
            </div>
          </div>

          {(() => {
            const filledCount = filtered.filter(a => appointments[a._row]?.has_filled_application).length;
            const notFilledCount = filtered.length - filledCount;
            const subTabs: [typeof queueSubFilter, string][] = [
              ["all", `ทั้งหมด (${filtered.length})`],
              ["filled", `✅ เข้ามากรอกใบสมัครแล้ว (${filledCount})`],
              ["not_filled", `ยังไม่เข้ามา (${notFilledCount})`],
            ];
            return (
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {subTabs.map(([k, v]) => (
                  <button key={k} onClick={() => setQueueSubFilter(k)} style={{
                    padding: "6px 14px", borderRadius: 20, border: "1.5px solid",
                    borderColor: queueSubFilter === k ? "#7c3aed" : "#e2e8f0",
                    background: queueSubFilter === k ? "#7c3aed" : "#fff",
                    color: queueSubFilter === k ? "#fff" : "#475569",
                    fontSize: 12, fontWeight: queueSubFilter === k ? 700 : 400,
                    cursor: "pointer", fontFamily: "inherit", transition: "all .15s",
                  }}>{v}</button>
                ))}
              </div>
            );
          })()}

          <div style={{ display: "grid", gap: 14 }}>
            {filtered.filter(app => {
              if (queueSubFilter === "all") return true;
              const has = !!appointments[app._row]?.has_filled_application;
              return queueSubFilter === "filled" ? has : !has;
            }).map((app, ri) => (
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                      {nameCol?.key ? app[nameCol?.key] || "—" : "—"}
                    </span>
                    {appointments[app._row]?.has_filled_application && (
                      <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 20,
                        padding: "2px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
                        ✅ กรอกใบสมัครแล้ว
                      </span>
                    )}
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
                  {appointments[app._row]?.appointment_date && (
                    <div style={{ fontSize: 12, color: "#c2410c", fontWeight: 700, marginTop: 4 }}>
                      📅 นัด {formatApptDate(appointments[app._row].appointment_date)}
                    </div>
                  )}
                  {appointments[app._row]?.note && (
                    <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      📝 {appointments[app._row].note}
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
                  <button onClick={() => updateStatus(app, "ผ่านการพิจารณา")} disabled={updating === app._row}
                    style={{ padding: "7px 16px", borderRadius: 9, border: "none",
                      background: "#dcfce7", fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit", color: "#16a34a", fontWeight: 700,
                      opacity: updating === app._row ? 0.6 : 1 }}>
                    🎉 ผ่านการพิจารณา
                  </button>
                  <button onClick={() => updateStatus(app, "ไม่ผ่านการพิจารณา")} disabled={updating === app._row}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #fecaca",
                      background: "#fff", fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit", color: "#dc2626", fontWeight: 600,
                      opacity: updating === app._row ? 0.6 : 1 }}>
                    ✗ ไม่ผ่านการพิจารณา
                  </button>
                  <button onClick={() => updateStatus(app, "ผู้สมัครยกเลิกการสัมภาษณ์")} disabled={updating === app._row}
                    style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #cbd5e1",
                      background: "#fff", fontSize: 12, cursor: "pointer",
                      fontFamily: "inherit", color: "#475569", fontWeight: 600,
                      opacity: updating === app._row ? 0.6 : 1 }}>
                    🚫 ผู้สมัครยกเลิกการสัมภาษณ์
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      ) : (

        /* ── Regular Table View ── */
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f4f7ff", borderBottom: "2px solid #dce4f5" }}>
                  <th style={TH}>#</th>
                  {resolvedTableCols.map(col => <th key={col.label} style={TH}>{col.label}</th>)}
                  <th style={TH}>ผลพิจารณา</th>
                  <th style={{ ...TH, textAlign: "center" }}>ข้อมูล</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((app, ri) => {
                  const curStatus = statusKey ? (app[statusKey] || "รอพิจารณา") : "รอพิจารณา";
                  const sc = STATUS_COLOR[curStatus];
                  return (
                    <tr key={app._row}
                      style={{ borderBottom: "1px solid #f1f5f9", background: ri % 2 === 0 ? "#fff" : "#fafbff", transition: "background .15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f0f6ff")}
                      onMouseLeave={e => (e.currentTarget.style.background = ri % 2 === 0 ? "#fff" : "#fafbff")}>
                      <td style={{ ...TD, color: "#94a3b8", width: 36, textAlign: "center", fontWeight: 600 }}>{pageStart + ri + 1}</td>
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
          <div style={{ padding: "12px 20px", borderTop: "1px solid #f0f5ff",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <span style={{ fontSize: 12, color: "#94a3b8" }}>
              แสดง {filtered.length === 0 ? 0 : pageStart + 1}-{Math.min(pageStart + PAGE_SIZE, filtered.length)} จาก {filtered.length} รายการ (ทั้งหมด {applications.length})
            </span>
            {totalPages > 1 && (
              <Pagination page={pageSafe} totalPages={totalPages} onChange={setPage} />
            )}
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
                  {nameCol?.key ? detail[nameCol?.key] || "—" : "—"}
                </div>
                <div style={{ display: "flex", gap: 14, fontSize: 13, color: "#64748b", marginBottom: 10, flexWrap: "wrap" }}>
                  {resolvedTableCols[1].key && <span>แผนก: <b style={{ color: "#334155" }}>{detail[resolvedTableCols[1].key] || "—"}</b></span>}
                  {resolvedTableCols[0].key && <span>วันที่สมัคร: <b style={{ color: "#334155" }}>{detail[resolvedTableCols[0].key] || "—"}</b></span>}
                  {birthKey && detail[birthKey] && (() => {
                    const age = calcAge(detail[birthKey]);
                    return age !== null ? (
                      <span style={{ background: "#eff6ff", color: "#1d4ed8", borderRadius: 8,
                        padding: "2px 10px", fontWeight: 700, fontSize: 13 }}>
                        อายุ {age} ปี
                      </span>
                    ) : null;
                  })()}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {statusKey && <StatusBadge val={detail[statusKey] ?? ""} />}
                  {appointments[detail._row]?.appointment_date && (
                    <span style={{ background: "#fff7ed", color: "#c2410c", border: "1.5px solid #fed7aa",
                      borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                      📅 นัด {formatApptDate(appointments[detail._row].appointment_date)}
                    </span>
                  )}
                  {appointments[detail._row]?.has_filled_application && (
                    <span style={{ background: "#dcfce7", color: "#16a34a", border: "1.5px solid #86efac",
                      borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: 700 }}>
                      ✅ กรอกใบสมัครแล้ว
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setDetail(null)}
                style={{ border: "none", background: "#f1f5f9", borderRadius: 10, width: 36, height: 36,
                  cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0, color: "#64748b" }}>×</button>
            </div>

            {/* All Fields */}
            <div style={{ padding: "20px 28px" }}>

              {/* เริ่มงานได้ภายในกี่วัน — highlight card */}
              {noticeKey && (
                <div style={{ marginBottom: 20,
                  background: detail[noticeKey] ? "#f0f5ff" : "#f8fafc",
                  border: `1.5px solid ${detail[noticeKey] ? "#c4cfee" : "#e2e8f0"}`,
                  borderLeft: `4px solid ${detail[noticeKey] ? "#0038C6" : "#cbd5e1"}`,
                  borderRadius: 8, padding: "14px 18px",
                  display: "flex", alignItems: "center", gap: 14 }}>
                  <span style={{ fontSize: 22 }}>⏱️</span>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#475569",
                      letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 4 }}>
                      เริ่มงานได้ภายในกี่วัน
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800,
                      color: detail[noticeKey] ? "#0038C6" : "#94a3b8" }}>
                      {detail[noticeKey] || "ไม่ได้ระบุ"}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 28px" }}>
                {allDataCols.map(h => (
                  <div key={h} style={{ borderBottom: "1px solid #f8fafc", paddingBottom: 10 }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase" as const,
                      letterSpacing: "0.05em", marginBottom: 4 }}>{h}</div>
                    <div style={{ fontSize: 13, color: "#1e293b", fontWeight: 500, wordBreak: "break-word" }}>
                      {detail[h] || <span style={{ color: "#cbd5e1" }}>—</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* ── Head / Deputy action: send to HR for contact ── */}
              {canSendToHR && statusKey && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "2px solid #f1f5f9" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#475569", marginBottom: 12 }}>การดำเนินการ</div>
                  {detail[statusKey] === "กรอกใบสมัครและสัมภาษณ์" ? (
                    <div style={{ background: "#f5f3ff", border: "1.5px solid #ddd6fe", borderRadius: 12,
                      padding: "14px 18px", display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>📋</span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#7c3aed", fontSize: 14 }}>ส่งเข้ากระบวนการสัมภาษณ์แล้ว</div>
                        <div style={{ fontSize: 12, color: "#6d28d9", marginTop: 2 }}>อยู่ระหว่างการสัมภาษณ์และพิจารณา</div>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => updateStatus(detail, "กรอกใบสมัครและสัมภาษณ์")} disabled={updating === detail._row}
                      style={{ width: "100%", padding: "14px 24px", borderRadius: 12, border: "none",
                        background: "linear-gradient(135deg,#7c3aed,#6d28d9)",
                        color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer",
                        fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center",
                        gap: 10, opacity: updating === detail._row ? 0.7 : 1,
                        boxShadow: "0 4px 14px rgba(124,58,237,.35)", transition: "opacity .15s" }}>
                      <span style={{ fontSize: 20 }}>📋</span>
                      ส่งเข้ากระบวนการสัมภาษณ์
                    </button>
                  )}
                </div>
              )}

              {/* ── HR appointment scheduling (call to book application/interview) ── */}
              {canUpdate && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "2px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>📅 นัดหมาย</div>
                    <span style={{ fontSize: 11, background: "#fef9c3", color: "#b45309", borderRadius: 8, padding: "2px 10px", fontWeight: 600 }}>HR</span>
                  </div>
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    <div style={{ flex: "0 0 auto" }}>
                      <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 4 }}>วันที่นัด</label>
                      <input type="date" value={apptDraft.appointment_date}
                        onChange={e => setApptDraft(d => ({ ...d, appointment_date: e.target.value }))}
                        style={{ padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                          fontFamily: "inherit", fontSize: 13 }} />
                    </div>
                    <div style={{ flex: "1 1 220px" }}>
                      <label style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, display: "block", marginBottom: 4 }}>หมายเหตุ / ข้อความเพิ่มเติม</label>
                      <textarea value={apptDraft.note} rows={2}
                        placeholder="เช่น นัดกรอกใบสมัคร 10:00 น. / โทรนัดสัมภาษณ์รอบ 2"
                        onChange={e => setApptDraft(d => ({ ...d, note: e.target.value }))}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0",
                          fontFamily: "inherit", fontSize: 13, resize: "vertical" }} />
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, cursor: "pointer",
                    background: apptDraft.has_filled_application ? "#f0fdf4" : "#f8fafc",
                    border: `1.5px solid ${apptDraft.has_filled_application ? "#86efac" : "#e2e8f0"}`,
                    borderRadius: 10, padding: "9px 14px", width: "fit-content" }}>
                    <input type="checkbox" checked={apptDraft.has_filled_application}
                      onChange={e => setApptDraft(d => ({ ...d, has_filled_application: e.target.checked }))}
                      style={{ width: 16, height: 16, cursor: "pointer" }} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: apptDraft.has_filled_application ? "#16a34a" : "#475569" }}>
                      ✅ เข้ามากรอกใบสมัครแล้ว
                    </span>
                  </label>
                  <button onClick={saveAppointment} disabled={savingAppt}
                    style={{ marginTop: 10, padding: "9px 20px", borderRadius: 10, border: "none",
                      background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
                      fontFamily: "inherit", opacity: savingAppt ? 0.6 : 1 }}>
                    {savingAppt ? "กำลังบันทึก..." : "บันทึกนัดหมาย"}
                  </button>
                </div>
              )}

              {/* ── HR status update panel (full access) ── */}
              {canUpdate && statusKey && (
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "2px solid #f1f5f9" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>อัปเดตผลการพิจารณา</div>
                    <span style={{ fontSize: 11, background: "#fef9c3", color: "#b45309", borderRadius: 8, padding: "2px 10px", fontWeight: 600 }}>HR</span>
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

function calcAge(dateStr: string): number | null {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{4})/);
  if (!match) return null;
  let year = parseInt(match[1]);
  if (year > 2400) year -= 543; // แปลง พ.ศ. → ค.ศ.
  const age = new Date().getFullYear() - year;
  return age >= 0 && age <= 100 ? age : null;
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "14px 20px",
      border: "1px solid #dce4f5", borderLeft: `4px solid ${color}`, minWidth: 120 }}>
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

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  const btnStyle = (active: boolean, disabled: boolean): React.CSSProperties => ({
    minWidth: 30, height: 30, padding: "0 8px", borderRadius: 7,
    border: `1.5px solid ${active ? "#0038C6" : "#e2e8f0"}`,
    background: active ? "#0038C6" : "#fff", color: active ? "#fff" : disabled ? "#cbd5e1" : "#475569",
    fontFamily: "inherit", fontSize: 12, fontWeight: active ? 700 : 600,
    cursor: disabled ? "default" : "pointer",
  });

  // Windowed page numbers: first, last, current ±1, with "…" gaps.
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button disabled={page <= 1} onClick={() => onChange(page - 1)} style={btnStyle(false, page <= 1)}>‹</button>
      {nums.map((n, i) => n === "…"
        ? <span key={`gap-${i}`} style={{ color: "#cbd5e1", fontSize: 12, padding: "0 2px" }}>…</span>
        : <button key={n} onClick={() => onChange(n)} style={btnStyle(n === page, false)}>{n}</button>)}
      <button disabled={page >= totalPages} onClick={() => onChange(page + 1)} style={btnStyle(false, page >= totalPages)}>›</button>
    </div>
  );
}

const TH: React.CSSProperties = {
  padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#475569",
  fontSize: 12, whiteSpace: "nowrap", letterSpacing: "0.03em",
};
const TD: React.CSSProperties = {
  padding: "12px 16px", color: "#334155", verticalAlign: "middle",
};
