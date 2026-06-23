import { useEffect, useMemo, useState } from "react";

interface Employee {
  id: number; emp_code: string | null; full_name: string; name_en: string | null;
  position: string | null; division_name: string | null; department_name: string | null;
  license_number: string | null; emp_status: string;
}

const STATUS_LABEL: Record<string, string> = {
  probation: "ทดลองงาน", passed: "ประจำ", transferred: "ย้ายแผนก", resigned: "ลาออก",
};

function csvEsc(v: string | null | undefined) {
  const s = v ?? "";
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function CardExportTab() {
  const [employees, setEmps]   = useState<Employee[]>([]);
  const [loading, setLoading]  = useState(true);
  const [selected, setSelected]= useState<Set<number>>(new Set());
  const [q, setQ]              = useState("");
  const [divFilter, setDiv]    = useState("");

  useEffect(() => {
    fetch("/api/manpower/employees")
      .then(r => r.json())
      .then((d: { ok: boolean; employees: Employee[] }) => {
        const active = (d.employees ?? []).filter(e => e.emp_status !== "resigned");
        setEmps(active);
        setLoading(false);
      });
  }, []);

  const divisions = useMemo(() => {
    const set = new Set(employees.map(e => e.division_name ?? "").filter(Boolean));
    return [...set].sort();
  }, [employees]);

  const filtered = useMemo(() => {
    const qLow = q.toLowerCase();
    return employees.filter(e => {
      const matchDiv = !divFilter || e.division_name === divFilter;
      const matchQ   = !q || [e.full_name, e.name_en, e.position, e.emp_code]
        .some(v => v?.toLowerCase().includes(qLow));
      return matchDiv && matchQ;
    });
  }, [employees, q, divFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(e => selected.has(e.id));

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(e => next.delete(e.id));
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        filtered.forEach(e => next.add(e.id));
        return next;
      });
    }
  }

  function clearAll() { setSelected(new Set()); }

  function exportCSV() {
    const rows = employees.filter(e => selected.has(e.id));
    const header = "employee_code,name_th,name_en,position,division,department,license_number";
    const lines  = rows.map(r =>
      [r.emp_code, r.full_name, r.name_en, r.position,
       r.division_name, r.department_name, r.license_number].map(csvEsc).join(",")
    );
    const csv  = "﻿" + [header, ...lines].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "employees_canva.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const inp: React.CSSProperties = {
    padding: "9px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
    fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" as const,
  };

  if (loading) return (
    <div style={{ textAlign: "center", padding: 48, color: "#94a3b8" }}>กำลังโหลดรายชื่อพนักงาน…</div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header + Export */}
      <div style={{ background: "#fff", borderRadius: 14, padding: "18px 22px",
        boxShadow: "0 1px 6px rgba(0,0,0,.06)", borderTop: "4px solid #0038c6",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628", marginBottom: 2 }}>
            🎴 เลือกพนักงานเพื่อทำบัตร Canva
          </div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            เลือกได้ทีละคน หรือเลือกทั้งฝ่าย · Export CSV ไปใช้กับ Canva Bulk Create
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {selected.size > 0 && (
            <button onClick={clearAll}
              style={{ ...inp, background: "#f8faff", cursor: "pointer", color: "#64748b", width: "auto" }}>
              ล้างการเลือก
            </button>
          )}
          <button onClick={exportCSV} disabled={selected.size === 0}
            style={{ padding: "10px 20px", borderRadius: 8, border: "none",
              background: selected.size === 0 ? "#c4cfee" : "#0038c6",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: selected.size === 0 ? "not-allowed" : "pointer",
              fontFamily: "inherit", display: "flex", alignItems: "center", gap: 8 }}>
            ⬇️ Export CSV
            {selected.size > 0 && (
              <span style={{ background: "rgba(255,255,255,0.25)", borderRadius: 12,
                padding: "1px 8px", fontSize: 12 }}>{selected.size} คน</span>
            )}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 12, padding: "14px 18px",
        boxShadow: "0 1px 4px rgba(0,0,0,.05)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)" }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหาชื่อ, ตำแหน่ง, รหัส…"
            style={{ ...inp, paddingLeft: 30, width: "100%" }} />
        </div>
        <select value={divFilter} onChange={e => setDiv(e.target.value)}
          style={{ ...inp, width: "auto", minWidth: 160 }}>
          <option value="">ทุกฝ่าย</option>
          {divisions.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <button onClick={toggleAll}
          style={{ ...inp, background: allFilteredSelected ? "#eef3ff" : "#f8faff",
            color: allFilteredSelected ? "#0038c6" : "#475569",
            cursor: "pointer", width: "auto", fontWeight: allFilteredSelected ? 700 : 400 }}>
          {allFilteredSelected ? "✓ ยกเลิกทั้งหมด" : "เลือกทั้งหมด"}
          {filtered.length > 0 && (
            <span style={{ marginLeft: 6, fontSize: 11, color: "#94a3b8" }}>({filtered.length})</span>
          )}
        </button>
      </div>

      {/* Employee list */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 1px 4px rgba(0,0,0,.05)", overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#94a3b8", fontSize: 13 }}>ไม่พบพนักงานที่ตรงกับคำค้นหา</div>
        ) : (
          <div style={{ maxHeight: 520, overflowY: "auto" }}>
            {filtered.map((e, i) => {
              const isSelected = selected.has(e.id);
              const missingEn = !e.name_en;
              return (
                <div key={e.id} onClick={() => toggleOne(e.id)}
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 18px",
                    cursor: "pointer", borderBottom: "1px solid #f1f5f9",
                    background: isSelected ? "#eef7ff" : i % 2 === 0 ? "#fafbff" : "#fff",
                    transition: "background .1s" }}>

                  {/* Checkbox */}
                  <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                    border: `2px solid ${isSelected ? "#0038c6" : "#c4cfee"}`,
                    background: isSelected ? "#0038c6" : "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isSelected && (
                      <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                        <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>

                  {/* Avatar */}
                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: "#e0edff", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "#0038c6" }}>
                    {e.full_name.charAt(0)}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "#0a1628", marginBottom: 1 }}>
                      {e.full_name}
                      {e.emp_code && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "#0038c6", fontWeight: 700,
                          background: "#eef3ff", padding: "1px 7px", borderRadius: 4 }}>
                          {e.emp_code}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {e.position || "—"} · {e.division_name || "—"}
                    </div>
                  </div>

                  {/* English name status */}
                  <div style={{ flexShrink: 0, textAlign: "right" }}>
                    {missingEn ? (
                      <span style={{ fontSize: 11, color: "#b45309", background: "#fefce8",
                        border: "1px solid #fde68a", padding: "2px 8px", borderRadius: 5 }}>
                        ⚠️ ไม่มีชื่ออังกฤษ
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: "#16a34a", background: "#f0fdf4",
                        border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 5 }}>
                        {e.name_en}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Missing name_en warning */}
      {selected.size > 0 && (
        (() => {
          const missing = employees.filter(e => selected.has(e.id) && !e.name_en);
          if (missing.length === 0) return null;
          return (
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10,
              padding: "12px 16px", fontSize: 12, color: "#92400e" }}>
              ⚠️ พนักงาน <b>{missing.length} คน</b> ที่เลือกยังไม่มีชื่อภาษาอังกฤษ —
              {" "}ช่อง name_en ใน CSV จะว่าง กรุณาแก้ไขในหน้า Master List ก่อน export
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {missing.map(e => (
                  <span key={e.id} style={{ background: "#fde68a", padding: "1px 8px",
                    borderRadius: 4, fontSize: 11, color: "#78350f" }}>
                    {e.full_name}
                  </span>
                ))}
              </div>
            </div>
          );
        })()
      )}

      {/* Canva link */}
      <div style={{ background: "#eef3ff", borderRadius: 10, padding: "12px 16px",
        fontSize: 12, color: "#3730a3", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>🎨</span>
        <span>
          Design ที่ใช้อยู่: <b>Copy of บัตรพนักงาน รพ.</b> ·{" "}
          <a href="https://www.canva.com/d/_2F1nAWLvZCBpef" target="_blank" rel="noreferrer"
            style={{ color: "#0038c6", fontWeight: 700 }}>เปิดใน Canva →</a>
          {" "}แล้วใช้ <b>Bulk Create</b> import CSV ที่ export
        </span>
      </div>

    </div>
  );
}
