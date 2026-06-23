import { useMemo, useState } from "react";
import { MANPOWER_ROWS, type ManpowerRow } from "../../data/manpowerPlan";

// ─── Summary computation ───────────────────────────────────────────────────
function computeSummary(rows: ManpowerRow[]) {
  let totalPlan = 0, totalFilled = 0, totalVac = 0;
  const deptSet = new Set<number>();
  for (const r of rows) {
    if (r.type === "slot") {
      totalPlan   += r.plan;
      totalFilled += r.filled;
      totalVac    += r.vac;
    }
    if (r.type === "division") deptSet.add(r.divId);
  }
  return { totalPlan, totalFilled, totalVac, totalDepts: deptSet.size };
}

const DIV_NAMES: Record<number, string> = {
  1: "ฝ่ายการแพทย์", 2: "ฝ่ายเทคนิคบริการ", 3: "ฝ่ายบริหารค่าตอบแทน",
  4: "ฝ่ายการเงิน", 5: "ฝ่ายบัญชี", 6: "ฝ่ายสนับสนุน",
  7: "ฝ่ายพัฒนาองค์กร", 8: "ฝ่ายการพยาบาลส่วนใน", 9: "ฝ่ายการพยาบาลส่วนหน้า",
  10: "สำนักงานผู้อำนวยการ", 11: "ศูนย์มะเร็ง",
};

// ─── Card ──────────────────────────────────────────────────────────────────
function Card({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px",
      boxShadow: "0 1px 6px rgba(0,0,0,.07)", borderTop: `3px solid ${color}`, minWidth: 150 }}>
      <div style={{ fontSize: 11.5, color: "#64748b", fontWeight: 700, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function ManpowerTable() {
  const [q, setQ]               = useState("");
  const [filterDiv, setFilterDiv] = useState(0);
  const [vacOnly, setVacOnly]   = useState(false);
  const [sortVac, setSortVac]   = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  const summary = useMemo(() => computeSummary(MANPOWER_ROWS), []);

  // Toggle one division
  function toggleDiv(divId: number) {
    setCollapsed(prev => ({ ...prev, [divId]: !prev[divId] }));
  }

  // Filter rows
  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return MANPOWER_ROWS.filter(r => {
      if (filterDiv && r.divId !== filterDiv) return false;
      if (vacOnly && r.type === "slot" && r.vac <= 0) return false;
      if (ql && r.type === "slot") {
        return r.pos.toLowerCase().includes(ql) || r.emp.toLowerCase().includes(ql);
      }
      return true;
    });
  }, [q, filterDiv, vacOnly]);

  // If sorting by vacancy: collect slots, sort, then re-insert back keeping structure
  const display = useMemo(() => {
    if (!sortVac) return filtered;
    // Sort only slot rows by vac desc; keep headers in place
    return [...filtered].sort((a, b) => {
      if (a.type !== "slot" || b.type !== "slot") return 0;
      return b.vac - a.vac;
    });
  }, [filtered, sortVac]);

  const th: React.CSSProperties = {
    padding: "10px 12px", textAlign: "left", fontWeight: 700,
    color: "#475569", fontSize: 12, whiteSpace: "nowrap",
    position: "sticky" as const, top: 0, background: "#f8fafc",
    borderBottom: "2px solid #e2e8f0", zIndex: 1,
  };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 12.5, color: "#1e293b" };

  // Unique divIds for filter
  const divIds = Array.from(new Set(MANPOWER_ROWS.filter(r => r.type === "division").map(r => r.divId))).sort();

  // Track current division for collapse logic
  let lastDivId = 0;
  const visibleRows: (ManpowerRow & { _hidden?: boolean })[] = [];
  for (const r of display) {
    if (r.type === "division") { lastDivId = r.divId; }
    const isHidden = lastDivId > 0 && collapsed[lastDivId] && r.type !== "division";
    visibleRows.push({ ...r, _hidden: isHidden });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Card label="อัตรากำลังทั้งหมด" value={summary.totalPlan}   color="#0038C6" sub="ที่ตั้งไว้" />
        <Card label="รับแล้ว"           value={summary.totalFilled} color="#16a34a" sub="ณ มิถุนายน 2569" />
        <Card label="คงเหลือ"           value={summary.totalVac}    color="#dc2626" sub="ตำแหน่งว่าง" />
        <Card label="จำนวนฝ่าย"         value={summary.totalDepts}  color="#7c3aed" sub="ทั้งหมด" />
        <Card label="% บรรจุ"
          value={`${Math.round((summary.totalFilled / Math.max(1, summary.totalPlan)) * 100)}%`}
          color="#0891b2" sub={`${summary.totalFilled}/${summary.totalPlan}`} />
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center",
        background: "#fff", borderRadius: 12, padding: "12px 16px",
        boxShadow: "0 1px 4px rgba(0,0,0,.06)" }}>
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="🔍 ค้นหาตำแหน่ง / ชื่อพนักงาน…"
          style={{ padding: "8px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0",
            fontSize: 13, fontFamily: "inherit", width: 260, outline: "none" }} />
        <select value={filterDiv} onChange={e => setFilterDiv(Number(e.target.value))}
          style={{ padding: "8px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0",
            fontSize: 13, fontFamily: "inherit", background: "#fff", cursor: "pointer" }}>
          <option value={0}>ทุกฝ่าย</option>
          {divIds.map(id => <option key={id} value={id}>{DIV_NAMES[id] ?? `ฝ่าย ${id}`}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={vacOnly} onChange={e => setVacOnly(e.target.checked)} />
          เฉพาะตำแหน่งว่าง
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={sortVac} onChange={e => setSortVac(e.target.checked)} />
          เรียงตาม vacancy มาก→น้อย
        </label>
        <button onClick={() => {
          const allDivIds = Array.from(new Set(MANPOWER_ROWS.filter(r=>r.type==="division").map(r=>r.divId)));
          const allCollapsed = Object.fromEntries(allDivIds.map(id => [id, true]));
          setCollapsed(prev => Object.values(prev).every(Boolean) ? {} : allCollapsed);
        }} style={{ marginLeft: "auto", padding: "7px 14px", borderRadius: 9, border: "1.5px solid #e2e8f0",
          background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", color: "#64748b" }}>
          {Object.values(collapsed).every(Boolean) ? "ขยายทั้งหมด" : "ยุบทั้งหมด"}
        </button>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
            <thead>
              <tr>
                <th style={{ ...th, width: 36, textAlign: "center" }}>#</th>
                <th style={{ ...th, minWidth: 240 }}>ตำแหน่ง</th>
                <th style={{ ...th, textAlign: "center", width: 80 }}>อัตราที่ตั้งไว้</th>
                <th style={{ ...th, textAlign: "center", width: 70 }}>รับแล้ว</th>
                <th style={{ ...th, textAlign: "center", width: 70 }}>คงเหลือ</th>
                <th style={{ ...th, minWidth: 170 }}>ชื่อ-นามสกุล</th>
                <th style={{ ...th, minWidth: 160 }}>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                let slotNum = 0;
                return visibleRows.map((r, i) => {
                  if (r._hidden) return null;

                  if (r.type === "division") {
                    const isCollapsed = collapsed[r.divId];
                    return (
                      <tr key={i} onClick={() => toggleDiv(r.divId)}
                        style={{ cursor: "pointer", userSelect: "none" }}>
                        <td colSpan={7} style={{
                          background: "#FFFF00", padding: "9px 14px",
                          fontWeight: 800, fontSize: 13, color: "#1a1a00",
                          borderBottom: "1px solid #e5e000",
                        }}>
                          <span style={{ marginRight: 8, fontSize: 10 }}>{isCollapsed ? "▶" : "▼"}</span>
                          {r.name}
                        </td>
                      </tr>
                    );
                  }

                  if (r.type === "subdept") {
                    return (
                      <tr key={i}>
                        <td colSpan={7} style={{
                          background: "#fffde7", padding: "7px 22px",
                          fontWeight: 700, fontSize: 12.5, color: "#78690a",
                          borderBottom: "1px solid #f0e000",
                        }}>
                          {r.name}
                        </td>
                      </tr>
                    );
                  }

                  if (r.type === "section") {
                    return (
                      <tr key={i}>
                        <td colSpan={7} style={{
                          background: "#f0f4ff", padding: "6px 30px",
                          fontWeight: 600, fontSize: 12, color: "#3b4a8f",
                          borderBottom: "1px solid #dce4f5",
                        }}>
                          {r.name}
                        </td>
                      </tr>
                    );
                  }

                  // slot
                  slotNum++;
                  const vacColor = r.vac > 0 ? "#dc2626" : r.vac < 0 ? "#0891b2" : "#16a34a";
                  return (
                    <tr key={i} style={{ background: slotNum % 2 === 0 ? "#fafbff" : "#fff",
                      borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ ...td, textAlign: "center", color: "#94a3b8", fontSize: 11 }}>{slotNum}</td>
                      <td style={{ ...td, fontWeight: r.pos ? 500 : 400, color: r.pos ? "#0a1628" : "#94a3b8" }}>
                        {r.pos || <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      <td style={{ ...td, textAlign: "center" }}>{r.plan || "—"}</td>
                      <td style={{ ...td, textAlign: "center", color: "#16a34a", fontWeight: 600 }}>
                        {r.filled || "—"}
                      </td>
                      <td style={{ ...td, textAlign: "center", fontWeight: 700, color: vacColor }}>
                        {r.vac > 0 ? `−${r.vac}` : r.vac < 0 ? `+${Math.abs(r.vac)}` : "0"}
                      </td>
                      <td style={{ ...td }}>{r.emp || <span style={{ color: "#cbd5e1" }}>ว่าง</span>}</td>
                      <td style={{ ...td, color: "#94a3b8", fontSize: 11.5 }}>{r.note || ""}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
