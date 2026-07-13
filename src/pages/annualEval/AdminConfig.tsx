import { useEffect, useState } from "react";

interface UserRow { id: number; full_name: string; role: string; is_active: number; }
interface RoleAssign { user_id: number | null; full_name: string | null }
interface Band { id: number; metric: string; level_group: string | null; min_value: number | null; max_value: number | null; score: number; sort_order: number; }

const METRIC_LABEL: Record<string, string> = {
  sick_leave: "ลาป่วย (วัน)", personal_leave: "ลากิจ (วัน)", vacation_leave: "ลาพักผ่อน (วัน)",
  late_minutes: "มาสาย (นาที)", training_count: "จำนวนหลักสูตรอบรม", hospital_activity: "กิจกรรมโรงพยาบาล",
  committee: "คณะกรรมการ",
};

function RoleAssignCard({ roleKey, label }: { roleKey: "quality_head" | "director"; label: string }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [current, setCurrent] = useState<RoleAssign | null>(null);
  const [selected, setSelected] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(r => r.json()).catch(() => ({ ok: false })),
      fetch("/api/annual-eval/roles").then(r => r.json()),
    ]).then(([u, r]: [{ ok: boolean; users?: UserRow[] }, { ok: boolean; roles: Record<string, RoleAssign> }]) => {
      if (u.ok) setUsers((u.users ?? []).filter(x => x.is_active));
      if (r.ok) {
        const cur = r.roles[roleKey];
        setCurrent(cur);
        setSelected(cur?.user_id ? String(cur.user_id) : "");
      }
    });
  }, [roleKey]);

  async function save() {
    setSaving(true); setError("");
    const r = await fetch("/api/annual-eval/roles", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role_key: roleKey, user_id: selected ? Number(selected) : null }),
    });
    const d = await r.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setCurrent({ user_id: selected ? Number(selected) : null, full_name: users.find(u => String(u.id) === selected)?.full_name ?? null });
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #dce4f5", borderRadius: 6,
      borderLeft: "4px solid #7c3aed", padding: "16px 20px" }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>
        ปัจจุบัน: {current?.full_name ?? "ยังไม่กำหนด"}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <select value={selected} onChange={e => setSelected(e.target.value)}
          style={{ flex: 1, padding: "8px 10px", borderRadius: 6, border: "1.5px solid #dce4f5", fontSize: 13, fontFamily: "inherit" }}>
          <option value="">-- ไม่กำหนด --</option>
          {users.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
        </select>
        <button onClick={save} disabled={saving}
          style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#7c3aed",
            color: "#fff", fontWeight: 700, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </button>
      </div>
      {error && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function ScoreBandGroup({ metric, levelGroup, bands, onSaved }: {
  metric: string; levelGroup: string | null; bands: Band[]; onSaved: () => void;
}) {
  const [rows, setRows] = useState(bands.map(b => ({ min_value: b.min_value, max_value: b.max_value, score: b.score, sort_order: b.sort_order })));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/annual-eval/score-bands", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metric, level_group: levelGroup, bands: rows }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ background: "#fff", border: "1px solid #dce4f5", borderRadius: 6, padding: "14px 18px" }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0038C6", marginBottom: 10 }}>
        {METRIC_LABEL[metric] ?? metric} {levelGroup ? `· ระดับ ${levelGroup}` : "· ทุกระดับ"}
      </div>
      {rows.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
          <input type="number" placeholder="ต่ำสุด" value={b.min_value ?? ""}
            onChange={e => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, min_value: e.target.value === "" ? null : Number(e.target.value) } : r))}
            style={{ width: 80, padding: "6px 8px", borderRadius: 4, border: "1.5px solid #dce4f5", fontSize: 12.5, fontFamily: "inherit" }} />
          <span style={{ color: "#94a3b8", fontSize: 12 }}>ถึง</span>
          <input type="number" placeholder="สูงสุด" value={b.max_value ?? ""}
            onChange={e => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, max_value: e.target.value === "" ? null : Number(e.target.value) } : r))}
            style={{ width: 80, padding: "6px 8px", borderRadius: 4, border: "1.5px solid #dce4f5", fontSize: 12.5, fontFamily: "inherit" }} />
          <span style={{ color: "#94a3b8", fontSize: 12 }}>=</span>
          <input type="number" min={0} max={5} value={b.score}
            onChange={e => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, score: Number(e.target.value) } : r))}
            style={{ width: 56, padding: "6px 8px", borderRadius: 4, border: "1.5px solid #0038C6", fontSize: 12.5,
              fontFamily: "inherit", fontWeight: 700, color: "#0038C6" }} />
          <span style={{ color: "#94a3b8", fontSize: 11 }}>คะแนน</span>
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{ marginTop: 4, padding: "6px 16px", borderRadius: 8, border: "1.5px solid #0038C6",
          background: "#fff", color: "#0038C6", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
        {saving ? "กำลังบันทึก…" : "บันทึกเกณฑ์นี้"}
      </button>
    </div>
  );
}

export default function AdminConfig() {
  const [bands, setBands] = useState<Band[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/annual-eval/score-bands").then(r => r.json())
      .then((d: { ok: boolean; bands: Band[] }) => setBands(d.bands ?? []))
      .finally(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  const groups = new Map<string, Band[]>();
  for (const b of bands) {
    const key = `${b.metric}::${b.level_group ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(b);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 12 }}>ผู้ประเมินประจำตำแหน่ง</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <RoleAssignCard roleKey="quality_head" label="หัวหน้าส่วนงานคุณภาพ" />
          <RoleAssignCard roleKey="director" label="ผู้อำนวยการ / ผู้ได้รับมอบหมาย" />
        </div>
      </div>

      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#334155", marginBottom: 12 }}>
          เกณฑ์แปลงสถิติเป็นคะแนน (ลา/สาย/อบรม)
        </div>
        {loading ? (
          <div style={{ textAlign: "center", padding: 30, color: "#94a3b8" }}>กำลังโหลด…</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
            {[...groups.entries()].map(([key, grp]) => {
              const [metric, lg] = key.split("::");
              return <ScoreBandGroup key={key} metric={metric} levelGroup={lg || null} bands={grp} onSaved={load} />;
            })}
          </div>
        )}
      </div>
    </div>
  );
}
