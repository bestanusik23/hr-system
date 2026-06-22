import { useEffect, useState } from "react";
import PageLayout from "../../components/PageLayout";
import UserForm from "./UserForm";

interface UserRow {
  id: number; username: string; full_name: string; role: string;
  scope_division_id: number | null; scope_department_id: number | null;
  division_name: string | null; department_name: string | null;
  is_active: number; created_at: string;
}

const ROLE_LABEL: Record<string, string> = { hr: "HR", head: "หัวหน้าแผนก", deputy: "รองผู้อำนวยการ", deputyHR: "รองผู้อำนวยการ (HR)", admin: "ผู้ดูแลระบบ" };
const ROLE_COLOR: Record<string, string> = { hr: "#0038C6", head: "#1d4ed8", deputy: "#0050FF", deputyHR: "#0050FF", admin: "#16a34a" };

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function deleteUser() {
    if (!confirmDelete) return;
    setDeleting(true); setDeleteError("");
    const r = await fetch(`/api/admin/users/${confirmDelete.id}`, { method: "DELETE" });
    const d = await r.json() as { ok: boolean; error?: string };
    setDeleting(false);
    if (!d.ok) { setDeleteError(d.error ?? "เกิดข้อผิดพลาด"); return; }
    setConfirmDelete(null);
    load();
  }

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/users");
    const d = await r.json() as { ok: boolean; users: UserRow[] };
    setUsers(d.users ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = users.filter(u =>
    !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.username.toLowerCase().includes(search.toLowerCase())
  );

  const active = users.filter(u => u.is_active).length;

  return (
    <PageLayout title="จัดการผู้ใช้งาน" accent="#0038C6">
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "ผู้ใช้ทั้งหมด", value: users.length, color: "#0038C6" },
          { label: "ใช้งานอยู่", value: active, color: "#16a34a" },
          { label: "ปิดการใช้งาน", value: users.length - active, color: "#94a3b8" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 8, padding: "18px 22px", border: "1px solid #dce4f5", borderLeft: "4px solid #0038C6" }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 6 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อ / username…"
          style={{ padding: "9px 14px", borderRadius: 7, border: "1.5px solid #c4cfee", fontSize: 13, fontFamily: "inherit", width: 240, outline: "none" }} />
        <button onClick={() => setShowNew(true)}
          style={{ marginLeft: "auto", padding: "10px 22px", borderRadius: 8, border: "none", background: "#0038C6", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 2px 8px rgba(0,56,198,0.25)" }}>
          + เพิ่มผู้ใช้งาน
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 8, border: "1px solid #dce4f5", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f4f7ff" }}>
                {["#", "ชื่อ-นามสกุล", "Username", "สิทธิ์", "แผนก/ฝ่าย", "สถานะ", ""].map(h => (
                  <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "2px solid #dce4f5", whiteSpace: "nowrap", fontSize: 11, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f0f5ff", background: i % 2 === 0 ? "#fff" : "#fafcff", opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: "11px 16px", color: "#94a3b8", width: 36 }}>{i + 1}</td>
                  <td style={{ padding: "11px 16px", fontWeight: 600, color: "#0a1628" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: (ROLE_COLOR[u.role] ?? "#94a3b8") + "1c", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: ROLE_COLOR[u.role] ?? "#94a3b8" }}>
                        {u.full_name.charAt(0)}
                      </div>
                      {u.full_name}
                    </div>
                  </td>
                  <td style={{ padding: "11px 16px", color: "#64748b", fontFamily: "monospace" }}>{u.username}</td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ background: (ROLE_COLOR[u.role] ?? "#94a3b8") + "1c", color: ROLE_COLOR[u.role] ?? "#94a3b8", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px", color: "#64748b" }}>
                    {u.role === "head"
                      ? (u.department_name ?? "—")
                      : (u.division_name ?? "—")}
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ background: u.is_active ? "#dcfce7" : "#f1f5f9", color: u.is_active ? "#16a34a" : "#94a3b8", borderRadius: 6, padding: "3px 10px", fontSize: 12, fontWeight: 700 }}>
                      {u.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setEditing(u)}
                        style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #c4cfee", background: "#fff", color: "#0038C6", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        ✏️ แก้ไข
                      </button>
                      <button onClick={() => { setDeleteError(""); setConfirmDelete(u); }}
                        style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #fecaca", background: "#fee2e2", color: "#dc2626", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                        🗑 ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <UserForm user={null} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); load(); }} />}
      {editing && <UserForm user={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div onClick={e => { if (e.target === e.currentTarget && !deleting) setConfirmDelete(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(10,22,56,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 10, padding: 32, width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,56,198,0.25)", border: "1px solid #c4cfee", borderTop: "4px solid #dc2626" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1628", textAlign: "center", marginBottom: 8 }}>ยืนยันการลบผู้ใช้</div>
            <div style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 6 }}>
              คุณต้องการลบ <strong style={{ color: "#0a1628" }}>{confirmDelete.full_name}</strong> ออกจากระบบ?
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", marginBottom: 20 }}>
              ({confirmDelete.username} · {ROLE_LABEL[confirmDelete.role] ?? confirmDelete.role})
            </div>
            <div style={{ background: "#fff8ed", border: "1px solid #fde68a", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 20 }}>
              ⚠️ การลบไม่สามารถย้อนกลับได้ ข้อมูลผู้ใช้จะหายถาวร
            </div>
            {deleteError && (
              <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#dc2626", marginBottom: 16 }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "1.5px solid #c4cfee", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                ยกเลิก
              </button>
              <button onClick={deleteUser} disabled={deleting}
                style={{ flex: 1, padding: "11px 0", borderRadius: 7, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>
                {deleting ? "กำลังลบ…" : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
