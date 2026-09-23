import { Fragment, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useAuth, hasRole } from "../../context/AuthContext";
import {
  type OtCategory, type OtMonthlyEntry, type OtFactor, type OtSignoff,
  groupCategories, formatYearMonthShort, formatYearMonthLong, monthsOfFiscalYear,
  fmtNum, monthTotal, diffLabel, entryFor,
} from "./otBudgetApi";

const NAVY = "#1F3864";
const NAVY_2 = "#2F5597";
const BUDGET_BG = "#D9E2F3";

export default function ReportTab({ year, onYearChange }: {
  year: string; onYearChange: (y: string) => void;
}) {
  const { user } = useAuth();
  const [categories, setCategories] = useState<OtCategory[]>([]);
  const [entries, setEntries] = useState<OtMonthlyEntry[]>([]);
  const [factors, setFactors] = useState<OtFactor[]>([]);
  const [signoff, setSignoff] = useState<OtSignoff | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyStep, setBusyStep] = useState<string | null>(null);

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/ot-budget/categories").then(r => r.json()),
      fetch(`/api/ot-budget/monthly?year=${year}`).then(r => r.json()),
      fetch(`/api/ot-budget/factors?year=${year}`).then(r => r.json()),
      fetch(`/api/ot-budget/signoff?year=${year}`).then(r => r.json()),
    ]).then(([c, m, f, s]: [
      { ok: boolean; categories: OtCategory[] },
      { ok: boolean; entries: OtMonthlyEntry[] },
      { ok: boolean; factors: OtFactor[] },
      { ok: boolean; signoff: OtSignoff },
    ]) => {
      if (c.ok) setCategories(c.categories);
      if (m.ok) setEntries(m.entries);
      if (f.ok) setFactors(f.factors);
      if (s.ok) setSignoff(s.signoff);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => groupCategories(categories), [categories]);
  const months = useMemo(() => monthsOfFiscalYear(year), [year]);

  const yearTotals = useMemo(() => {
    let budget = 0, actual = 0;
    for (const m of months) { const t = monthTotal(entries, m); budget += t.budget; actual += t.actual; }
    return { budget, actual };
  }, [entries, months]);
  const monthsOverBudget = useMemo(() =>
    months.filter(m => { const t = monthTotal(entries, m); return t.actual > t.budget; }).length,
  [entries, months]);
  const pctUsed = yearTotals.budget > 0 ? (yearTotals.actual / yearTotals.budget) * 100 : 0;

  const factorsByMonth = useMemo(() => {
    const map = new Map<string, OtFactor[]>();
    for (const f of factors) {
      if (!map.has(f.year_month)) map.set(f.year_month, []);
      map.get(f.year_month)!.push(f);
    }
    return map;
  }, [factors]);

  async function setSignoffStep(step: "preparer" | "reviewer" | "approver", status: "done" | "pending") {
    setBusyStep(step);
    await fetch("/api/ot-budget/signoff", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fiscal_year: year, step, status }),
    });
    setBusyStep(null);
    load();
  }

  function exportExcel() {
    const aoa: (string | number)[][] = [];
    aoa.push([`ประมาณการ OT และจ่ายจริง ปี ${year}`]);
    aoa.push([]);
    const headerRow1: (string | number)[] = ["เดือน"];
    const headerRow2: (string | number)[] = [""];
    for (const g of groups) {
      headerRow1.push(g.group_name, ...Array(g.categories.length - 1).fill(""));
      headerRow2.push(...g.categories.map(c => c.name));
    }
    headerRow1.push("Total", "หมายเหตุ");
    headerRow2.push("", "");
    aoa.push(headerRow1, headerRow2);

    for (const m of months) {
      const t = monthTotal(entries, m);
      const { diff, label } = diffLabel(t.budget, t.actual);
      const budgetRow: (string | number)[] = [`${formatYearMonthShort(m)} (Budget)`];
      const actualRow: (string | number)[] = [`${formatYearMonthShort(m)} (Actual)`];
      for (const g of groups) for (const c of g.categories) {
        const e = entryFor(entries, m, c.id);
        budgetRow.push(e?.budget_amount ?? 0);
        actualRow.push(e?.actual_amount ?? 0);
      }
      budgetRow.push(t.budget, "");
      actualRow.push(t.actual, label ? `${label} ${diff}` : "");
      aoa.push(budgetRow, actualRow);
    }

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, year);
    XLSX.writeFile(wb, `ประมาณการ_OT_ปี_${year}.xlsx`);
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด…</div>;

  return (
    <div id="ot-report" style={{ fontFamily: "'Sarabun', sans-serif" }}>
      <style>{`
        .ot-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .ot-table { border-collapse: collapse; font-size: 12px; min-width: 1100px; }
        .ot-table th, .ot-table td { border: 1px solid #C9D3E8; padding: 4px 7px; text-align: center; white-space: nowrap; }
        .ot-table thead th { background: ${NAVY}; color: #fff; font-weight: 700; position: sticky; top: 0; z-index: 2; }
        .ot-table td.ot-month-cell, .ot-table th.ot-month-th { position: sticky; left: 0; z-index: 1; text-align: left; background: #fff; }
        .ot-table thead th.ot-month-th { z-index: 3; background: ${NAVY}; }

        /* Print: everything (table + legend + factors + signoff) must fit one A4 landscape page,
           matching the original Excel ปะหน้า sheet's print area — so this drops decorative
           chrome (card borders/shadows, the on-screen-only stat tiles) and shrinks hard. */
        @media print {
          .print-hide { display: none !important; }
          body { margin: 0; background: #fff; }
          @page { size: A4 landscape; margin: 6mm; }
          #ot-report { font-size: 7pt; }
          #ot-report h2 { font-size: 12pt; margin: 0 0 6px; }
          .ot-report-card { border: none !important; box-shadow: none !important; padding: 0 !important; border-radius: 0 !important; }
          .ot-stats-row { display: none !important; }
          .ot-table-wrap { overflow: visible !important; }
          .ot-table { width: 100%; min-width: 0; table-layout: fixed; font-size: 6.3pt; }
          .ot-table th, .ot-table td { padding: 1px 2px !important; white-space: normal; word-break: break-word; }
          .ot-table th.ot-month-th, .ot-table td.ot-month-cell { position: static !important; width: 42px; }
          .ot-table thead th { position: static !important; }
          .ot-legend { font-size: 6.3pt !important; gap: 8px !important; margin-top: 4px !important; }
          .ot-swatch { width: 8px !important; height: 8px !important; }
          .ot-factors-card { border: none !important; box-shadow: none !important; padding: 4px 0 0 !important;
            border-top: 1px solid #C9D3E8 !important; border-radius: 0 !important; margin-top: 6px !important; }
          .ot-factors-card > div:first-child { font-size: 7pt !important; margin-bottom: 4px !important; }
          .ot-factors-card ul { font-size: 6.3pt !important; }
          .ot-signoff-row { margin-top: 14px !important; gap: 10px !important; }
          .ot-signoff-row * { font-size: 7pt !important; }
        }
      `}</style>

      {/* Controls */}
      <div className="print-hide" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
          ปีงบ:
          <input type="number" value={year} onChange={e => onYearChange(e.target.value)}
                 style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit" }} />
        </label>
        <button onClick={() => window.print()} style={{ padding: "8px 16px", borderRadius: 8, border: "none",
          background: NAVY, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          🖨️ พิมพ์
        </button>
        <button onClick={exportExcel} style={{ padding: "8px 16px", borderRadius: 8, border: `1.5px solid ${NAVY}`,
          background: "#fff", color: NAVY, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
          📥 Export Excel
        </button>
      </div>

      {/* Report card — title, summary, table and legend together as one page */}
      <div className="ot-report-card" style={{ background: "#fff", border: "1px solid #E6EBF5", borderRadius: 14,
        boxShadow: "0 2px 10px rgba(20,40,90,.05)", padding: "20px 22px", marginBottom: 16 }}>
        <h2 style={{ textAlign: "center", color: NAVY, fontSize: 20, fontWeight: 800, margin: "0 0 16px" }}>
          ประมาณการ OT และจ่ายจริง ปี {year}
        </h2>

        {/* Summary stat row — screen only, dropped from print (see .ot-stats-row rule) */}
        <div className="ot-stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10, marginBottom: 18 }}>
          {[
            { label: "งบประมาณรวม", value: fmtNum(yearTotals.budget) },
            { label: "จ่ายจริงสะสม", value: fmtNum(yearTotals.actual) },
            { label: "% การใช้งบ", value: `${pctUsed.toFixed(1)}%` },
            { label: "เดือนที่เกินงบ", value: String(monthsOverBudget) },
          ].map(s => (
            <div key={s.label} style={{ background: "#F6F8FD", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 11, color: "#6B7A99" }}>{s.label}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="ot-table-wrap">
          <table className="ot-table">
            <thead>
              <tr>
                <th className="ot-month-th" rowSpan={2} style={{ minWidth: 110 }}>เดือน</th>
                {groups.map(g => (
                  <th key={g.group_name} colSpan={g.categories.length}>{g.group_name}</th>
                ))}
                <th rowSpan={2}>Total</th>
                <th rowSpan={2}>หมายเหตุ</th>
              </tr>
              <tr>
                {groups.flatMap(g => g.categories).map(c => <th key={c.id}>{c.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {months.map(m => {
                const t = monthTotal(entries, m);
                const { diff, label } = diffLabel(t.budget, t.actual);
                const factorsThisMonth = factorsByMonth.get(m) ?? [];
                return (
                  <Fragment key={m}>
                    <tr>
                      <td className="ot-month-cell" rowSpan={2}>
                        {formatYearMonthShort(m)}
                        {factorsThisMonth.length > 0 && <span title="มีปัจจัยที่มีผล" style={{ marginLeft: 4 }}>📌</span>}
                      </td>
                      {groups.flatMap(g => g.categories).map(c => {
                        const e = entryFor(entries, m, c.id);
                        return <td key={c.id} style={{ background: BUDGET_BG }}>{fmtNum(e?.budget_amount ?? 0)}</td>;
                      })}
                      <td style={{ background: BUDGET_BG, fontWeight: 700 }}>{fmtNum(t.budget)}</td>
                      <td rowSpan={2} style={{ color: label === "มากกว่า" ? "#dc2626" : label === "น้อยกว่า" ? "#16a34a" : "#94a3b8", fontWeight: 700 }}>
                        {label ? `${label} ${fmtNum(diff)}` : "-"}
                      </td>
                    </tr>
                    <tr>
                      {groups.flatMap(g => g.categories).map(c => {
                        const e = entryFor(entries, m, c.id);
                        const over = (e?.actual_amount ?? 0) > (e?.budget_amount ?? 0) && (e?.actual_amount ?? 0) > 0;
                        return (
                          <td key={c.id} style={over ? { background: "#fee2e2", color: "#dc2626", fontWeight: 700 } : undefined}>
                            {fmtNum(e?.actual_amount ?? 0)}
                          </td>
                        );
                      })}
                      <td style={{ fontWeight: 700 }}>{fmtNum(t.actual)}</td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="ot-legend" style={{ display: "flex", gap: 18, flexWrap: "wrap", fontSize: 12, color: "#334155", marginTop: 14 }}>
          <div><span className="ot-swatch" style={{ display: "inline-block", width: 14, height: 14, background: BUDGET_BG, border: "1px solid #C9D3E8", marginRight: 6, verticalAlign: "middle" }} />Budget</div>
          <div><span className="ot-swatch" style={{ display: "inline-block", width: 14, height: 14, background: "#fff", border: "1px solid #C9D3E8", marginRight: 6, verticalAlign: "middle" }} />Actual</div>
          <div><span className="ot-swatch" style={{ display: "inline-block", width: 14, height: 14, background: "#fee2e2", border: "1px solid #fca5a5", marginRight: 6, verticalAlign: "middle" }} />Actual เกิน Budget ของหมวดนั้น</div>
          <div><span style={{ color: "#dc2626", fontWeight: 700, marginRight: 4 }}>■</span>มากกว่างบ</div>
          <div><span style={{ color: "#16a34a", fontWeight: 700, marginRight: 4 }}>■</span>น้อยกว่างบ</div>
        </div>
      </div>

      {/* Factors */}
      {factors.length > 0 && (
        <div className="ot-factors-card" style={{ background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10 }}>ปัจจัยที่มีผลต่อค่าล่วงเวลา</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 14 }}>
            {months.filter(m => factorsByMonth.has(m)).map(m => (
              <div key={m}>
                <div style={{ fontWeight: 700, fontSize: 12.5, color: NAVY_2, marginBottom: 4 }}>{formatYearMonthLong(m)}</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: "#334155" }}>
                  {factorsByMonth.get(m)!.sort((a, b) => a.sort_order - b.sort_order).map(f => (
                    <li key={f.id} style={{ marginBottom: 3 }}>{f.factor_text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signoff */}
      <div className="ot-signoff-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 20, marginTop: 28 }}>
        {([
          { key: "preparer" as const, label: "ผู้จัดทำ", name: signoff?.preparer_name, status: signoff?.preparer_status, roles: ["hr", "admin", "deputyHR"] },
          { key: "reviewer" as const, label: "ผู้ตรวจสอบ", name: signoff?.reviewer_name, status: signoff?.reviewer_status, roles: ["head", "admin", "deputyHR"] },
          { key: "approver" as const, label: "ผู้อนุมัติ", name: signoff?.approver_name, status: signoff?.approver_status, roles: ["deputy", "admin", "deputyHR"] },
        ]).map(s => {
          const canAct = hasRole(user, ...s.roles);
          const done = s.status === "done";
          return (
            <div key={s.key} style={{ textAlign: "center" }}>
              <div style={{ height: 46, display: "flex", alignItems: "flex-end", justifyContent: "center", marginBottom: 6 }}>
                {done && <span style={{ fontSize: 13, color: "#334155" }}>( {s.name} )</span>}
              </div>
              <div style={{ borderTop: "1px solid #94a3b8", paddingTop: 6, fontSize: 13, fontWeight: 700, color: NAVY }}>{s.label}</div>
              {done && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>✓ ดำเนินการแล้ว</div>}
              {canAct && (
                <button className="print-hide" disabled={busyStep === s.key}
                  onClick={() => setSignoffStep(s.key, done ? "pending" : "done")}
                  style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 12,
                    fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                    background: done ? "#f1f5f9" : NAVY, color: done ? "#475569" : "#fff" }}>
                  {busyStep === s.key ? "กำลังบันทึก…" : done ? "ยกเลิกการดำเนินการ" : `กด${s.label === "ผู้จัดทำ" ? "จัดทำ" : s.label === "ผู้ตรวจสอบ" ? "ตรวจสอบ" : "อนุมัติ"}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
