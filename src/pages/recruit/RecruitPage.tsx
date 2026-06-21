import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import { useAuth } from "../../context/AuthContext";

interface Application {
  _row: string;
  [key: string]: string;
}

const STATUS_COLOR: Record<string, string> = {
  "รอสัมภาษณ์": "#f59e0b",
  "ผ่านสัมภาษณ์": "#16a34a",
  "ไม่ผ่าน": "#ef4444",
  "รับเข้างาน": "#0891b2",
  "": "#94a3b8",
};

export default function RecruitPage() {
  const { user } = useAuth();
  const [headers, setHeaders] = useState<string[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);

  const isHR = user && ["hr", "admin"].includes(user.role);
  const statusCol = headers.findIndex(h => h.toLowerCase().includes("สถานะ") || h.toLowerCase() === "status");

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

  async function updateStatus(row: string, value: string) {
    if (statusCol < 0) return;
    const colLetter = String.fromCharCode(65 + statusCol);
    setUpdating(row);
    await fetch("/api/recruit/applications", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ row: Number(row), col: colLetter, value }),
    });
    setApplications(prev => prev.map(a => a._row === row ? { ...a, [headers[statusCol]]: value } : a));
    setUpdating(null);
  }

  const filtered = applications.filter(a => {
    const matchSearch = !search || Object.values(a).some(v => v.toLowerCase().includes(search.toLowerCase()));
    const matchStatus = !statusFilter || a[headers[statusCol]] === statusFilter;
    return matchSearch && matchStatus;
  });

  const allStatuses = statusCol >= 0
    ? [...new Set(applications.map(a => a[headers[statusCol]] ?? "").filter(Boolean))]
    : [];

  return (
    <PageLayout title="ระบบสรรหาบุคลากร" accent="#0038C6">
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหา..."
          style={{ padding: "9px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", width: 220 }}
        />
        {allStatuses.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setStatusFilter("")} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid", borderColor: !statusFilter ? "#0038C6" : "#e2e8f0", background: !statusFilter ? "#0038C6" : "#fff", color: !statusFilter ? "#fff" : "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>ทั้งหมด</button>
            {allStatuses.map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} style={{ padding: "6px 12px", borderRadius: 8, border: "1.5px solid", borderColor: statusFilter === s ? "#0038C6" : "#e2e8f0", background: statusFilter === s ? "#0038C6" : "#fff", color: statusFilter === s ? "#fff" : "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>{s}</button>
            ))}
          </div>
        )}
        <div style={{ marginLeft: "auto", fontSize: 13, color: "#94a3b8" }}>ทั้งหมด {filtered.length} รายการ</div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลดจาก Google Sheets…</div>
      ) : error ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, color: "#dc2626" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>ไม่สามารถโหลดข้อมูลได้</div>
          <div style={{ fontSize: 13 }}>{error}</div>
          <div style={{ fontSize: 12, color: "#ef4444", marginTop: 12 }}>ตรวจสอบว่า:<br/>• ตั้งค่า GOOGLE_SA_EMAIL และ GOOGLE_SA_PRIVATE_KEY ใน Cloudflare Variables แล้ว<br/>• Service Account มีสิทธิ์ Editor บน Google Sheet</div>
        </div>
      ) : applications.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>ไม่มีข้อมูลใน Google Sheets (หรือยังไม่มีแถวข้อมูล)</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {headers.map((h, i) => (
                    <th key={i} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                  {isHR && statusCol >= 0 && <th style={{ padding: "12px 14px", color: "#475569", fontWeight: 600, borderBottom: "2px solid #e2e8f0" }}>อัปเดตสถานะ</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((app, ri) => {
                  const curStatus = statusCol >= 0 ? (app[headers[statusCol]] ?? "") : "";
                  return (
                    <tr key={app._row} style={{ borderBottom: "1px solid #f1f5f9", background: ri % 2 === 0 ? "#fff" : "#fafafa" }}>
                      {headers.map((h, ci) => (
                        <td key={ci} style={{ padding: "11px 14px", color: "#1e293b", verticalAlign: "middle" }}>
                          {ci === statusCol ? (
                            <span style={{ background: (STATUS_COLOR[app[h]] ?? "#94a3b8") + "22", color: STATUS_COLOR[app[h]] ?? "#94a3b8", borderRadius: 8, padding: "3px 10px", fontWeight: 600, whiteSpace: "nowrap" }}>{app[h] || "—"}</span>
                          ) : app[h]}
                        </td>
                      ))}
                      {isHR && statusCol >= 0 && (
                        <td style={{ padding: "8px 14px" }}>
                          <select
                            value={curStatus}
                            onChange={e => updateStatus(app._row, e.target.value)}
                            disabled={updating === app._row}
                            style={{ padding: "5px 10px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 12, fontFamily: "inherit", cursor: "pointer" }}
                          >
                            <option value="">-- เลือก --</option>
                            {["รอสัมภาษณ์", "ผ่านสัมภาษณ์", "ไม่ผ่าน", "รับเข้างาน"].map(s => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Setup hint if no Google credentials */}
      <div style={{ marginTop: 20, background: "#eff6ff", borderRadius: 12, padding: "14px 18px", fontSize: 12, color: "#1d4ed8" }}>
        <b>หมายเหตุ:</b> ระบบนี้ดึงข้อมูลจาก Google Sheets (ID: {import.meta.env.VITE_SHEET_ID ?? "ตั้งค่าใน wrangler.toml"})<br/>
        หากต้องการเปลี่ยน Sheet ให้อัปเดต SHEET_APPLICATIONS ใน wrangler.toml
      </div>
    </PageLayout>
  );
}
