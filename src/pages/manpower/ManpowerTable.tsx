import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { MANPOWER_ROWS, type ManpowerRow } from "../../data/manpowerPlan";

interface LiveEmp {
  id: number;
  full_name: string;
  position: string;
  division_id: number | null;
  department_id: number | null;
  emp_status: string;
  emp_type: string;
  start_date: string;
  resign_date?: string;
  remark?: string | null;
}

interface OrgDiv  { id: number; name: string; }
interface OrgDept { id: number; name: string; division_id: number; }

// Build map: position (trimmed, lower-cased) → active employees
// We intentionally do NOT use division_id here because the static
// manpowerPlan.ts divIds may not match the DB division_ids for some
// divisions (e.g. ฝ่ายการพยาบาล was not detected as a separate division
// during generation). Matching by position name alone is safe in practice
// because hospital position names are specific to their department.
function buildLiveMap(employees: LiveEmp[]): Map<string, LiveEmp[]> {
  const map = new Map<string, LiveEmp[]>();
  for (const e of employees) {
    if (e.emp_status === "resigned") continue;
    const key = (e.position ?? "").trim().toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(e);
  }
  return map;
}

interface AugRow extends ManpowerRow {
  liveEmp: string;
  liveFilled: number;
  liveVac: number;
  empStatus: string;
  liveEmpId: number | null;
  liveEmpRemark: string | null;
  liveEmpObj: LiveEmp | null;
}

function buildAugRows(rows: ManpowerRow[], liveMap: Map<string, LiveEmp[]>): AugRow[] {
  const ptrMap = new Map<string, number>();
  return rows.map(r => {
    if (r.type !== "slot") {
      return { ...r, liveEmp: "", liveFilled: 0, liveVac: 0, empStatus: "", liveEmpId: null, liveEmpRemark: null, liveEmpObj: null };
    }
    const key = r.pos.trim().toLowerCase();
    const pool = liveMap.get(key) ?? [];
    const ptr = ptrMap.get(key) ?? 0;
    ptrMap.set(key, ptr + 1);
    if (ptr < pool.length) {
      const e = pool[ptr];
      return { ...r, liveEmp: e.full_name, liveFilled: 1, liveVac: r.plan - 1, empStatus: e.emp_status, liveEmpId: e.id, liveEmpRemark: e.remark ?? null, liveEmpObj: e };
    }
    return { ...r, liveEmp: "", liveFilled: 0, liveVac: r.plan, empStatus: "", liveEmpId: null, liveEmpRemark: null, liveEmpObj: null };
  });
}

// Division names loaded from DB at runtime (see orgDivs state)
function buildDivNames(orgDivs: OrgDiv[]): Record<number, string> {
  const m: Record<number, string> = {};
  for (const d of orgDivs) m[d.id] = d.name;
  return m;
}

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

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  probation:   { label: "ทดลองงาน", color: "#d97706" },
  transferred: { label: "ย้ายแผนก", color: "#0891b2" },
  passed:      { label: "Active",   color: "#16a34a" },
};

export default function ManpowerTable() {
  const { user } = useAuth();
  const canEdit = user && ["hr", "admin", "deputyHR"].includes(user.role);

  const [q, setQ]                 = useState("");
  const [filterDiv, setFilterDiv] = useState(0);
  const [vacOnly, setVacOnly]     = useState(false);
  const [sortVac, setSortVac]     = useState(false);
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});
  const [liveEmps, setLiveEmps]   = useState<LiveEmp[]>([]);
  const [loading, setLoading]     = useState(true);
  const [liveError, setLiveError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing]   = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Edit modal state
  const [editEmp,    setEditEmp]    = useState<LiveEmp | null>(null);
  const [editName,   setEditName]   = useState("");
  const [editPos,    setEditPos]    = useState("");
  const [editDivId,  setEditDivId]  = useState<number | "">("");
  const [editDeptId, setEditDeptId] = useState<number | "">("");
  const [editRemark, setEditRemark] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError,  setEditError]  = useState("");
  const [orgDivs,    setOrgDivs]    = useState<OrgDiv[]>([]);
  const [orgDepts,   setOrgDepts]   = useState<OrgDept[]>([]);

  // Fetch org structure for edit modal
  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json()).then((d: { divisions: OrgDiv[]; departments: OrgDept[] }) => {
      setOrgDivs(d.divisions ?? []);
      setOrgDepts(d.departments ?? []);
    }).catch(() => { /* silent */ });
  }, []);

  // Populate edit form when employee selected
  useEffect(() => {
    if (editEmp) {
      setEditName(editEmp.full_name ?? "");
      setEditPos(editEmp.position ?? "");
      setEditDivId(editEmp.division_id ?? "");
      setEditDeptId(editEmp.department_id ?? "");
      setEditRemark(editEmp.remark ?? "");
      setEditError("");
    }
  }, [editEmp]);

  const fetchEmployees = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const r = await fetch("/api/manpower/employees");
      const d = await r.json() as { ok: boolean; employees: LiveEmp[] };
      if (d.ok) {
        setLiveEmps(d.employees ?? []);
        setLastUpdated(new Date());
        setLiveError("");
      } else {
        setLiveError("โหลดข้อมูลพนักงานไม่สำเร็จ");
      }
    } catch {
      setLiveError("เชื่อมต่อ API ไม่ได้");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  async function saveEdit() {
    if (!editEmp) return;
    if (!editName.trim()) { setEditError("กรุณากรอกชื่อพนักงาน"); return; }
    setEditSaving(true); setEditError("");
    try {
      const r = await fetch(`/api/manpower/employees/${editEmp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: editName.trim(),
          position: editPos.trim() || null,
          division_id: editDivId || null,
          department_id: editDeptId || null,
          remark: editRemark.trim() || null,
        }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (!d.ok) { setEditError(d.error ?? "เกิดข้อผิดพลาด"); return; }
      setEditEmp(null);
      fetchEmployees(true);
    } catch {
      setEditError("เกิดข้อผิดพลาดในการเชื่อมต่อ");
    } finally {
      setEditSaving(false);
    }
  }

  // Initial fetch + auto-refresh every 60 seconds
  // Also listens for "manpower:refresh" custom event fired by hire/resign/transfer actions
  useEffect(() => {
    fetchEmployees();
    intervalRef.current = setInterval(() => fetchEmployees(true), 60_000);
    const handler = () => fetchEmployees(true);
    window.addEventListener("manpower:refresh", handler);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("manpower:refresh", handler);
    };
  }, [fetchEmployees]);

  const divNames = useMemo(() => buildDivNames(orgDivs), [orgDivs]);
  const liveMap  = useMemo(() => buildLiveMap(liveEmps), [liveEmps]);
  const augRows  = useMemo(() => buildAugRows(MANPOWER_ROWS, liveMap), [liveMap]);

  // Summary from live data
  const summary = useMemo(() => {
    let totalPlan = 0, totalFilled = 0;
    const deptSet = new Set<number>();
    for (const r of augRows) {
      if (r.type === "slot") { totalPlan += r.plan; totalFilled += r.liveFilled; }
      if (r.type === "division") deptSet.add(r.divId);
    }
    return { totalPlan, totalFilled, totalVac: totalPlan - totalFilled, totalDepts: deptSet.size };
  }, [augRows]);

  function toggleDiv(divId: number) {
    setCollapsed(prev => ({ ...prev, [divId]: !prev[divId] }));
  }

  const filtered = useMemo(() => {
    const ql = q.toLowerCase();
    return augRows.filter(r => {
      if (filterDiv && r.divId !== filterDiv) return false;
      if (vacOnly && r.type === "slot" && r.liveVac <= 0) return false;
      if (ql && r.type === "slot") {
        return r.pos.toLowerCase().includes(ql) || r.liveEmp.toLowerCase().includes(ql);
      }
      return true;
    });
  }, [augRows, q, filterDiv, vacOnly]);

  const display = useMemo(() => {
    if (!sortVac) return filtered;
    return [...filtered].sort((a, b) => {
      if (a.type !== "slot" || b.type !== "slot") return 0;
      return b.liveVac - a.liveVac;
    });
  }, [filtered, sortVac]);

  const th: React.CSSProperties = {
    padding: "10px 12px", textAlign: "left", fontWeight: 700,
    color: "#475569", fontSize: 12, whiteSpace: "nowrap",
    position: "sticky" as const, top: 0, background: "#f8fafc",
    borderBottom: "2px solid #e2e8f0", zIndex: 1,
  };
  const td: React.CSSProperties = { padding: "8px 12px", fontSize: 12.5, color: "#1e293b" };

  const divIds = Array.from(new Set(MANPOWER_ROWS.filter(r => r.type === "division").map(r => r.divId))).sort();

  let lastDivId = 0;
  const visibleRows: (AugRow & { _hidden?: boolean })[] = [];
  for (const r of display) {
    if (r.type === "division") lastDivId = r.divId;
    const isHidden = lastDivId > 0 && collapsed[lastDivId] && r.type !== "division";
    visibleRows.push({ ...r, _hidden: isHidden });
  }

  const fillPct = Math.round((summary.totalFilled / Math.max(1, summary.totalPlan)) * 100);
  const allDivIds = Array.from(new Set(MANPOWER_ROWS.filter(r => r.type === "division").map(r => r.divId)));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Live data notice */}
      {liveError && (
        <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10,
          padding: "10px 16px", fontSize: 12.5, color: "#92400e" }}>
          {liveError} — แสดงข้อมูลจาก Excel แทน
        </div>
      )}
      {!loading && !liveError && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10,
          padding: "9px 16px", fontSize: 12.5, color: "#166534", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 14, color: refreshing ? "#d97706" : "#16a34a" }}>●</span>
          ข้อมูล Real-time จากฐานข้อมูล — {liveEmps.filter(e => e.emp_status !== "resigned").length} คน
          {" · "}อัปเดตอัตโนมัติทุก 60 วินาที
          {refreshing && <span style={{ color: "#d97706", marginLeft: 4 }}>กำลังซิงค์…</span>}
        </div>
      )}

      {/* Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Card label="อัตรากำลังทั้งหมด" value={summary.totalPlan}   color="#0038C6" sub="ที่ตั้งไว้" />
        <Card label="รับแล้ว"           value={summary.totalFilled} color="#16a34a" sub="บรรจุแล้ว (real-time)" />
        <Card label="คงเหลือ"           value={summary.totalVac}    color="#dc2626" sub="ตำแหน่งว่าง" />
        <Card label="จำนวนฝ่าย"         value={summary.totalDepts}  color="#7c3aed" sub="ทั้งหมด" />
        <Card label="% บรรจุ"           value={`${fillPct}%`}       color="#0891b2"
          sub={`${summary.totalFilled}/${summary.totalPlan}`} />
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
          {divIds.map(id => <option key={id} value={id}>{divNames[id] ?? `ฝ่าย ${id}`}</option>)}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={vacOnly} onChange={e => setVacOnly(e.target.checked)} />
          เฉพาะตำแหน่งว่าง
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", cursor: "pointer" }}>
          <input type="checkbox" checked={sortVac} onChange={e => setSortVac(e.target.checked)} />
          เรียงตาม vacancy มาก→น้อย
        </label>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {lastUpdated && (
            <span style={{ fontSize: 11, color: "#94a3b8" }}>
              อัปเดต {lastUpdated.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </span>
          )}
          <button onClick={() => fetchEmployees(true)} disabled={refreshing}
            style={{ padding: "7px 14px", borderRadius: 9, border: "1.5px solid #c4cfee",
              background: refreshing ? "#f0f5ff" : "#fff", fontSize: 12,
              cursor: refreshing ? "default" : "pointer", fontFamily: "inherit",
              color: "#0038C6", fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ display: "inline-block", animation: refreshing ? "spin 1s linear infinite" : "none" }}>↻</span>
            {refreshing ? "กำลังอัปเดต…" : "รีเฟรช"}
          </button>
          <button onClick={() => {
            const all = Object.fromEntries(allDivIds.map(id => [id, true]));
            setCollapsed(prev => Object.values(prev).every(Boolean) ? {} : all);
          }} style={{ padding: "7px 14px", borderRadius: 9,
            border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 12,
            cursor: "pointer", fontFamily: "inherit", color: "#64748b" }}>
            {Object.values(collapsed).every(Boolean) ? "ขยายทั้งหมด" : "ยุบทั้งหมด"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", fontSize: 13 }}>
            กำลังโหลดข้อมูลพนักงาน…
          </div>
        )}
        {!loading && (
          <div style={{ overflowX: "auto", maxHeight: "70vh", overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 36, textAlign: "center" }}>#</th>
                  <th style={{ ...th, minWidth: 240 }}>ตำแหน่ง</th>
                  <th style={{ ...th, textAlign: "center", width: 80 }}>อัตราที่ตั้งไว้</th>
                  <th style={{ ...th, textAlign: "center", width: 70 }}>รับแล้ว</th>
                  <th style={{ ...th, textAlign: "center", width: 70 }}>คงเหลือ</th>
                  <th style={{ ...th, minWidth: 180 }}>ชื่อ-นามสกุล</th>
                  <th style={{ ...th, minWidth: 120 }}>หมายเหตุ</th>
                  {canEdit && <th style={{ ...th, width: 50 }}></th>}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let slotNum = 0;
                  return visibleRows.map((r, i) => {
                    if (r._hidden) return null;

                    const colSpan = canEdit ? 8 : 7;

                    if (r.type === "division") {
                      const isCollapsed = collapsed[r.divId];
                      return (
                        <tr key={i} onClick={() => toggleDiv(r.divId)}
                          style={{ cursor: "pointer", userSelect: "none" }}>
                          <td colSpan={colSpan} style={{ background: "#FFFF00", padding: "9px 14px",
                            fontWeight: 800, fontSize: 13, color: "#1a1a00",
                            borderBottom: "1px solid #e5e000" }}>
                            <span style={{ marginRight: 8, fontSize: 10 }}>{isCollapsed ? "▶" : "▼"}</span>
                            {r.name}
                          </td>
                        </tr>
                      );
                    }

                    if (r.type === "subdept") {
                      return (
                        <tr key={i}>
                          <td colSpan={colSpan} style={{ background: "#fffde7", padding: "7px 22px",
                            fontWeight: 700, fontSize: 12.5, color: "#78690a",
                            borderBottom: "1px solid #f0e000" }}>
                            {r.name}
                          </td>
                        </tr>
                      );
                    }

                    if (r.type === "section") {
                      return (
                        <tr key={i}>
                          <td colSpan={colSpan} style={{ background: "#f0f4ff", padding: "6px 30px",
                            fontWeight: 600, fontSize: 12, color: "#3b4a8f",
                            borderBottom: "1px solid #dce4f5" }}>
                            {r.name}
                          </td>
                        </tr>
                      );
                    }

                    // slot row
                    slotNum++;
                    const vacColor = r.liveVac > 0 ? "#dc2626" : r.liveVac < 0 ? "#0891b2" : "#16a34a";
                    const badge = r.empStatus ? STATUS_BADGE[r.empStatus] : null;
                    return (
                      <tr key={i} style={{ background: slotNum % 2 === 0 ? "#fafbff" : "#fff",
                        borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ ...td, textAlign: "center", color: "#94a3b8", fontSize: 11 }}>{slotNum}</td>
                        <td style={{ ...td, fontWeight: r.pos ? 500 : 400 }}>
                          {r.pos || <span style={{ color: "#cbd5e1" }}>—</span>}
                        </td>
                        <td style={{ ...td, textAlign: "center" }}>{r.plan || "—"}</td>
                        <td style={{ ...td, textAlign: "center", color: "#16a34a", fontWeight: 600 }}>
                          {r.liveFilled || "—"}
                        </td>
                        <td style={{ ...td, textAlign: "center", fontWeight: 700, color: vacColor }}>
                          {r.liveVac > 0 ? `−${r.liveVac}` : r.liveVac < 0 ? `+${Math.abs(r.liveVac)}` : "0"}
                        </td>
                        <td style={{ ...td }}>
                          {r.liveEmp ? (
                            <span>
                              {r.liveEmp}
                              {badge && (
                                <span style={{ marginLeft: 6, fontSize: 10, color: badge.color,
                                  background: `${badge.color}18`, borderRadius: 10,
                                  padding: "1px 7px", fontWeight: 700 }}>
                                  {badge.label}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span style={{ color: "#f87171", fontSize: 12 }}>ว่าง</span>
                          )}
                        </td>
                        <td style={{ ...td, color: "#94a3b8", fontSize: 11.5 }}>
                          {r.liveEmpRemark || r.note || ""}
                        </td>
                        {canEdit && (
                          <td style={{ ...td, textAlign: "center", padding: "4px 8px" }}>
                            {r.liveEmpObj && (
                              <button
                                onClick={() => setEditEmp(r.liveEmpObj)}
                                title="แก้ไขข้อมูล"
                                style={{ background: "none", border: "1px solid #c4cfee", borderRadius: 6,
                                  padding: "3px 8px", cursor: "pointer", fontSize: 12, color: "#0038C6" }}>
                                ✏️
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Employee Modal */}
      {editEmp && (
        <div onClick={e => { if (e.target === e.currentTarget) setEditEmp(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.55)",
            display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 460,
            boxShadow: "0 24px 60px rgba(0,56,198,0.22)", border: "1px solid #c4cfee",
            borderTop: "4px solid #0038C6", padding: "28px 30px" }}>

            <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1628", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 4, height: 18, borderRadius: 2, background: "#0038C6" }} />
              แก้ไขข้อมูลพนักงาน
            </div>

            {/* Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                ชื่อ-นามสกุล *
              </label>
              <input value={editName} onChange={e => setEditName(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7,
                  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" as const }} />
            </div>

            {/* Position */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                ตำแหน่ง
              </label>
              <input value={editPos} onChange={e => setEditPos(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7,
                  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" as const }} />
            </div>

            {/* Division */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                ฝ่าย
              </label>
              <select value={editDivId}
                onChange={e => { setEditDivId(e.target.value ? Number(e.target.value) : ""); setEditDeptId(""); }}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7,
                  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
                  outline: "none", background: "#fff", boxSizing: "border-box" as const }}>
                <option value="">-- เลือกฝ่าย --</option>
                {orgDivs.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            {/* Department */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                แผนก
              </label>
              <select value={editDeptId}
                onChange={e => setEditDeptId(e.target.value ? Number(e.target.value) : "")}
                disabled={!editDivId}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7,
                  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
                  outline: "none", background: "#fff", boxSizing: "border-box" as const }}>
                <option value="">{editDivId ? "-- เลือกแผนก (ไม่บังคับ) --" : "-- เลือกฝ่ายก่อน --"}</option>
                {orgDepts.filter(d => d.division_id === Number(editDivId)).map(d =>
                  <option key={d.id} value={d.id}>{d.name}</option>
                )}
              </select>
            </div>

            {/* Remark */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#475569",
                letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                หมายเหตุ
              </label>
              <input value={editRemark} onChange={e => setEditRemark(e.target.value)}
                placeholder="เช่น แจ้งเข้า สพ.6, ลาคลอด, รออัตรา..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 7,
                  border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
                  outline: "none", boxSizing: "border-box" as const }} />
            </div>

            {editError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 7,
                padding: "9px 12px", fontSize: 13, color: "#dc2626", marginBottom: 14 }}>
                {editError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditEmp(null)} disabled={editSaving}
                style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "1.5px solid #c4cfee",
                  background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ยกเลิก
              </button>
              <button onClick={saveEdit} disabled={editSaving}
                style={{ flex: 2, padding: "11px 0", borderRadius: 7, border: "none",
                  background: editSaving ? "#94a3b8" : "#0038C6", color: "#fff",
                  fontWeight: 700, cursor: editSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit", fontSize: 13 }}>
                {editSaving ? "กำลังบันทึก…" : "บันทึก"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
