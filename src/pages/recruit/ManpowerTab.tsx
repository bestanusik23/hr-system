import { useEffect, useState } from "react";

interface ManpowerRow { [key: string]: string; }

export default function ManpowerTab() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<ManpowerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/recruit/manpower").then(r => r.json())
      .then((d: { ok: boolean; records: ManpowerRow[]; headers: string[]; error?: string }) => {
        if (!d.ok) { setError(d.error ?? "ไม่สามารถโหลดข้อมูลได้"); }
        else { setHeaders(d.headers ?? []); setRecords(d.records ?? []); }
        setLoading(false);
      });
  }, []);

  // Try to detect target vs actual columns for progress bar
  const targetCol = headers.find(h => h.includes("เป้า") || h.includes("อัตรา") || h.toLowerCase().includes("target"));
  const actualCol = headers.find(h => h.includes("จริง") || h.includes("ปัจจุบัน") || h.toLowerCase().includes("actual") || h.toLowerCase().includes("current"));

  const filtered = records.filter(r =>
    !search || Object.values(r).some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหา…"
          style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", width: 220 }} />
        <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: "auto" }}>ทั้งหมด {filtered.length} แถว</span>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลดจาก Google Sheets…</div>
      ) : error ? (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, color: "#dc2626" }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>ไม่สามารถโหลดข้อมูลได้</div>
          <div style={{ fontSize: 13 }}>{error}</div>
          <div style={{ fontSize: 12, marginTop: 10, color: "#ef4444" }}>ตรวจสอบว่า share SHEET_MANPOWER ให้ service account แล้ว</div>
        </div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>ไม่มีข้อมูล (หรือยังไม่ได้ share Sheet)</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", fontSize: 12 }}>#</th>
                  {headers.map(h => <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 12 }}>{h}</th>)}
                  {targetCol && actualCol && <th style={{ padding: "10px 14px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", fontSize: 12 }}>ความครบ</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => {
                  const target = targetCol ? Number(row[targetCol]) : 0;
                  const actual = actualCol ? Number(row[actualCol]) : 0;
                  const pct = target > 0 ? Math.min(100, Math.round(actual / target * 100)) : 0;
                  const pctColor = pct >= 90 ? "#16a34a" : pct >= 60 ? "#f59e0b" : "#ef4444";
                  return (
                    <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                      <td style={{ padding: "10px 14px", color: "#94a3b8" }}>{i + 1}</td>
                      {headers.map(h => (
                        <td key={h} style={{ padding: "10px 14px", color: "#1e293b", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {row[h] || "—"}
                        </td>
                      ))}
                      {targetCol && actualCol && (
                        <td style={{ padding: "10px 14px", minWidth: 120 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ flex: 1, height: 8, background: "#e2e8f0", borderRadius: 4 }}>
                              <div style={{ height: 8, background: pctColor, borderRadius: 4, width: `${pct}%` }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: pctColor, width: 36 }}>{pct}%</span>
                          </div>
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
    </div>
  );
}
