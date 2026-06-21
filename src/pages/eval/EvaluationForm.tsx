import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Topic { id: number; owner: string; text: string; sort_order: number; }
interface EvalDetail {
  id: number; round: number; status: string; grade: string | null; total_score: number | null;
  suggestion: string | null; decision: string | null; head_user_id: number | null;
  full_name: string; position: string | null; start_date: string | null;
  department_name: string | null; division_name: string | null;
}
interface ScoreRow { topic_id: number; score: number; text: string; owner: string; sort_order: number; }
interface Approval { step: string; status: string; note: string | null; created_at: string; approver_name: string; }

const GRADE_MAP = (score: number) => {
  if (score >= 90) return "A"; if (score >= 80) return "B+"; if (score >= 70) return "B";
  if (score >= 60) return "C+"; if (score >= 50) return "C"; return "D";
};

interface Props { evalId: number; onClose: () => void; onSaved: () => void; }

export default function EvaluationForm({ evalId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const [ev, setEv] = useState<EvalDetail | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [scores, setScores] = useState<Record<number, number>>({});
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [suggestion, setSuggestion] = useState("");
  const [decision, setDecision] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/eval/evaluations/${evalId}`).then(r => r.json()),
      fetch("/api/eval/topics").then(r => r.json()),
    ]).then(([evd, td]) => {
      const evData = evd as { ok: boolean; evaluation: EvalDetail; scores: ScoreRow[]; approvals: Approval[] };
      const tData = td as { ok: boolean; topics: Topic[] };
      setEv(evData.evaluation);
      setTopics(tData.topics);
      setApprovals(evData.approvals ?? []);
      setSuggestion(evData.evaluation.suggestion ?? "");
      setDecision(evData.evaluation.decision ?? "");
      const sc: Record<number, number> = {};
      evData.scores.forEach(s => { sc[s.topic_id] = s.score; });
      setScores(sc);
    });
  }, [evalId]);

  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const grade = GRADE_MAP(totalScore);

  const canEdit = user && ["hr", "head", "admin"].includes(user.role) && ev?.status === "draft";
  const canApprove = user && ["deputy", "deputyHR", "admin"].includes(user.role) && ev?.status === "pending_deputy";
  const isReadOnly = !canEdit && !canApprove;

  async function save(action: "save" | "submit" | "approve" | "reject") {
    setSaving(true); setError("");
    const r = await fetch(`/api/eval/evaluations/${evalId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, scores, suggestion, decision, grade, note }),
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

  const hrTopics = topics.filter(t => t.owner === "hr");
  const headTopics = topics.filter(t => t.owner === "head");

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 680, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
        {/* Header */}
        <div style={{ padding: "24px 28px 0", borderBottom: "1px solid #f1f5f9", paddingBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>ใบประเมินรอบ {ev.round} วัน</div>
              <div style={{ fontSize: 14, color: "#64748b", marginTop: 4 }}>{ev.full_name} · {ev.department_name ?? "—"} · {ev.division_name ?? "—"}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#16A34A" }}>{totalScore}<span style={{ fontSize: 13, fontWeight: 400, color: "#94a3b8" }}>/100</span></div>
              <div style={{ fontSize: 13, color: "#64748b" }}>เกรด <b>{grade}</b></div>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px 28px" }}>
          {/* HR topics (1-3) */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0038C6", marginBottom: 10 }}>หัวข้อที่ HR ประเมิน (ข้อ 1-3)</div>
          {hrTopics.map(t => (
            <ScoreRow key={t.id} topic={t} score={scores[t.id] ?? 0} onChange={v => setScores(prev => ({ ...prev, [t.id]: v }))} readOnly={isReadOnly || (user?.role === "head")} />
          ))}

          {/* Head topics (4-10) */}
          <div style={{ fontSize: 13, fontWeight: 700, color: "#16A34A", marginBottom: 10, marginTop: 18 }}>หัวข้อที่หัวหน้าประเมิน (ข้อ 4-10)</div>
          {headTopics.map(t => (
            <ScoreRow key={t.id} topic={t} score={scores[t.id] ?? 0} onChange={v => setScores(prev => ({ ...prev, [t.id]: v }))} readOnly={isReadOnly || (!!user && user.role === "hr")} />
          ))}

          {/* Suggestion & Decision */}
          <div style={{ marginTop: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>ข้อเสนอแนะ</label>
            <textarea value={suggestion} onChange={e => setSuggestion(e.target.value)} readOnly={isReadOnly}
              rows={2} style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit", resize: "vertical" }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>ผลการตัดสิน</label>
            {canEdit ? (
              <div style={{ display: "flex", gap: 8 }}>
                {["ผ่านทดลองงาน", "ทดลองงานต่อ", "ยุติการจ้าง"].map(d => (
                  <button key={d} onClick={() => setDecision(d)} style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: "1.5px solid", borderColor: decision === d ? "#16A34A" : "#e2e8f0", background: decision === d ? "#16A34A" : "#fff", color: decision === d ? "#fff" : "#475569", fontFamily: "inherit", fontSize: 13, cursor: "pointer" }}>{d}</button>
                ))}
              </div>
            ) : (
              <div style={{ padding: "9px 12px", background: "#f8fafc", borderRadius: 9, fontSize: 14 }}>{ev.decision ?? "—"}</div>
            )}
          </div>

          {/* Deputy note */}
          {canApprove && (
            <div style={{ marginTop: 12 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: "#475569", display: "block", marginBottom: 6 }}>หมายเหตุการอนุมัติ (ถ้ามี)</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                style={{ width: "100%", padding: "9px 12px", borderRadius: 9, border: "1.5px solid #e2e8f0", fontSize: 14, fontFamily: "inherit" }} />
            </div>
          )}

          {/* Approval history */}
          {approvals.length > 0 && (
            <div style={{ marginTop: 16, background: "#f8fafc", borderRadius: 10, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>ประวัติการอนุมัติ</div>
              {approvals.map((a, i) => (
                <div key={i} style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>
                  <b>{a.step === "head" ? "หัวหน้า" : "รองผอ."}</b> {a.approver_name} — {a.status === "approved" ? "✅ อนุมัติ" : "❌ ไม่อนุมัติ"}{a.note ? ` (${a.note})` : ""}
                </div>
              ))}
            </div>
          )}

          {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 12 }}>{error}</div>}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontFamily: "inherit" }}>ปิด</button>
            {canEdit && (
              <>
                <button onClick={() => save("save")} disabled={saving} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #16A34A", background: "#fff", color: "#16A34A", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  บันทึกร่าง
                </button>
                <button onClick={() => save("submit")} disabled={saving || !decision} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: decision ? "#16A34A" : "#94a3b8", color: "#fff", fontWeight: 700, cursor: decision ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                  {saving ? "กำลังส่ง…" : "ส่งขออนุมัติ →"}
                </button>
              </>
            )}
            {canApprove && (
              <>
                <button onClick={() => save("reject")} disabled={saving} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#ef4444", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  ไม่อนุมัติ
                </button>
                <button onClick={() => save("approve")} disabled={saving} style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: "#16A34A", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
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

function ScoreRow({ topic, score, onChange, readOnly }: { topic: Topic; score: number; onChange: (v: number) => void; readOnly: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10, padding: "10px 14px", background: "#f8fafc", borderRadius: 10 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: topic.owner === "hr" ? "#0038C6" : "#16A34A", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
        {topic.id}
      </div>
      <div style={{ flex: 1, fontSize: 13 }}>{topic.text}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {readOnly ? (
          <span style={{ fontWeight: 700, fontSize: 15, color: "#16A34A", minWidth: 28, textAlign: "center" }}>{score}</span>
        ) : (
          <input type="number" min={0} max={10} value={score} onChange={e => onChange(Math.min(10, Math.max(0, Number(e.target.value))))}
            style={{ width: 52, padding: "5px 8px", borderRadius: 7, border: "1.5px solid #e2e8f0", fontSize: 14, textAlign: "center", fontFamily: "inherit" }} />
        )}
        <span style={{ fontSize: 12, color: "#94a3b8" }}>/10</span>
      </div>
    </div>
  );
}
