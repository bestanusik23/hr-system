import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

type KpiKey = "license" | "orientation" | "competency" | "training";

interface KpiDef {
  key: KpiKey; label: string; targetLabel: string; targetPct: number;
  numeratorLabel: string; denominatorLabel: string; formulaNote: string;
}

const KPI_DEFS: KpiDef[] = [
  {
    key: "license", label: "ร้อยละของบุคลากรที่มีใบประกอบวิชาชีพถูกต้อง", targetLabel: "100%", targetPct: 100,
    numeratorLabel: "มีใบฯ ยังไม่หมดอายุ (ณ สิ้นเดือน)", denominatorLabel: "บุคลากรที่บันทึกเลขใบประกอบวิชาชีพไว้",
    formulaNote: "อิงจากข้อมูลใบประกอบวิชาชีพในทะเบียนพนักงาน (เมนู Manpower › ใบประกอบ/ทะเบียนรถ)",
  },
  {
    key: "orientation", label: "ร้อยละของบุคลากรใหม่ที่ผ่านการอบรมปฐมนิเทศ", targetLabel: "100%", targetPct: 100,
    numeratorLabel: "ผ่านการปฐมนิเทศ", denominatorLabel: "พนักงานใหม่เดือนนั้น",
    formulaNote: "สูตรเดียวกับ KPI “ร้อยละพนักงานใหม่ที่ผ่านการอบรมปฐมนิเทศ” ด้านบน",
  },
  {
    key: "competency", label: "ร้อยละของบุคลากรที่ผ่านการประเมินทดลองงาน (Competency)", targetLabel: "≥ 90%", targetPct: 90,
    numeratorLabel: "ผ่าน (บรรจุเป็นพนักงานประจำ)", denominatorLabel: "ประเมินรอบสุดท้ายที่อนุมัติแล้ว",
    formulaNote: "อิงจากผลประเมินทดลองงานรอบสุดท้าย (รอบ 90 วัน) ในระบบประเมินผลพนักงาน",
  },
  {
    key: "training", label: "ร้อยละหลักสูตรที่จัดอบรมได้ตามแผน", targetLabel: "≥ 90%", targetPct: 90,
    numeratorLabel: "จัดจริง (ไม่ยกเลิก)", denominatorLabel: "หลักสูตรตามแผนทั้งหมด",
    formulaNote: "ปรับหน่วยวัดเป็นรายหลักสูตร (ไม่ใช่รายคน) ให้ตรงกับ KPI แผนอบรมด้านบน",
  },
];

const MONTH_LABELS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

interface MonthRow { month: number; numerator: number; denominator: number; pct: number | null; source: "manual" | "computed" }
interface ActionEntry {
  id: number; kpi_key: KpiKey; year: number; month: number;
  root_cause: string; corrective_action: string; responsible: string;
  due_date: string | null; completed_date: string | null; created_by: string | null; created_at: string;
}

function currentYearBE(): number {
  return new Date().getFullYear() + 543;
}

function pctColor(pct: number | null, target: number): string {
  if (pct === null) return "#94a3b8";
  return pct >= target ? "#16a34a" : pct >= target - 10 ? "#d97706" : "#dc2626";
}

function IsoKpiDetailCard({ def, year }: { def: KpiDef; year: number }) {
  const { user } = useAuth();
  const canEdit = user && ["hr", "admin", "deputyHR"].includes(user.role);

  const [months, setMonths] = useState<MonthRow[] | null>(null);
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMonth, setFormMonth] = useState(1);
  const [formRootCause, setFormRootCause] = useState("");
  const [formAction, setFormAction] = useState("");
  const [formResponsible, setFormResponsible] = useState("");
  const [formDue, setFormDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Manual per-month backfill (for periods before this tracking existed)
  const [editingMonth, setEditingMonth] = useState<number | null>(null);
  const [editNum, setEditNum] = useState("");
  const [editDen, setEditDen] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  function loadActions() {
    fetch(`/api/iso-kpi/actions?kpi=${def.key}&year=${year}`).then(r => r.json())
      .then((d: { ok: boolean; actions?: ActionEntry[] }) => { if (d.ok) setActions(d.actions ?? []); });
  }

  function loadMonths() {
    setLoading(true);
    return fetch(`/api/iso-kpi/monthly?kpi=${def.key}&year=${year}`).then(r => r.json())
      .then((d: { ok: boolean; months?: MonthRow[] }) => { if (d.ok) setMonths(d.months ?? null); })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadMonths();
    loadActions();
    setEditingMonth(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [def.key, year]);

  function startEdit(m: MonthRow) {
    setEditingMonth(m.month);
    setEditNum(String(m.numerator));
    setEditDen(String(m.denominator));
  }

  async function saveEdit(month: number) {
    const num = Number(editNum), den = Number(editDen);
    if (!Number.isFinite(num) || !Number.isFinite(den) || num < 0 || den < 0) return;
    setEditSaving(true);
    await fetch("/api/iso-kpi/monthly", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kpi: def.key, year, month, numerator: num, denominator: den }),
    });
    setEditSaving(false);
    setEditingMonth(null);
    loadMonths();
  }

  async function clearOverride(month: number) {
    setEditSaving(true);
    await fetch(`/api/iso-kpi/monthly?kpi=${def.key}&year=${year}&month=${month}`, { method: "DELETE" });
    setEditSaving(false);
    setEditingMonth(null);
    loadMonths();
  }

  const yearTotal = months
    ? { num: months.reduce((s, m) => s + m.numerator, 0), den: months.reduce((s, m) => s + m.denominator, 0) }
    : null;
  const yearPct = yearTotal && yearTotal.den > 0 ? Math.round((yearTotal.num / yearTotal.den) * 1000) / 10 : null;

  const maxBar = Math.max(...(months?.map(m => m.pct ?? 0) ?? [0]), def.targetPct, 10);

  async function submitAction() {
    if (!formRootCause.trim() && !formAction.trim()) return;
    setSaving(true); setSaveMsg("");
    try {
      const r = await fetch("/api/iso-kpi/actions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kpi_key: def.key, year, month: formMonth,
          root_cause: formRootCause, corrective_action: formAction,
          responsible: formResponsible, due_date: formDue || null,
        }),
      });
      const d = await r.json() as { ok: boolean; error?: string };
      if (d.ok) {
        setFormRootCause(""); setFormAction(""); setFormResponsible(""); setFormDue("");
        setShowForm(false);
        loadActions();
      } else setSaveMsg(`❌ ${d.error}`);
    } catch {
      setSaveMsg("❌ เกิดข้อผิดพลาด");
    }
    setSaving(false);
  }

  async function markCompleted(id: number) {
    await fetch(`/api/iso-kpi/actions?id=${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed_date: new Date().toISOString().slice(0, 10) }),
    });
    loadActions();
  }

  return (
    <div style={{ background: "#fff", borderRadius: 12, border: "1px solid #dce4f5",
      borderTop: `4px solid ${pctColor(yearPct, def.targetPct)}`, padding: "20px 22px", marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10, marginBottom: 4 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#0a1628" }}>{def.label}</div>
          <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 2 }}>{def.formulaNote}</div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#94a3b8" }}>เป้าหมาย {def.targetLabel} · สะสมทั้งปี</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: pctColor(yearPct, def.targetPct) }}>
            {yearPct === null ? "—" : `${yearPct}%`}
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>กำลังโหลด…</div>
      ) : (
        <>
          {/* Monthly bar chart */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 100, marginTop: 14, marginBottom: 4, position: "relative" }}>
            <div style={{ position: "absolute", left: 0, right: 0,
              bottom: `${(def.targetPct / maxBar) * 100}%`, borderTop: "1.5px dashed #c4cfee", zIndex: 1 }} />
            {(months ?? []).map(m => (
              <div key={m.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", height: "100%", position: "relative", zIndex: 2 }}>
                {m.pct !== null && (
                  <div style={{ fontSize: 9, color: pctColor(m.pct, def.targetPct), fontWeight: 700, marginBottom: 2 }}>{m.pct}</div>
                )}
                <div style={{ width: "70%", maxWidth: 16, borderRadius: "3px 3px 0 0",
                  background: pctColor(m.pct, def.targetPct),
                  height: `${m.pct !== null ? Math.max(2, (m.pct / maxBar) * 100) : 1}%`,
                  opacity: m.denominator === 0 ? 0.25 : 1 }} />
                <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 3 }}>{MONTH_LABELS[m.month - 1]}</div>
              </div>
            ))}
          </div>

          {/* Monthly detail table */}
          <div style={{ overflowX: "auto", marginTop: 10 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead>
                <tr style={{ background: "#f4f7ff" }}>
                  <th style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700, color: "#475569" }}>เดือน</th>
                  {(months ?? []).map(m => (
                    <th key={m.month} style={{ padding: "6px 6px", textAlign: "center", fontWeight: 700, color: "#475569" }}>{MONTH_LABELS[m.month - 1]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: "5px 8px", color: "#64748b" }}>{def.numeratorLabel}</td>
                  {(months ?? []).map(m => (
                    <td key={m.month} style={{ padding: "5px 6px", textAlign: "center" }}>
                      {editingMonth === m.month ? (
                        <input type="number" min={0} value={editNum} onChange={e => setEditNum(e.target.value)}
                          style={{ width: 44, padding: "2px 3px", borderRadius: 4, border: "1.5px solid #c4cfee", textAlign: "center", fontFamily: "inherit", fontSize: 11 }} />
                      ) : m.numerator}
                    </td>
                  ))}
                </tr>
                <tr style={{ background: "#f8faff" }}>
                  <td style={{ padding: "5px 8px", color: "#64748b" }}>{def.denominatorLabel}</td>
                  {(months ?? []).map(m => (
                    <td key={m.month} style={{ padding: "5px 6px", textAlign: "center" }}>
                      {editingMonth === m.month ? (
                        <input type="number" min={0} value={editDen} onChange={e => setEditDen(e.target.value)}
                          style={{ width: 44, padding: "2px 3px", borderRadius: 4, border: "1.5px solid #c4cfee", textAlign: "center", fontFamily: "inherit", fontSize: 11 }} />
                      ) : m.denominator}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td style={{ padding: "5px 8px", fontWeight: 700, color: "#0a1628" }}>ร้อยละ</td>
                  {(months ?? []).map(m => (
                    <td key={m.month} style={{ padding: "5px 6px", textAlign: "center" }}>
                      {editingMonth === m.month ? (
                        <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                          <button onClick={() => saveEdit(m.month)} disabled={editSaving}
                            title="บันทึก" style={{ border: "none", background: "#16a34a", color: "#fff", borderRadius: 4,
                              width: 18, height: 18, fontSize: 10, cursor: "pointer", lineHeight: 1 }}>✓</button>
                          <button onClick={() => setEditingMonth(null)} disabled={editSaving}
                            title="ยกเลิก" style={{ border: "none", background: "#94a3b8", color: "#fff", borderRadius: 4,
                              width: 18, height: 18, fontSize: 10, cursor: "pointer", lineHeight: 1 }}>✕</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
                          <span style={{ fontWeight: 700, color: pctColor(m.pct, def.targetPct) }}>
                            {m.pct === null ? "—" : `${m.pct}%`}
                          </span>
                          {canEdit && (
                            <button onClick={() => startEdit(m)} title="กรอกยอดเอง"
                              style={{ border: "none", background: "none", color: "#94a3b8", cursor: "pointer", fontSize: 10, padding: 0 }}>✎</button>
                          )}
                          {m.source === "manual" && (
                            <button onClick={() => clearOverride(m.month)} title="ล้างค่าที่กรอกเอง กลับไปใช้ค่าคำนวณอัตโนมัติ"
                              style={{ border: "none", background: "none", color: "#0038C6", cursor: "pointer", fontSize: 9, padding: 0 }}>↺</button>
                          )}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td></td>
                  {(months ?? []).map(m => (
                    <td key={m.month} style={{ padding: "1px 6px", textAlign: "center", fontSize: 9, color: "#d97706" }}>
                      {m.source === "manual" ? "กรอกเอง" : ""}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          {/* CAR / CQI log */}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f5ff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0a1628" }}>
                🔍 การวิเคราะห์สาเหตุ / แนวทางแก้ไข ({actions.length})
              </div>
              {canEdit && (
                <button onClick={() => setShowForm(v => !v)}
                  style={{ padding: "5px 12px", borderRadius: 6, border: "1.5px solid #0038C6",
                    background: showForm ? "#0038C6" : "#fff", color: showForm ? "#fff" : "#0038C6",
                    fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  {showForm ? "ยกเลิก" : "+ เพิ่มรายการ"}
                </button>
              )}
            </div>

            {showForm && (
              <div style={{ background: "#f8faff", border: "1px solid #dce4f5", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 8, marginBottom: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 11.5, color: "#64748b" }}>เดือนที่</label>
                  <select value={formMonth} onChange={e => setFormMonth(Number(e.target.value))}
                    style={{ padding: "5px 8px", borderRadius: 6, border: "1.5px solid #dce4f5", fontFamily: "inherit", fontSize: 12 }}>
                    {MONTH_LABELS.map((l, i) => <option key={i} value={i + 1}>{l}</option>)}
                  </select>
                </div>
                <textarea placeholder="การวิเคราะห์หาสาเหตุที่แท้จริงของปัญหา" value={formRootCause}
                  onChange={e => setFormRootCause(e.target.value)}
                  style={{ width: "100%", minHeight: 50, padding: 8, borderRadius: 6, border: "1.5px solid #dce4f5",
                    fontFamily: "inherit", fontSize: 12.5, marginBottom: 8, boxSizing: "border-box" }} />
                <textarea placeholder="แนวทางการแก้ไขป้องกันปัญหา/พัฒนาอย่างต่อเนื่อง" value={formAction}
                  onChange={e => setFormAction(e.target.value)}
                  style={{ width: "100%", minHeight: 50, padding: 8, borderRadius: 6, border: "1.5px solid #dce4f5",
                    fontFamily: "inherit", fontSize: 12.5, marginBottom: 8, boxSizing: "border-box" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                  <input placeholder="ผู้รับผิดชอบ" value={formResponsible} onChange={e => setFormResponsible(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1.5px solid #dce4f5", fontFamily: "inherit", fontSize: 12.5 }} />
                  <input type="date" value={formDue} onChange={e => setFormDue(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 6, border: "1.5px solid #dce4f5", fontFamily: "inherit", fontSize: 12.5 }} />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
                  {saveMsg && <span style={{ fontSize: 11.5, color: "#dc2626" }}>{saveMsg}</span>}
                  <button onClick={submitAction} disabled={saving}
                    style={{ padding: "6px 16px", borderRadius: 6, border: "none",
                      background: saving ? "#c4cfee" : "#0038C6", color: "#fff", fontSize: 12, fontWeight: 700,
                      cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
                    {saving ? "กำลังบันทึก…" : "บันทึก"}
                  </button>
                </div>
              </div>
            )}

            {actions.length === 0 ? (
              <div style={{ fontSize: 12, color: "#94a3b8", padding: "8px 0" }}>ยังไม่มีรายการวิเคราะห์/แก้ไขในปีนี้</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {actions.map(a => (
                  <div key={a.id} style={{ background: a.completed_date ? "#f0fdf4" : "#fffbeb",
                    border: `1px solid ${a.completed_date ? "#bbf7d0" : "#fde68a"}`, borderRadius: 8, padding: "8px 12px", fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span style={{ fontWeight: 700, color: "#0a1628" }}>{MONTH_LABELS[a.month - 1]} {a.year}</span>
                      {!a.completed_date && canEdit && (
                        <button onClick={() => markCompleted(a.id)}
                          style={{ padding: "2px 10px", borderRadius: 5, border: "1px solid #16a34a", background: "#fff",
                            color: "#16a34a", fontSize: 10.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          ✓ เสร็จแล้ว
                        </button>
                      )}
                      {a.completed_date && <span style={{ fontSize: 10.5, color: "#16a34a", fontWeight: 700 }}>เสร็จ {a.completed_date}</span>}
                    </div>
                    {a.root_cause && <div style={{ marginTop: 3, color: "#475569" }}><b>สาเหตุ:</b> {a.root_cause}</div>}
                    {a.corrective_action && <div style={{ marginTop: 2, color: "#475569" }}><b>แก้ไข:</b> {a.corrective_action}</div>}
                    <div style={{ marginTop: 3, fontSize: 10.5, color: "#94a3b8" }}>
                      {a.responsible && `ผู้รับผิดชอบ: ${a.responsible}`}{a.due_date && ` · กำหนดเสร็จ: ${a.due_date}`}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Embedded in ExecPage — the ISO 9001 (FM-ISO-01-01 to 03) HR quality-objective
 *  section, with its own year selector since it shows all 12 months at once
 *  (unlike the single-period "5 ตัวชี้วัด HR KPI" section above it). */
export default function IsoQualitySection() {
  const [year, setYear] = useState(currentYearBE);
  const yearOptions = Array.from({ length: 4 }, (_, i) => currentYearBE() - i);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 12.5, color: "#64748b" }}>
          ตาม FM-ISO-01-01 ถึง 03 — คำนวณสดจากข้อมูลในระบบ กรอกยอดเองย้อนหลังได้ต่อเดือนหากจำเป็น
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 12.5, color: "#6b7794", fontWeight: 600 }}>ปี:</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))}
            style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid #c4cfee",
              fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff", cursor: "pointer" }}>
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {KPI_DEFS.map(def => <IsoKpiDetailCard key={def.key} def={def} year={year} />)}
    </div>
  );
}
