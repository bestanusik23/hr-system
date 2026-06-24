import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import PrintEvalModal from "./PrintEvalModal";

interface Topic { id: number; owner: string; text: string; sort_order: number; }
interface EvalDetail {
  id: number; round: number; status: string; grade: string | null; total_score: number | null;
  suggestion: string | null; decision: string | null; template_id: number | null;
  signer_employee: string | null; signer_head: string | null;
  signer_hr: string | null; signer_director: string | null;
  full_name: string; position: string | null; start_date: string | null;
  department_name: string | null; division_name: string | null;
}
interface ScoreRow { topic_id: number; score: number; text: string; owner: string; }
interface Approval { step: string; status: string; note: string | null; created_at: string; approver_name: string; }
interface Props { evalId: number; onClose: () => void; onSaved: () => void; }

function gradeFromScore(s: number): string {
  if (s >= 90) return "A"; if (s >= 80) return "B"; if (s >= 70) return "C";
  if (s >= 60) return "D"; if (s >= 50) return "E"; return "F";
}
/* ── Score ring ─────────────────────────────────────────────────── */
function ScoreRing({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const r = 40, circ = 2 * Math.PI * r;
  const grade = gradeFromScore(score);
  const offset = circ * (1 - Math.min(score / maxScore, 1));
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
        <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 1 }}>/{maxScore}</div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginTop: 2 }}>{grade}</div>
      </div>
    </div>
  );
}

/* ── Status badge ───────────────────────────────────────────────── */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft:          { label: "ร่าง",                  bg: "rgba(255,255,255,0.15)", color: "#fff" },
    pending_deputy: { label: "รอรองผู้อำนวยการ",      bg: "#fff3cd",               color: "#b45309" },
    pending_hr:     { label: "รอ HR ประเมิน",          bg: "#ede9fe",               color: "#7c3aed" },
    pending_final:  { label: "รออนุมัติขั้นสุดท้าย", bg: "#dcfce7",               color: "#16a34a" },
    approved:       { label: "อนุมัติแล้ว",           bg: "#dcfce7",               color: "#16a34a" },
    rejected:       { label: "ไม่อนุมัติ",           bg: "#fee2e2",               color: "#dc2626" },
  };
  const s = map[status] ?? { label: status, bg: "rgba(255,255,255,0.15)", color: "#fff" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 4,
      padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.05em" }}>
      {s.label}
    </span>
  );
}

/* ── Workflow step bar ──────────────────────────────────────────── */
const STEP_META = [
  { key: "draft",          short: "01", label: "หัวหน้าแผนก" },
  { key: "pending_deputy", short: "02", label: "รองผู้อำนวยการ" },
  { key: "pending_hr",     short: "03", label: "HR ประเมิน" },
  { key: "pending_final",  short: "04", label: "รองฯ อนุมัติสุดท้าย" },
];
const STATUS_ORDER = ["draft", "pending_deputy", "pending_hr", "pending_final", "approved"];

function WorkflowSteps({ status }: { status: string }) {
  const cur = STATUS_ORDER.indexOf(status);
  const approved = status === "approved";
  const rejected = status === "rejected";
  return (
    <div style={{ background: "#f0f5ff", borderBottom: "1px solid #dce4f5",
      display: "flex", padding: "0 32px", overflowX: "auto" }}>
      {STEP_META.map((s, i) => {
        const done   = approved || i < cur;
        const active = i === cur && !approved && !rejected;
        const c = done ? "#16a34a" : active ? "#0038C6" : "#94a3b8";
        const bg = done ? "#dcfce7" : active ? "#e8eeff" : "transparent";
        return (
          <div key={i} style={{ display: "flex", alignItems: "center", flex: 1, minWidth: 0 }}>
            <div style={{ flex: 1, padding: "12px 8px", display: "flex", alignItems: "center",
              gap: 8, borderBottom: `3px solid ${(done || active) ? c : "transparent"}`,
              transition: "border-color .2s" }}>
              <div style={{ width: 24, height: 24, borderRadius: "50%", background: bg,
                border: `1.5px solid ${c}`, display: "flex", alignItems: "center",
                justifyContent: "center", flexShrink: 0,
                fontSize: 9, fontWeight: 700, color: c, fontFamily: "monospace" }}>
                {done ? "✓" : s.short}
              </div>
              <span style={{ fontSize: 11, fontWeight: active ? 700 : 400, color: c,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {s.label}
              </span>
            </div>
            {i < STEP_META.length - 1 && (
              <div style={{ width: 16, flexShrink: 0, display: "flex", alignItems: "center",
                justifyContent: "center", color: "#c4cfee", fontSize: 14, paddingBottom: 3 }}>›</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Topic row ─────────────────────────────────────────────────── */
function TopicRow({ topic, score, onChange, locked }: {
  topic: Topic; score: number; onChange: (v: number) => void; locked: boolean;
}) {
  const isHR = topic.owner === "hr";
  const accentColor = isHR ? "#7c3aed" : "#0038C6";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6,
      padding: "10px 14px", borderRadius: 4,
      background: locked ? "#f8fafc" : "#fff",
      border: `1px solid ${locked ? "#e8eeff" : "#c4cfee"}` }}>
      <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
        background: locked ? "#f0f4ff" : (isHR ? "#ede9fe" : "#e8eeff"),
        color: locked ? "#94a3b8" : accentColor,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, fontWeight: 700, border: `1px solid ${locked ? "#dce4f5" : (isHR ? "#ddd6fe" : "#c4cfee")}` }}>
        {topic.id}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: locked ? "#94a3b8" : "#1e293b", lineHeight: 1.4 }}>
        {topic.text}
      </div>
      {locked ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13 }}>🔒</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#94a3b8", minWidth: 24, textAlign: "right" }}>
            {score || "—"}
          </span>
          <span style={{ fontSize: 11, color: "#c4cfee" }}>/10</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="number" min={0} max={10} value={score}
            onChange={e => onChange(Math.min(10, Math.max(0, Number(e.target.value))))}
            style={{ width: 56, padding: "5px 8px", borderRadius: 4,
              border: `1.5px solid ${accentColor}`, fontSize: 15, textAlign: "center",
              fontFamily: "inherit", fontWeight: 700, color: accentColor, outline: "none",
              background: isHR ? "#faf5ff" : "#f0f5ff" }} />
          <span style={{ fontSize: 11, color: "#94a3b8" }}>/10</span>
        </div>
      )}
    </div>
  );
}

/* ── Section header ─────────────────────────────────────────────── */
function SectionHeader({ color, label, note, style }: {
  color: string; label: string; note?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, ...style }}>
      <div style={{ width: 4, height: 16, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>{label}</span>
      {note && (
        <span style={{ fontSize: 10, color: "#94a3b8", background: "#f0f5ff",
          borderRadius: 4, padding: "2px 8px", border: "1px solid #dce4f5" }}>{note}</span>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function EvaluationForm({ evalId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [ev, setEv]               = useState<EvalDetail | null>(null);
  const [topics, setTopics]       = useState<Topic[]>([]);
  const [scores, setScores]       = useState<Record<number, number>>({});
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [decision, setDecision]     = useState("");
  const [note, setNote]             = useState("");
  const [signerEmp, setSignerEmp]   = useState("");
  const [signerHead, setSignerHead] = useState("");
  const [signerHR, setSignerHR]     = useState("");
  const [signerDir, setSignerDir]   = useState("");
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState("");
  const [showPrint, setShowPrint]   = useState(false);

  useEffect(() => {
    fetch(`/api/eval/evaluations/${evalId}`).then(r => r.json())
      .then((evd: { ok: boolean; evaluation: EvalDetail; scores: ScoreRow[]; approvals: Approval[]; templateTopics: Topic[] | null }) => {
        const evaluation = evd.evaluation;
        setEv(evaluation);
        setApprovals(evd.approvals ?? []);
        setSuggestion(evaluation.suggestion ?? "");
        setDecision(evaluation.decision ?? "");
        setSignerEmp(evaluation.signer_employee ?? "");
        setSignerHead(evaluation.signer_head ?? "");
        setSignerHR(evaluation.signer_hr ?? "");
        setSignerDir(evaluation.signer_director ?? "");
        const sc: Record<number, number> = {};
        evd.scores.forEach(s => { sc[s.topic_id] = s.score; });
        setScores(sc);
        // Auto-fill signature
        if (user) {
          if (evaluation.status === "draft" && ["head","admin"].includes(user.role) && !evaluation.signer_head)
            setSignerHead(user.full_name ?? "");
          if (evaluation.status === "pending_hr" && ["hr","admin"].includes(user.role) && !evaluation.signer_hr)
            setSignerHR(user.full_name ?? "");
          if (evaluation.status === "pending_final" && user.role === "deputyHR" && !evaluation.signer_director)
            setSignerDir(user.full_name ?? "");
        }
        if (evd.templateTopics) setTopics(evd.templateTopics);
        else fetch("/api/eval/topics").then(r => r.json())
          .then((td: { ok: boolean; topics: Topic[] }) => setTopics(td.topics));
      });
  }, [evalId]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);

  const canEditHead  = !!(user && ["head","admin"].includes(user.role)    && ev?.status === "draft");
  const canEditHR    = !!(user && ["hr","admin"].includes(user.role)      && ev?.status === "pending_hr");
  const canDeputyAct = !!(user && ["deputy","admin"].includes(user.role)  && ev?.status === "pending_deputy");
  const canHRAct     = !!(user && ["hr","admin"].includes(user.role)      && ev?.status === "pending_hr");
  const canFinalAct  = !!(user && ["deputyHR","admin"].includes(user.role)&& ev?.status === "pending_final");
  const canPrint     = !!(user && ["hr","admin","deputyHR"].includes(user.role) && ev?.status === "approved");

  async function save(action: string) {
    setSaving(true); setError("");
    const r = await fetch(`/api/eval/evaluations/${evalId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action, scores, suggestion, decision,
        grade: gradeFromScore(totalScore), note,
        signer_employee: signerEmp || null, signer_head: signerHead || null,
        signer_hr: signerHR || null, signer_director: signerDir || null,
      }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    onSaved();
  }

  if (!ev) return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: 12, padding: 40, color: "#0038C6",
        fontWeight: 600 }}>กำลังโหลด…</div>
    </div>
  );

  const hrTopics   = topics.filter(t => t.owner === "hr");
  const headTopics = topics.filter(t => t.owner === "head");

  const DECISIONS = ev.round >= 90
    ? ["บรรจุเป็นพนักงานประจำ", "ยุติทดลองงาน"]
    : ["ทดลองงานต่อในเดือนถัดไป", "ยุติทดลองงาน"];
  const DECISION_COLOR: Record<string, string> = {
    "บรรจุเป็นพนักงานประจำ":    "#16a34a",
    "ทดลองงานต่อในเดือนถัดไป": "#d97706",
    "ยุติทดลองงาน":             "#dc2626",
  };
  const STEP_LABEL: Record<string, string> = {
    head: "หัวหน้าแผนก", deputy: "รองผู้อำนวยการ",
    hr: "ฝ่ายทรัพยากรบุคคล", final: "รองผู้อำนวยการ (อนุมัติสุดท้าย)",
  };

  /* ── shared style tokens ── */
  const cardStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid #dce4f5", borderRadius: 6,
    borderLeft: "4px solid #0038C6",
  };
  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 4,
    border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit",
    outline: "none", boxSizing: "border-box" as const, background: "#fff",
  };
  const btnClose: React.CSSProperties = {
    flex: 1, minWidth: 80, padding: "11px 0", borderRadius: 4,
    border: "1.5px solid #c4cfee", background: "#fff", cursor: "pointer",
    fontFamily: "inherit", fontSize: 13, color: "#475569",
  };
  const btnPrimary = (bg: string): React.CSSProperties => ({
    flex: 2, minWidth: 150, padding: "11px 0", borderRadius: 4, border: "none",
    background: bg, color: "#fff", fontWeight: 700, cursor: "pointer",
    fontFamily: "inherit", fontSize: 13, letterSpacing: "0.02em",
  });
  const btnOutline = (color: string): React.CSSProperties => ({
    flex: 1, minWidth: 100, padding: "11px 0", borderRadius: 4,
    border: `1.5px solid ${color}`, background: "#fff",
    color, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", fontSize: 13,
  });
  const btnRed: React.CSSProperties = {
    flex: 1, minWidth: 100, padding: "11px 0", borderRadius: 4, border: "none",
    background: "#dc2626", color: "#fff", fontWeight: 700,
    cursor: "pointer", fontFamily: "inherit", fontSize: 13,
  };

  return (
    <>
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#f0f5ff", borderRadius: 8, width: "100%", maxWidth: 720,
        maxHeight: "94vh", overflowY: "auto",
        boxShadow: "0 24px 80px rgba(0,56,198,0.25), 0 4px 16px rgba(0,0,0,0.1)",
        border: "1px solid #c4cfee" }}>

        {/* ── Blue header ── */}
        <div style={{ background: "#0038C6", borderRadius: "8px 8px 0 0",
          padding: "28px 32px 24px", position: "relative", overflow: "hidden" }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", right: -40, top: -40, width: 160, height: 160,
            borderRadius: "50%", border: "32px solid rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: 60, bottom: -60, width: 120, height: 120,
            borderRadius: "50%", border: "24px solid rgba(255,255,255,0.04)", pointerEvents: "none" }} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, position: "relative", zIndex: 1 }}>
            <ScoreRing score={totalScore} />
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.5)", marginBottom: 8, textTransform: "uppercase" as const }}>
                ระบบประเมินพนักงานทดลองงาน
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" as const }}>
                <span style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderRadius: 4,
                  padding: "4px 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
                  fontFamily: "monospace" }}>
                  รอบ {ev.round} วัน
                </span>
                <StatusBadge status={ev.status} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.01em" }}>
                {ev.full_name}
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 6, lineHeight: 1.6 }}>
                {ev.position ?? "—"} · {ev.department_name ?? "—"} · {ev.division_name ?? "—"}
                {ev.start_date && <> · เริ่มงาน {ev.start_date}</>}
              </div>
            </div>
            <button onClick={onClose} style={{ border: "none", background: "rgba(255,255,255,0.15)",
              borderRadius: 6, width: 34, height: 34, cursor: "pointer", fontSize: 18,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, zIndex: 1 }}>×</button>
          </div>
        </div>

        {/* ── Workflow step bar ── */}
        <WorkflowSteps status={ev.status} />

        {/* ── Content ── */}
        <div style={{ padding: "24px 32px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Head topics card */}
          <div style={{ ...cardStyle }}>
            <div style={{ padding: "16px 20px 6px" }}>
              <SectionHeader color="#0038C6"
                label={`หัวหน้าแผนกประเมิน · ${headTopics.length} ข้อ`}
                note={!canEditHead ? (ev.status === "draft" ? "🔒 เฉพาะหัวหน้าแผนก" : "🔒 ดูเท่านั้น") : undefined} />
            </div>
            <div style={{ padding: "0 20px 16px" }}>
              {headTopics.map(t => (
                <TopicRow key={t.id} topic={t} score={scores[t.id] ?? 0}
                  onChange={v => setScores(p => ({ ...p, [t.id]: v }))}
                  locked={!canEditHead} />
              ))}
            </div>
          </div>

          {/* HR topics card */}
          <div style={{ ...cardStyle, borderLeftColor: "#7c3aed" }}>
            <div style={{ padding: "16px 20px 6px" }}>
              <SectionHeader color="#7c3aed" label="ฝ่ายบุคคลประเมิน · 3 ข้อ"
                note={!canEditHR ? "🔒 HR ประเมินในขั้นตอนที่ 3" : undefined} />
            </div>
            <div style={{ padding: "0 20px 16px" }}>
              {hrTopics.map(t => (
                <TopicRow key={t.id} topic={t} score={scores[t.id] ?? 0}
                  onChange={v => setScores(p => ({ ...p, [t.id]: v }))}
                  locked={!canEditHR} />
              ))}
            </div>
          </div>

          {/* Suggestion + Decision */}
          <div style={{ ...cardStyle, borderLeftColor: "#0038C6", padding: "20px" }}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#0038C6",
                letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                ข้อเสนอแนะ / ความเห็น (หัวหน้าแผนก)
              </label>
              <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)}
                readOnly={!canEditHead} rows={2}
                style={{ ...inp, resize: "vertical" as const, height: "auto",
                  background: canEditHead ? "#fff" : "#f8fafc" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#0038C6",
                letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                ผลการพิจารณา (หัวหน้าแผนก)
              </label>
              {canEditHead ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
                  {DECISIONS.map(d => (
                    <button key={d} onClick={() => setDecision(d)}
                      style={{ flex: 1, minWidth: 130, padding: "10px 8px", borderRadius: 4,
                        border: `2px solid ${decision === d ? DECISION_COLOR[d] : "#dce4f5"}`,
                        background: decision === d ? DECISION_COLOR[d] : "#fff",
                        color: decision === d ? "#fff" : "#64748b",
                        fontFamily: "inherit", fontSize: 12, fontWeight: 700, cursor: "pointer",
                        transition: "all .15s", letterSpacing: "0.01em" }}>
                      {d}
                    </button>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "10px 14px", background: "#f0f5ff", borderRadius: 4,
                  fontSize: 13, border: "1px solid #dce4f5",
                  color: ev.decision ? (DECISION_COLOR[ev.decision] ?? "#1e293b") : "#94a3b8",
                  fontWeight: ev.decision ? 700 : 400 }}>
                  {ev.decision || "—"}
                </div>
              )}
            </div>
          </div>

          {/* Note for deputy / final */}
          {(canDeputyAct || canFinalAct) && (
            <div style={{ background: "#fff8ed", border: "1px solid #fde68a",
              borderLeft: "4px solid #d97706", borderRadius: 4, padding: "16px 20px" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#b45309",
                letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                หมายเหตุการอนุมัติ (ถ้ามี)
              </label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                style={{ ...inp, resize: "vertical" as const, height: "auto",
                  borderColor: "#fde68a" }} />
            </div>
          )}

          {/* Note for HR */}
          {canHRAct && (
            <div style={{ background: "#faf5ff", border: "1px solid #ddd6fe",
              borderLeft: "4px solid #7c3aed", borderRadius: 4, padding: "16px 20px" }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#7c3aed",
                letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 8 }}>
                หมายเหตุ HR (ถ้ามี)
              </label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                style={{ ...inp, resize: "vertical" as const, height: "auto",
                  borderColor: "#ddd6fe" }} />
            </div>
          )}

          {/* Signatories */}
          <div style={{ ...cardStyle, borderLeftColor: "#16a34a", padding: "20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a",
              letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 14 }}>
              ✍️ ผู้ลงนาม
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
              {([
                { label: "พนักงานผู้รับการประเมิน", value: signerEmp,  set: setSignerEmp,  editable: canEditHead },
                { label: "หัวหน้าแผนก",             value: signerHead, set: setSignerHead, editable: canEditHead },
                { label: "ฝ่ายทรัพยากรบุคคล",      value: signerHR,   set: setSignerHR,   editable: canEditHR },
                { label: "รองผู้อำนวยการ",          value: signerDir,  set: setSignerDir,  editable: canFinalAct },
              ] as { label: string; value: string; set: (v: string) => void; editable: boolean }[]).map(({ label, value, set, editable }) => (
                <div key={label}>
                  <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#64748b",
                    letterSpacing: "0.08em", textTransform: "uppercase" as const, marginBottom: 6 }}>
                    {label}
                  </label>
                  <input value={value} onChange={e => set(e.target.value)}
                    readOnly={!editable} placeholder={editable ? "ชื่อ-นามสกุล" : "—"}
                    style={{ ...inp, fontSize: 12, background: editable ? "#fff" : "#f8fafc",
                      borderColor: editable ? "#c4cfee" : "#e8eeff" }} />
                </div>
              ))}
            </div>
          </div>

          {/* Approval timeline */}
          {approvals.length > 0 && (
            <div style={{ background: "#fff", border: "1px solid #dce4f5", borderRadius: 6,
              padding: "20px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#0038C6",
                letterSpacing: "0.1em", textTransform: "uppercase" as const, marginBottom: 16 }}>
                ประวัติการดำเนินการ
              </div>
              {approvals.map((a, i) => (
                <div key={i} style={{ display: "flex", gap: 12, position: "relative",
                  paddingBottom: i < approvals.length - 1 ? 16 : 0 }}>
                  {i < approvals.length - 1 && (
                    <div style={{ position: "absolute", left: 14, top: 28, bottom: 0,
                      width: 1, background: "#dce4f5" }} />
                  )}
                  <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: a.status === "approved" ? "#dcfce7" : "#fee2e2",
                    border: `1px solid ${a.status === "approved" ? "#bbf7d0" : "#fecaca"}`,
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12,
                    color: a.status === "approved" ? "#16a34a" : "#dc2626", fontWeight: 700 }}>
                    {a.status === "approved" ? "✓" : "✗"}
                  </div>
                  <div style={{ flex: 1, paddingTop: 3 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b" }}>
                      {STEP_LABEL[a.step] ?? a.step}
                      <span style={{ fontWeight: 400, color: "#64748b" }}> — {a.approver_name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: a.status === "approved" ? "#16a34a" : "#dc2626", marginTop: 2 }}>
                      {a.status === "approved" ? "✅ อนุมัติ / ดำเนินการ" : "❌ ไม่อนุมัติ"}
                      {a.note ? ` · ${a.note}` : ""}
                    </div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2, fontFamily: "monospace" }}>
                      {new Date(a.created_at).toLocaleDateString("th-TH", {
                        day: "numeric", month: "short", year: "2-digit",
                        hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ color: "#dc2626", fontSize: 12, padding: "10px 14px",
              background: "#fee2e2", borderRadius: 4, border: "1px solid #fecaca" }}>
              {error}
            </div>
          )}

          {/* ── Action buttons ── */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
            <button onClick={onClose} style={btnClose}>ปิด</button>

            {canPrint && (
              <button onClick={() => setShowPrint(true)}
                style={{ flex: 1, minWidth: 160, padding: "11px 0", borderRadius: 4,
                  border: "none", background: "#0038C6", color: "#fff", fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                🖨️ Print Evaluation Form
              </button>
            )}

            {canEditHead && (
              <>
                <button onClick={() => save("save")} disabled={saving} style={btnOutline("#0038C6")}>
                  💾 บันทึกร่าง
                </button>
                <button onClick={() => save("submit")} disabled={saving || !decision}
                  style={{ ...btnPrimary(decision ? "#0038C6" : "#94a3b8"),
                    cursor: decision ? "pointer" : "not-allowed" }}>
                  {saving ? "กำลังส่ง…" : "ส่งให้รองผู้อำนวยการ →"}
                </button>
              </>
            )}
            {canDeputyAct && (
              <>
                <button onClick={() => save("deputy_reject")} disabled={saving} style={btnRed}>
                  ✗ ไม่อนุมัติ
                </button>
                <button onClick={() => save("deputy_approve")} disabled={saving}
                  style={btnPrimary("#0038C6")}>
                  {saving ? "กำลังบันทึก…" : "✓ อนุมัติ → ส่ง HR"}
                </button>
              </>
            )}
            {canHRAct && (
              <>
                <button onClick={() => save("save")} disabled={saving} style={btnOutline("#7c3aed")}>
                  💾 บันทึกร่าง
                </button>
                <button onClick={() => save("hr_acknowledge")} disabled={saving}
                  style={btnPrimary("#7c3aed")}>
                  {saving ? "กำลังส่ง…" : "รับทราบและส่งต่อ →"}
                </button>
              </>
            )}
            {canFinalAct && (
              <>
                <button onClick={() => save("final_reject")} disabled={saving} style={btnRed}>
                  ✗ ไม่อนุมัติ
                </button>
                <button onClick={() => save("final_approve")} disabled={saving}
                  style={btnPrimary("#16a34a")}>
                  {saving ? "กำลังบันทึก…" : "✓ อนุมัติขั้นสุดท้าย"}
                </button>
              </>
            )}
          </div>

        </div>
      </div>
    </div>

    {showPrint && ev && (
      <PrintEvalModal evalId={ev.id} onClose={() => setShowPrint(false)} />
    )}
    </>
  );
}
