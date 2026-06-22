import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Topic { id: number; owner: string; text: string; sort_order: number; }
interface EvalDetail {
  id: number; round: number; status: string; grade: string | null; total_score: number | null;
  suggestion: string | null; decision: string | null;
  signer_employee: string | null; signer_head: string | null;
  signer_hr: string | null; signer_director: string | null;
  full_name: string; position: string | null; start_date: string | null;
  department_name: string | null; division_name: string | null;
}
interface ScoreRow { topic_id: number; score: number; text: string; owner: string; }
interface Approval { step: string; status: string; note: string | null; created_at: string; approver_name: string; }

interface Props { evalId: number; onClose: () => void; onSaved: () => void; }

// Grade A–F from raw score out of 100
function gradeFromScore(s: number): string {
  if (s >= 90) return "A";
  if (s >= 80) return "B";
  if (s >= 70) return "C";
  if (s >= 60) return "D";
  if (s >= 50) return "E";
  return "F";
}

const GRADE_COLOR: Record<string, string> = {
  A: "#16a34a", B: "#0891b2", C: "#f59e0b", D: "#f97316", E: "#ef4444", F: "#991b1b",
};

function ScoreRing({ score, maxScore = 100 }: { score: number; maxScore?: number }) {
  const r = 48, circ = 2 * Math.PI * r;
  const pct = Math.min(score / maxScore, 1);
  const offset = circ * (1 - pct);
  const grade = gradeFromScore(score);
  const color = GRADE_COLOR[grade] ?? "#94a3b8";
  return (
    <div style={{ position: "relative", width: 120, height: 120, flexShrink: 0 }}>
      <svg viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)", width: 120, height: 120 }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: "stroke-dashoffset .5s ease" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 1 }}>
        <div style={{ fontSize: 24, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>/{maxScore}</div>
        <div style={{ fontSize: 15, fontWeight: 800, color }}>เกรด {grade}</div>
      </div>
    </div>
  );
}

export default function EvaluationForm({ evalId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [ev, setEv]           = useState<EvalDetail | null>(null);
  const [topics, setTopics]   = useState<Topic[]>([]);
  const [scores, setScores]   = useState<Record<number, number>>({});
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

  useEffect(() => {
    Promise.all([
      fetch(`/api/eval/evaluations/${evalId}`).then(r => r.json()),
      fetch("/api/eval/topics").then(r => r.json()),
    ]).then(([evd, td]) => {
      const evData = evd as { ok: boolean; evaluation: EvalDetail; scores: ScoreRow[]; approvals: Approval[] };
      const tData  = td as { ok: boolean; topics: Topic[] };
      setEv(evData.evaluation);
      setTopics(tData.topics);
      setApprovals(evData.approvals ?? []);
      setSuggestion(evData.evaluation.suggestion ?? "");
      setDecision(evData.evaluation.decision ?? "");
      setSignerEmp(evData.evaluation.signer_employee ?? "");
      setSignerHead(evData.evaluation.signer_head ?? "");
      setSignerHR(evData.evaluation.signer_hr ?? "");
      setSignerDir(evData.evaluation.signer_director ?? "");
      const sc: Record<number, number> = {};
      evData.scores.forEach(s => { sc[s.topic_id] = s.score; });
      setScores(sc);
    });
  }, [evalId]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const grade      = gradeFromScore(totalScore);

  const isHR      = user && ["hr", "admin"].includes(user.role);
  const isHead    = user && ["head", "admin"].includes(user.role);
  const canEdit   = !!(user && ["hr", "head", "admin"].includes(user.role) && ev?.status === "draft");
  const canApprove = !!(user && ["deputy", "deputyHR", "admin"].includes(user.role) && ev?.status === "pending_deputy");

  async function save(action: "save" | "submit" | "approve" | "reject") {
    setSaving(true); setError("");
    const r = await fetch(`/api/eval/evaluations/${evalId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action, scores, suggestion, decision, grade, note,
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
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 40 }}>กำลังโหลด…</div>
    </div>
  );

  const hrTopics   = topics.filter(t => t.owner === "hr");
  const headTopics = topics.filter(t => t.owner === "head");

  const DECISIONS = ["ผ่านทดลองงาน", "ทดลองงานต่อ", "ยุติการจ้าง"];
  const DECISION_COLOR: Record<string, string> = {
    "ผ่านทดลองงาน": "#16a34a", "ทดลองงานต่อ": "#f59e0b", "ยุติการจ้าง": "#dc2626",
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 700,
        maxHeight: "94vh", overflowY: "auto", boxShadow: "0 32px 80px rgba(0,0,0,.3)" }}>

        {/* ── Header ── */}
        <div style={{ padding: "22px 28px 18px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
            <ScoreRing score={totalScore} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ background: "#0038C622", color: "#0038C6", borderRadius: 20,
                  padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>รอบ {ev.round} วัน</span>
                <StatusBadge status={ev.status} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{ev.full_name}</div>
              <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                {ev.position ?? "—"} · {ev.department_name ?? "—"} · {ev.division_name ?? "—"}
              </div>
              {ev.start_date && (
                <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
                  เริ่มงาน {ev.start_date}
                </div>
              )}
            </div>
            <button onClick={onClose} style={{ border: "none", background: "#f1f5f9", borderRadius: 10,
              width: 36, height: 36, cursor: "pointer", fontSize: 20, display: "flex",
              alignItems: "center", justifyContent: "center", color: "#64748b", flexShrink: 0 }}>×</button>
          </div>
        </div>

        <div style={{ padding: "20px 28px" }}>

          {/* ── HR Topics (1-3) ── */}
          <SectionHeader color="#0038C6" label="หัวข้อฝ่ายบุคคลประเมิน (ข้อ 1–3)"
            note={!isHR ? "🔒 เฉพาะ HR เท่านั้น" : undefined} />
          {hrTopics.map(t => (
            <TopicRow key={t.id} topic={t} score={scores[t.id] ?? 0}
              onChange={v => setScores(p => ({ ...p, [t.id]: v }))}
              locked={!canEdit || !isHR} />
          ))}

          {/* ── Head Topics (4-10) ── */}
          <SectionHeader color="#16A34A" label="หัวข้อหัวหน้าแผนกประเมิน (ข้อ 4–10)"
            note={!isHead ? "🔒 เฉพาะหัวหน้าแผนกเท่านั้น" : undefined}
            style={{ marginTop: 20 }} />
          {headTopics.map(t => (
            <TopicRow key={t.id} topic={t} score={scores[t.id] ?? 0}
              onChange={v => setScores(p => ({ ...p, [t.id]: v }))}
              locked={!canEdit || !isHead} />
          ))}

          {/* ── Suggestion ── */}
          <div style={{ marginTop: 22, borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
            <label style={labelStyle}>ข้อเสนอแนะ / ความเห็นเพิ่มเติม</label>
            <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)}
              readOnly={!canEdit}
              rows={3} style={{ ...inputStyle, resize: "vertical", height: "auto" }} />
          </div>

          {/* ── Decision ── */}
          <div style={{ marginTop: 16 }}>
            <label style={labelStyle}>ผลการพิจารณา</label>
            {canEdit ? (
              <div style={{ display: "flex", gap: 8 }}>
                {DECISIONS.map(d => (
                  <button key={d} onClick={() => setDecision(d)}
                    style={{ flex: 1, padding: "10px 4px", borderRadius: 10, border: "2px solid",
                      borderColor: decision === d ? DECISION_COLOR[d] : "#e2e8f0",
                      background: decision === d ? DECISION_COLOR[d] : "#fff",
                      color: decision === d ? "#fff" : "#475569",
                      fontFamily: "inherit", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      transition: "all .15s" }}>
                    {d}
                  </button>
                ))}
              </div>
            ) : (
              <div style={{ padding: "10px 14px", background: "#f8fafc", borderRadius: 10, fontSize: 14,
                color: ev.decision ? (DECISION_COLOR[ev.decision] ?? "#1e293b") : "#94a3b8",
                fontWeight: ev.decision ? 700 : 400 }}>
                {ev.decision || "—"}
              </div>
            )}
          </div>

          {/* ── Signatories ── */}
          <div style={{ marginTop: 22, borderTop: "1px solid #f1f5f9", paddingTop: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 14 }}>
              ✍️ ผู้ลงนาม
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
              {[
                { label: "พนักงานผู้รับการประเมิน", value: signerEmp, set: setSignerEmp },
                { label: "หัวหน้าแผนก",             value: signerHead, set: setSignerHead },
                { label: "ฝ่ายทรัพยากรบุคคล",      value: signerHR,   set: setSignerHR },
                { label: "รองผู้อำนวยการ",          value: signerDir,  set: setSignerDir },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label style={{ ...labelStyle, fontSize: 11, textTransform: "uppercase",
                    letterSpacing: "0.05em" }}>{label}</label>
                  <input value={value} onChange={e => set(e.target.value)}
                    readOnly={!canEdit && !canApprove}
                    placeholder={canEdit || canApprove ? "ชื่อ-นามสกุล" : "—"}
                    style={{ ...inputStyle, fontSize: 13 }} />
                </div>
              ))}
            </div>
          </div>

          {/* ── Deputy approve note ── */}
          {canApprove && (
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle}>หมายเหตุการอนุมัติ (ถ้ามี)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                style={{ ...inputStyle, resize: "vertical", height: "auto" }} />
            </div>
          )}

          {/* ── Approval Timeline ── */}
          {approvals.length > 0 && (
            <div style={{ marginTop: 20, borderTop: "1px solid #f1f5f9", paddingTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 12 }}>
                ประวัติการดำเนินการ
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {approvals.map((a, i) => (
                  <div key={i} style={{ display: "flex", gap: 12, position: "relative",
                    paddingBottom: i < approvals.length - 1 ? 14 : 0 }}>
                    {/* Timeline line */}
                    {i < approvals.length - 1 && (
                      <div style={{ position: "absolute", left: 15, top: 30, bottom: 0,
                        width: 2, background: "#e2e8f0" }} />
                    )}
                    <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                      background: a.status === "approved" ? "#dcfce7" : "#fee2e2",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                      {a.status === "approved" ? "✓" : "✗"}
                    </div>
                    <div style={{ flex: 1, paddingTop: 4 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>
                        {a.step === "head" ? "หัวหน้าแผนก" : "รองผู้อำนวยการ"} — {a.approver_name}
                      </div>
                      <div style={{ fontSize: 12, color: a.status === "approved" ? "#16a34a" : "#dc2626" }}>
                        {a.status === "approved" ? "✅ อนุมัติ" : "❌ ไม่อนุมัติ"}
                        {a.note ? ` · ${a.note}` : ""}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                        {new Date(a.created_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</div>}

          {/* ── Action Buttons ── */}
          <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 10,
              border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer",
              fontFamily: "inherit", fontSize: 14 }}>ปิด</button>

            {canEdit && (
              <>
                <button onClick={() => save("save")} disabled={saving}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "1.5px solid #16A34A",
                    background: "#fff", color: "#16A34A", fontWeight: 600, cursor: "pointer",
                    fontFamily: "inherit", fontSize: 14 }}>
                  💾 บันทึกร่าง
                </button>
                <button onClick={() => save("submit")} disabled={saving || !decision}
                  style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none",
                    background: decision ? "#16A34A" : "#94a3b8",
                    color: "#fff", fontWeight: 700, cursor: decision ? "pointer" : "not-allowed",
                    fontFamily: "inherit", fontSize: 14 }}>
                  {saving ? "กำลังส่ง…" : "ส่งขออนุมัติ →"}
                </button>
              </>
            )}
            {canApprove && (
              <>
                <button onClick={() => save("reject")} disabled={saving}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none",
                    background: "#ef4444", color: "#fff", fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>
                  ✗ ไม่อนุมัติ
                </button>
                <button onClick={() => save("approve")} disabled={saving}
                  style={{ flex: 2, padding: "11px 0", borderRadius: 10, border: "none",
                    background: "#16A34A", color: "#fff", fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>
                  {saving ? "กำลังอนุมัติ…" : "✓ อนุมัติ"}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ──

function SectionHeader({ color, label, note, style }: { color: string; label: string; note?: string; style?: React.CSSProperties }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, ...style }}>
      <div style={{ width: 4, height: 18, borderRadius: 2, background: color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, fontWeight: 700, color }}>{label}</span>
      {note && <span style={{ fontSize: 11, color: "#94a3b8", background: "#f8fafc",
        borderRadius: 6, padding: "2px 8px" }}>{note}</span>}
    </div>
  );
}

function TopicRow({ topic, score, onChange, locked }: {
  topic: Topic; score: number; onChange: (v: number) => void; locked: boolean;
}) {
  const color = topic.owner === "hr" ? "#0038C6" : "#16A34A";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
      padding: "10px 14px", background: locked ? "#f8fafc" : "#fff",
      borderRadius: 10, border: `1px solid ${locked ? "#f1f5f9" : "#e2e8f0"}` }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", background: color + "22",
        color, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
        {topic.id}
      </div>
      <div style={{ flex: 1, fontSize: 13, color: locked ? "#94a3b8" : "#334155" }}>
        {topic.text}
      </div>
      {locked ? (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 16 }}>🔒</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#94a3b8", minWidth: 28, textAlign: "center" }}>
            {score || "—"}
          </span>
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>/10</span>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="number" min={0} max={10} value={score}
            onChange={e => onChange(Math.min(10, Math.max(0, Number(e.target.value))))}
            style={{ width: 56, padding: "5px 8px", borderRadius: 8, border: "1.5px solid #e2e8f0",
              fontSize: 15, textAlign: "center", fontFamily: "inherit", fontWeight: 700,
              color, outline: "none" }} />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>/10</span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    draft:         { label: "ร่าง",          bg: "#f1f5f9", color: "#64748b" },
    pending_deputy:{ label: "รออนุมัติรอง",  bg: "#dbeafe", color: "#1d4ed8" },
    approved:      { label: "อนุมัติแล้ว",   bg: "#dcfce7", color: "#16a34a" },
    rejected:      { label: "ไม่อนุมัติ",   bg: "#fee2e2", color: "#dc2626" },
  };
  const s = map[status] ?? { label: status, bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20,
      padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{s.label}</span>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 13, fontWeight: 600, color: "#475569", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0",
  fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
};
