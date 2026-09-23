import { Fragment, useEffect, useMemo, useState } from "react";
import {
  type OtCategory, type OtMonthlyEntry, type OtFactor,
  groupCategories, formatYearMonthLong, monthsOfFiscalYear, entryFor,
} from "./otBudgetApi";

const NAVY = "#1F3864";

export default function EntryTab({ year, onYearChange }: { year: string; onYearChange: (y: string) => void }) {
  const [categories, setCategories] = useState<OtCategory[]>([]);
  const [entries, setEntries] = useState<OtMonthlyEntry[]>([]);
  const [factors, setFactors] = useState<OtFactor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const months = useMemo(() => monthsOfFiscalYear(year), [year]);
  const [yearMonth, setYearMonth] = useState<string>(months[0]);
  useEffect(() => { if (!months.includes(yearMonth)) setYearMonth(months[0]); }, [months]); // eslint-disable-line react-hooks/exhaustive-deps

  const [form, setForm] = useState<Record<number, { budget: string; actual: string }>>({});
  const [paidDate, setPaidDate] = useState("");
  const [newFactor, setNewFactor] = useState("");

  function load() {
    setLoading(true);
    Promise.all([
      fetch("/api/ot-budget/categories").then(r => r.json()),
      fetch(`/api/ot-budget/monthly?year=${year}`).then(r => r.json()),
      fetch(`/api/ot-budget/factors?year=${year}`).then(r => r.json()),
    ]).then(([c, m, f]: [
      { ok: boolean; categories: OtCategory[] },
      { ok: boolean; entries: OtMonthlyEntry[] },
      { ok: boolean; factors: OtFactor[] },
    ]) => {
      if (c.ok) setCategories(c.categories);
      if (m.ok) setEntries(m.entries);
      if (f.ok) setFactors(f.factors);
      setLoading(false);
    }).catch(() => setLoading(false));
  }

  useEffect(() => { load(); }, [year]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const next: Record<number, { budget: string; actual: string }> = {};
    for (const c of categories) {
      const e = entryFor(entries, yearMonth, c.id);
      next[c.id] = { budget: String(e?.budget_amount ?? 0), actual: String(e?.actual_amount ?? 0) };
    }
    setForm(next);
    const anyPaidDate = entries.find(e => e.year_month === yearMonth && e.paid_date)?.paid_date;
    setPaidDate(anyPaidDate ?? "");
    setSaved(false);
  }, [yearMonth, entries, categories]);

  const groups = useMemo(() => groupCategories(categories), [categories]);
  const monthFactors = factors.filter(f => f.year_month === yearMonth);

  function updateField(catId: number, field: "budget" | "actual", value: string) {
    if (value !== "" && (!/^\d*$/.test(value))) return; // digits only
    setForm(prev => ({ ...prev, [catId]: { ...prev[catId], [field]: value } }));
  }

  async function save() {
    setError(""); setSaved(false);
    for (const c of categories) {
      const v = form[c.id];
      if (!v) continue;
      if (v.budget !== "" && Number(v.budget) < 0) { setError("ยอดเงินต้องไม่ติดลบ"); return; }
      if (v.actual !== "" && Number(v.actual) < 0) { setError("ยอดเงินต้องไม่ติดลบ"); return; }
    }
    setSaving(true);
    const body = {
      year_month: yearMonth,
      paid_date: paidDate || null,
      entries: categories.map(c => ({
        category_id: c.id,
        budget_amount: Number(form[c.id]?.budget || 0),
        actual_amount: Number(form[c.id]?.actual || 0),
      })),
    };
    const res = await fetch("/api/ot-budget/monthly", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const d = await res.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "บันทึกไม่สำเร็จ"); return; }
    setSaved(true);
    load();
  }

  async function addFactor() {
    const text = newFactor.trim();
    if (!text) return;
    await fetch("/api/ot-budget/factors", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year_month: yearMonth, factor_text: text, sort_order: monthFactors.length }),
    });
    setNewFactor("");
    load();
  }

  async function deleteFactor(id: number) {
    await fetch(`/api/ot-budget/factors?id=${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด…</div>;

  return (
    <div style={{ fontFamily: "'Sarabun', sans-serif", maxWidth: 900 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 18, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
          ปีงบ:
          <input type="number" value={year} onChange={e => onYearChange(e.target.value)}
                 style={{ width: 90, padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit" }} />
        </label>
        <label style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
          เดือน:
          <select value={yearMonth} onChange={e => setYearMonth(e.target.value)}
                  style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit" }}>
            {months.map(m => <option key={m} value={m}>{formatYearMonthLong(m)}</option>)}
          </select>
        </label>
        <label style={{ fontSize: 13, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
          วันที่จ่าย:
          <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)}
                 style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit" }} />
        </label>
      </div>

      {groups.map(g => (
        <div key={g.group_name} style={{ background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12,
          padding: "12px 16px", marginBottom: 12 }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8, fontSize: 13.5 }}>{g.group_name}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr repeat(2, 140px)", gap: 8, alignItems: "center" }}>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }} />
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textAlign: "center" }}>Budget</div>
            <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, textAlign: "center" }}>Actual</div>
            {g.categories.map(c => (
              <Fragment key={c.id}>
                <div style={{ fontSize: 13, color: "#334155" }}>{c.name}</div>
                <input value={form[c.id]?.budget ?? ""} onChange={e => updateField(c.id, "budget", e.target.value)}
                  inputMode="numeric" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5",
                  fontFamily: "inherit", textAlign: "right" }} />
                <input value={form[c.id]?.actual ?? ""} onChange={e => updateField(c.id, "actual", e.target.value)}
                  inputMode="numeric" style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5",
                  fontFamily: "inherit", textAlign: "right" }} />
              </Fragment>
            ))}
          </div>
        </div>
      ))}

      {error && (
        <div style={{ background: "#fee2e2", border: "1px solid #fecaca", color: "#dc2626", borderRadius: 8,
          padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>{error}</div>
      )}
      {saved && (
        <div style={{ background: "#dcfce7", border: "1px solid #bbf7d0", color: "#16a34a", borderRadius: 8,
          padding: "10px 14px", fontSize: 13, marginBottom: 12 }}>✅ บันทึกเรียบร้อยแล้ว</div>
      )}

      <button onClick={save} disabled={saving} style={{ padding: "10px 22px", borderRadius: 8, border: "none",
        background: NAVY, color: "#fff", fontWeight: 700, fontSize: 13, cursor: saving ? "not-allowed" : "pointer",
        fontFamily: "inherit", opacity: saving ? 0.7 : 1, marginBottom: 20 }}>
        {saving ? "กำลังบันทึก…" : "บันทึกยอดเดือนนี้"}
      </button>

      {/* Factors for this month */}
      <div style={{ background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12, padding: "14px 16px" }}>
        <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10, fontSize: 13.5 }}>
          ปัจจัยที่มีผลต่อค่าล่วงเวลา — {formatYearMonthLong(yearMonth)}
        </div>
        {monthFactors.length > 0 && (
          <ul style={{ margin: "0 0 10px", paddingLeft: 18, fontSize: 13 }}>
            {monthFactors.map(f => (
              <li key={f.id} style={{ marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ flex: 1 }}>{f.factor_text}</span>
                <button onClick={() => deleteFactor(f.id)} style={{ background: "none", border: "none",
                  color: "#dc2626", cursor: "pointer", fontSize: 12 }}>ลบ</button>
              </li>
            ))}
          </ul>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <input value={newFactor} onChange={e => setNewFactor(e.target.value)}
            placeholder="เพิ่มปัจจัยที่มีผลต่อ OT เดือนนี้…"
            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit" }} />
          <button onClick={addFactor} style={{ padding: "8px 16px", borderRadius: 8, border: "none",
            background: NAVY, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            เพิ่ม
          </button>
        </div>
      </div>
    </div>
  );
}
