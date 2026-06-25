import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface CheckItem {
  key: string; label: string;
  completed: boolean; completed_at: string | null; note: string | null;
}

interface Props {
  employeeId: number;
  employeeName: string;
  onClose: () => void;
}

export default function ExitChecklistModal({ employeeId, employeeName, onClose }: Props) {
  const { user } = useAuth();
  const isHR = user && ["hr", "admin"].includes(user.role);
  const [items, setItems] = useState<CheckItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/manpower/exit-checklist?employee_id=${employeeId}`)
      .then(r => r.json())
      .then((d: { ok: boolean; items: CheckItem[] }) => {
        if (d.ok) setItems(d.items);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [employeeId]);

  async function toggle(key: string, currentVal: boolean) {
    if (!isHR) return;
    setSaving(key);
    const res = await fetch("/api/manpower/exit-checklist", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, key, completed: !currentVal }),
    });
    const d = await res.json() as { ok: boolean };
    if (d.ok) {
      setItems(prev => prev.map(i =>
        i.key === key ? { ...i, completed: !currentVal, completed_at: !currentVal ? new Date().toISOString() : null } : i
      ));
    }
    setSaving(null);
  }

  const done  = items.filter(i => i.completed).length;
  const total = items.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.5)", display: "flex",
        alignItems: "center", justifyContent: "center", zIndex: 400, padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 500,
        boxShadow: "0 32px 80px rgba(0,0,0,.3)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "linear-gradient(135deg,#dc2626,#b91c1c)", padding: "22px 28px 18px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,.7)",
                letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>Exit Clearance Checklist</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{employeeName}</div>
            </div>
            <button onClick={onClose}
              style={{ border: "none", background: "rgba(255,255,255,.15)", color: "#fff",
                borderRadius: 10, width: 36, height: 36, cursor: "pointer", fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>×</button>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,.8)", fontWeight: 600 }}>
                {done}/{total} รายการ
              </span>
              <span style={{ fontSize: 13, fontWeight: 800,
                color: pct === 100 ? "#86efac" : "rgba(255,255,255,.9)" }}>
                {pct === 100 ? "✅ ครบแล้ว" : `${pct}%`}
              </span>
            </div>
            <div style={{ background: "rgba(255,255,255,.2)", borderRadius: 8, height: 8, overflow: "hidden" }}>
              <div style={{ background: pct === 100 ? "#4ade80" : "#fff",
                width: `${pct}%`, height: "100%", borderRadius: 8, transition: "width .4s ease" }} />
            </div>
          </div>
        </div>

        {/* Items */}
        <div style={{ padding: "20px 28px 28px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>กำลังโหลด…</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {items.map((item, idx) => (
                <div key={item.key}
                  onClick={() => toggle(item.key, item.completed)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "14px 18px",
                    borderRadius: 12, border: `2px solid ${item.completed ? "#bbf7d0" : "#fecaca"}`,
                    background: item.completed ? "#f0fdf4" : "#fff5f5",
                    cursor: isHR ? "pointer" : "default",
                    transition: "all .2s", opacity: saving === item.key ? 0.6 : 1,
                  }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                    background: item.completed ? "#16a34a" : "#fff",
                    border: `2px solid ${item.completed ? "#16a34a" : "#fca5a5"}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, color: "#fff", transition: "all .2s",
                  }}>
                    {item.completed ? "✓" : <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 700 }}>{idx + 1}</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14,
                      color: item.completed ? "#15803d" : "#dc2626",
                      textDecoration: item.completed ? "line-through" : "none", opacity: item.completed ? 0.8 : 1 }}>
                      {item.label}
                    </div>
                    {item.completed && item.completed_at && (
                      <div style={{ fontSize: 11, color: "#16a34a", marginTop: 3 }}>
                        เสร็จ {new Date(item.completed_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    )}
                  </div>
                  {saving === item.key && (
                    <div style={{ width: 20, height: 20, border: "2px solid #dc2626",
                      borderTopColor: "transparent", borderRadius: "50%",
                      animation: "spin .7s linear infinite" }} />
                  )}
                </div>
              ))}
            </div>
          )}

          {!isHR && (
            <div style={{ marginTop: 16, padding: "10px 16px", background: "#f1f5f9", borderRadius: 10,
              fontSize: 12, color: "#64748b", textAlign: "center" }}>
              เฉพาะ HR เท่านั้นที่สามารถอัปเดตรายการนี้ได้
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
