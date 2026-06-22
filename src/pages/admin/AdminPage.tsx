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
const ROLE_COLOR: Record<string, string> = { hr: "#0891b2", head: "#7c3aed", deputy: "#e0533d", deputyHR: "#e0533d", admin: "#16a34a" };

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
    <PageLayout title="จัดการผู้ใช้งาน" accent="#16a34a">
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 14, marginBottom: 24 }}>
        {[
          { label: "ผู้ใช้ทั้งหมด", value: users.length, color: "#16a34a" },
          { label: "ใช้งานอยู่", value: active, color: "#0891b2" },
          { label: "ปิดการใช้งาน", value: users.length - active, color: "#94a3b8" },
        ].map(s => (
          <div key={s.label} style={{ background: "#fff", borderRadius: 14, padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,.07)" }}>
            <div style={{ fontSize: 12, color: "#64748b" }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 ค้นหาชื่อ / username…"
          style={{ padding: "8px 14px", borderRadius: 10, border: "1.5px solid #e2e8f0", fontSize: 13, fontFamily: "inherit", width: 240 }} />
        <button onClick={() => setShowNew(true)}
          style={{ marginLeft: "auto", padding: "9px 20px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          + เพิ่มผู้ใช้งาน
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>กำลังโหลด…</div>
      ) : (
        <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 1px 4px rgba(0,0,0,.07)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc" }}>
                {["#", "ชื่อ-นามสกุล", "Username", "สิทธิ์", "แผนก/ฝ่าย", "สถานะ", ""].map(h => (
                  <th key={h} style={{ padding: "11px 16px", textAlign: "left", fontWeight: 600, color: "#475569", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap", fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#fafafa", opacity: u.is_active ? 1 : 0.5 }}>
                  <td style={{ padding: "11px 16px", color: "#94a3b8", width: 36 }}>{i + 1}</td>
                  <td style={{ padding: "11px 16px", fontWeight: 600 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 10, background: (ROLE_COLOR[u.role] ?? "#94a3b8") + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: ROLE_COLOR[u.role] ?? "#94a3b8" }}>
                        {u.full_name.charAt(0)}
                      </div>
                      {u.full_name}
                    </div>
                  </td>
                  <td style={{ padding: "11px 16px", color: "#64748b", fontFamily: "monospace" }}>{u.username}</td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ background: (ROLE_COLOR[u.role] ?? "#94a3b8") + "22", color: ROLE_COLOR[u.role] ?? "#94a3b8", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px", color: "#64748b" }}>
                    {u.role === "head"
                      ? (u.department_name ?? "—")
                      : (u.division_name ?? "—")}
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <span style={{ background: u.is_active ? "#dcfce7" : "#f1f5f9", color: u.is_active ? "#16a34a" : "#94a3b8", borderRadius: 7, padding: "3px 10px", fontSize: 12, fontWeight: 600 }}>
                      {u.is_active ? "ใช้งาน" : "ปิดใช้งาน"}
                    </span>
                  </td>
                  <td style={{ padding: "11px 16px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setEditing(u)}
                        style={{ padding: "5px 12px", borderRadius: 7, border: "1.5px solid #e2e8f0", background: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
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
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 32, width: "100%", maxWidth: 400, boxShadow: "0 24px 60px rgba(0,0,0,.25)" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🗑️</div>
            <div style={{ fontSize: 17, fontWeight: 700, textAlign: "center", marginBottom: 8 }}>ยืนยันการลบผู้ใช้</div>
            <div style={{ fontSize: 14, color: "#64748b", textAlign: "center", marginBottom: 6 }}>
              คุณต้องการลบ <strong style={{ color: "#0f172a" }}>{confirmDelete.full_name}</strong> ออกจากระบบ?
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
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "1.5px solid #e2e8f0", background: "#fff", cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>
                ยกเลิก
              </button>
              <button onClick={deleteUser} disabled={deleting}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: "#dc2626", color: "#fff", fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 14 }}>
                {deleting ? "กำลังลบ…" : "ยืนยันลบ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
