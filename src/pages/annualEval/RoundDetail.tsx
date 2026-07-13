import { useEffect, useState } from "react";
import { useAuth, hasRole } from "../../context/AuthContext";
import AnnualEvalForm from "./AnnualEvalForm";

interface Round {
  id: number; year_be: number; name: string; start_date: string; end_date: string;
  status: "draft" | "open" | "closed" | "cancelled";
}
interface EvalRow {
  id: number; employee_id: number; template_id: number;
  snap_full_name: string; snap_emp_code: string | null; snap_position: string | null;
  snap_department: string | null; snap_division: string | null; snap_job_level: number;
  status: string; total_weighted_score: number | null; grade: string | null;
}
interface Props { roundId: number; onBack: () => void; }

export const EVAL_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  not_started: { label: "ยังไม่เริ่มประเมิน", bg: "#f1f5f9", color: "#94a3b8" },
  pending_head: { label: "รอหัวหน้าแผนกประเมิน", bg: "#fff3cd", color: "#b45309" },
  pending_deputy: { label: "รอรองผู้อำนวยการฝ่ายประเมิน", bg: "#fed7aa", color: "#c2410c" },
  pending_quality: { label: "รอส่วนงานคุณภาพประเมิน", bg: "#ede9fe", color: "#7c3aed" },
  pending_hr: { label: "รอ HR ประเมิน", bg: "#dbeafe", color: "#1d4ed8" },
  pending_director: { label: "รอผู้อำนวยการประเมิน", bg: "#fce7f3", color: "#be185d" },
  pending_summary: { label: "รอสรุปผล", bg: "#e8eeff", color: "#0038C6" },
  completed: { label: "เสร็จสมบูรณ์", bg: "#dcfce7", color: "#16a34a" },
  returned: { label: "ส่งกลับแก้ไข", bg: "#fee2e2", color: "#dc2626" },
  cancelled: { label: "ยกเลิกการประเมิน", bg: "#f1f5f9", color: "#94a3b8" },
};

const ROUND_STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "แบบร่าง", bg: "#f1f5f9", color: "#64748b" },
  open: { label: "เปิดรับการประเมิน", bg: "#dcfce7", color: "#16a34a" },
  closed: { label: "ปิดรอบแล้ว", bg: "#e8eeff", color: "#0038C6" },
  cancelled: { label: "ยกเลิก", bg: "#fee2e2", color: "#dc2626" },
};

export default function RoundDetail({ roundId, onBack }: Props) {
  const { user } = useAuth();
  const [round, setRound] = useState<Round | null>(null);
  const [evals, setEvals] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEvalId, setOpenEvalId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const canManage = hasRole(user, "hr", "deputyHR", "admin");

  function load() {
    setLoading(true);
    fetch(`/api/annual-eval/rounds/${roundId}`).then(r => r.json())
      .then((d: { ok: boolean; round: Round; evaluations: EvalRow[] }) => {
        setRound(d.round); setEvals(d.evaluations ?? []);
      })
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, [roundId]);

  async function roundAction(action: "open" | "close" | "cancel") {
    if (action === "cancel" && !confirm("ยืนยันยกเลิกรอบประเมินนี้ทั้งหมด?")) return;
    setBusy(true);
    const r = await fetch(`/api/annual-eval/rounds/${roundId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setBusy(false);
    if (!d.ok) { alert(d.error ?? "เกิดข้อผิดพลาด"); return; }
    load();
  }

  const filtered = evals.filter(e =>
    !search || e.snap_full_name.toLowerCase().includes(search.toLowerCase()) ||
    (e.snap_emp_code ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading || !round) return <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>;
  const meta = ROUND_STATUS_META[round.status];

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#0038C6",
        fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 14,
        display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
        ‹ กลับไปยังรายการรอบประเมิน
      </button>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start",
        marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>{round.name}</span>
            <span style={{ background: meta.bg, color: meta.color, borderRadius: 20,
              padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
          </div>
          <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
            ปี {round.year_be} · {round.start_date} ถึง {round.end_date} · {evals.length} คน
          </div>
        </div>
        {canManage && (
          <div style={{ display: "flex", gap: 8 }}>
            {round.status === "draft" && (
              <button onClick={() => roundAction("open")} disabled={busy}
                style={{ padding: "9px 18px", borderRadius: 8, border: "none", background: "#16a34a",
                  color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                เปิดรอบประเมิน
              </button>
            )}
            {round.status === "open" && (
              <button onClick={() => roundAction("close")} disabled={busy}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1.5px solid #c4cfee", background: "#fff",
                  color: "#0038C6", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                ปิดรอบ
              </button>
            )}
            {(round.status === "draft" || round.status === "open") && (
              <button onClick={() => roundAction("cancel")} disabled={busy}
                style={{ padding: "9px 18px", borderRadius: 8, border: "1.5px solid #fecaca", background: "#fff",
                  color: "#dc2626", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                ยกเลิกรอบ
              </button>
            )}
          </div>
        )}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อหรือรหัสพนักงาน…"
        style={{ padding: "9px 16px", borderRadius: 7, border: "1.5px solid #c4cfee", fontSize: 13,
          fontFamily: "inherit", width: 260, outline: "none", marginBottom: 16 }} />

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", background: "#fff", borderRadius: 14 }}>
          ไม่พบพนักงานในรอบนี้
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(ev => {
            const sm = EVAL_STATUS_META[ev.status] ?? EVAL_STATUS_META.not_started;
            const initial = ev.snap_full_name.charAt(0);
            return (
              <div key={ev.id} onClick={() => setOpenEvalId(ev.id)}
                style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 6px rgba(0,0,0,.06)",
                  border: "1px solid #f1f5f9", padding: "14px 18px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#0038C6",
                  color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 14, flexShrink: 0 }}>{initial}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "#0f172a" }}>{ev.snap_full_name}</span>
                    {ev.snap_emp_code && (
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#0038C6", background: "#f0f5ff",
                        border: "1px solid #c4cfee", borderRadius: 5, padding: "1px 7px" }}>{ev.snap_emp_code}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 2 }}>
                    {ev.snap_position ?? "—"} · {ev.snap_department ?? "—"} · ระดับ {ev.snap_job_level}
                  </div>
                </div>
                {ev.status === "completed" && ev.total_weighted_score != null && (
                  <span style={{ background: "#dcfce7", color: "#16a34a", borderRadius: 20,
                    padding: "4px 12px", fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                    {ev.total_weighted_score} · {ev.grade}
                  </span>
                )}
                <span style={{ background: sm.bg, color: sm.color, borderRadius: 20,
                  padding: "4px 12px", fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>
                  {sm.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {openEvalId !== null && (
        <AnnualEvalForm evalId={openEvalId} onClose={() => setOpenEvalId(null)}
          onSaved={() => { setOpenEvalId(null); load(); }} />
      )}
    </div>
  );
}
