import { useEffect, useState } from "react";
import { useAuth, hasRole } from "../../context/AuthContext";
import RoundDetail from "./RoundDetail";

interface Round {
  id: number; year_be: number; name: string; start_date: string; end_date: string;
  status: "draft" | "open" | "closed" | "cancelled";
  scope_division_id: number | null; scope_department_id: number | null;
  created_by: string | null; created_at: string;
  progress: Record<string, number>;
}
interface Division { id: number; name: string; }
interface Department { id: number; division_id: number; name: string; }

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft: { label: "แบบร่าง", bg: "#f1f5f9", color: "#64748b" },
  open: { label: "เปิดรับการประเมิน", bg: "#dcfce7", color: "#16a34a" },
  closed: { label: "ปิดรอบแล้ว", bg: "#e8eeff", color: "#0038C6" },
  cancelled: { label: "ยกเลิก", bg: "#fee2e2", color: "#dc2626" },
};

function ProgressBar({ progress }: { progress: Record<string, number> }) {
  const total = Object.values(progress).reduce((a, b) => a + b, 0);
  const completed = progress.completed ?? 0;
  const cancelled = progress.cancelled ?? 0;
  const pending = total - completed - cancelled;
  if (total === 0) return null;
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", background: "#f1f5f9" }}>
        <div style={{ width: pct(completed), background: "#16a34a" }} />
        <div style={{ width: pct(pending), background: "#26A9E0" }} />
        <div style={{ width: pct(cancelled), background: "#cbd5e1" }} />
      </div>
      <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
        เสร็จสมบูรณ์ {completed} / ทั้งหมด {total} คน
      </div>
    </div>
  );
}

function CreateRoundModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [yearBe, setYearBe] = useState(String(new Date().getFullYear() + 543));
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [scopeDivision, setScopeDivision] = useState("");
  const [scopeDepartment, setScopeDepartment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [missingLevel, setMissingLevel] = useState<{ id: number; full_name: string; emp_code: string | null }[]>([]);

  useEffect(() => {
    fetch("/api/eval/org").then(r => r.json())
      .then((d: { ok: boolean; divisions: Division[]; departments: Department[] }) => {
        setDivisions(d.divisions ?? []); setDepartments(d.departments ?? []);
      });
  }, []);

  async function submit() {
    setSaving(true); setError(""); setMissingLevel([]);
    const r = await fetch("/api/annual-eval/rounds", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        year_be: Number(yearBe), name, start_date: startDate, end_date: endDate,
        scope_division_id: scopeDivision ? Number(scopeDivision) : null,
        scope_department_id: scopeDepartment ? Number(scopeDepartment) : null,
      }),
    });
    const d = await r.json() as { ok: boolean; error?: string; missing_level_employees?: typeof missingLevel };
    setSaving(false);
    if (!d.ok) {
      setError(d.error ?? "เกิดข้อผิดพลาด");
      if (d.missing_level_employees) setMissingLevel(d.missing_level_employees);
      return;
    }
    onCreated();
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 8, border: "1.5px solid #dce4f5",
    fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box",
  };
  const label: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: "#334155", display: "block", marginBottom: 5 };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)",
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 520,
        maxHeight: "90vh", overflowY: "auto", boxShadow: "0 24px 80px rgba(0,56,198,0.25)" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 16, color: "#0f172a" }}>
          สร้างรอบประเมินประจำปีใหม่
        </div>
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={label}>ปี พ.ศ.</label>
            <input style={inp} value={yearBe} onChange={e => setYearBe(e.target.value)} placeholder="2569" />
          </div>
          <div>
            <label style={label}>ชื่อรอบ</label>
            <input style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="เช่น ประเมินประจำปี 2569" />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>วันที่เริ่มต้น</label>
              <input type="date" style={inp} value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>วันที่สิ้นสุด</label>
              <input type="date" style={inp} value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={label}>ฝ่าย (ไม่ระบุ = ทุกฝ่าย)</label>
              <select style={inp} value={scopeDivision} onChange={e => { setScopeDivision(e.target.value); setScopeDepartment(""); }}>
                <option value="">ทุกฝ่าย</option>
                {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={label}>แผนก (ไม่ระบุ = ทุกแผนก)</label>
              <select style={inp} value={scopeDepartment} onChange={e => setScopeDepartment(e.target.value)}>
                <option value="">ทุกแผนก</option>
                {departments
                  .filter(d => !scopeDivision || String(d.division_id) === scopeDivision)
                  .map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
              padding: "10px 14px", fontSize: 13, color: "#dc2626" }}>
              {error}
              {missingLevel.length > 0 && (
                <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                  {missingLevel.slice(0, 10).map(e => (
                    <li key={e.id} style={{ fontSize: 12 }}>{e.full_name} {e.emp_code ? `(${e.emp_code})` : ""}</li>
                  ))}
                  {missingLevel.length > 10 && <li style={{ fontSize: 12 }}>และอีก {missingLevel.length - 10} คน…</li>}
                </ul>
              )}
            </div>
          )}
        </div>
        <div style={{ padding: "16px 24px", borderTop: "1px solid #f1f5f9", display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: 9,
            border: "1.5px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 700,
            fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
            ยกเลิก
          </button>
          <button onClick={submit} disabled={saving || !name || !startDate || !endDate}
            style={{ flex: 2, padding: "11px 0", borderRadius: 9, border: "none",
              background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 14,
              cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit",
              opacity: saving || !name || !startDate || !endDate ? 0.6 : 1 }}>
            {saving ? "กำลังสร้าง…" : "สร้างรอบประเมิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RoundsList() {
  const { user } = useAuth();
  const [rounds, setRounds] = useState<Round[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openRoundId, setOpenRoundId] = useState<number | null>(null);

  const canManage = hasRole(user, "hr", "deputyHR", "admin");

  function load() {
    setLoading(true);
    fetch("/api/annual-eval/rounds").then(r => r.json())
      .then((d: { ok: boolean; rounds: Round[] }) => setRounds(d.rounds ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  if (openRoundId !== null) {
    return <RoundDetail roundId={openRoundId} onBack={() => { setOpenRoundId(null); load(); }} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#334155" }}>รอบประเมินทั้งหมด</div>
        {canManage && (
          <button onClick={() => setShowCreate(true)}
            style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: "#0038C6",
              color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
              boxShadow: "0 2px 8px rgba(0,56,198,0.25)" }}>
            + สร้างรอบประเมินใหม่
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : rounds.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8", background: "#fff", borderRadius: 14 }}>
          ยังไม่มีรอบประเมินประจำปี
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {rounds.map(round => {
            const meta = STATUS_META[round.status];
            return (
              <div key={round.id} onClick={() => setOpenRoundId(round.id)}
                style={{ background: "#fff", borderRadius: 16, boxShadow: "0 1px 6px rgba(0,0,0,.07)",
                  border: "1px solid #f1f5f9", padding: "16px 20px", cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>{round.name}</span>
                      <span style={{ background: meta.bg, color: meta.color, borderRadius: 20,
                        padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#64748b", marginTop: 4 }}>
                      ปี {round.year_be} · {round.start_date} ถึง {round.end_date}
                    </div>
                  </div>
                  <span style={{ color: "#c4cfee", fontSize: 20 }}>›</span>
                </div>
                <ProgressBar progress={round.progress} />
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateRoundModal onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }} />
      )}
    </div>
  );
}
