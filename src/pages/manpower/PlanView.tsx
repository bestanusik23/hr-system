import { useEffect, useState } from "react";
import type { MasterEmployee } from "./MasterEmployeeForm";

interface DivisionGroup {
  division_id: number;
  division_name: string;
  positions: { position: string; employees: MasterEmployee[] }[];
  total: number;
}

const DIV_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const DIV_COLORS: Record<number, { bg: string; text: string }> = {
  1:  { bg: "#0038C6", text: "#fff" },
  2:  { bg: "#0891b2", text: "#fff" },
  3:  { bg: "#7c3aed", text: "#fff" },
  4:  { bg: "#16a34a", text: "#fff" },
  5:  { bg: "#d97706", text: "#fff" },
  6:  { bg: "#db2777", text: "#fff" },
  7:  { bg: "#0d9488", text: "#fff" },
  8:  { bg: "#1d4ed8", text: "#fff" },
  9:  { bg: "#6d28d9", text: "#fff" },
  10: { bg: "#dc2626", text: "#fff" },
  11: { bg: "#065f46", text: "#fff" },
};

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  probation:   { label: "ทดลองงาน", color: "#d97706", bg: "#fef3c7" },
  passed:      { label: "Active",   color: "#16a34a", bg: "#dcfce7" },
  transferred: { label: "ย้ายแผนก", color: "#0891b2", bg: "#cffafe" },
  resigned:    { label: "ลาออก",    color: "#64748b", bg: "#f1f5f9" },
};

function groupData(employees: MasterEmployee[]): DivisionGroup[] {
  const divMap = new Map<number, DivisionGroup>();
  const posMap = new Map<string, MasterEmployee[]>();

  for (const emp of employees) {
    const divId   = emp.division_id ?? 0;
    const divName = emp.division_name ?? "ไม่ระบุฝ่าย";
    const pos     = emp.position ?? "ไม่ระบุตำแหน่ง";
    const key     = `${divId}|${pos}`;

    if (!divMap.has(divId)) {
      divMap.set(divId, { division_id: divId, division_name: divName, positions: [], total: 0 });
    }
    if (!posMap.has(key)) {
      posMap.set(key, []);
      divMap.get(divId)!.positions.push({ position: pos, employees: posMap.get(key)! });
    }
    posMap.get(key)!.push(emp);
    divMap.get(divId)!.total++;
  }

  // Sort divisions by DIV_ORDER, positions alphabetically
  const sorted: DivisionGroup[] = [];
  for (const id of DIV_ORDER) {
    if (divMap.has(id)) {
      const g = divMap.get(id)!;
      g.positions.sort((a, b) => (a.position ?? "").localeCompare(b.position ?? "", "th"));
      sorted.push(g);
    }
  }
  // Any division not in DIV_ORDER
  for (const [id, g] of divMap) {
    if (!DIV_ORDER.includes(id)) {
      g.positions.sort((a, b) => (a.position ?? "").localeCompare(b.position ?? "", "th"));
      sorted.push(g);
    }
  }
  return sorted;
}

export default function PlanView() {
  const [rows, setRows]       = useState<MasterEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [showResigned, setShowResigned] = useState(false);
  const [filterDiv, setFilterDiv] = useState<number | 0>(0);

  useEffect(() => {
    fetch("/api/manpower/employees")
      .then(r => r.json())
      .then((d: { ok: boolean; employees: MasterEmployee[]; error?: string }) => {
        if (!d.ok) setError(d.error ?? "โหลดไม่สำเร็จ");
        else setRows(d.employees ?? []);
        setLoading(false);
      })
      .catch(() => { setError("เชื่อมต่อไม่สำเร็จ"); setLoading(false); });
  }, []);

  if (loading) return <div style={{ textAlign: "center", padding: 50, color: "#94a3b8" }}>กำลังโหลด…</div>;
  if (error)   return <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 24, color: "#dc2626" }}>{error}</div>;

  const visible  = rows.filter(e => showResigned ? true : e.emp_status !== "resigned");
  const filtered = filterDiv ? visible.filter(e => e.division_id === filterDiv) : visible;
  const grouped  = groupData(filtered);

  const th: React.CSSProperties = {
    padding: "9px 12px", textAlign: "left", fontWeight: 700,
    color: "#475569", background: "#f8fafc",
    borderBottom: "2px solid #e2e8f0", fontSize: 12, whiteSpace: "nowrap",
  };
  const td: React.CSSProperties = {
    padding: "8px 12px", fontSize: 12.5, color: "#1e293b",
    borderBottom: "1px solid #f1f5f9", verticalAlign: "middle",
  };

  // Get unique divisions for filter
  const divOptions = Array.from(new Set(rows.map(e => e.division_id))).sort()
    .map(id => ({ id, name: rows.find(e => e.division_id === id)?.division_name ?? `ฝ่าย ${id}` }));

  let rowNum = 0;

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <select value={filterDiv} onChange={e => setFilterDiv(Number(e.target.value))}
          style={{ padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e2e8f0",
            fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}>
          <option value={0}>ทุกฝ่าย</option>
          {divOptions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={showResigned} onChange={e => setShowResigned(e.target.checked)} />
          แสดงพนักงานลาออก
        </label>
        <span style={{ fontSize: 13, color: "#94a3b8", marginLeft: "auto" }}>
          {filtered.length} คน · {grouped.length} ฝ่าย
        </span>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 44, textAlign: "center" }}>ที่</th>
                <th style={{ ...th, minWidth: 200 }}>ตำแหน่ง</th>
                <th style={{ ...th, minWidth: 170 }}>ชื่อ-นามสกุล</th>
                <th style={{ ...th, minWidth: 120 }}>ประเภท</th>
                <th style={{ ...th }}>สถานะ</th>
                <th style={{ ...th, minWidth: 160 }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(div => {
                const col = DIV_COLORS[div.division_id] ?? { bg: "#64748b", text: "#fff" };
                rowNum = 0;
                return (
                  <>
                    {/* Division header */}
                    <tr key={`div-${div.division_id}`}>
                      <td colSpan={6} style={{
                        background: col.bg, color: col.text,
                        padding: "10px 16px", fontWeight: 800, fontSize: 13,
                        letterSpacing: "0.02em",
                      }}>
                        {div.division_name}
                        <span style={{ marginLeft: 12, fontWeight: 400, fontSize: 12, opacity: 0.85 }}>
                          ({div.total} คน)
                        </span>
                      </td>
                    </tr>
                    {/* Position rows */}
                    {div.positions.map(pos =>
                      pos.employees.map((emp, empIdx) => {
                        rowNum++;
                        const badge = STATUS_BADGE[emp.emp_status] ?? STATUS_BADGE.probation;
                        const isFirst = empIdx === 0;
                        const posCount = pos.employees.length;
                        return (
                          <tr key={emp.id}
                            style={{ background: rowNum % 2 === 0 ? "#fafbff" : "#fff",
                              opacity: emp.emp_status === "resigned" ? 0.6 : 1 }}>
                            {isFirst && (
                              <td rowSpan={posCount} style={{ ...td, textAlign: "center",
                                color: "#94a3b8", fontSize: 11, borderRight: "1px solid #f1f5f9",
                                background: rowNum % 2 === 0 ? "#fafbff" : "#fff" }}>
                                {rowNum}
                              </td>
                            )}
                            {isFirst && (
                              <td rowSpan={posCount} style={{ ...td, fontWeight: 600,
                                borderRight: "1px solid #f1f5f9", color: "#0a1628",
                                background: rowNum % 2 === 0 ? "#fafbff" : "#fff" }}>
                                {pos.position}
                              </td>
                            )}
                            <td style={td}>{emp.full_name}</td>
                            <td style={{ ...td, color: "#64748b", fontSize: 12 }}>{emp.emp_type ?? "—"}</td>
                            <td style={td}>
                              <span style={{ background: badge.bg, color: badge.color,
                                borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
                                {badge.label}
                              </span>
                            </td>
                            <td style={{ ...td, color: "#94a3b8", fontSize: 11 }}>{emp.remark ?? ""}</td>
                          </tr>
                        );
                      })
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
