import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";

interface Division { id: number; name: string; }
interface Department { id: number; name: string; division_id: number | null; division_name: string | null; }
interface Position { id: number; name: string; }

type Tab = "divisions" | "departments" | "positions";

export default function OrgPage() {
  const [tab, setTab] = useState<Tab>("divisions");

  return (
    <PageLayout title="จัดการฝ่าย / แผนก / ตำแหน่ง">
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["divisions", "departments", "positions"] as Tab[]).map(t => {
          const label = t === "divisions" ? "🏢 ฝ่าย" : t === "departments" ? "🏬 แผนก" : "💼 ตำแหน่ง";
          return (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: "8px 18px", borderRadius: 10, border: "1.5px solid",
              borderColor: tab === t ? "#16A34A" : "#e2e8f0",
              background: tab === t ? "#16A34A" : "#fff",
              color: tab === t ? "#fff" : "#475569",
              fontFamily: "inherit", fontSize: 14, cursor: "pointer", fontWeight: tab === t ? 700 : 400,
            }}>{label}</button>
          );
        })}
      </div>

      {tab === "divisions"   && <DivisionTab />}
      {tab === "departments" && <DepartmentTab />}
      {tab === "positions"   && <PositionTab />}
    </div>
    </PageLayout>
  );
}

/* ─── Divisions ─────────────────────────────────────────────────────── */
function DivisionTab() {
  const [items, setItems] = useState<Division[]>([]);
  const [name, setName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const d = await fetch("/api/admin/divisions").then(r => r.json()) as { divisions: Division[] };
    setItems(d.divisions ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/admin/divisions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setName(""); setSaving(false); load();
  }

  async function save(id: number) {
    await fetch(`/api/admin/divisions/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName }) });
    setEditId(null); load();
  }

  async function del(id: number) {
    if (!confirm("ลบฝ่ายนี้?")) return;
    await fetch(`/api/admin/divisions/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <OrgList
      items={items} name={name} setName={setName} saving={saving}
      onCreate={create} onDelete={del}
      editId={editId} editName={editName}
      onEditStart={(id, n) => { setEditId(id); setEditName(n); }}
      onEditSave={save} onEditCancel={() => setEditId(null)}
      setEditName={setEditName}
      placeholder="ชื่อฝ่ายใหม่ เช่น ฝ่ายการพยาบาล"
    />
  );
}

/* ─── Departments ────────────────────────────────────────────────────── */
function DepartmentTab() {
  const [items, setItems] = useState<Department[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [name, setName] = useState("");
  const [divId, setDivId] = useState<number | "">("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editDivId, setEditDivId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [dd, dv] = await Promise.all([
      fetch("/api/admin/departments").then(r => r.json()) as Promise<{ departments: Department[] }>,
      fetch("/api/admin/divisions").then(r => r.json()) as Promise<{ divisions: Division[] }>,
    ]);
    setItems(dd.departments ?? []);
    setDivisions(dv.divisions ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/admin/departments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, division_id: divId || null }) });
    setName(""); setDivId(""); setSaving(false); load();
  }

  async function save(id: number) {
    await fetch(`/api/admin/departments/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName, division_id: editDivId || null }) });
    setEditId(null); load();
  }

  async function del(id: number) {
    if (!confirm("ลบแผนกนี้?")) return;
    await fetch(`/api/admin/departments/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      {/* Add form */}
      <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อแผนกใหม่" style={inp} />
        <select value={divId} onChange={e => setDivId(e.target.value ? Number(e.target.value) : "")} style={{ ...inp, width: "auto", minWidth: 160 }}>
          <option value="">-- สังกัดฝ่าย --</option>
          {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button onClick={create} disabled={saving || !name.trim()} style={btnGreen}>+ เพิ่ม</button>
      </div>
      {/* List */}
      <div style={{ display: "grid", gap: 8 }}>
        {items.map(item => (
          <div key={item.id} style={card}>
            {editId === item.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, flex: 1 }} />
                <select value={editDivId} onChange={e => setEditDivId(e.target.value ? Number(e.target.value) : "")} style={{ ...inp, width: "auto", minWidth: 140 }}>
                  <option value="">-- ฝ่าย --</option>
                  {divisions.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
                <button onClick={() => save(item.id)} style={btnGreen}>บันทึก</button>
                <button onClick={() => setEditId(null)} style={btnGray}>ยกเลิก</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                  {item.division_name && <div style={{ fontSize: 12, color: "#94a3b8" }}>{item.division_name}</div>}
                </div>
                <button onClick={() => { setEditId(item.id); setEditName(item.name); setEditDivId(item.division_id ?? ""); }} style={btnGray}>แก้ไข</button>
                <button onClick={() => del(item.id)} style={btnRed}>ลบ</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Positions ──────────────────────────────────────────────────────── */
function PositionTab() {
  const [items, setItems] = useState<Position[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const d = await fetch("/api/eval/templates").then(r => r.json()) as { templates: Position[] };
    setItems(d.templates ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/eval/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setName(""); setSaving(false); load();
  }

  async function save(id: number) {
    await fetch(`/api/eval/templates/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editName }) });
    setEditId(null); load();
  }

  async function del(id: number) {
    if (!confirm("ลบตำแหน่งนี้? (จะลบแบบประเมินที่เกี่ยวข้องด้วย)")) return;
    await fetch(`/api/eval/templates/${id}`, { method: "DELETE" });
    load();
  }

  const filtered = search.trim() ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase())) : items;

  return (
    <div>
      <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="ชื่อตำแหน่งใหม่" style={inp} />
        <button onClick={create} disabled={saving || !name.trim()} style={btnGreen}>+ เพิ่ม</button>
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาตำแหน่ง…" style={{ ...inp, marginBottom: 12 }} />
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>ทั้งหมด {filtered.length} ตำแหน่ง</div>
      <div style={{ display: "grid", gap: 6 }}>
        {filtered.map(item => (
          <div key={item.id} style={card}>
            {editId === item.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, flex: 1 }} />
                <button onClick={() => save(item.id)} style={btnGreen}>บันทึก</button>
                <button onClick={() => setEditId(null)} style={btnGray}>ยกเลิก</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontSize: 14 }}>{item.name}</div>
                <button onClick={() => { setEditId(item.id); setEditName(item.name); }} style={btnGray}>แก้ไข</button>
                <button onClick={() => del(item.id)} style={btnRed}>ลบ</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared OrgList for Divisions ──────────────────────────────────── */
function OrgList({ items, name, setName, saving, onCreate, onDelete, editId, editName, onEditStart, onEditSave, onEditCancel, setEditName, placeholder }:
  { items: { id: number; name: string }[]; name: string; setName: (v: string) => void; saving: boolean;
    onCreate: () => void; onDelete: (id: number) => void;
    editId: number | null; editName: string; setEditName: (v: string) => void;
    onEditStart: (id: number, name: string) => void; onEditSave: (id: number) => void;
    onEditCancel: () => void; placeholder: string; }) {
  return (
    <div>
      <div style={{ background: "#f8fafc", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={placeholder} style={inp}
          onKeyDown={e => e.key === "Enter" && onCreate()} />
        <button onClick={onCreate} disabled={saving || !name.trim()} style={btnGreen}>+ เพิ่ม</button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {items.map(item => (
          <div key={item.id} style={card}>
            {editId === item.id ? (
              <>
                <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, flex: 1 }}
                  onKeyDown={e => e.key === "Enter" && onEditSave(item.id)} autoFocus />
                <button onClick={() => onEditSave(item.id)} style={btnGreen}>บันทึก</button>
                <button onClick={onEditCancel} style={btnGray}>ยกเลิก</button>
              </>
            ) : (
              <>
                <div style={{ flex: 1, fontWeight: 600, fontSize: 14 }}>{item.name}</div>
                <button onClick={() => onEditStart(item.id, item.name)} style={btnGray}>แก้ไข</button>
                <button onClick={() => onDelete(item.id)} style={btnRed}>ลบ</button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Shared styles ─────────────────────────────────────────────────── */
const inp: React.CSSProperties = { flex: 1, padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", outline: "none" };
const card: React.CSSProperties = { background: "#fff", borderRadius: 10, padding: "10px 14px", boxShadow: "0 1px 3px rgba(0,0,0,.06)", display: "flex", alignItems: "center", gap: 8 };
const btnGreen: React.CSSProperties = { padding: "7px 16px", borderRadius: 8, border: "none", background: "#16A34A", color: "#fff", fontFamily: "inherit", fontSize: 13, cursor: "pointer", whiteSpace: "nowrap", fontWeight: 600 };
const btnGray: React.CSSProperties  = { padding: "6px 12px", borderRadius: 8, border: "1.5px solid #e2e8f0", background: "#fff", fontFamily: "inherit", fontSize: 12, cursor: "pointer" };
const btnRed: React.CSSProperties   = { padding: "6px 12px", borderRadius: 8, border: "1.5px solid #fee2e2", background: "#fff", color: "#dc2626", fontFamily: "inherit", fontSize: 12, cursor: "pointer" };
