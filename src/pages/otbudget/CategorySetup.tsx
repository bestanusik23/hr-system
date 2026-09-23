import { useEffect, useState } from "react";
import { type OtCategory, groupCategories } from "./otBudgetApi";

const NAVY = "#1F3864";

export default function CategorySetup() {
  const [categories, setCategories] = useState<OtCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupName, setGroupName] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    fetch("/api/ot-budget/categories").then(r => r.json())
      .then((d: { ok: boolean; categories: OtCategory[] }) => { if (d.ok) setCategories(d.categories); setLoading(false); })
      .catch(() => setLoading(false));
  }
  useEffect(() => { load(); }, []);

  async function addCategory() {
    setError("");
    if (!groupName.trim() || !name.trim()) { setError("ระบุกลุ่มและชื่อหมวด"); return; }
    setSaving(true);
    const res = await fetch("/api/ot-budget/categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_name: groupName.trim(), name: name.trim(), sort_order: categories.length + 1 }),
    });
    const d = await res.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!d.ok) { setError(d.error ?? "บันทึกไม่สำเร็จ"); return; }
    setGroupName(""); setName("");
    load();
  }

  async function removeCategory(id: number) {
    if (!window.confirm("ปิดใช้งานหมวดนี้? (ข้อมูลย้อนหลังจะยังอยู่ แต่จะไม่แสดงในรายงาน/ฟอร์มกรอกอีก)")) return;
    await fetch(`/api/ot-budget/categories?id=${id}`, { method: "DELETE" });
    load();
  }

  async function renameCategory(cat: OtCategory, field: "group_name" | "name", value: string) {
    await fetch("/api/ot-budget/categories", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: cat.id, [field]: value }),
    });
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>กำลังโหลด…</div>;
  const groups = groupCategories(categories);

  return (
    <div style={{ fontFamily: "'Sarabun', sans-serif", maxWidth: 700 }}>
      <div style={{ background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
        <div style={{ fontWeight: 800, color: NAVY, marginBottom: 10 }}>เพิ่มหมวดใหม่</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="ชื่อกลุ่ม เช่น RN + Na"
            style={{ flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit" }} />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อหมวด เช่น RN"
            style={{ flex: 1, minWidth: 160, padding: "8px 12px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit" }} />
          <button onClick={addCategory} disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, border: "none",
            background: NAVY, color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            {saving ? "กำลังเพิ่ม…" : "+ เพิ่มหมวด"}
          </button>
        </div>
        {error && <div style={{ color: "#dc2626", fontSize: 12, marginTop: 8 }}>{error}</div>}
        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
          หมวดเดี่ยว (ไม่มีกลุ่มย่อย) ให้ใส่ชื่อกลุ่มซ้ำกับชื่อหมวด เช่น บัญชี/IT
        </div>
      </div>

      {groups.map(g => (
        <div key={g.group_name} style={{ background: "#fff", border: "1px solid #E6EBF5", borderRadius: 12,
          padding: "12px 16px", marginBottom: 10 }}>
          <div style={{ fontWeight: 800, color: NAVY, marginBottom: 8, fontSize: 13.5 }}>{g.group_name}</div>
          {g.categories.map(c => (
            <div key={c.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
              <input defaultValue={c.group_name} onBlur={e => renameCategory(c, "group_name", e.target.value)}
                style={{ width: 160, padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit", fontSize: 13 }} />
              <input defaultValue={c.name} onBlur={e => renameCategory(c, "name", e.target.value)}
                style={{ flex: 1, padding: "6px 10px", borderRadius: 8, border: "1px solid #E6EBF5", fontFamily: "inherit", fontSize: 13 }} />
              <button onClick={() => removeCategory(c.id)} style={{ background: "#fee2e2", border: "none",
                borderRadius: 8, padding: "6px 12px", cursor: "pointer", fontSize: 12, color: "#dc2626", fontFamily: "inherit" }}>
                ปิดใช้งาน
              </button>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
