import { useEffect, useMemo, useState } from "react";
import { EVAL_STATUS_META } from "./RoundDetail";
import AnnualEvalPrintModal from "./AnnualEvalPrintModal";

interface EvalDetail {
  id: number; round_id: number; employee_id: number; template_id: number;
  snap_full_name: string; snap_emp_code: string | null; snap_position: string | null;
  snap_department: string | null; snap_division: string | null; snap_job_level: number;
  snap_department_head: string | null; snap_deputy_director: string | null;
  status: string; returned_reason: string | null; cancel_reason: string | null;
  total_raw_score: number | null; total_weighted_score: number | null; total_percent: number | null; grade: string | null;
  round_name: string;
}
interface Template { id: number; level_group: string; workflow_steps_json: string; label: string; }
interface Category { id: number; template_id: number; name: string; weight_points: number; rater_roles_json: string; sort_order: number; }
interface Item { id: number; category_id: number; text: string; sort_order: number; }
interface ScoreRow { item_id: number; rater_role: string; score: number | null; reason: string | null; submitted_at: string | null; }
interface Stats {
  period_start: string | null; period_end: string | null; sick_leave_days: number; personal_leave_days: number;
  vacation_leave_days: number; late_minutes: number; training_count: number;
  hospital_activity_count: number; committee_count: number; warning_count: number;
}
interface Comment { source: string; item_order: number; text: string; }
interface Props { evalId: number; onClose: () => void; onSaved: () => void; }

const STEP_LABEL: Record<string, string> = {
  head: "หัวหน้าแผนก", deputy: "รองผู้อำนวยการฝ่าย", quality: "ส่วนงานคุณภาพ",
  hr: "HR", director: "ผู้อำนวยการ/ผู้ได้รับมอบหมาย", summary: "สรุปผล",
};
// Matches functions/lib/annualEval.ts raterRoleForStep — "quality" step uses rater_role "quality_head".
const STEP_TO_RATER_ROLE: Record<string, string> = {
  head: "head", deputy: "deputy", quality: "quality_head", hr: "hr", director: "director",
};
// Matches functions/api/annual-eval/evaluations/[id]/comments.ts SOURCE_STEP — which comment
// fields belong to which workflow step, and their Thai labels.
const STEP_COMMENT_SOURCES: Record<string, { source: string; label: string }[]> = {
  head: [{ source: "head_strength", label: "จุดแข็ง" }, { source: "head_development", label: "สิ่งที่ต้องพัฒนา" }],
  deputy: [{ source: "deputy_strength", label: "จุดแข็ง" }, { source: "deputy_development", label: "สิ่งที่ต้องพัฒนา" }],
  director: [{ source: "director_comment", label: "ความคิดเห็น" }],
  hr: [
    { source: "hr_comment", label: "ความเห็นเพิ่มเติมจาก HR" },
    { source: "next_year_kpi", label: "ตัวชี้วัดการปฏิบัติงานหลัก/ผลงานที่คาดหวังปีถัดไป" },
    { source: "dev_plan", label: "แผนพัฒนารายบุคคล" },
    { source: "training_recommend", label: "หลักสูตรที่ควรเข้ารับการอบรม" },
  ],
};
const ALL_SOURCE_LABELS: Record<string, string> = Object.fromEntries(
  Object.values(STEP_COMMENT_SOURCES).flat().map(s => [s.source, s.label]),
);

function CommentEditor({ label, initial, onSave }: {
  label: string; initial: string[]; onSave: (items: string[]) => Promise<void>;
}) {
  const [items, setItems] = useState(initial.length > 0 ? initial : [""]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const cleaned = items.map(t => t.trim()).filter(Boolean);
    setSaving(true);
    await onSave(cleaned);
    setSaving(false);
  }

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#334155", marginBottom: 6 }}>{label}</div>
      {items.map((text, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input value={text} onChange={e => setItems(arr => arr.map((v, idx) => idx === i ? e.target.value : v))}
            placeholder={`ข้อ ${i + 1}`}
            style={{ flex: 1, padding: "7px 10px", borderRadius: 4, border: "1.5px solid #dce4f5",
              fontSize: 12.5, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
          {items.length > 1 && (
            <button onClick={() => setItems(arr => arr.filter((_, idx) => idx !== i))}
              style={{ background: "#fee2e2", border: "none", borderRadius: 4, width: 30, cursor: "pointer", color: "#dc2626" }}>×</button>
          )}
        </div>
      ))}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => setItems(arr => [...arr, ""])}
          style={{ padding: "5px 12px", borderRadius: 6, border: "1px dashed #c4cfee", background: "#fff",
            color: "#64748b", fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
          + เพิ่มข้อ
        </button>
        <button onClick={save} disabled={saving}
          style={{ padding: "5px 12px", borderRadius: 6, border: "none", background: "#0038C6",
            color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
    </div>
  );
}

function ScoreRing({ score, grade }: { score: number | null; grade: string | null }) {
  const r = 40, circ = 2 * Math.PI * r;
  const pct = score != null ? Math.min(score / 20, 1) : 0;
  const offset = circ * (1 - pct);
  return (
    <div style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" style={{ transform: "rotate(-90deg)", width: 100, height: 100 }}>
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="8" />
        <circle cx="50" cy="50" r={r} fill="none" stroke="#fff" strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .6s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{score ?? "—"}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>/20</div>
        {grade && <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginTop: 2 }}>{grade}</div>}
      </div>
    </div>
  );
}

export default function AnnualEvalForm({ evalId, onClose, onSaved }: Props) {
  const [ev, setEv] = useState<EvalDetail | null>(null);
  const [template, setTemplate] = useState<Template | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const [canAct, setCanAct] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [draft, setDraft] = useState<Record<number, { score: number; reason: string }>>({});
  const [showReturn, setShowReturn] = useState(false);
  const [returnStep, setReturnStep] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [showPrint, setShowPrint] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  function load() {
    setLoading(true); setError("");
    fetch(`/api/annual-eval/evaluations/${evalId}`).then(r => r.json())
      .then((d: { ok: boolean; error?: string; evaluation: EvalDetail; template: Template;
        categories: Category[]; items: Item[]; scores: ScoreRow[]; stats: Stats | null; comments: Comment[];
        current_step: string | null; can_act: boolean; can_manage: boolean }) => {
        if (!d.ok) { setError(d.error ?? "โหลดข้อมูลไม่สำเร็จ"); return; }
        setEv(d.evaluation); setTemplate(d.template); setCategories(d.categories);
        setItems(d.items); setScores(d.scores); setStats(d.stats); setComments(d.comments ?? []);
        setCurrentStep(d.current_step); setCanAct(d.can_act); setCanManage(d.can_manage);
        const raterRole = d.current_step ? STEP_TO_RATER_ROLE[d.current_step] : null;
        if (raterRole) {
          const pre: Record<number, { score: number; reason: string }> = {};
          for (const s of d.scores) {
            if (s.rater_role === raterRole && s.score != null) pre[s.item_id] = { score: s.score, reason: s.reason ?? "" };
          }
          setDraft(pre);
        }
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [evalId]);

  const workflowSteps = useMemo(() => template ? (JSON.parse(template.workflow_steps_json) as string[]) : [], [template]);
  const myRaterRole = currentStep ? STEP_TO_RATER_ROLE[currentStep] : null;
  const myCategories = useMemo(
    () => categories.filter(c => myRaterRole && (JSON.parse(c.rater_roles_json) as string[]).includes(myRaterRole)),
    [categories, myRaterRole],
  );
  const scoresByItemRater = useMemo(() => {
    const m = new Map<string, ScoreRow>();
    for (const s of scores) m.set(`${s.item_id}:${s.rater_role}`, s);
    return m;
  }, [scores]);

  function setScore(itemId: number, score: number) {
    setDraft(d => ({ ...d, [itemId]: { score, reason: [1, 2, 5].includes(score) ? (d[itemId]?.reason ?? "") : "" } }));
  }
  function setReason(itemId: number, reason: string) {
    setDraft(d => ({ ...d, [itemId]: { score: d[itemId]?.score ?? 0, reason } }));
  }

  async function submitScores(isDraft: boolean) {
    if (!ev) return;
    const myItemIds = myCategories.flatMap(c => items.filter(i => i.category_id === c.id).map(i => i.id));
    const itemScores = myItemIds.map(id => draft[id]).filter(Boolean).map((v, idx) => ({ item_id: myItemIds[idx], score: v.score, reason: v.reason || undefined }));
    if (!isDraft) {
      for (const id of myItemIds) {
        if (!draft[id]) { setError("กรุณาให้คะแนนครบทุกหัวข้อก่อนส่ง"); return; }
        if ([1, 2, 5].includes(draft[id].score) && !draft[id].reason.trim()) {
          setError("กรุณาระบุเหตุผลเมื่อให้คะแนน 1, 2 หรือ 5"); return;
        }
      }
    }
    setSaving(true); setError("");
    const r = await fetch(`/api/annual-eval/evaluations/${evalId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit_scores", item_scores: itemScores, draft: isDraft }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    if (isDraft) load(); else onSaved();
  }

  async function finalize() {
    setSaving(true); setError("");
    const r = await fetch(`/api/annual-eval/evaluations/${evalId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "finalize" }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  async function doReturn() {
    if (!returnStep || !returnReason.trim()) return;
    setSaving(true); setError("");
    const r = await fetch(`/api/annual-eval/evaluations/${evalId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "return", target_step: returnStep, reason: returnReason }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setShowReturn(false); load();
  }

  async function doCancel() {
    if (!cancelReason.trim()) return;
    setSaving(true); setError("");
    const r = await fetch(`/api/annual-eval/evaluations/${evalId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reason: cancelReason }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  async function saveStats() {
    if (!stats) return;
    setSaving(true); setError("");
    const r = await fetch(`/api/annual-eval/evaluations/${evalId}/stats`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(stats),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    load();
  }

  async function saveComments(source: string, items: string[]) {
    setError("");
    const r = await fetch(`/api/annual-eval/evaluations/${evalId}/comments`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ source, items }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setComments(cs => [...cs.filter(c => c.source !== source), ...items.map((text, i) => ({ source, item_order: i + 1, text }))]);
  }

  if (loading) {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 100 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      </div>
    );
  }
  if (!ev || !template) {
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 100 }}>
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, color: "#dc2626" }}>{error || "ไม่พบข้อมูล"}</div>
      </div>
    );
  }

  const statusMeta = EVAL_STATUS_META[ev.status] ?? EVAL_STATUS_META.not_started;
  const visibleSteps = workflowSteps.filter(s => s !== "summary");
  const curIdx = currentStep ? workflowSteps.indexOf(currentStep) : workflowSteps.length;

  return (
    <>
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#f0f5ff", borderRadius: 8, width: "100%", maxWidth: 760,
        maxHeight: "94vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,56,198,0.25)",
        border: "1px solid #c4cfee" }}>

        <div style={{ background: "#0038C6", borderRadius: "8px 8px 0 0", padding: "28px 32px 24px",
          position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160,
            borderRadius: "50%", border: "32px solid rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, position: "relative", zIndex: 1 }}>
            <ScoreRing score={ev.total_weighted_score} grade={ev.grade} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase" }}>
                ประเมินผลการปฏิบัติงานประจำปี
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 4,
                  padding: "4px 12px", fontSize: 11, fontWeight: 700, fontFamily: "monospace" }}>{ev.round_name}</span>
                <span style={{ background: statusMeta.bg, color: statusMeta.color, borderRadius: 4,
                  padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>{statusMeta.label}</span>
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{ev.snap_full_name}</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6, lineHeight: 1.6 }}>
                {ev.snap_position ?? "—"} · {ev.snap_department ?? "—"} · ระดับ {ev.snap_job_level}
              </div>
            </div>
            <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.15)",
              borderRadius: 6, width: 34, height: 34, cursor: "pointer", fontSize: 18, color: "#fff", flexShrink: 0 }}>×</button>
          </div>
        </div>

        <div style={{ background: "#f0f5ff", borderBottom: "1px solid #dce4f5", display: "flex", padding: "0 32px", overflowX: "auto" }}>
          {visibleSteps.map((step, i) => {
            const done = i < curIdx || ev.status === "completed";
            const active = i === curIdx && ev.status !== "completed" && ev.status !== "cancelled";
            const c = done ? "#16a34a" : active ? "#0038C6" : "#94a3b8";
            const bg = done ? "#dcfce7" : active ? "#e8eeff" : "transparent";
            return (
              <div key={step} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
                <div style={{ flex: 1, padding: "12px 8px", display: "flex", alignItems: "center", gap: 8,
                  borderBottom: `3px solid ${(done || active) ? c : "transparent"}` }}>
                  <div style={{ width: 24, height: 24, borderRadius: "50%", background: bg, border: `1.5px solid ${c}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    fontSize: 9, fontWeight: 700, color: c, fontFamily: "monospace" }}>
                    {done ? "✓" : String(i + 1).padStart(2, "0")}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: c, whiteSpace: "nowrap" }}>
                    {STEP_LABEL[step]}
                  </span>
                </div>
                {i < visibleSteps.length - 1 && (
                  <div style={{ width: 16, flexShrink: 0, color: "#c4cfee", fontSize: 14, paddingBottom: 3 }}>›</div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: 16 }}>
          {ev.returned_reason && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              ↩️ ถูกส่งกลับแก้ไข: {ev.returned_reason}
            </div>
          )}

          {categories.map(cat => {
            const catItems = items.filter(i => i.category_id === cat.id);
            const raters = JSON.parse(cat.rater_roles_json) as string[];
            const isMyCategory = myCategories.some(c => c.id === cat.id);
            return (
              <div key={cat.id} style={{ background: "#fff", border: "1px solid #dce4f5", borderRadius: 6,
                borderLeft: "4px solid #0038C6", padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 4, height: 16, borderRadius: 2, background: "#0038C6" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#0038C6", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                    {cat.name} · น้ำหนัก {cat.weight_points}
                  </span>
                </div>
                {catItems.map(item => {
                  const existingByRater = raters.map(role => scoresByItemRater.get(`${item.id}:${role}`)).filter(Boolean) as ScoreRow[];
                  const myDraft = draft[item.id];
                  if (isMyCategory) {
                    return (
                      <div key={item.id} style={{ marginBottom: 10, padding: "10px 14px", borderRadius: 4,
                        background: "#fff", border: "1px solid #c4cfee" }}>
                        <div style={{ fontSize: 13, color: "#1e293b", marginBottom: 8 }}>{item.text}</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {[1, 2, 3, 4, 5].map(n => (
                            <button key={n} onClick={() => setScore(item.id, n)}
                              style={{ flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 13, fontFamily: "inherit",
                                border: myDraft?.score === n ? "none" : "1.5px solid #dce4f5",
                                background: myDraft?.score === n ? "#0038C6" : "#fff",
                                color: myDraft?.score === n ? "#fff" : "#475569",
                                fontWeight: myDraft?.score === n ? 700 : 400, cursor: "pointer" }}>
                              {n}
                            </button>
                          ))}
                        </div>
                        {myDraft && [1, 2, 5].includes(myDraft.score) && (
                          <input value={myDraft.reason} onChange={e => setReason(item.id, e.target.value)}
                            placeholder="ระบุเหตุผล…" style={{ width: "100%", marginTop: 8, padding: "7px 10px",
                              borderRadius: 4, border: "1.5px solid #fed7aa", fontSize: 12.5, fontFamily: "inherit",
                              outline: "none", boxSizing: "border-box" }} />
                        )}
                      </div>
                    );
                  }
                  return (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6,
                      padding: "10px 14px", borderRadius: 4, background: "#f8fafc", border: "1px solid #e8eeff" }}>
                      <div style={{ flex: 1, fontSize: 13, color: "#64748b", lineHeight: 1.4 }}>{item.text}</div>
                      {existingByRater.length > 0 ? existingByRater.map(s => (
                        <span key={s.rater_role} style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>
                          {s.score}/5
                        </span>
                      )) : <span style={{ fontSize: 13 }}>🔒</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {stats && (canAct && myRaterRole === "hr") && (
            <div style={{ background: "#fff", border: "1px solid #dce4f5", borderRadius: 6,
              borderLeft: "4px solid #7c3aed", padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed", letterSpacing: "0.04em",
                textTransform: "uppercase", marginBottom: 12 }}>สถิติการปฏิบัติงาน</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                {([
                  ["ลาป่วย (วัน)", "sick_leave_days"], ["ลากิจ (วัน)", "personal_leave_days"],
                  ["ลาพักผ่อน (วัน)", "vacation_leave_days"], ["มาสาย (นาที)", "late_minutes"],
                  ["จำนวนหลักสูตรอบรม", "training_count"], ["กิจกรรมโรงพยาบาล", "hospital_activity_count"],
                  ["คณะกรรมการ", "committee_count"], ["ใบเตือน", "warning_count"],
                ] as [string, keyof Stats][]).map(([label, key]) => (
                  <div key={key}>
                    <label style={{ fontSize: 11.5, color: "#64748b", display: "block", marginBottom: 4 }}>{label}</label>
                    <input type="number" min={0} value={stats[key] as number}
                      onChange={e => setStats(s => s ? { ...s, [key]: Number(e.target.value) } : s)}
                      style={{ width: "100%", padding: "7px 10px", borderRadius: 4, border: "1.5px solid #dce4f5",
                        fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
                  </div>
                ))}
              </div>
              <button onClick={saveStats} disabled={saving}
                style={{ marginTop: 12, padding: "8px 18px", borderRadius: 8, border: "1.5px solid #7c3aed",
                  background: "#fff", color: "#7c3aed", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                บันทึกสถิติ
              </button>
            </div>
          )}

          {(canAct && currentStep && STEP_COMMENT_SOURCES[currentStep]) && (
            <div style={{ background: "#fff", border: "1px solid #dce4f5", borderRadius: 6,
              borderLeft: "4px solid #16a34a", padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a", letterSpacing: "0.04em",
                textTransform: "uppercase", marginBottom: 12 }}>ข้อคิดเห็นและแผนพัฒนา</div>
              {STEP_COMMENT_SOURCES[currentStep].map(({ source, label }) => (
                <CommentEditor key={source} label={label}
                  initial={comments.filter(c => c.source === source).sort((a, b) => a.item_order - b.item_order).map(c => c.text)}
                  onSave={items => saveComments(source, items)} />
              ))}
            </div>
          )}

          {Object.keys(ALL_SOURCE_LABELS)
            .filter(src => !(currentStep && STEP_COMMENT_SOURCES[currentStep]?.some(s => s.source === src)))
            .some(src => comments.some(c => c.source === src)) && (
            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "16px 20px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", letterSpacing: "0.04em",
                textTransform: "uppercase", marginBottom: 10 }}>ข้อคิดเห็นจากขั้นตอนก่อนหน้า</div>
              {Object.entries(ALL_SOURCE_LABELS).map(([source, label]) => {
                const list = comments.filter(c => c.source === source).sort((a, b) => a.item_order - b.item_order);
                if (list.length === 0) return null;
                return (
                  <div key={source} style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#334155", marginBottom: 4 }}>{label}</div>
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {list.map((c, i) => <li key={i} style={{ fontSize: 12.5, color: "#64748b" }}>{c.text}</li>)}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canAct && myCategories.length > 0 && (
              <>
                <button onClick={() => submitScores(true)} disabled={saving}
                  style={{ flex: 1, minWidth: 100, padding: "11px 0", borderRadius: 4, border: "1.5px solid #c4cfee",
                    background: "#fff", color: "#475569", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                  บันทึกร่าง
                </button>
                <button onClick={() => submitScores(false)} disabled={saving}
                  style={{ flex: 2, minWidth: 150, padding: "11px 0", borderRadius: 4, border: "none",
                    background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                  {saving ? "กำลังส่ง…" : "ส่งคะแนน"}
                </button>
              </>
            )}
            {canManage && ev.status === "pending_summary" && (
              <button onClick={finalize} disabled={saving}
                style={{ flex: 2, minWidth: 150, padding: "11px 0", borderRadius: 4, border: "none",
                  background: "#16a34a", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {saving ? "กำลังสรุปผล…" : "สรุปผลและอนุมัติ"}
              </button>
            )}
            {canManage && ev.status === "completed" && (
              <button onClick={() => setShowPrint(true)}
                style={{ flex: 2, minWidth: 150, padding: "11px 0", borderRadius: 4, border: "none",
                  background: "#0038C6", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                🖨️ พิมพ์แบบประเมิน
              </button>
            )}
            {canManage && !["completed", "cancelled"].includes(ev.status) && (
              <button onClick={() => setShowReturn(v => !v)}
                style={{ flex: 1, minWidth: 100, padding: "11px 0", borderRadius: 4, border: "1.5px solid #fed7aa",
                  background: "#fff", color: "#c2410c", fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ส่งกลับแก้ไข
              </button>
            )}
            {canManage && !["completed", "cancelled"].includes(ev.status) && (
              <button onClick={() => setShowCancel(v => !v)}
                style={{ flex: 1, minWidth: 100, padding: "11px 0", borderRadius: 4, border: "none",
                  background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ยกเลิกใบประเมิน
              </button>
            )}
            <button onClick={onClose} style={{ flex: 1, minWidth: 80, padding: "11px 0", borderRadius: 4,
              border: "1.5px solid #c4cfee", background: "#fff", cursor: "pointer", fontFamily: "inherit",
              fontSize: 13, color: "#475569" }}>
              ปิด
            </button>
          </div>

          {showReturn && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#c2410c", marginBottom: 8 }}>ส่งกลับให้แก้ไขขั้นตอนไหน</div>
              <select value={returnStep} onChange={e => setReturnStep(e.target.value)}
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #fed7aa",
                  fontSize: 13, fontFamily: "inherit", marginBottom: 8 }}>
                <option value="">-- เลือกขั้นตอน --</option>
                {visibleSteps.slice(0, Math.max(curIdx, visibleSteps.length)).map(s => (
                  <option key={s} value={s}>{STEP_LABEL[s]}</option>
                ))}
              </select>
              <input value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="เหตุผลที่ส่งกลับ…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #fed7aa",
                  fontSize: 13, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }} />
              <button onClick={doReturn} disabled={saving || !returnStep || !returnReason.trim()}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#c2410c",
                  color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                ยืนยันส่งกลับ
              </button>
            </div>
          )}
          {showCancel && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#dc2626", marginBottom: 8 }}>เหตุผลการยกเลิก</div>
              <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="ระบุเหตุผล…"
                style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1.5px solid #fecaca",
                  fontSize: 13, fontFamily: "inherit", marginBottom: 8, boxSizing: "border-box" }} />
              <button onClick={doCancel} disabled={saving || !cancelReason.trim()}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#dc2626",
                  color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
                ยืนยันยกเลิก
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    {showPrint && <AnnualEvalPrintModal evalId={evalId} onClose={() => setShowPrint(false)} />}
    </>
  );
}
